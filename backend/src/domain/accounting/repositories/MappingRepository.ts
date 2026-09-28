import type { AccountMapping, CategoryMapping } from '../types.js';

/** Both mapping tables are simple key->GL-account lookups, so one repository covers both. */
export interface MappingRepository {
  createAccountMapping(row: Omit<AccountMapping, 'id' | 'createdAt'> & { createdAt: Date }): Promise<AccountMapping>;
  findAccountMapping(tenantId: string, cashAccountId: string): Promise<AccountMapping | null>;
  listAccountMappings(tenantId: string): Promise<AccountMapping[]>;

  createCategoryMapping(row: Omit<CategoryMapping, 'id' | 'createdAt'> & { createdAt: Date }): Promise<CategoryMapping>;
  findCategoryMapping(tenantId: string, cashCategoryName: string): Promise<CategoryMapping | null>;
  listCategoryMappings(tenantId: string): Promise<CategoryMapping[]>;
}
