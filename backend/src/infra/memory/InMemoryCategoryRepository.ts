import type { CategoryRepository } from '../../domain/repositories/CategoryRepository.js';
import type { Category, CategoryType } from '../../domain/types.js';
import { generateId, InMemoryDatabase } from './InMemoryDatabase.js';

export class InMemoryCategoryRepository implements CategoryRepository {
  constructor(private readonly db: InMemoryDatabase) {}

  async create(category: Omit<Category, 'id' | 'createdAt'> & { createdAt: Date }): Promise<Category> {
    const row: Category = { ...category, id: generateId('category') };
    this.db.categories.set(row.id, row);
    return row;
  }

  async findById(tenantId: string, categoryId: string): Promise<Category | null> {
    const row = this.db.categories.get(categoryId);
    return row && row.tenantId === tenantId ? row : null;
  }

  async findByNameAndType(tenantId: string, categoryName: string, categoryType: CategoryType): Promise<Category | null> {
    for (const category of this.db.categories.values()) {
      if (category.tenantId === tenantId && category.categoryName === categoryName && category.categoryType === categoryType) {
        return category;
      }
    }
    return null;
  }

  async isActive(tenantId: string, categoryName: string, categoryType: CategoryType): Promise<boolean> {
    const row = await this.findByNameAndType(tenantId, categoryName, categoryType);
    return row?.status === 'active';
  }

  async listByTenant(tenantId: string): Promise<Category[]> {
    return [...this.db.categories.values()].filter((c) => c.tenantId === tenantId);
  }

  async listActiveByTenant(tenantId: string): Promise<Category[]> {
    return (await this.listByTenant(tenantId)).filter((c) => c.status === 'active');
  }

  async update(
    tenantId: string,
    categoryId: string,
    patch: Partial<Pick<Category, 'categoryName' | 'categoryType'>>,
  ): Promise<Category> {
    const row = await this.findById(tenantId, categoryId);
    if (!row) throw new Error(`Category ${categoryId} not found for tenant ${tenantId}`);
    const updated = { ...row, ...patch };
    this.db.categories.set(categoryId, updated);
    return updated;
  }

  async setStatus(tenantId: string, categoryId: string, status: Category['status']): Promise<void> {
    const row = await this.findById(tenantId, categoryId);
    if (!row) throw new Error(`Category ${categoryId} not found for tenant ${tenantId}`);
    this.db.categories.set(categoryId, { ...row, status });
  }
}
