import type { VoucherRepository } from '../../../domain/accounting/repositories/VoucherRepository.js';
import type { Voucher } from '../../../domain/accounting/types.js';
import { AccountingDatabase, generateAccountingId } from './AccountingDatabase.js';

export class InMemoryVoucherRepository implements VoucherRepository {
  constructor(private readonly db: AccountingDatabase) {}

  async create(row: Omit<Voucher, 'id' | 'createdAt'> & { createdAt: Date }): Promise<Voucher> {
    const record: Voucher = { ...row, id: generateAccountingId('voucher') };
    this.db.vouchers.set(record.id, record);
    return record;
  }

  async listByTenant(tenantId: string): Promise<Voucher[]> {
    return [...this.db.vouchers.values()].filter((r) => r.tenantId === tenantId);
  }

  async countByTenant(tenantId: string): Promise<number> {
    return (await this.listByTenant(tenantId)).length;
  }
}
