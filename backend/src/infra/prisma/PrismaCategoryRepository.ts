import type { CategoryRepository } from '../../domain/repositories/CategoryRepository.js';
import type { Category, CategoryType } from '../../domain/types.js';
import type { Db } from './types.js';

type CategoryRow = {
  id: string;
  tenantId: string;
  categoryName: string;
  categoryType: string;
  status: string;
  createdAt: Date;
};

function toDomain(row: CategoryRow): Category {
  return {
    id: row.id,
    tenantId: row.tenantId,
    categoryName: row.categoryName,
    categoryType: row.categoryType as CategoryType,
    status: row.status as Category['status'],
    createdAt: row.createdAt,
  };
}

export class PrismaCategoryRepository implements CategoryRepository {
  constructor(private readonly db: Db) {}

  async create(category: Omit<Category, 'id' | 'createdAt'> & { createdAt: Date }): Promise<Category> {
    const row = await this.db.category.create({ data: category });
    return toDomain(row);
  }

  async findById(tenantId: string, categoryId: string): Promise<Category | null> {
    const row = await this.db.category.findFirst({ where: { id: categoryId, tenantId } });
    return row ? toDomain(row) : null;
  }

  async findByNameAndType(tenantId: string, categoryName: string, categoryType: CategoryType): Promise<Category | null> {
    const row = await this.db.category.findFirst({ where: { tenantId, categoryName, categoryType } });
    return row ? toDomain(row) : null;
  }

  async isActive(tenantId: string, categoryName: string, categoryType: CategoryType): Promise<boolean> {
    const row = await this.findByNameAndType(tenantId, categoryName, categoryType);
    return row?.status === 'active';
  }

  async listByTenant(tenantId: string): Promise<Category[]> {
    const rows = await this.db.category.findMany({ where: { tenantId } });
    return rows.map(toDomain);
  }

  async listActiveByTenant(tenantId: string): Promise<Category[]> {
    const rows = await this.db.category.findMany({ where: { tenantId, status: 'active' } });
    return rows.map(toDomain);
  }

  async update(
    tenantId: string,
    categoryId: string,
    patch: Partial<Pick<Category, 'categoryName' | 'categoryType'>>,
  ): Promise<Category> {
    const row = await this.db.category.update({ where: { id: categoryId, tenantId }, data: patch });
    return toDomain(row);
  }

  async setStatus(tenantId: string, categoryId: string, status: Category['status']): Promise<void> {
    await this.db.category.update({ where: { id: categoryId, tenantId }, data: { status } });
  }
}
