import type { Account, CashEntry, Category, Tenant, TenantMembership } from '../../domain/types.js';

let nextId = 1;
/** Simple incrementing id generator, good enough for Gate 2's in-memory store and tests. */
export function generateId(prefix: string): string {
  return `${prefix}_${nextId++}`;
}

/**
 * Backs every in-memory repository. Kept as one shared store (rather than
 * one per repository) so tests can assert cross-aggregate effects (e.g. a
 * transfer's two entries both landing correctly) and so a future real
 * transaction/unit-of-work wrapper has one place to snapshot.
 *
 * This is Gate 2 test/development infrastructure only — the real
 * persistence adapter (Prisma/MySQL, per docs/architecture/database-strategy.md)
 * is built when the API/deployment layers need it (Gate 3+), not here.
 */
export class InMemoryDatabase {
  readonly tenants = new Map<string, Tenant>();
  readonly memberships: TenantMembership[] = [];
  readonly accounts = new Map<string, Account>();
  readonly categories = new Map<string, Category>();
  readonly entries = new Map<string, CashEntry>();
}
