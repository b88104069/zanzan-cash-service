import type { AccountRepository } from '../../domain/repositories/AccountRepository.js';
import type { Account } from '../../domain/types.js';
import { decimalToNumber } from './mappers.js';
import type { Db } from './types.js';

type AccountRow = {
  id: string;
  tenantId: string;
  accountName: string;
  accountType: string;
  openingBalance: unknown;
  status: string;
  createdAt: Date;
};

function toDomain(row: AccountRow): Account {
  return {
    id: row.id,
    tenantId: row.tenantId,
    accountName: row.accountName,
    accountType: row.accountType,
    openingBalance: decimalToNumber(row.openingBalance as never),
    status: row.status as Account['status'],
    createdAt: row.createdAt,
  };
}

export class PrismaAccountRepository implements AccountRepository {
  constructor(private readonly db: Db) {}

  async create(account: Omit<Account, 'id' | 'createdAt'> & { createdAt: Date }): Promise<Account> {
    const row = await this.db.account.create({ data: account });
    return toDomain(row);
  }

  async findById(tenantId: string, accountId: string): Promise<Account | null> {
    const row = await this.db.account.findFirst({ where: { id: accountId, tenantId } });
    return row ? toDomain(row) : null;
  }

  async findByName(tenantId: string, accountName: string): Promise<Account | null> {
    const row = await this.db.account.findFirst({ where: { tenantId, accountName } });
    return row ? toDomain(row) : null;
  }

  async listByTenant(tenantId: string): Promise<Account[]> {
    const rows = await this.db.account.findMany({ where: { tenantId } });
    return rows.map(toDomain);
  }

  async listActiveByTenant(tenantId: string): Promise<Account[]> {
    const rows = await this.db.account.findMany({ where: { tenantId, status: 'active' } });
    return rows.map(toDomain);
  }

  async update(
    tenantId: string,
    accountId: string,
    patch: Partial<Pick<Account, 'accountName' | 'accountType' | 'openingBalance'>>,
  ): Promise<Account> {
    const row = await this.db.account.update({ where: { id: accountId, tenantId }, data: patch });
    return toDomain(row);
  }

  async setStatus(tenantId: string, accountId: string, status: Account['status']): Promise<void> {
    await this.db.account.update({ where: { id: accountId, tenantId }, data: { status } });
  }
}
