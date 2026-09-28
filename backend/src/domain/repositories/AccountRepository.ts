import type { Account } from '../types.js';

// Every method is tenant-scoped by an explicit parameter — see
// docs/architecture/database-strategy.md "Tenant isolation at the data
// layer": no method may fetch a row by id alone and trust the caller.
export interface AccountRepository {
  create(account: Omit<Account, 'id' | 'createdAt'> & { createdAt: Date }): Promise<Account>;
  findById(tenantId: string, accountId: string): Promise<Account | null>;
  findByName(tenantId: string, accountName: string): Promise<Account | null>;
  listByTenant(tenantId: string): Promise<Account[]>;
  listActiveByTenant(tenantId: string): Promise<Account[]>;
  update(tenantId: string, accountId: string, patch: Partial<Pick<Account, 'accountName' | 'accountType' | 'openingBalance'>>): Promise<Account>;
  setStatus(tenantId: string, accountId: string, status: Account['status']): Promise<void>;
}
