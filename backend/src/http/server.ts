import { AccountService } from '../domain/services/AccountService.js';
import { AuthService } from '../domain/services/AuthService.js';
import { CashEntryService } from '../domain/services/CashEntryService.js';
import { CategoryService } from '../domain/services/CategoryService.js';
import { ExportService } from '../domain/services/ExportService.js';
import { TenantService } from '../domain/services/TenantService.js';
import { TransferService } from '../domain/services/TransferService.js';
import { DevEntitlementAdapter } from '../infra/entitlement/DevEntitlementAdapter.js';
import { prisma } from '../infra/prisma/client.js';
import { PrismaAccountRepository } from '../infra/prisma/PrismaAccountRepository.js';
import { PrismaCashEntryRepository } from '../infra/prisma/PrismaCashEntryRepository.js';
import { PrismaCategoryRepository } from '../infra/prisma/PrismaCategoryRepository.js';
import { PrismaTenantRepository } from '../infra/prisma/PrismaTenantRepository.js';
import { PrismaUnitOfWork } from '../infra/prisma/PrismaUnitOfWork.js';
import { PrismaUserRepository } from '../infra/prisma/PrismaUserRepository.js';
import { buildApp } from './app.js';

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  throw new Error('JWT_SECRET environment variable is required.');
}

// Gate 5 staging runs with no live WooCommerce connection — this is exactly
// the DevEntitlementAdapter swap docs/architecture/auth-entitlement-abstraction.md
// says Gate 3 must prove is possible via configuration alone. A future
// production-cutover project swaps this for WooCommerceEntitlementAdapter.
const entitlementService = new DevEntitlementAdapter({ mode: (process.env.ENTITLEMENT_MODE as 'allow-all' | 'deny-all' | 'allow-list') ?? 'allow-all' });

const userRepo = new PrismaUserRepository(prisma);
const tenantRepo = new PrismaTenantRepository(prisma);
const accountRepo = new PrismaAccountRepository(prisma);
const categoryRepo = new PrismaCategoryRepository(prisma);
const entryRepo = new PrismaCashEntryRepository(prisma);
const uow = new PrismaUnitOfWork(prisma);

const authService = new AuthService(userRepo);
const accountService = new AccountService(accountRepo, entryRepo);
const categoryService = new CategoryService(categoryRepo);
const tenantService = new TenantService(tenantRepo, uow);
const cashEntryService = new CashEntryService(entryRepo, accountService, categoryService);
const transferService = new TransferService(entryRepo, accountService);
const exportService = new ExportService(entryRepo);

const app = buildApp({
  jwtSecret,
  authService,
  entitlementService,
  tenantService,
  accountService,
  categoryService,
  cashEntryService,
  transferService,
  exportService,
});

const port = Number(process.env.PORT ?? 3000);
app
  .listen({ port, host: '0.0.0.0' })
  .then(() => console.log(`zanzan-cash-service backend listening on :${port}`))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
