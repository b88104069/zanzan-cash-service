import type { GeneralVoucherDraft } from '../types.js';

/** Follows the same tenant-scoped repository shape as ChartOfAccountRepository/FiscalPeriodRepository. */
export interface GeneralVoucherDraftRepository {
  create(row: Omit<GeneralVoucherDraft, 'id'>): Promise<GeneralVoucherDraft>;
  findById(tenantId: string, id: string): Promise<GeneralVoucherDraft | null>;
  listByTenant(tenantId: string): Promise<GeneralVoucherDraft[]>;
  update(draft: GeneralVoucherDraft): Promise<GeneralVoucherDraft>;
  delete(id: string): Promise<void>;
}
