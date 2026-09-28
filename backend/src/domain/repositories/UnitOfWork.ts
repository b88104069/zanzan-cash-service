import type { AccountRepository } from './AccountRepository.js';
import type { CategoryRepository } from './CategoryRepository.js';
import type { TenantRepository } from './TenantRepository.js';

export interface ProvisioningRepositories {
  tenants: TenantRepository;
  accounts: AccountRepository;
  categories: CategoryRepository;
}

/**
 * Delivers the real-transaction requirement Gate 2 deferred (see
 * reports/gate-2-delta-report.md DEVIATIONS: "real prisma.$transaction
 * wrapping is a tracked Gate 3+ carry-over"). Tenant creation + default
 * seed (membership + account + categories) must be atomic — either all of
 * it lands, or none of it does.
 *
 * The Prisma implementation runs `work` inside `prisma.$transaction`,
 * constructing repository instances bound to the transaction client so
 * every write inside `work` is part of the same transaction. The in-memory
 * implementation (Gate 2 test harness) just calls `work` with the existing
 * repositories — there is nothing to roll back in a synchronous in-memory
 * store, so this is intentionally a no-op wrapper there.
 */
export interface UnitOfWork {
  runInTransaction<T>(work: (repos: ProvisioningRepositories) => Promise<T>): Promise<T>;
}
