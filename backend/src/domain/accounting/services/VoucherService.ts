import type { VoucherRepository } from '../repositories/VoucherRepository.js';
import type { Voucher } from '../types.js';

export class VoucherService {
  constructor(private readonly vouchers: VoucherRepository) {}

  /** v0.1: always exactly one journal entry per voucher. */
  async createForJournalEntry(tenantId: string, journalEntryId: string, voucherDate: string): Promise<Voucher> {
    const voucherNo = await this.nextVoucherNo(tenantId);
    return this.vouchers.create({
      tenantId,
      voucherNo,
      voucherDate,
      journalEntryIds: [journalEntryId],
      createdAt: new Date(),
    });
  }

  async listVouchers(tenantId: string): Promise<Voucher[]> {
    return this.vouchers.listByTenant(tenantId);
  }

  private async nextVoucherNo(tenantId: string): Promise<string> {
    const count = await this.vouchers.countByTenant(tenantId);
    return `JV${String(count + 1).padStart(5, '0')}`;
  }
}
