import { describe, expect, it } from 'vitest';
import { OWNER } from '../testHarness.js';
import { createAccountingHarness } from './accountingHarness.js';

// Accounting Module v0.4 — Manual Journal Entry + General Voucher. Required
// evidence per the Gate Review final PASS (3 rounds): draft/posted
// separation (a draft never affects TB/IS/BS while unposted), the
// provenance contract (manual/GL vs. module/CASH), the single shared
// inactive-COA enforcement point across BOTH posting paths, atomic
// UnitOfWork posting (including a late-failure rollback), and the
// backward-compatible provenance migration.

async function setupTenant(tenantId = 't1') {
  const h = createAccountingHarness();
  await h.accountService.createAccount(tenantId, { accountName: '現金' });
  await h.categoryService.createCategory(tenantId, { categoryName: '課程收入', categoryType: 'income' });
  await h.categoryService.createCategory(tenantId, { categoryName: '房租', categoryType: 'expense' });

  const cashGl = await h.chartOfAccountService.createChartOfAccount(tenantId, { code: '1101', name: '庫存現金', type: 'asset' });
  const revenueGl = await h.chartOfAccountService.createChartOfAccount(tenantId, { code: '4101', name: '課程收入科目', type: 'revenue' });
  const expenseGl = await h.chartOfAccountService.createChartOfAccount(tenantId, { code: '5101', name: '房租費用', type: 'expense' });
  const bankGl = await h.chartOfAccountService.createChartOfAccount(tenantId, { code: '1102', name: '銀行存款', type: 'asset' });

  const cashAccount = (await h.accountService.listForAdmin(tenantId))[0]!;
  await h.chartOfAccountService.setAccountMapping(tenantId, cashAccount.id, cashGl.id);
  await h.chartOfAccountService.setCategoryMapping(tenantId, '課程收入', revenueGl.id);
  await h.chartOfAccountService.setCategoryMapping(tenantId, '房租', expenseGl.id);

  return { ...h, cashGl, revenueGl, expenseGl, bankGl };
}

async function makeIncomeEntry(h: Awaited<ReturnType<typeof setupTenant>>, tenantId: string, entryDate: string, amount: number, memo: string) {
  return h.cashEntryService.addEntry(tenantId, OWNER, { entryDate, memo, category: '課程收入', accountName: '現金', income: amount, expense: 0 });
}

function balancedLines(h: Awaited<ReturnType<typeof setupTenant>>, amount = 1000) {
  return [
    { chartOfAccountId: h.cashGl.id, debit: amount, credit: 0 },
    { chartOfAccountId: h.bankGl.id, debit: 0, credit: amount },
  ];
}

function zeroArtifacts(h: Awaited<ReturnType<typeof setupTenant>>) {
  expect(h.accountingDb.journalEntries.size).toBe(0);
  expect(h.accountingDb.journalLines.size).toBe(0);
  expect(h.accountingDb.vouchers.size).toBe(0);
}

describe('Accounting Module v0.4 — GeneralVoucherDraft CRUD + tenant isolation', () => {
  it('creates, lists, gets, updates and deletes a draft scoped to its own tenant', async () => {
    const h = await setupTenant('t1');
    const draft = await h.generalVoucherService.createDraft('t1', {
      entryDate: '2026-02-01',
      memo: '手動調整分錄',
      lines: balancedLines(h),
    });
    expect(draft.status).toBe('draft');
    expect(draft.lines).toHaveLength(2);

    const fetched = await h.generalVoucherService.getDraft('t1', draft.id);
    expect(fetched.id).toBe(draft.id);

    const listed = await h.generalVoucherService.listDrafts('t1');
    expect(listed.map((d) => d.id)).toEqual([draft.id]);

    const updated = await h.generalVoucherService.updateDraft('t1', draft.id, {
      entryDate: '2026-02-02',
      memo: '更新後的摘要',
      lines: balancedLines(h, 500),
    });
    expect(updated.memo).toBe('更新後的摘要');
    expect(updated.lines[0]!.debit).toBe(500);

    await h.generalVoucherService.deleteDraft('t1', draft.id);
    await expect(h.generalVoucherService.getDraft('t1', draft.id)).rejects.toMatchObject({ code: 'GENERAL_VOUCHER_DRAFT_NOT_FOUND' });
  });

  it('draft lines may be incomplete/invalid at create/update time — no strict validation until postDraft', async () => {
    const h = await setupTenant('t1');
    const draft = await h.generalVoucherService.createDraft('t1', {
      entryDate: '2026-02-01',
      memo: '不完整草稿',
      lines: [{ chartOfAccountId: h.cashGl.id, debit: 100, credit: 0 }], // only 1 line, unbalanced
    });
    expect(draft.status).toBe('draft');
    expect(draft.lines).toHaveLength(1);
  });

  it('tenant isolation: a draft created under one tenant is invisible to another', async () => {
    const h = await setupTenant('t1');
    const draft = await h.generalVoucherService.createDraft('t1', { entryDate: '2026-02-01', memo: 'x', lines: balancedLines(h) });

    await expect(h.generalVoucherService.getDraft('t2', draft.id)).rejects.toMatchObject({ code: 'GENERAL_VOUCHER_DRAFT_NOT_FOUND' });
    await expect(h.generalVoucherService.updateDraft('t2', draft.id, { entryDate: '2026-02-01', memo: 'y', lines: balancedLines(h) })).rejects.toMatchObject({
      code: 'GENERAL_VOUCHER_DRAFT_NOT_FOUND',
    });
    await expect(h.generalVoucherService.deleteDraft('t2', draft.id)).rejects.toMatchObject({ code: 'GENERAL_VOUCHER_DRAFT_NOT_FOUND' });
    await expect(h.generalVoucherService.postDraft('t2', draft.id)).rejects.toMatchObject({ code: 'GENERAL_VOUCHER_DRAFT_NOT_FOUND' });
    expect(await h.generalVoucherService.listDrafts('t2')).toEqual([]);
  });
});

