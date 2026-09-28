import { AccountService } from '../src/domain/services/AccountService.js';
import { CashEntryService } from '../src/domain/services/CashEntryService.js';
import { CategoryService } from '../src/domain/services/CategoryService.js';
import { ExportService } from '../src/domain/services/ExportService.js';
import { TenantService } from '../src/domain/services/TenantService.js';
import { TransferService } from '../src/domain/services/TransferService.js';
import { InMemoryAccountRepository } from '../src/infra/memory/InMemoryAccountRepository.js';
import { InMemoryCashEntryRepository } from '../src/infra/memory/InMemoryCashEntryRepository.js';
import { InMemoryCategoryRepository } from '../src/infra/memory/InMemoryCategoryRepository.js';
import { InMemoryDatabase } from '../src/infra/memory/InMemoryDatabase.js';
import { InMemoryTenantRepository } from '../src/infra/memory/InMemoryTenantRepository.js';
import { InMemoryUnitOfWork } from '../src/infra/memory/InMemoryUnitOfWork.js';

/** Fresh, isolated wiring for each test — no shared state between tests. */
export function createHarness() {
  const db = new InMemoryDatabase();

  const tenantRepo = new InMemoryTenantRepository(db);
  const accountRepo = new InMemoryAccountRepository(db);
  const categoryRepo = new InMemoryCategoryRepository(db);
  const entryRepo = new InMemoryCashEntryRepository(db);
  const uow = new InMemoryUnitOfWork({ tenants: tenantRepo, accounts: accountRepo, categories: categoryRepo });

  const accountService = new AccountService(accountRepo, entryRepo);
  const categoryService = new CategoryService(categoryRepo);
  const tenantService = new TenantService(tenantRepo, uow);
  const cashEntryService = new CashEntryService(entryRepo, accountService, categoryService);
  const transferService = new TransferService(entryRepo, accountService);
  const exportService = new ExportService(entryRepo);

  return { db, tenantService, accountService, categoryService, cashEntryService, transferService, exportService };
}

export const OWNER = 'user_1';
export const OTHER_USER = 'user_2';
