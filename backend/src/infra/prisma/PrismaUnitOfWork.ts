import type { PrismaClient } from '@prisma/client';
import type { ProvisioningRepositories, UnitOfWork } from '../../domain/repositories/UnitOfWork.js';
import { PrismaAccountRepository } from './PrismaAccountRepository.js';
import { PrismaCategoryRepository } from './PrismaCategoryRepository.js';
import { PrismaTenantRepository } from './PrismaTenantRepository.js';

/**
 * Real transactional wrapping (Gate 3), delivering what Gate 2 deferred.
 * `prisma.$transaction` gives us a `tx` client; repository instances bound
 * to `tx` (not the top-level `prisma`) are what makes every write inside
 * `work` part of the same atomic transaction — using the top-level client
 * anywhere inside `work` would silently break atomicity, so this is the
 * only place these three repositories are ever constructed for writes
 * during tenant provisioning.
 */
export class PrismaUnitOfWork implements UnitOfWork {
  constructor(private readonly prisma: PrismaClient) {}

  async runInTransaction<T>(work: (repos: ProvisioningRepositories) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      const repos: ProvisioningRepositories = {
        tenants: new PrismaTenantRepository(tx),
        accounts: new PrismaAccountRepository(tx),
        categories: new PrismaCategoryRepository(tx),
      };
      return work(repos);
    });
  }
}
