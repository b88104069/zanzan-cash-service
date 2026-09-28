// Core domain types for the standalone Cash Service.
//
// These are the standalone equivalents of the legacy plugin's five DB
// tables (see docs/architecture/legacy-architecture-map.md). Deliberately
// framework-agnostic: no ORM decorators, no HTTP types, no WordPress types.

export type Status = 'active' | 'inactive';
export type CategoryType = 'income' | 'expense';
export type TenantRole = 'owner';
export type UserRole = 'member' | 'platform_admin';

/**
 * Standalone identity (Gate 3) — replaces WordPress user records. See
 * docs/architecture/auth-entitlement-abstraction.md. `platform_admin`
 * mirrors the legacy `manage_options` capability: bypasses entitlement
 * checks but still needs a bound tenant for tenant-scoped endpoints
 * (domain-boundaries.md → Entitlement).
 */
export interface User {
  id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  createdAt: Date;
}

export interface Tenant {
  id: string;
  companyName: string;
  ownerUserId: string;
  planCode: string;
  status: Status;
  createdAt: Date;
}

export interface TenantMembership {
  tenantId: string;
  userId: string;
  role: TenantRole;
  status: Status;
  createdAt: Date;
}

export interface Account {
  id: string;
  tenantId: string;
  accountName: string;
  accountType: string;
  openingBalance: number;
  status: Status;
  createdAt: Date;
}

export interface Category {
  id: string;
  tenantId: string;
  categoryName: string;
  categoryType: CategoryType;
  status: Status;
  createdAt: Date;
}

export interface CashEntry {
  id: string;
  tenantId: string;
  entryDate: string; // ISO date (YYYY-MM-DD), matches legacy `entry_date`
  memo: string;
  category: string; // free-text, matches legacy column — see domain-boundaries.md
  accountId: string;
  income: number;
  expense: number;
  note: string;
  transferCode: string | null;
  createdBy: string;
  createdAt: Date;
}

/** Default categories/account seeded for every new tenant. See T1. */
export const DEFAULT_SEED_ACCOUNT_NAME = '現金';
export const DEFAULT_SEED_CATEGORIES: ReadonlyArray<{ name: string; type: CategoryType }> = [
  { name: '餐費', type: 'expense' },
  { name: '交通', type: 'expense' },
  { name: '住宿', type: 'expense' },
  { name: '一般收入', type: 'income' },
];
