import type { MappingRepository } from '../../../domain/accounting/repositories/MappingRepository.js';
import type { AccountMapping, CategoryMapping } from '../../../domain/accounting/types.js';
import { AccountingDatabase, generateAccountingId } from './AccountingDatabase.js';

export class InMemoryMappingRepository implements MappingRepository {
  constructor(private readonly db: AccountingDatabase) {}

  async createAccountMapping(row: Omit<AccountMapping, 'id' | 'createdAt'> & { createdAt: Date }): Promise<AccountMapping> {
    // Upsert semantics: a new mapping for the same (tenant, cashAccountId) replaces the old one.
    const existing = await this.findAccountMapping(row.tenantId, row.cashAccountId);
    if (existing) this.db.accountMappings.delete(existing.id);

    const record: AccountMapping = { ...row, id: generateAccountingId('acctmap') };
    this.db.accountMappings.set(record.id, record);
    return record;
  }

  async findAccountMapping(tenantId: string, cashAccountId: string): Promise<AccountMapping | null> {
    for (const row of this.db.accountMappings.values()) {
      if (row.tenantId === tenantId && row.cashAccountId === cashAccountId) return row;
    }
    return null;
  }

  async listAccountMappings(tenantId: string): Promise<AccountMapping[]> {
    return [...this.db.accountMappings.values()].filter((r) => r.tenantId === tenantId);
  }

  async createCategoryMapping(row: Omit<CategoryMapping, 'id' | 'createdAt'> & { createdAt: Date }): Promise<CategoryMapping> {
    const existing = await this.findCategoryMapping(row.tenantId, row.cashCategoryName);
    if (existing) this.db.categoryMappings.delete(existing.id);

    const record: CategoryMapping = { ...row, id: generateAccountingId('catmap') };
    this.db.categoryMappings.set(record.id, record);
    return record;
  }

  async findCategoryMapping(tenantId: string, cashCategoryName: string): Promise<CategoryMapping | null> {
    for (const row of this.db.categoryMappings.values()) {
      if (row.tenantId === tenantId && row.cashCategoryName === cashCategoryName) return row;
    }
    return null;
  }

  async listCategoryMappings(tenantId: string): Promise<CategoryMapping[]> {
    return [...this.db.categoryMappings.values()].filter((r) => r.tenantId === tenantId);
  }
}
