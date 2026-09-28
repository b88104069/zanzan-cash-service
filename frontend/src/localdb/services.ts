import { InMemoryDatabase } from '../../../backend/src/infra/memory/InMemoryDatabase.js';
import { InMemoryAccountRepository } from '../../../backend/src/infra/memory/InMemoryAccountRepository.js';
import { InMemoryCategoryRepository } from '../../../backend/src/infra/memory/InMemoryCategoryRepository.js';
import { InMemoryCashEntryRepository } from '../../../backend/src/infra/memory/InMemoryCashEntryRepository.js';
import { InMemoryTenantRepository } from '../../../backend/src/infra/memory/InMemoryTenantRepository.js';
import { InMemoryUnitOfWork } from '../../../backend/src/infra/memory/InMemoryUnitOfWork.js';
import { AccountService } from '../../../backend/src/domain/services/AccountService.js';
import { CategoryService } from '../../../backend/src/domain/services/CategoryService.js';
import { CashEntryService } from '../../../backend/src/domain/services/CashEntryService.js';
import { TransferService } from '../../../backend/src/domain/services/TransferService.js';
import { ExportService } from '../../../backend/src/domain/services/ExportService.js';
import { TenantService } from '../../../backend/src/domain/services/TenantService.js';
import { loadDatabase, saveDatabase } from './persistence.js';

/** Fixed single test user — no login, no multi-tenant isolation, per Gate 5 (ACTIVE)'s scope. */
export const LOCAL_USER_ID = 'local-user';
const LOCAL_LEDGER_NAME = '我的記帳本';

export interface LocalServices {
  db: InMemoryDatabase;
  tenantId: string;
  accountService: AccountService;
  categoryService: CategoryService;
  cashEntryService: CashEntryService;
  transferService: TransferService;
  exportService: ExportService;
  save: () => void;
}

/**
 * Builds the whole service graph against a persisted InMemoryDatabase, and
 * auto-provisions the single ledger (tenant) this prototype needs on first
 * run — reusing TenantService.createTenant unchanged, so the exact same
 * seeding behavior Gate 2 characterized (one default 現金 account + 4
 * default categories) runs here too.
 */
export async function initLocalServices(): Promise<LocalServices> {
  const db = loadDatabase();

  const tenantRepo = new InMemoryTenantRepository(db);
  const accountRepo = new InMemoryAccountRepository(db);
  const categoryRepo = new InMemoryCategoryRepository(db);
  const entryRepo = new InMemoryCashEntryRepository(db);
  const uow = new InMemoryUnitOfWork({ tenants: tenantRepo, accounts: accountRepo, categories: categoryRepo });

  const accountService = new AccountService(accountRepo, entryRepo);
  const categoryService = new CategoryService(categoryRepo);
  const cashEntryService = new CashEntryService(entryRepo, accountService, categoryService);
  const transferService = new TransferService(entryRepo, accountService);
  const exportService = new ExportService(entryRepo);
  const tenantService = new TenantService(tenantRepo, uow);

  const save = () => saveDatabase(db);

  let tenantId = [...db.tenants.values()].find((t) => t.ownerUserId === LOCAL_USER_ID)?.id;
  if (!tenantId) {
    const tenant = await tenantService.createTenant({ ownerUserId: LOCAL_USER_ID, companyName: LOCAL_LEDGER_NAME });
    tenantId = tenant.id;
    save();
  }

  return { db, tenantId, accountService, categoryService, cashEntryService, transferService, exportService, save };
}
