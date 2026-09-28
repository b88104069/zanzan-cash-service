import { AccountService } from '../../src/domain/services/AccountService.js';
import { AuthService } from '../../src/domain/services/AuthService.js';
import { CashEntryService } from '../../src/domain/services/CashEntryService.js';
import { CategoryService } from '../../src/domain/services/CategoryService.js';
import { ExportService } from '../../src/domain/services/ExportService.js';
import { TenantService } from '../../src/domain/services/TenantService.js';
import { TransferService } from '../../src/domain/services/TransferService.js';
import type { EntitlementService } from '../../src/domain/entitlement/EntitlementService.js';
import { DevEntitlementAdapter } from '../../src/infra/entitlement/DevEntitlementAdapter.js';
import { InMemoryAccountRepository } from '../../src/infra/memory/InMemoryAccountRepository.js';
import { InMemoryCashEntryRepository } from '../../src/infra/memory/InMemoryCashEntryRepository.js';
import { InMemoryCategoryRepository } from '../../src/infra/memory/InMemoryCategoryRepository.js';
import { InMemoryDatabase } from '../../src/infra/memory/InMemoryDatabase.js';
import { InMemoryTenantRepository } from '../../src/infra/memory/InMemoryTenantRepository.js';
import { InMemoryUnitOfWork } from '../../src/infra/memory/InMemoryUnitOfWork.js';
import { InMemoryUserRepository } from '../../src/infra/memory/InMemoryUserRepository.js';
import { buildApp } from '../../src/http/app.js';

export const TEST_JWT_SECRET = 'test-secret-do-not-use-in-production';

export function createHttpTestApp(entitlementOverride?: EntitlementService) {
  const db = new InMemoryDatabase();

  const tenantRepo = new InMemoryTenantRepository(db);
  const accountRepo = new InMemoryAccountRepository(db);
  const categoryRepo = new InMemoryCategoryRepository(db);
  const entryRepo = new InMemoryCashEntryRepository(db);
  const userRepo = new InMemoryUserRepository(db);
  const uow = new InMemoryUnitOfWork({ tenants: tenantRepo, accounts: accountRepo, categories: categoryRepo });

  const authService = new AuthService(userRepo);
  const accountService = new AccountService(accountRepo, entryRepo);
  const categoryService = new CategoryService(categoryRepo);
  const tenantService = new TenantService(tenantRepo, uow);
  const cashEntryService = new CashEntryService(entryRepo, accountService, categoryService);
  const transferService = new TransferService(entryRepo, accountService);
  const exportService = new ExportService(entryRepo);
  const entitlementService = entitlementOverride ?? new DevEntitlementAdapter({ mode: 'allow-all' });

  const app = buildApp({
    jwtSecret: TEST_JWT_SECRET,
    authService,
    entitlementService,
    tenantService,
    accountService,
    categoryService,
    cashEntryService,
    transferService,
    exportService,
  });

  return { app, db };
}

export async function registerUser(app: ReturnType<typeof createHttpTestApp>['app'], email: string) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { email, password: 'hunter22' },
  });
  const body = response.json();
  return { token: body.token as string, userId: body.user.id as string };
}

export async function issuePlatformAdminToken(app: ReturnType<typeof createHttpTestApp>['app'], userId: string): Promise<string> {
  await app.ready();
  return app.jwt.sign({ sub: userId, role: 'platform_admin' });
}

export async function createTenant(
  app: ReturnType<typeof createHttpTestApp>['app'],
  token: string,
  companyName: string,
): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/tenants',
    headers: { authorization: `Bearer ${token}` },
    payload: { companyName },
  });
  return response.json().data.id as string;
}
