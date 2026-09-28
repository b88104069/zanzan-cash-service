import { PrismaClient } from '@prisma/client';
import { AccountService } from '../../src/domain/services/AccountService.js';
import { CashEntryService } from '../../src/domain/services/CashEntryService.js';
import { CategoryService } from '../../src/domain/services/CategoryService.js';
import { ExportService } from '../../src/domain/services/ExportService.js';
import { TenantService } from '../../src/domain/services/TenantService.js';
import { TransferService } from '../../src/domain/services/TransferService.js';
import { PrismaAccountRepository } from '../../src/infra/prisma/PrismaAccountRepository.js';
import { PrismaCashEntryRepository } from '../../src/infra/prisma/PrismaCashEntryRepository.js';
import { PrismaCategoryRepository } from '../../src/infra/prisma/PrismaCategoryRepository.js';
import { PrismaTenantRepository } from '../../src/infra/prisma/PrismaTenantRepository.js';
import { PrismaUnitOfWork } from '../../src/infra/prisma/PrismaUnitOfWork.js';
import { PrismaUserRepository } from '../../src/infra/prisma/PrismaUserRepository.js';

export const prisma = new PrismaClient();

export function createIntegrationHarness() {
  const tenantRepo = new PrismaTenantRepository(prisma);
  const accountRepo = new PrismaAccountRepository(prisma);
  const categoryRepo = new PrismaCategoryRepository(prisma);
  const entryRepo = new PrismaCashEntryRepository(prisma);
  const userRepo = new PrismaUserRepository(prisma);
  const uow = new PrismaUnitOfWork(prisma);

  const accountService = new AccountService(accountRepo, entryRepo);
  const categoryService = new CategoryService(categoryRepo);
  const tenantService = new TenantService(tenantRepo, uow);
  const cashEntryService = new CashEntryService(entryRepo, accountService, categoryService);
  const transferService = new TransferService(entryRepo, accountService);
  const exportService = new ExportService(entryRepo);

  return {
    prisma,
    userRepo,
    tenantRepo,
    accountRepo,
    categoryRepo,
    entryRepo,
    tenantService,
    accountService,
    categoryService,
    cashEntryService,
    transferService,
    exportService,
  };
}

/** Deletes all rows in FK-safe order. Called between tests for isolation. */
export async function resetDatabase(): Promise<void> {
  await prisma.cashEntry.deleteMany();
  await prisma.tenantMembership.deleteMany();
  await prisma.account.deleteMany();
  await prisma.category.deleteMany();
  await prisma.tenant.deleteMany();
  await prisma.user.deleteMany();
}

let userCounter = 0;
export async function createTestUser(prismaClient: PrismaClient = prisma): Promise<{ id: string; email: string }> {
  userCounter += 1;
  const user = await prismaClient.user.create({
    data: {
      email: `test-user-${Date.now()}-${userCounter}@example.test`,
      passwordHash: 'unused-in-these-tests',
      role: 'member',
    },
  });
  return { id: user.id, email: user.email };
}
