import type { ChartOfAccount } from '../types.js';

export interface ChartOfAccountRepository {
  create(row: Omit<ChartOfAccount, 'id' | 'createdAt'> & { createdAt: Date }): Promise<ChartOfAccount>;
  findById(tenantId: string, id: string): Promise<ChartOfAccount | null>;
  listByTenant(tenantId: string): Promise<ChartOfAccount[]>;
  update(account: ChartOfAccount): Promise<ChartOfAccount>;
}
