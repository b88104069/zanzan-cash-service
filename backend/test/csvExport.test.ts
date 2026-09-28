import { beforeEach, describe, expect, it } from 'vitest';
import { createHarness, OWNER } from './testHarness.js';

// Spec: docs/gates/characterization-test-spec.md § CSV Export

describe('CSV Export', () => {
  let harness: ReturnType<typeof createHarness>;

  beforeEach(async () => {
    harness = createHarness();
    await harness.accountService.createAccount('t1', { accountName: '現金' });
    await harness.categoryService.createCategory('t1', { categoryName: '薪水', categoryType: 'income' });
    await harness.categoryService.createCategory('t1', { categoryName: '餐費', categoryType: 'expense' });

    await harness.cashEntryService.addEntry('t1', OWNER, {
      entryDate: '2026-01-01',
      memo: '薪水',
      category: '薪水',
      accountName: '現金',
      income: 1000,
      expense: 0,
    });
    await harness.cashEntryService.addEntry('t1', OWNER, {
      entryDate: '2026-01-05',
      memo: '午餐',
      category: '餐費',
      accountName: '現金',
      income: 0,
      expense: 100,
    });
    await harness.cashEntryService.addEntry('t1', OWNER, {
      entryDate: '2026-01-10',
      memo: '晚餐',
      category: '餐費',
      accountName: '現金',
      income: 0,
      expense: 80,
    });
  });

  it('CSV1 — export returns the same filtered/sorted rows as the list query', async () => {
    const filter = { startDate: '2026-01-05', endDate: '2026-01-31', order: 'asc' as const };

    const listed = await harness.cashEntryService.listEntries('t1', filter);
    const exported = await harness.exportService.getCsvRows('t1', filter);

    expect(exported).toHaveLength(listed.length);
    expect(exported.map((r) => r.memo)).toEqual(listed.map((r) => r.memo));
    expect(exported.map((r) => r.memo)).toEqual(['午餐', '晚餐']);
  });

  it('CSV1 — a keyword filter narrows both list and export identically', async () => {
    const filter = { keyword: '晚餐' };

    const listed = await harness.cashEntryService.listEntries('t1', filter);
    const exported = await harness.exportService.getCsvRows('t1', filter);

    expect(listed).toHaveLength(1);
    expect(exported).toHaveLength(1);
    expect(exported[0]?.memo).toBe('晚餐');
  });
});
