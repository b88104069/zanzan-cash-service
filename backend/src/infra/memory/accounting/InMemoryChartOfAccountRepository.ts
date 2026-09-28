import type { ChartOfAccountRepository } from '../../../domain/accounting/repositories/ChartOfAccountRepository.js';
import type { ChartOfAccount } from '../../../domain/accounting/types.js';
import { AccountingDatabase, generateAccountingId } from './AccountingDatabase.js';

export class InMemoryChartOfAccountRepository implements ChartOfAccountRepository {
  constructor(private readonly db: AccountingDatabase) {}

  async create(row: Omit<ChartOfAccount, 'id' | 'createdAt'> & { createdAt: Date }): Promise<ChartOfAccount> {
    const record: ChartOfAccount = { ...row, id: generateAccountingId('coa') };
    this.db.chartOfAccounts.set(record.id, record);
    return record;
  }

  async findById(tenantId: string, id: string): Promise<ChartOfAccount | null> {
    const row = this.db.chartOfAccounts.get(id);
    return row && row.tenantId === tenantId ? row : null;
  }

  async listByTenant(tenantId: string): Promise<ChartOfAccount[]> {
    return [...this.db.chartOfAccounts.values()].filter((r) => r.tenantId === tenantId);
  }
}