describe('Accounting Module v0.4 — postDraft validation, zero artifacts on failure', () => {
  it('fewer than 2 lines cannot post (GENERAL_VOUCHER_MIN_LINES), zero artifacts created', async () => {
    const h = await setupTenant();
    const draft = await h.generalVoucherService.createDraft('t1', {
      entryDate: '2026-02-01',
      memo: '單行',
      lines: [{ chartOfAccountId: h.cashGl.id, debit: 100, credit: 0 }],
    });

    await expect(h.generalVoucherService.postDraft('t1', draft.id)).rejects.toMatchObject({ code: 'GENERAL_VOUCHER_MIN_LINES' });
    zeroArtifacts(h);
    expect((await h.generalVoucherService.getDraft('t1', draft.id)).status).toBe('draft');
  });

  it('a line with both debit>0 and credit>0 cannot post (GENERAL_VOUCHER_INVALID_LINE)', async () => {
    const h = await setupTenant();
    const draft = await h.generalVoucherService.createDraft('t1', {
      entryDate: '2026-02-01',
      memo: '雙邊金額',
      lines: [
        { chartOfAccountId: h.cashGl.id, debit: 100, credit: 100 },
        { chartOfAccountId: h.bankGl.id, debit: 0, credit: 100 },
      ],
    });

    await expect(h.generalVoucherService.postDraft('t1', draft.id)).rejects.toMatchObject({ code: 'GENERAL_VOUCHER_INVALID_LINE' });
    zeroArtifacts(h);
  });

  it('a line with negative debit or credit cannot post (GENERAL_VOUCHER_INVALID_LINE)', async () => {
    const h = await setupTenant();
    const draft = await h.generalVoucherService.createDraft('t1', {
      entryDate: '2026-02-01',
      memo: '負數',
      lines: [
        { chartOfAccountId: h.cashGl.id, debit: -100, credit: 0 },
        { chartOfAccountId: h.bankGl.id, debit: 0, credit: 100 },
      ],
    });

    await expect(h.generalVoucherService.postDraft('t1', draft.id)).rejects.toMatchObject({ code: 'GENERAL_VOUCHER_INVALID_LINE' });
    zeroArtifacts(h);
  });

  it('a completely empty line (debit=0 and credit=0) cannot post (GENERAL_VOUCHER_INVALID_LINE)', async () => {
    const h = await setupTenant();
    const draft = await h.generalVoucherService.createDraft('t1', {
      entryDate: '2026-02-01',
      memo: '空行',
      lines: [
        { chartOfAccountId: h.cashGl.id, debit: 0, credit: 0 },
        { chartOfAccountId: h.bankGl.id, debit: 0, credit: 100 },
      ],
    });

    await expect(h.generalVoucherService.postDraft('t1', draft.id)).rejects.toMatchObject({ code: 'GENERAL_VOUCHER_INVALID_LINE' });
    zeroArtifacts(h);
  });

  it('a blank chartOfAccountId cannot post (GENERAL_VOUCHER_INVALID_LINE)', async () => {
    const h = await setupTenant();
    const draft = await h.generalVoucherService.createDraft('t1', {
      entryDate: '2026-02-01',
      memo: '缺科目',
      lines: [
        { chartOfAccountId: '', debit: 100, credit: 0 },
        { chartOfAccountId: h.bankGl.id, debit: 0, credit: 100 },
      ],
    });

    await expect(h.generalVoucherService.postDraft('t1', draft.id)).rejects.toMatchObject({ code: 'GENERAL_VOUCHER_INVALID_LINE' });
    zeroArtifacts(h);
  });

  it('unbalanced ΣDebit≠ΣCredit cannot post (GENERAL_VOUCHER_UNBALANCED), zero artifacts created', async () => {
    const h = await setupTenant();
    const draft = await h.generalVoucherService.createDraft('t1', {
      entryDate: '2026-02-01',
      memo: '不平衡',
      lines: [
        { chartOfAccountId: h.cashGl.id, debit: 100, credit: 0 },
        { chartOfAccountId: h.bankGl.id, debit: 0, credit: 99 },
      ],
    });

    await expect(h.generalVoucherService.postDraft('t1', draft.id)).rejects.toMatchObject({ code: 'GENERAL_VOUCHER_UNBALANCED' });
    zeroArtifacts(h);
  });

  it('posting to an inactive COA is blocked (CHART_OF_ACCOUNT_INACTIVE), zero artifacts created — and the Cash-mapping path is ALSO blocked by the same rule', async () => {
    const h = await setupTenant();
    await h.chartOfAccountService.setChartOfAccountActive('t1', h.bankGl.id, false);

    const draft = await h.generalVoucherService.createDraft('t1', { entryDate: '2026-02-01', memo: '停用科目', lines: balancedLines(h) });
    await expect(h.generalVoucherService.postDraft('t1', draft.id)).rejects.toMatchObject({ code: 'CHART_OF_ACCOUNT_INACTIVE' });
    zeroArtifacts(h);

    // Same single enforcement point also blocks the Cash-mapping path: map
    // the cash account to the now-inactive bank GL and confirm journalizeEntry fails too.
    await h.chartOfAccountService.setAccountMapping('t1', (await h.accountService.listForAdmin('t1'))[0]!.id, h.bankGl.id);
    const entry = await makeIncomeEntry(h, 't1', '2026-02-05', 500, '現金收入');
    await expect(h.journalEntryService.journalizeEntry('t1', entry)).rejects.toMatchObject({ code: 'CHART_OF_ACCOUNT_INACTIVE' });
    zeroArtifacts(h);
  });

  it('posting to a COA belonging to a different tenant is blocked (CHART_OF_ACCOUNT_NOT_FOUND) — tenant isolation on posting', async () => {
    const h = await setupTenant('t1');
    const other = await setupTenant('t2');

    const draft = await h.generalVoucherService.createDraft('t1', {
      entryDate: '2026-02-01',
      memo: '跨租戶科目',
      lines: [
        { chartOfAccountId: h.cashGl.id, debit: 100, credit: 0 },
        { chartOfAccountId: other.bankGl.id, debit: 0, credit: 100 },
      ],
    });

    await expect(h.generalVoucherService.postDraft('t1', draft.id)).rejects.toMatchObject({ code: 'CHART_OF_ACCOUNT_NOT_FOUND' });
    zeroArtifacts(h);
  });

  it('posting into a closed fiscal period is blocked (JOURNAL_ENTRY_PERIOD_CLOSED), zero artifacts created', async () => {
    const h = await setupTenant();
    const period = await h.fiscalPeriodService.createFiscalPeriod('t1', { name: 'Feb', startDate: '2026-02-01', endDate: '2026-02-28' });
    await h.fiscalPeriodService.closePeriod('t1', period.id);

    const draft = await h.generalVoucherService.createDraft('t1', { entryDate: '2026-02-15', memo: '關帳期間', lines: balancedLines(h) });
    await expect(h.generalVoucherService.postDraft('t1', draft.id)).rejects.toMatchObject({ code: 'JOURNAL_ENTRY_PERIOD_CLOSED' });
    zeroArtifacts(h);
    expect((await h.generalVoucherService.getDraft('t1', draft.id)).status).toBe('draft');
  });

  it('a posted draft cannot be updated or deleted (GENERAL_VOUCHER_ALREADY_POSTED)', async () => {
    const h = await setupTenant();
    const draft = await h.generalVoucherService.createDraft('t1', { entryDate: '2026-02-01', memo: '將過帳', lines: balancedLines(h) });
    await h.generalVoucherService.postDraft('t1', draft.id);

    await expect(
      h.generalVoucherService.updateDraft('t1', draft.id, { entryDate: '2026-02-01', memo: 'x', lines: balancedLines(h) }),
    ).rejects.toMatchObject({ code: 'GENERAL_VOUCHER_ALREADY_POSTED' });
    await expect(h.generalVoucherService.deleteDraft('t1', draft.id)).rejects.toMatchObject({ code: 'GENERAL_VOUCHER_ALREADY_POSTED' });
    await expect(h.generalVoucherService.postDraft('t1', draft.id)).rejects.toMatchObject({ code: 'GENERAL_VOUCHER_ALREADY_POSTED' });
  });
});

