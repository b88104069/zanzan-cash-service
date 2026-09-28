import { DomainError } from '../errors.js';
import type { CategoryRepository } from '../repositories/CategoryRepository.js';
import type { Category, CategoryType } from '../types.js';

/** Parity source: zzscs_api_category_* (see docs/architecture/domain-boundaries.md → Category). */
export class CategoryService {
  constructor(private readonly categories: CategoryRepository) {}

  /** C1, C2, C3 — uniqueness is scoped to (tenant, name, type), so the same name can exist once per type. */
  async createCategory(tenantId: string, input: { categoryName: string; categoryType?: CategoryType }): Promise<Category> {
    const categoryName = input.categoryName.trim();
    if (!categoryName) throw new DomainError('VALIDATION_REQUIRED_FIELD', '請填寫科目名稱。');

    const categoryType: CategoryType = input.categoryType === 'income' ? 'income' : 'expense';

    const existing = await this.categories.findByNameAndType(tenantId, categoryName, categoryType);
    if (existing) throw new DomainError('DUPLICATE_CATEGORY_NAME', '此科目名稱已存在於該類型中。');

    return this.categories.create({
      tenantId,
      categoryName,
      categoryType,
      status: 'active',
      createdAt: new Date(),
    });
  }

  async updateCategory(
    tenantId: string,
    categoryId: string,
    input: { categoryName: string; categoryType?: CategoryType },
  ): Promise<Category> {
    const categoryName = input.categoryName.trim();
    if (!categoryName) throw new DomainError('VALIDATION_REQUIRED_FIELD', '請填寫科目名稱。');

    const categoryType: CategoryType = input.categoryType === 'income' ? 'income' : 'expense';

    const current = await this.categories.findById(tenantId, categoryId);
    if (!current) throw new DomainError('CATEGORY_NOT_FOUND', '找不到這個科目，或無權限修改。');

    const duplicate = await this.categories.findByNameAndType(tenantId, categoryName, categoryType);
    if (duplicate && duplicate.id !== categoryId) {
      throw new DomainError('DUPLICATE_CATEGORY_NAME', '此科目名稱已存在於該類型中。');
    }

    return this.categories.update(tenantId, categoryId, { categoryName, categoryType });
  }

  /** C4 — soft-delete only. */
  async disableCategory(tenantId: string, categoryId: string): Promise<void> {
    const current = await this.categories.findById(tenantId, categoryId);
    if (!current) throw new DomainError('CATEGORY_NOT_FOUND', '找不到這個科目。');
    await this.categories.setStatus(tenantId, categoryId, 'inactive');
  }

  async enableCategory(tenantId: string, categoryId: string): Promise<void> {
    const current = await this.categories.findById(tenantId, categoryId);
    if (!current) throw new DomainError('CATEGORY_NOT_FOUND', '找不到這個科目。');
    await this.categories.setStatus(tenantId, categoryId, 'active');
  }

  async listActiveCategories(tenantId: string): Promise<Category[]> {
    return this.categories.listActiveByTenant(tenantId);
  }

  async listForAdmin(tenantId: string): Promise<Category[]> {
    return this.categories.listByTenant(tenantId);
  }

  /** Validates an active category of the matching type exists (used by CashEntryService, E4/C4). */
  async requireActiveCategory(tenantId: string, categoryName: string, categoryType: CategoryType): Promise<void> {
    const active = await this.categories.isActive(tenantId, categoryName, categoryType);
    if (!active) {
      throw new DomainError(
        'CATEGORY_NOT_FOUND_OR_INACTIVE',
        '請從下拉清單選擇正確的科目，或先至下方「科目管理」新增此科目。',
      );
    }
  }
}
