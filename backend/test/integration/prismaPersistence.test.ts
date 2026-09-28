import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaUnitOfWork } from '../../src/infra/prisma/PrismaUnitOfWork.js';
import { createIntegrationHarness, createTestUser, prisma, resetDatabase } from './testHarness.js';

// These tests run against a REAL MySQL database (zanzan_cash_test), not the
// in-memory store Gate 2's characterization tests use. This is what the
// Gate 2 review explicitly required before Gate 3 could be considered
// complete: "Gate 3/4 must verify real DB transaction, rollback and
// constraint behavior" (reports/gate-2-delta-report.md GATE REVIEW RESULT).

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await resetDatabase();
  await prisma.$disconnect();
});

describe('Prisma persistence — transactions', () => {
  it('tenant creation + seed persists atomically across 4 tables in one real transaction', async () => {
    const harness = createIntegrationHarness();
    const user = await createTestUser();

    const tenant = await harness.tenantService.createTenant({ ownerUserId: user.id, companyName: '真實資料庫測試公司' });

    const [membershipCount, accountCount, categoryCount] = await Promise.all([
      prisma.tenantMembership.count({ where: { tenantId: tenant.id } }),
      prisma.account.count({ where: { tenantId: tenant.id } }),
      prisma.category.count({ where: { tenantId: tenant.id } }),
    ]);

    expect(membershipCount).toBe(1);
    expect(accountCount).toBe(1);
    expect(categoryCount).toBe(4);
  });

  it('rolls back ALL writes when a later step in the transaction fails (real DB rollback, not simulated)', async () => {
    const uow = new PrismaUnitOfWork(prisma);
    const user = await createTestUser();

    await expect(
      uow.runInTransaction(async (repos) => {
        const tenant = await repos.tenants.create({
          companyName: 'Should Not Survive',
          ownerUserId: user.id,
          planCode: 'simple-cash-saas',
          status: 'active',
          createdAt: new Date(),
        });

        // First insert succeeds...
        await repos.categories.create({
          tenantId: tenant.id,
          categoryName: '重複科目',
          categoryType: 'expense',
          status: 'active',
          createdAt: new Date(),
        });
        // ...second insert violates the real DB unique constraint on
        // (tenantId, categoryName, categoryType) — this must abort the
        // WHOLE transaction, including the tenant insert above.
        await repos.categories.create({
          tenantId: tenant.id,
          categoryName: '重複科目',
          categoryType: 'expense',
          status: 'active',
          createdAt: new Date(),
        });

        return tenant;
      }),
    ).rejects.toThrow();

    const tenantCount = await prisma.tenant.count();
    const categoryCount = await prisma.category.count();
    expect(tenantCount).toBe(0);
    expect(categoryCount).toBe(0);
  });

  it('transfer creation persists both linked entries atomically (real DB rows)', async () => {
    const harness = createIntegrationHarness();
    const user = await createTestUser();
    const tenant = await harness.tenantService.createTenant({ ownerUserId: user.id, companyName: '轉帳測試公司' });
    await harness.accountService.createAccount(tenant.id, { accountName: '銀行' });

    const result = await harness.transferService.createTransfer(tenant.id, user.id, {
      entryDate: '2026-01-15',
      fromAccountName: '現金',
      toAccountName: '銀行',
      amount: 500,
    });

    const rows = await prisma.cashEntry.findMany({ where: { tenantId: tenant.id, transferCode: result.transferCode } });
    expect(rows).toHaveLength(2);
  });

  it('deleting a transfer pair removes both real rows, not just the one requested', async () => {
    const harness = createIntegrationHarness();
    const user = await createTestUser();
    const tenant = await harness.tenantService.createTenant({ ownerUserId: user.id, companyName: '轉帳刪除測試公司' });
    await harness.accountService.createAccount(tenant.id, { accountName: '銀行' });
    const { entries, transferCode } = await harness.transferService.createTransfer(tenant.id, user.id, {
      entryDate: '2026-01-16',
      fromAccountName: '現金',
      toAccountName: '銀行',
      amount: 250,
    });

    await harness.cashEntryService.deleteEntry(tenant.id, entries[0].id);

    const remaining = await prisma.cashEntry.count({ where: { tenantId: tenant.id, transferCode } });
    expect(remaining).toBe(0);
  });
});

describe('Prisma persistence — constraints', () => {
  it('the DB itself enforces unique account names per tenant, independent of app-layer checks', async () => {
    const harness = createIntegrationHarness();
    const user = await createTestUser();
    const tenant = await harness.tenantService.createTenant({ ownerUserId: user.id, companyName: '帳戶唯一性測試' });

    await harness.accountRepo.create({
      tenantId: tenant.id,
      accountName: '重複帳戶',
      accountType: 'cash',
      openingBalance: 0,
      status: 'active',
      createdAt: new Date(),
    });

    await expect(
      harness.accountRepo.create({
        tenantId: tenant.id,
        accountName: '重複帳戶',
        accountType: 'cash',
        openingBalance: 0,
        status: 'active',
        createdAt: new Date(),
      }),
    ).rejects.toThrow();
  });

  it('money amounts round-trip through DECIMAL(14,2) without floating-point drift', async () => {
    const harness = createIntegrationHarness();
    const user = await createTestUser();
    const tenant = await harness.tenantService.createTenant({ ownerUserId: user.id, companyName: '精度測試公司' });
    await harness.categoryService.createCategory(tenant.id, { categoryName: '薪水', categoryType: 'income' });

    const entry = await harness.cashEntryService.addEntry(tenant.id, user.id, {
      entryDate: '2026-01-20',
      memo: '精度測試',
      category: '薪水',
      accountName: '現金',
      income: 1234.56,
      expense: 0,
    });

    const reloaded = await harness.entryRepo.findById(tenant.id, entry.id);
    expect(reloaded?.income).toBe(1234.56);
  });
});
