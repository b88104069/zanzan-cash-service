import type { AccountRepository } from '../../domain/repositories/AccountRepository.js';
import type { Account } from '../../domain/types.js';
import { generateId, InMemoryDatabase } from './InMemoryDatabase.js';

export class InMemoryAccountRepository implements AccountRepository {
  constructor(private readonly db: InMemoryDatabase) {}

  async create(account: Omit<Account, 'id' | 'createdAt'> & { createdAt: Date }): Promise<Account> {
    const row: Account = { ...account, id: generateId('account') };
    this.db.accounts.set(row.id, row);
    return row;
  }

  async findById(tenantId: string, accountId: string): Promise<Account | null> {
    const row = this.db.accounts.get(accountId);
    return row && row.tenantId === tenantId ? row : null;
  }

  async findByName(tenantId: string, accountName: string): Promise<Account | null> {
    for (const account of this.db.accounts.values()) {
      if (account.tenantId === tenantId && account.accountName === accountName) return account;
    }
    return null;
  }

  async listByTenant(tenantId: string): Promise<Account[]> {
    return [...this.db.accounts.values()].filter((a) => a.tenantId === tenantId);
  }

  async listActiveByTenant(tenantId: string): Promise<Account[]> {
    return (await this.listByTenant(tenantId)).filter((a) => a.status === 'active');
  }

  async update(
    tenantId: string,
    accountId: string,
    patch: Partial<Pick<Account, 'accountName' | 'accountType' | 'openingBalance'>>,
  ): Promise<Account> {
    const row = await this.findById(tenantId, accountId);
    if (!row) throw new Error(`Account ${accountId} not found for tenant ${tenantId}`);
    const updated = { ...row, ...patch };
    this.db.accounts.set(accountId, updated);
    return updated;
  }

  async setStatus(tenantId: string, accountId: string, status: Account['status']): Promise<void> {
    await this.update(tenantId, accountId, {});
    const row = this.db.accounts.get(accountId)!;
    this.db.accounts.set(accountId, { ...row, status });
  }
}
