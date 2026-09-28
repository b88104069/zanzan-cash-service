import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import type { LegacyExport } from './legacyTypes.js';
import {
  toStandaloneAccount,
  toStandaloneCashEntry,
  toStandaloneCategory,
  toStandaloneMembership,
  toStandaloneTenant,
  toStandaloneUser,
} from './transform.js';
import { summarize, verifyMigration, type DestinationSnapshot } from './verify.js';

/**
 * Gate 4 migration dry-run driver. Per the Kickoff's explicit Gate 4 scope:
 * schema mapping + migration script + fixture/synthetic-data dry-run ONLY —
 * this script refuses to run against anything that isn't clearly a
 * dry-run/throwaway database, and there is no code path anywhere in this
 * directory that reads from or writes to a production database.
 */

const DRY_RUN_DATABASE_URL = process.env.MIGRATION_DRYRUN_DATABASE_URL;

if (!DRY_RUN_DATABASE_URL) {
  console.error('MIGRATION_DRYRUN_DATABASE_URL is not set. Refusing to run — see scripts/migration/README.md.');
  process.exit(1);
}

if (!/dryrun|migration_test|migration_dry/i.test(DRY_RUN_DATABASE_URL)) {
  console.error(
    'MIGRATION_DRYRUN_DATABASE_URL does not look like a dry-run database name (expected it to contain ' +
      '"dryrun" or similar). Refusing to run against what might be a real database. ' +
      'See scripts/migration/README.md.',
  );
  process.exit(1);
}

const dryRunDatabaseUrl: string = DRY_RUN_DATABASE_URL;

const fixturePath = process.argv[2] ?? fileURLToPath(new URL('./fixtures/legacy-sample.json', import.meta.url));
const source: LegacyExport = JSON.parse(readFileSync(fixturePath, 'utf-8'));

const prisma = new PrismaClient({ datasources: { db: { url: dryRunDatabaseUrl } } });

async function resetDryRunDatabase(): Promise<void> {
  // FK-safe order. This is what makes the dry run repeatable — see
  // Kickoff Gate 4 PASS criteria ("migration dry-run is repeatable").
  await prisma.cashEntry.deleteMany();
  await prisma.tenantMembership.deleteMany();
  await prisma.account.deleteMany();
  await prisma.category.deleteMany();
  await prisma.tenant.deleteMany();
  await prisma.user.deleteMany();
}

async function runMigration() {
  const userIdMap = new Map<number, string>();
  const tenantIdMap = new Map<number, string>();
  const accountIdMap = new Map<number, string>();

  await prisma.$transaction(async (tx) => {
    for (const legacyUser of source.wp_users) {
      const created = await tx.user.create({ data: toStandaloneUser(legacyUser) });
      userIdMap.set(legacyUser.ID, created.id);
    }

    for (const legacyTenant of source.zz_tenants) {
      const ownerId = userIdMap.get(legacyTenant.owner_user_id);
      if (!ownerId) throw new Error(`Tenant #${legacyTenant.id} references unknown owner_user_id ${legacyTenant.owner_user_id}`);
      const created = await tx.tenant.create({ data: toStandaloneTenant(legacyTenant, ownerId) });
      tenantIdMap.set(legacyTenant.id, created.id);
    }

    for (const legacyMembership of source.zz_tenant_users) {
      const tenantId = tenantIdMap.get(legacyMembership.tenant_id);
      const userId = userIdMap.get(legacyMembership.user_id);
      if (!tenantId || !userId) throw new Error(`Membership #${legacyMembership.id} references an unmapped tenant/user`);
      await tx.tenantMembership.create({ data: toStandaloneMembership(legacyMembership, tenantId, userId) });
    }

    for (const legacyAccount of source.zz_cash_accounts) {
      const tenantId = tenantIdMap.get(legacyAccount.tenant_id);
      if (!tenantId) throw new Error(`Account #${legacyAccount.id} references unmapped tenant ${legacyAccount.tenant_id}`);
      const created = await tx.account.create({ data: toStandaloneAccount(legacyAccount, tenantId) });
      accountIdMap.set(legacyAccount.id, created.id);
    }

    for (const legacyCategory of source.zz_cash_categories) {
      const tenantId = tenantIdMap.get(legacyCategory.tenant_id);
      if (!tenantId) throw new Error(`Category #${legacyCategory.id} references unmapped tenant ${legacyCategory.tenant_id}`);
      await tx.category.create({ data: toStandaloneCategory(legacyCategory, tenantId) });
    }

    for (const legacyEntry of source.zz_cash_entries) {
      const tenantId = tenantIdMap.get(legacyEntry.tenant_id);
      const accountId = accountIdMap.get(legacyEntry.account_id);
      const createdBy = userIdMap.get(legacyEntry.created_by);
      if (!tenantId || !accountId || !createdBy) {
        throw new Error(`Entry #${legacyEntry.id} references an unmapped tenant/account/user`);
      }
      await tx.cashEntry.create({ data: toStandaloneCashEntry(legacyEntry, tenantId, accountId, createdBy) });
    }
  });

  return { userIdMap, tenantIdMap, accountIdMap };
}