describe('Accounting Module v0.4 — successful post', () => {
  it('creates exactly one JournalEntry + correct JournalLines + one Voucher, marks the draft posted, and carries manual/GL provenance', async () => {
    const h = await setupTenant();
    const draft = await h.generalVoucherService.createDraft('t1', {
      entryDate: '2026-02-10',
      memo: '銀行轉存',
      lines: balancedLines(h, 2000),
    });

    const journalEntry = await h.generalVoucherService.postDraft('t1', draft.id);

    expect(h.accountingDb.journalEntries.size).toBe(1);
    expect(h.accountingDb.journalLines.size).toBe(2);
    expect(h.accountingDb.vouchers.size).toBe(1);

    expect(journalEntry.amount).toBe(2000);
    expect(journalEntry.sourceType).toBe('manual');
    expect(journalEntry.sourceModule).toBe('GL');
    expect(journalEntry.sourceReferenceId).toBe(draft.id);
    expect(journalEntry.sourceCashEntryId).toBeUndefined();
    expect(journalEntry.lines).toHaveLength(2);
    expect(journalEntry.lines.find((l) => l.chartOfAccountId === h.cashGl.id)?.debit).toBe(2000);
    expect(journalEntry.lines.find((l) => l.chartOfAccountId === h.bankGl.id)?.credit).toBe(2000);

    const postedDraft = await h.generalVoucherService.getDraft('t1', draft.id);
    expect(postedDraft.status).toBe('posted');
    expect(postedDraft.postedJournalEntryId).toBe(journalEntry.id);
  });

  it('a posted manual JournalEntry flows into Trial Balance / Income Statement / Balance Sheet; a draft never affects any report while unposted', async () => {
    const h = await setupTenant();
    const draft = await h.generalVoucherService.createDraft('t1', {
      entryDate: '2026-02-10',
      memo: '銀行轉存',
      lines: balancedLines(h, 3000),
    });

    const tbBefore = await h.trialBalanceService.getTrialBalance('t1', { asOfDate: '2026-02-28' });
    expect(tbBefore.totalPeriodDebit).toBe(0);
    expect(tbBefore.totalPeriodCredit).toBe(0);

    await h.generalVoucherService.postDraft('t1', draft.id);

    const tbAfter = await h.trialBalanceService.getTrialBalance('t1', { asOfDate: '2026-02-28' });
    expect(tbAfter.totalPeriodDebit).toBe(3000);
    expect(tbAfter.totalPeriodCredit).toBe(3000);
    const cashLine = tbAfter.lines.find((l) => l.chartOfAccountId === h.cashGl.id)!;
    expect(cashLine.endingBalance).toBe(3000);
    const bankLine = tbAfter.lines.find((l) => l.chartOfAccountId === h.bankGl.id)!;
    expect(bankLine.endingBalance).toBe(-3000);

    const bs = await h.balanceSheetService.getBalanceSheet('t1', '2026-02-28');
    expect(bs.totalAssets).toBe(bs.totalLiabilities + bs.totalEquity + bs.currentEarnings);

    // Income Statement is unaffected by an asset<->asset transfer.
    const is = await h.incomeStatementService.getIncomeStatement('t1', { toDate: '2026-02-28' });
    expect(is.totalRevenue).toBe(0);
    expect(is.totalExpense).toBe(0);
  });
});

