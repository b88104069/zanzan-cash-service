import { beforeEach, describe, expect, it } from 'vitest';
import { createHarness, OWNER } from './testHarness.js';

// Spec: docs/gates/characterization-test-spec.md § Cash Entry

describe('Cash Entry', () => {
  let harness: ReturnType<typeof createHarness>;

  beforeEach(async () => {
    harness = createHarness();
    await harness.accountService.createAccount('t1', { accountName: '現金' });
    await harness.categoryService.createCategory('t1', { categoryName: '薪水', categoryType: 'income' });
    await harness.categoryService.createCategory('t1', { categoryName: '餐費', categoryType: 'expense' });
  });

  it('E1 — a valid income entry is created', async () => {
    const entry = await harness.cashEntryService.addEntry('t1', OWNER, {
      entryDate: '2026-01-01',
      memo: '薪水',
      category: '薪水',
      accountName: '現金',
      income: 100,
      expense: 0,
    });
    expect(entry.income).toBe(100);
    expect(entry.expense).toBe(0);
  });

  it('E2 — rejects income and expense both > 0', async () => {
    await expect(
      harness.cashEntryService.addEntry('t1', OWNER, {
        entryDate: '2026-01-01',
        memo: 'x',
        category: '薪水',
        accountName: '現金',
        income: 100,
        expense: 50,
      }),
    ).rejects.toMatchObject({ code: 'INCOME_EXPENSE_MUTUAL_EXCLUSION' });
  });

  it('E3 — rejects income and expense both zero', async () => {
    await expect(
      harness.cashEntryService.addEntry('t1', OWNER, {
        entryDate: '2026-01-01',
        memo: 'x',
        category: '薪水',
        accountName: '現金',
        income: 0,
        expense: 0,
      }),
    ).rejects.toMatchObject({ code: 'INCOME_EXPENSE_MUTUAL_EXCLUSION' });
  });

  it('E4 — rejects an income entry against an expense-type category', async () => {
    await expect(
      harness.cashEntryService.addEntry('t1', OWNER, {
        entryDate: '2026-01-01',
        memo: 'x',
        category: '餐費', // expense-type category
        accountName: '現金',
        income: 100,
        expense: 0,
      }),
    ).rejects.toMatchObject({ code: 'CATEGORY_NOT_FOUND_OR_INACTIVE' });
  });

  it('E5 — rejects updating a transfer-linked entry', async () => {
    await harness.accountService.createAccount('t1', { accountName: '銀行' });
    const { entries } = await harness.transferService.createTransfer('t1', OWNER, {
      entryDate: '2026-01-01',
      fromAccountName: '現金',
      toAccountName: '銀行',
      amount: 50,
    });

    await expect(
      harness.cashEntryService.updateEntry('t1', entries[0].id, {
        entryDate: '2026-01-02',
        memo: '改過的備註',
        category: '帳戶轉帳',
        accountName: '現金',
        income: 0,
        expense: 60,
      }),
    ).rejects.toMatchObject({ code: 'ENTRY_TRANSFER_IMMUTABLE' });
  });

  it('E6 — deletes a normal (non-transfer) entry', async () => {
    const entry = await harness.cashEntryService.addEntry('t1', OWNER, {
      entryDate: '2026-01-01',
      memo: '薪水',
      category: '薪水',
      accountName: '現金',
      income: 100,
      expense: 0,
    });

    const result = await harness.cashEntryService.deleteEntry('t1', entry.id);
    expect(result.deletedCount).toBe(1);
    expect(result.transferCode).toBeNull();

    const remaining = await harness.cashEntryService.listEntries('t1', {});
    expect(remaining).toHaveLength(0);
  });
});