async function buildSnapshot(tenantIdMap: Map<number, string>, accountIdMap: Map<number, string>): Promise<DestinationSnapshot> {
  const [userCount, tenantCount, membershipCount, accountCount, categoryCount, entryCount] = await Promise.all([
    prisma.user.count(),
    prisma.tenant.count(),
    prisma.tenantMembership.count(),
    prisma.account.count(),
    prisma.category.count(),
    prisma.cashEntry.count(),
  ]);

  const accountBalances = new Map<string, number>();
  for (const standaloneAccountId of accountIdMap.values()) {
    const account = await prisma.account.findUniqueOrThrow({ where: { id: standaloneAccountId } });
    const agg = await prisma.cashEntry.aggregate({ where: { accountId: standaloneAccountId }, _sum: { income: true, expense: true } });
    const income = agg._sum.income ? Number(agg._sum.income) : 0;
    const expense = agg._sum.expense ? Number(agg._sum.expense) : 0;
    accountBalances.set(standaloneAccountId, Number(account.openingBalance) + income - expense);
  }

  const tenantTotals = new Map<string, { income: number; expense: number }>();
  for (const standaloneTenantId of tenantIdMap.values()) {
    const agg = await prisma.cashEntry.aggregate({
      where: { tenantId: standaloneTenantId, transferCode: null },
      _sum: { income: true, expense: true },
    });
    tenantTotals.set(standaloneTenantId, {
      income: agg._sum.income ? Number(agg._sum.income) : 0,
      expense: agg._sum.expense ? Number(agg._sum.expense) : 0,
    });
  }

  const transferGroups = await prisma.cashEntry.groupBy({ by: ['transferCode'], where: { transferCode: { not: null } }, _count: true });
  const transferCodeCounts = new Map<string, number>();
  for (const group of transferGroups) {
    if (group.transferCode) transferCodeCounts.set(group.transferCode, group._count);
  }

  return {
    userCount,
    tenantCount,
    membershipCount,
    accountCount,
    categoryCount,
    entryCount,
    accountBalances,
    tenantTotals,
    transferCodeCounts,
    accountIdMap,
    tenantIdMap,
  };
}

async function main() {
  console.log(`Migration dry run — fixture: ${fixturePath}`);
  console.log(`Target (dry-run) database: ${dryRunDatabaseUrl.replace(/:[^:@]+@/, ':***@')}`);

  await resetDryRunDatabase();
  const { tenantIdMap, accountIdMap } = await runMigration();
  const snapshot = await buildSnapshot(tenantIdMap, accountIdMap);

  const checks = verifyMigration(source, snapshot);
  const { allPassed, passedCount, total } = summarize(checks);

  console.log(`\nVerification: ${passedCount}/${total} checks passed\n`);
  for (const check of checks) {
    console.log(`${check.passed ? '✓' : '✗'} ${check.name}${check.detail ? ` — ${check.detail}` : ''}`);
  }

  await prisma.$disconnect();

  if (!allPassed) {
    console.error('\nMigration dry run FAILED verification.');
    process.exit(1);
  }
  console.log('\nMigration dry run PASSED verification.');
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