describe('Accounting Module v0.4 — UnitOfWork atomicity', () => {
  it('a late injected failure (after JournalEntry+JournalLines+Voucher exist) rolls back ALL of them and leaves the draft at status=draft', async () => {
    const h = await setupTenant();
    const draft = await h.generalVoucherService.createDraft('t1', { entryDate: '2026-02-10', memo: '晚期失敗', lines: balancedLines(h) });

    // Inject a failure on the LAST internal step (the draft-status update)
    // by monkey-patching the repository's update method for this one call.
    const originalUpdate = h.accountingDb.generalVoucherDrafts.set.bind(h.accountingDb.generalVoucherDrafts);
    let calls = 0;
    h.accountingDb.generalVoucherDrafts.set = (...args: Parameters<typeof originalUpdate>) => {
      calls += 1;
      if (calls === 1) throw new Error('simulated late failure after JournalEntry/JournalLines/Voucher were created');
      return originalUpdate(...args);
    };

    await expect(h.generalVoucherService.postDraft('t1', draft.id)).rejects.toThrow('simulated late failure');

    // Restore the real Map method so later assertions/repositories work normally.
    h.accountingDb.generalVoucherDrafts.set = originalUpdate;

    zeroArtifacts(h);
    const stillDraft = await h.generalVoucherService.getDraft('t1', draft.id);
    expect(stillDraft.status).toBe('draft');
    expect(stillDraft.postedJournalEntryId).toBeUndefined();
  });

  it('an early failure point (e.g. inactive COA, before any mutation) also leaves zero artifacts — for contrast with the late-failure case above', async () => {
    const h = await setupTenant();
    await h.chartOfAccountService.setChartOfAccountActive('t1', h.bankGl.id, false);
    const draft = await h.generalVoucherService.createDraft('t1', { entryDate: '2026-02-10', memo: '早期失敗', lines: balancedLines(h) });

    await expect(h.generalVoucherService.postDraft('t1', draft.id)).rejects.toMatchObject({ code: 'CHART_OF_ACCOUNT_INACTIVE' });

    zeroArtifacts(h);
    const stillDraft = await h.generalVoucherService.getDraft('t1', draft.id);
    expect(stillDraft.status).toBe('draft');
  });
});

