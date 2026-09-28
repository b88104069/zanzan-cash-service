import type { ProvisioningRepositories, UnitOfWork } from '../../domain/repositories/UnitOfWork.js';

/**
 * Gate 2 test-harness stand-in: no real transaction exists for an
 * in-memory store, so this just runs `work` against the existing
 * repositories. Real atomicity is delivered by PrismaUnitOfWork (Gate 3).
 */
export class InMemoryUnitOfWork implements UnitOfWork {
  constructor(private readonly repos: ProvisioningRepositories) {}

  async runInTransaction<T>(work: (repos: ProvisioningRepositories) => Promise<T>): Promise<T> {
    return work(this.repos);
  }
}
