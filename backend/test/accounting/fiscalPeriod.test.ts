import { describe, expect, it } from 'vitest';
import { OWNER } from '../testHarness.js';
import { createAccountingHarness } from './accountingHarness.js';

// Accounting Module v0.3 — Fiscal Period + Close Lock. Required evidence
// per the Gate Review PASS on the revised plan (Slack #ai-gate-test):
// tenant isolation + overlap rejection on period creation/listing/closing,
// inclusive boundary handling, closed-period posting lock (strict single
// entry + independent batch semantics), idempotent processPending,
// fiscalPeriodId/explicit-date equivalence across all three statements,
// and the v0.2 Balance Sheet invariant surviving fiscalPeriodId queries.

async function setupTenant(tenantId = 't1') {
  const h = createAccountingHarness();
  await h.accountService.createAccount(tenantId, { accountName: '現金' });
  await h.categoryService.createCategory(tenantId, { categoryName: '課程收入', categoryType: 'income' });
  await h.categoryService.createCategory(tenantId, { categoryName: '房租', categoryType: 'expense' });

  const cashGl = await h.chartOfAccountService.createChartOfAccount(tenantId, { code: '1101', name: '庫存現金', type: 'asset' });
  const revenueGl = await h.chartOfAccountService.createChartOfAccount(tenantId, { code: '4101', name: '課程收入科目', type: 'revenue' });
  const expenseGl = await h.chartOfAccountService.createChartOfAccount(tenantId, { code: '5101', name: '房租費用', type: 'expense' });

  const cashAccount = (await h.accountService.listForAdmin(tenantId))[0]!;
  await h.chartOfAccountService.setAccountMapping(tenantId, cashAccount.id, cashGl.id);
  await h.chartOfAccountService.setCategoryMapping(tenantId, '課程收入', revenueGl.id);
  await h.chartOfAccountService.setCategoryMapping(tenantId, '房租', expenseGl.id);

  return { ...h, cashGl, revenueGl, expenseGl };
}

async function makeIncomeEntry(h: Awaited<ReturnType<typeof setupTenant>>, tenantId: string, entryDate: string, amount: number, memo: string) {
  return h.cashEntryService.addEntry(tenantId, OWNER, { entryDate, memo, category: '課程收入', accountName: '現金', income: amount, expense: 0 });
}

describe('Accounting Module v0.3 — FiscalPeriodService creation/tenant isolation', () => {
  it('rejects a start date after the end date', async () => {
    const h = await setupTenant();
    await expect(h.fiscalPeriodService.createFiscalPeriod('t1', { name: 'Q1', startDate: '2026-03-31', endDate: '2026-01-01' })).rejects.toMatchObject({
      code: 'FISCAL_PERIOD_INVALID_RANGE',
    });
  });

  it('rejects a same-tenant overlapping period but allows an identical range for a different tenant', async () => {
    const h = await setupTenant('t1');
    await setupTenant('t2'); // separate tenant, same harness instance's underlying stores are shared but tenant-scoped
    await h.fiscalPeriodService.createFiscalPeriod('t1', { name: 'Jan', startDate: '2026-01-01', endDate: '2026-01-31' });

    await expect(
      h.fiscalPeriodService.createFiscalPeriod('t1', { name: 'Overlap', startDate: '2026-01-15', endDate: '2026-02-15' }),
    ).rejects.toMatchObject({ code: 'FISCAL_PERIOD_OVERLAPS' });

    // Non-overlapping (gap allowed) succeeds.
    await expect(
      h.fiscalPeriodService.createFiscalPeriod('t1', { name: 'Feb', startDate: '2026-02-01', endDate: '2026-02-28' }),
    ).resolves.toMatchObject({ status: 'open' });

    // Identical range for a different tenant is unrelated and allowed.
    await expect(
      h.fiscalPeriodService.createFiscalPeriod('t2', { name: 'Jan (t2)', startDate: '2026-01-01', endDate: '2026-01-31' }),
    ).resolves.toMatchObject({ tenantId: 't2' });
  });

  it('lists and closes periods scoped to their own tenant only', async () => {
    const h = await setupTenant('t1');
    const p1 = await h.fiscalPeriodService.createFiscalPeriod('t1', { name: 'Jan', startDate: '2026-01-01', endDate: '2026-01-31' });
    await h.fiscalPeriodService.createFiscalPeriod('t2', { name: 'Jan (t2)', startDate: '2026-01-01', endDate: '2026-01-31' });

    const t1Periods = await h.fiscalPeriodService.listFiscalPeriods('t1');
    expect(t1Periods.map((p) => p.id)).toEqual([p1.id]);

    // Tenant t2 cannot close tenant t1's period.
    await expect(h.fiscalPeriodService.closePeriod('t2', p1.id)).rejects.toMatchObject({ code: 'FISCAL_PERIOD_NOT_FOUND' });
  });

  it('close is one-directional and idempotent-safe: closing an already-closed period is an explicit error, never a silent no-op or inconsistent state', async () => {
    const h = await setupTenant();
    const period = await h.fiscalPeriodService.createFiscalPeriod('t1', { name: 'Jan', startDate: '2026-01-01', endDate: '2026-01-31' });

    const closed = await h.fiscalPeriodService.closePeriod('t1', period.id);
    expect(closed.status).toBe('closed');
    expect(closed.closedAt).toBeInstanceOf(Date);

    await expect(h.fiscalPeriodService.closePeriod('t1', period.id)).rejects.toMatchObject({ code: 'FISCAL_PERIOD_ALREADY_CLOSED' });
  });
});

