import { beforeEach, describe, expect, it } from 'vitest';
import { createHarness, OWNER } from './testHarness.js';

// Spec: docs/gates/characterization-test-spec.md § Summary / Aggregation

describe('Summary', () => {
  let harness: ReturnType<typeof createHarness>;

  beforeEach(async () => {
    harness = createHarness();
    await harness.accountService.createAccount('t1', { accountName: '現金' });
    await harness.accountService.createAccount('t1', { accountName: '銀行' });
    await harness.categoryService.createCategory('t1', { categoryName: '薪水', categoryType: 'income' });
    await harness.categoryService.createCategory('t1', { categoryName: '餐費', categoryType: 'expense' });
  });

  it('S1 — lifetime totals exclude transfer-linked entries', async () => {
    await harness.cashEntryService.addEntry('t1', OWNER, {
      entryDate: '2026-01-01',
      memo: '薪水',
      category: '薪水',
      accountName: '現金',
      income: 1000,
      expense: 0,
    });
    await harness.transferService.createTransfer('t1', OWNER, {
      entryDate: '2026-01-02',
      fromAccountName: '現金',
      toAccountName: '銀行',
      amount: 300,
    });

    const summary = await harness.cashEntryService.getSummary('t1');
    expect(summary.incomeTotal).toBe(1000);
    expect(summary.expenseTotal).toBe(0);
    expect(summary.balance).toBe(1000);
  });

  it('S2 — month-to-date totals include only in-month, non-transfer entries', async () => {
    const referenceDate = new Date(2026, 0, 15); // Jan 15, 2026

    await harness.cashEntryService.addEntry('t1', OWNER, {
      entryDate: '2026-01-10',
      memo: '本月薪水',
      category: '薪水',
      accountName: '現金',
      income: 500,
      expense: 0,
    });
    await harness.cashEntryService.addEntry('t1', OWNER, {
      entryDate: '2025-12-20',
      memo: '上月薪水',
      category: '薪水',
      accountName: '現金',
      income: 999,
      expense: 0,
    });
    await harness.cashEntryService.addEntry('t1', OWNER, {
      entryDate: '2026-01-11',
      memo: '本月午餐',
      category: '餐費',
      accountName: '現金',
      income: 0,
      expense: 100,
    });

    const summary = await harness.cashEntryService.getSummary('t1', referenceDate);
    expect(summary.monthIncome).toBe(500);
    expect(summary.monthExpense).toBe(100);
  });

  it('S3 — monthBalance = monthIncome − monthExpense', async () => {
    const referenceDate = new Date(2026, 0, 15);
    await harness.cashEntryService.addEntry('t1', OWNER, {
      entryDate: '2026-01-05',
      memo: '薪水',
      category: '薪水',
      accountName: '現金',
      income: 300,
      expense: 0,
    });
    await harness.cashEntryService.addEntry('t1', OWNER, {
      entryDate: '2026-01-06',
      memo: '午餐',
      category: '餐費',
      accountName: '現金',
      income: 0,
      expense: 120,
    });

    const summary = await harness.cashEntryService.getSummary('t1', referenceDate);
    expect(summary.monthBalance).toBe(summary.monthIncome - summary.monthExpense);
    expect(summary.monthBalance).toBe(180);
  });
});
