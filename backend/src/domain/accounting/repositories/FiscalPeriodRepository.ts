import type { FiscalPeriod } from '../types.js';

export interface FiscalPeriodRepository {
  create(row: Omit<FiscalPeriod, 'id'>): Promise<FiscalPeriod>;
  findById(tenantId: string, id: string): Promise<FiscalPeriod | null>;
  listByTenant(tenantId: string): Promise<FiscalPeriod[]>;
  update(period: FiscalPeriod): Promise<FiscalPeriod>;
}