describe('Accounting Module v0.3 — closed-period posting lock (inclusive boundary)', () => {
  it('entryDate exactly on startDate or endDate is treated as inside the period', async () => {
    const h = await setupTenant();
    const period = await h.fiscalPeriodService.createFiscalPeriod('t1', { name: 'Jan', startDate: '2026-01-01', endDate: '2026-01-31' });
    await h.fiscalPeriodService.closePeriod('t1', period.id);

    expect(await h.fiscalPeriodService.isDateInClosedPeriod('t1', '2026-01-01')).toBe(true);
    expect(await h.fiscalPeriodService.isDateInClosedPeriod('t1', '2026-01-31')).toBe(true);
    expect(await h.fiscalPeriodService.isDateInClosedPeriod('t1', '2025-12-31')).toBe(false);
    expect(await h.fiscalPeriodService.isDateInClosedPeriod('t1', '2026-02-01')).toBe(false);
  });

  it('an entryDate outside every defined period is never considered closed and can still be journalized', async () => {
    const h = await setupTenant();
    const period = await h.fiscalPeriodService.createFiscalPeriod('t1', { name: 'Jan', startDate: '2026-01-01', endDate: '2026-01-31' });
    await h.fiscalPeriodService.closePeriod('t1', period.id);

    const entry = await makeIncomeEntry(h, 't1', '2026-02-15', 1000, '2月無期間');
    const journalEntry = await h.journalEntryService.journalizeEntry('t1', entry);
    expect(journalEntry.sourceCashEntryId).toBe(entry.id);
  });

  it('direct journalizeEntry into a closed period is rejected with zero JournalEntry/JournalLine/Voucher rows created', async () => {
    const h = await setupTenant();
    const period = await h.fiscalPeriodService.createFiscalPeriod('t1', { name: 'Jan', startDate: '2026-01-01', endDate: '2026-01-31' });
    await h.fiscalPeriodService.closePeriod('t1', period.id);

    const entry = await makeIncomeEntry(h, 't1', '2026-01-15', 1000, '一月學費');

    await expect(h.journalEntryService.journalizeEntry('t1', entry)).rejects.toMatchObject({ code: 'JOURNAL_ENTRY_PERIOD_CLOSED' });

    expect(h.accountingDb.journalEntries.size).toBe(0);
    expect(h.accountingDb.journalLines.size).toBe(0);
    expect(h.accountingDb.vouchers.size).toBe(0);
  });

  it('processPending handles a mixed batch independently — closed-period entries are skipped and counted, without aborting the rest', async () => {
    const h = await setupTenant();
    const period = await h.fiscalPeriodService.createFiscalPeriod('t1', { name: 'Jan', startDate: '2026-01-01', endDate: '2026-01-31' });
    await h.fiscalPeriodService.closePeriod('t1', period.id);

    const closedEntry = await makeIncomeEntry(h, 't1', '2026-01-15', 1000, 'closed period');
    const openEntry = await makeIncomeEntry(h, 't1', '2026-02-15', 2000, 'open period');
    const noPeriodEntry = await makeIncomeEntry(h, 't1', '2026-05-01', 3000, 'no period at all');

    const allEntries = await h.cashEntryService.listEntries('t1', {});
    const result = await h.journalEntryService.processPending('t1', allEntries);

    expect(result.journaled).toBe(2);
    expect(result.periodClosed).toBe(1);
    expect(result.alreadyJournaled).toBe(0);
    expect(result.unmapped).toBe(0);
    expect(result.excluded).toBe(0);

    expect(await h.journalEntryService.getJournalEntryBySource('t1', closedEntry.id)).toBeNull();
    expect(await h.journalEntryService.getJournalEntryBySource('t1', openEntry.id)).not.toBeNull();
    expect(await h.journalEntryService.getJournalEntryBySource('t1', noPeriodEntry.id)).not.toBeNull();
  });

  it('repeated processPending is idempotent: already-journalized entries are classified as alreadyJournaled, not re-counted as periodClosed, even after their period closes later', async () => {
    const h = await setupTenant();
    const entry = await makeIncomeEntry(h, 't1', '2026-01-15', 1000, '先入帳再關帳');

    const firstRun = await h.journalEntryService.processPending('t1', [entry]);
    expect(firstRun.journaled).toBe(1);

    const period = await h.fiscalPeriodService.createFiscalPeriod('t1', { name: 'Jan', startDate: '2026-01-01', endDate: '2026-01-31' });
    await h.fiscalPeriodService.closePeriod('t1', period.id);

    const secondRun = await h.journalEntryService.processPending('t1', [entry]);
    expect(secondRun.alreadyJournaled).toBe(1);
    expect(secondRun.periodClosed).toBe(0);
    expect(secondRun.journaled).toBe(0);

    // Still exactly one JournalEntry — the historical posting was never disturbed.
    expect(h.accountingDb.journalEntries.size).toBe(1);
  });
});

