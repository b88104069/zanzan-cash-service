import type {
  LegacyAccount,
  LegacyCashEntry,
  LegacyCategory,
  LegacyTenant,
  LegacyTenantUser,
  LegacyWpUser,
} from './legacyTypes.js';

/**
 * WordPress hashes passwords with phpass, which this standalone service's
 * scrypt-based AuthService cannot verify against. A real production
 * cutover needs a forced password-reset flow for migrated users — this is
 * explicitly out of scope for Gate 4's dry run (no real user ever reaches
 * this path; see docs/migration/README.md follow-up note). This sentinel
 * makes that limitation visible rather than silently producing a
 * logged-in-capable account with an unknown password.
 */
export const MIGRATION_PLACEHOLDER_PASSWORD_HASH = 'MIGRATED_ACCOUNT_REQUIRES_PASSWORD_RESET';

function parseAmount(value: string): number {
  const n = Number(value);
  if (Number.isNaN(n)) throw new Error(`Non-numeric amount in legacy data: ${value}`);
  return n;
}

function toDate(mysqlDatetime: string): Date {
  return new Date(mysqlDatetime.replace(' ', 'T') + 'Z');
}

export function toStandaloneUser(row: LegacyWpUser) {
  return {
    email: row.user_email.trim().toLowerCase(),
    passwordHash: MIGRATION_PLACEHOLDER_PASSWORD_HASH,
    role: 'member' as const,
  };
}

export function toStandaloneTenant(row: LegacyTenant, ownerUserId: string) {
  return {
    companyName: row.company_name,
    ownerUserId,
    planCode: row.plan_code,
    status: row.status,
    createdAt: toDate(row.created_at),
  };
}

export function toStandaloneMembership(row: LegacyTenantUser, tenantId: string, userId: string) {
  return {
    tenantId,
    userId,
    tenantRole: row.tenant_role === 'owner' ? ('owner' as const) : ('owner' as const), // legacy only ever has 'owner'
    status: row.status,
    createdAt: toDate(row.created_at),
  };
}

export function toStandaloneAccount(row: LegacyAccount, tenantId: string) {
  return {
    tenantId,
    accountName: row.account_name,
    accountType: row.account_type,
    openingBalance: parseAmount(row.opening_balance),
    status: row.status,
    createdAt: toDate(row.created_at),
  };
}

export function toStandaloneCategory(row: LegacyCategory, tenantId: string) {
  return {
    tenantId,
    categoryName: row.category_name,
    categoryType: row.category_type,
    status: row.status,
    createdAt: toDate(row.created_at),
  };
}

/**
 * `category` is copied verbatim as a string — see
 * docs/architecture/category-decision.md. No lookup/reconciliation against
 * the categories table is performed, deliberately: that's the whole point
 * of the preserve decision.
 */
export function toStandaloneCashEntry(row: LegacyCashEntry, tenantId: string, accountId: string, createdBy: string) {
  return {
    tenantId,
    entryDate: new Date(`${row.entry_date}T00:00:00.000Z`),
    memo: row.memo,
    category: row.category,
    accountId,
    income: parseAmount(row.income),
    expense: parseAmount(row.expense),
    note: row.note || null,
    // Legacy convention: '' means "not a transfer" (see
    // docs/architecture/domain-boundaries.md). Standalone schema uses NULL
    // for the same meaning (Gate 3's schema.prisma).
    transferCode: row.transfer_code ? row.transfer_code : null,
    createdBy,
    createdAt: toDate(row.created_at),
  };
}
