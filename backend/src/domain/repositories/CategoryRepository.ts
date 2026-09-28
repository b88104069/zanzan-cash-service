import type { Category, CategoryType } from '../types.js';

export interface CategoryRepository {
  create(category: Omit<Category, 'id' | 'createdAt'> & { createdAt: Date }): Promise<Category>;
  findById(tenantId: string, categoryId: string): Promise<Category | null>;
  findByNameAndType(tenantId: string, categoryName: string, categoryType: CategoryType): Promise<Category | null>;
  isActive(tenantId: string, categoryName: string, categoryType: CategoryType): Promise<boolean>;
  listByTenant(tenantId: string): Promise<Category[]>;
  listActiveByTenant(tenantId: string): Promise<Category[]>;
  update(tenantId: string, categoryId: string, patch: Partial<Pick<Category, 'categoryName' | 'categoryType'>>): Promise<Category>;
  setStatus(tenantId: string, categoryId: string, status: Category['status']): Promise<void>;
}