describe('Accounting Module v0.3 — fiscalPeriodId statement resolution equals explicit-date equivalent', () => {
  async function setupWithData() {
    const h = await setupTenant();
    const entry1 = await makeIncomeEntry(h, 't1', '2026-01-10', 30000, '一月學費');
    await h.journalEntryService.journalizeEntry('t1', entry1);
    const expenseEntry = await h.cashEntryService.addEntry('t1', OWNER, {
      entryDate: '2026-01-15',
      memo: '房租',
      category: '房租',
      accountName: '現金',
      income: 0,
      expense: 5000,
    });
    await h.journalEntryService.journalizeEntry('t1', expenseEntry);

    const period = await h.fiscalPeriodService.createFiscalPeriod('t1', { name: 'Jan', startDate: '2026-01-01', endDate: '2026-01-31' });
    return { ...h, period };
  }

  it('Trial Balance via fiscalPeriodId matches the explicit-date equivalent', async () => {
    const h = await setupWithData();
    const viaPeriod = await h.trialBalanceService.getTrialBalance('t1', { fiscalPeriodId: h.period.id });
    const viaDates = await h.trialBalanceService.getTrialBalance('t1', { fromDate: '2026-01-01', asOfDate: '2026-01-31' });

    expect(viaPeriod.fromDate).toBe('2026-01-01');
    expect(viaPeriod.asOfDate).toBe('2026-01-31');
    expect(viaPeriod.fiscalPeriodId).toBe(h.period.id);
    expect(viaPeriod.lines).toEqual(viaDates.lines);
    expect(viaPeriod.totalPeriodDebit).toBe(viaDates.totalPeriodDebit);
    expect(viaPeriod.totalPeriodCredit).toBe(viaDates.totalPeriodCredit);
  });

  it('Income Statement via fiscalPeriodId matches the explicit-date equivalent', async () => {
    const h = await setupWithData();
    const viaPeriod = await h.incomeStatementService.getIncomeStatement('t1', { fiscalPeriodId: h.period.id });
    const viaDates = await h.incomeStatementService.getIncomeStatement('t1', { fromDate: '2026-01-01', toDate: '2026-01-31' });

    expect(viaPeriod.fiscalPeriodId).toBe(h.period.id);
    expect(viaPeriod.totalRevenue).toBe(viaDates.totalRevenue);
    expect(viaPeriod.totalExpense).toBe(viaDates.totalExpense);
    expect(viaPeriod.netIncome).toBe(viaDates.netIncome);
  });

  it('Balance Sheet via fiscalPeriodId uses period.endDate as as-of (never startDate) and matches the explicit as-of equivalent, including Current Earnings and the A=L+E+CE invariant', async () => {
    const h = await setupWithData();
    const viaPeriod = await h.balanceSheetService.getBalanceSheet('t1', { fiscalPeriodId: h.period.id });
    const viaDate = await h.balanceSheetService.getBalanceSheet('t1', '2026-01-31');

    expect(viaPeriod.fiscalPeriodId).toBe(h.period.id);
    expect(viaPeriod.asOfDate).toBe('2026-01-31');
    expect(viaPeriod.currentEarnings).toBe(viaDate.currentEarnings);
    expect(viaPeriod.totalAssets).toBe(viaDate.totalAssets);
    expect(viaPeriod.totalLiabilitiesAndEquity).toBe(viaDate.totalLiabilitiesAndEquity);
    expect(viaPeriod.totalAssets).toBe(viaPeriod.totalLiabilities + viaPeriod.totalEquity + viaPeriod.currentEarnings);
  });

  it('Balance Sheet Current Earnings stays cumulative since inception through period.endDate, not scoped to just that period', async () => {
    const h = await setupTenant();
    // Income before the fiscal period even starts — a real prior-period earning.
    const priorEntry = await makeIncomeEntry(h, 't1', '2025-12-01', 10000, '去年收入');
    await h.journalEntryService.journalizeEntry('t1', priorEntry);
    const periodEntry = await makeIncomeEntry(h, 't1', '2026-01-10', 30000, '一月學費');
    await h.journalEntryService.journalizeEntry('t1', periodEntry);

    const period = await h.fiscalPeriodService.createFiscalPeriod('t1', { name: 'Jan', startDate: '2026-01-01', endDate: '2026-01-31' });

    const viaPeriod = await h.balanceSheetService.getBalanceSheet('t1', { fiscalPeriodId: period.id });
    // Cumulative since inception (10000 + 30000), not just the period's own 30000.
    expect(viaPeriod.currentEarnings).toBe(40000);
  });
});