describe('Accounting Module v0.4 — Cash-derived provenance regression', () => {
  it('Cash-derived JournalEntries continue to work exactly as before and now carry module/CASH provenance, with sourceCashEntryId still set', async () => {
    const h = await setupTenant();
    const entry = await makeIncomeEntry(h, 't1', '2026-02-01', 1000, '學費');
    const journalEntry = await h.journalEntryService.journalizeEntry('t1', entry);

    expect(journalEntry.sourceType).toBe('module');
    expect(journalEntry.sourceModule).toBe('CASH');
    expect(journalEntry.sourceReferenceId).toBe(entry.id);
    expect(journalEntry.sourceCashEntryId).toBe(entry.id);
  });
});

describe('Accounting Module v0.4 — processPending inactiveAccount bucket', () => {
  it('a mixed batch with one entry mapped to a now-inactive COA counts it separately (inactiveAccount) without aborting the rest; classification order holds', async () => {
    const h = await setupTenant();

    const okEntry = await makeIncomeEntry(h, 't1', '2026-02-01', 1000, '正常收入');
    const inactiveEntry = await makeIncomeEntry(h, 't1', '2026-02-02', 2000, '停用科目收入');

    // Journalize okEntry first so it becomes alreadyJournaled on the next run.
    await h.journalEntryService.journalizeEntry('t1', okEntry);

    // Deactivate the revenue GL so inactiveEntry's mapping now resolves to an inactive account.
    await h.chartOfAccountService.setChartOfAccountActive('t1', h.revenueGl.id, false);

    const period = await h.fiscalPeriodService.createFiscalPeriod('t1', { name: 'Jan', startDate: '2026-01-01', endDate: '2026-01-31' });
    await h.fiscalPeriodService.closePeriod('t1', period.id);
    // Uses the (still-active) expense mapping, not the revenue mapping that
    // was just deactivated above — otherwise this would land in the
    // inactiveAccount bucket instead of periodClosed.
    const closedEntry = await h.cashEntryService.addEntry('t1', OWNER, {
      entryDate: '2026-01-15',
      memo: '關帳期間支出',
      category: '房租',
      accountName: '現金',
      income: 0,
      expense: 500,
    });

    await h.categoryService.createCategory('t1', { categoryName: '未對應支出', categoryType: 'expense' });
    const unmappedExpense = await h.cashEntryService.addEntry('t1', OWNER, {
      entryDate: '2026-02-03',
      memo: '未對應科目',
      category: '未對應支出',
      accountName: '現金',
      income: 0,
      expense: 300,
    });

    const allEntries = await h.cashEntryService.listEntries('t1', {});
    const result = await h.journalEntryService.processPending('t1', allEntries);

    expect(result.alreadyJournaled).toBe(1); // okEntry
    expect(result.inactiveAccount).toBe(1); // inactiveEntry
    expect(result.periodClosed).toBe(1); // closedEntry
    expect(result.unmapped).toBe(1); // unmappedExpense
    expect(result.excluded).toBe(0);
    expect(result.journaled).toBe(0);

    expect(await h.journalEntryService.getJournalEntryBySource('t1', inactiveEntry.id)).toBeNull();
    expect(await h.journalEntryService.getJournalEntryBySource('t1', closedEntry.id)).toBeNull();
  });
});
