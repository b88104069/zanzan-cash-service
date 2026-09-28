import { describe, expect, it } from 'vitest';
import { createHarness, OWNER } from './testHarness.js';

// Spec: docs/gates/characterization-test-spec.md § Category

describe('Category', () => {
  it('C1 — creates an expense category', async () => {
    const { categoryService } = createHarness();
    const category = await categoryService.createCategory('t1', { categoryName: '餐費', categoryType: 'expense' });
    expect(category.categoryType).toBe('expense');
    expect(category.status).toBe('active');
  });

  it('C2 — the same name may exist once per type (income and expense are distinct)', async () => {
    const { categoryService } = createHarness();
    await categoryService.createCategory('t1', { categoryName: '其他', categoryType: 'expense' });

    const income = await categoryService.createCategory('t1', { categoryName: '其他', categoryType: 'income' });
    expect(income.categoryType).toBe('income');
  });

  it('C3 — rejects a duplicate name within the same type', async () => {
    const { categoryService } = createHarness();
    await categoryService.createCategory('t1', { categoryName: '其他', categoryType: 'expense' });

    await expect(
      categoryService.createCategory('t1', { categoryName: '其他', categoryType: 'expense' }),
    ).rejects.toMatchObject({ code: 'DUPLICATE_CATEGORY_NAME' });
  });

  it('C4 — a disabled category is rejected for new cash entries', async () => {
    const { categoryService, cashEntryService, accountService } = createHarness();
    await accountService.createAccount('t1', { accountName: '現金' });
    const category = await categoryService.createCategory('t1', { categoryName: '餐費', categoryType: 'expense' });
    await categoryService.disableCategory('t1', category.id);

    await expect(
      cashEntryService.addEntry('t1', OWNER, {
        entryDate: '2026-01-01',
        memo: '午餐',
        category: '餐費',
        accountName: '現金',
        income: 0,
        expense: 100,
      }),
    ).rejects.toMatchObject({ code: 'CATEGORY_NOT_FOUND_OR_INACTIVE' });
  });
});
