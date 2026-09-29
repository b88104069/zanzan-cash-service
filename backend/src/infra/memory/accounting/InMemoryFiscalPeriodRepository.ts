import type { FiscalPeriodRepository } from '../../../domain/accounting/repositories/FiscalPeriodRepository.js';
import type { FiscalPeriod } from '../../../domain/accounting/types.js';
import { AccountingDatabase, generateAccountingId } from './AccountingDatabase.js';

export class InMemoryFiscalPeriodRepository implements FiscalPeriodRepository {
  constructor(private readonly db: AccountingDatabase) {}

  async create(row: Omit<FiscalPeriod, 'id'>): Promise<FiscalPeriod> {
    const record: FiscalPeriod = { ...row, id: generateAccountingId('fp') };
    this.db.fiscalPeriods.set(record.id, record);
    return record;
  }

  async findById(tenantId: string, id: string): Promise<FiscalPeriod | null> {
    const row = this.db.fiscalPeriods.get(id);
    return row && row.tenantId === tenantId ? row : null;
  }

  async listByTenant(tenantId: string): Promise<FiscalPeriod[]> {
    return [...this.db.fiscalPeriods.values()].filter((r) => r.tenantId === tenantId);
  }

  async update(period: FiscalPeriod): Promise<FiscalPeriod> {
    this.db.fiscalPeriods.set(period.id, period);
    return period;
  }
}
