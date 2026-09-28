import type { Voucher } from '../types.js';

export interface VoucherRepository {
  create(row: Omit<Voucher, 'id' | 'createdAt'> & { createdAt: Date }): Promise<Voucher>;
  listByTenant(tenantId: string): Promise<Voucher[]>;
  countByTenant(tenantId: string): Promise<number>;
}