describe('Accounting Module v0.3 — no regression on Cash Module, v0.1, or v0.2 data', () => {
  it('creating/closing fiscal periods and querying statements via fiscalPeriodId never mutates Cash Module or journal/voucher data', async () => {
    const h = await setupWithData_forRegression();

    const cashEntriesBefore = JSON.stringify([...h.db.entries.values()]);
    const journalEntriesBefore = JSON.stringify([...h.accountingDb.journalEntries.values()]);
    const vouchersBefore = JSON.stringify([...h.accountingDb.vouchers.values()]);

    await h.trialBalanceService.getTrialBalance('t1', { fiscalPeriodId: h.period.id });
    await h.incomeStatementService.getIncomeStatement('t1', { fiscalPeriodId: h.period.id });
    await h.balanceSheetService.getBalanceSheet('t1', { fiscalPeriodId: h.period.id });

    expect(JSON.stringify([...h.db.entries.values()])).toBe(cashEntriesBefore);
    expect(JSON.stringify([...h.accountingDb.journalEntries.values()])).toBe(journalEntriesBefore);
    expect(JSON.stringify([...h.accountingDb.vouchers.values()])).toBe(vouchersBefore);
  });

  async function setupWithData_forRegression() {
    const h = await setupTenant();
    const entry = await makeIncomeEntry(h, 't1', '2026-01-10', 30000, '一月學費');
    await h.journalEntryService.journalizeEntry('t1', entry);
    const period = await h.fiscalPeriodService.createFiscalPeriod('t1', { name: 'Jan', startDate: '2026-01-01', endDate: '2026-01-31' });
    return { ...h, period };
  }
});
