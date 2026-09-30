import type { GeneralVoucherDraftRepository } from '../../../domain/accounting/repositories/GeneralVoucherDraftRepository.js';
import type { GeneralVoucherDraft } from '../../../domain/accounting/types.js';
import { AccountingDatabase, generateAccountingId } from './AccountingDatabase.js';

export class InMemoryGeneralVoucherDraftRepository implements GeneralVoucherDraftRepository {
  constructor(private readonly db: AccountingDatabase) {}

  async create(row: Omit<GeneralVoucherDraft, 'id'>): Promise<GeneralVoucherDraft> {
    const record: GeneralVoucherDraft = { ...row, id: generateAccountingId('gvd') };
    this.db.generalVoucherDrafts.set(record.id, record);
    return record;
  }

  async findById(tenantId: string, id: string): Promise<GeneralVoucherDraft | null> {
    const row = this.db.generalVoucherDrafts.get(id);
    return row && row.tenantId === tenantId ? row : null;
  }

  async listByTenant(tenantId: string): Promise<GeneralVoucherDraft[]> {
    return [...this.db.generalVoucherDrafts.values()].filter((r) => r.tenantId === tenantId);
  }

  async update(draft: GeneralVoucherDraft): Promise<GeneralVoucherDraft> {
    this.db.generalVoucherDrafts.set(draft.id, draft);
    return draft;
  }

  async delete(id: string): Promise<void> {
    this.db.generalVoucherDrafts.delete(id);
  }
}
