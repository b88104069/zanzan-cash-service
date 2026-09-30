import { describe, expect, it } from 'vitest';
import { normalBalanceOf, normalize } from '../../src/domain/accounting/services/accountPresentation.js';
import { OWNER } from '../testHarness.js';
import { createAccountingHarness } from './accountingHarness.js';

// Accounting Module v0.2 — Financial Statements. Required evidence per the
// Gate Review PASS on the revised plan (Slack #ai-gate-test): Trial
// Balance beginning/period/ending correctness and date-boundary handling,
// Income Statement correctness, Balance Sheet A=L+E+CurrentEarnings,
// IS/BS current-earnings equality, normal-balance sign correctness,
// abnormal balances never clamped, and zero impact on Cash Module data.

async function setupTenant() {
  const h = createAccountingHarness();
  await h.accountService.createAccount('t1', { accountName: '現金' });
  await h.categoryService.createCategory('t1', { categoryName: '課程收入', categoryType: 'income' });
  await h.categoryService.createCategory('t1', { categoryName: '房租', categoryType: 'expense' });

  const cashGl = await h.chartOfAccountService.createChartOfAccount('t1', { code: '1101', name: '庫存現金', type: 'asset' });
  const revenueGl = await h.chartOfAccountService.createChartOfAccount('t1', { code: '4101', name: '課程收入科目', type: 'revenue' });
  const expenseGl = await h.chartOfAccountService.createChartOfAccount('t1', { code: '5101', name: '房租費用', type: 'expense' });
  const liabilityGl = await h.chartOfAccountService.createChartOfAccount('t1', { code: '2101', name: '應付帳款', type: 'liability' });
  const equityGl = await h.chartOfAccountService.createChartOfAccount('t1', { code: '3101', name: '股本', type: 'equity' });

  const cashAccount = (await h.accountService.listForAdmin('t1'))[0]!;
  await h.chartOfAccountService.setAccountMapping('t1', cashAccount.id, cashGl.id);
  await h.chartOfAccountService.setCategoryMapping('t1', '課程收入', revenueGl.id);
  await h.chartOfAccountService.setCategoryMapping('t1', '房租', expenseGl.id);

  return { ...h, cashGl, revenueGl, expenseGl, liabilityGl, equityGl };
}

async function journalizeIncome(h: Awaited<ReturnType<typeof setupTenant>>, entryDate: string, amount: number, memo: string) {
  const entry = await h.cashEntryService.addEntry('t1', OWNER, { entryDate, memo, category: '課程收入', accountName: '現金', income: amount, expense: 0 });
  return h.journalEntryService.journalizeEntry('t1', entry);
}

async function journalizeExpense(h: Awaited<ReturnType<typeof setupTenant>>, entryDate: string, amount: number, memo: string) {
  const entry = await h.cashEntryService.addEntry('t1', OWNER, { entryDate, memo, category: '房租', accountName: '現金', income: 0, expense: amount });
  return h.journalEntryService.journalizeEntry('t1', entry);
}

describe('Accounting Module v0.2 — normal-balance sign helper', () => {
  it('asset/expense are debit-normal; liability/equity/revenue are credit-normal', () => {
    expect(normalBalanceOf('asset')).toBe('debit');
    expect(normalBalanceOf('expense')).toBe('debit');
    expect(normalBalanceOf('liability')).toBe('credit');
    expect(normalBalanceOf('equity')).toBe('credit');
    expect(normalBalanceOf('revenue')).toBe('credit');
  });

  it('normalize() flips sign only for credit-normal types, never clamps', () => {
    expect(normalize(100, 'asset')).toBe(100);
    expect(normalize(-100, 'asset')).toBe(-100); // abnormal asset balance stays negative, not clamped to 0
    expect(normalize(100, 'liability')).toBe(-100); // a debit-heavy liability is abnormal — stays negative
    expect(normalize(-100, 'liability')).toBe(100);
  });
});

describe('Accounting Module v0.2 — TrialBalanceService', () => {
  it('as-of report (no fromDate): beginning=0 for all accounts, ending = normalized period activity', async () => {
    const h = await setupTenant();
    await journalizeIncome(h, '2026-01-10', 30000, '學費');
    await journalizeExpense(h, '2026-01-15', 5000, '房租');

    const report = await h.trialBalanceService.getTrialBalance('t1', { asOfDate: '2026-01-31' });
    expect(report.totalPeriodDebit).toBe(report.totalPeriodCredit); // structurally balanced

    const cashLine = report.lines.find((l) => l.chartOfAccountId === h.cashGl.id)!;
    expect(cashLine.beginningBalance).toBe(0);
    expect(cashLine.endingBalance).toBe(25000); // 30000 debit - 5000 credit, debit-normal

    const revenueLine = report.lines.find((l) => l.chartOfAccountId === h.revenueGl.id)!;
    expect(revenueLine.endingBalance).toBe(30000);

    const expenseLine = report.lines.find((l) => l.chartOfAccountId === h.expenseGl.id)!;
    expect(expenseLine.endingBalance).toBe(5000);
  });

  it('beginning balance carries forward correctly when fromDate is set', async () => {
    const h = await setupTenant();
    await journalizeIncome(h, '2026-01-05', 1000, '一月初收入'); // before fromDate
    await journalizeIncome(h, '2026-01-20', 2000, '一月中收入'); // within period

    const report = await h.trialBalanceService.getTrialBalance('t1', { fromDate: '2026-01-10', asOfDate: '2026-01-31' });
    const cashLine = report.lines.find((l) => l.chartOfAccountId === h.cashGl.id)!;

    expect(cashLine.beginningBalance).toBe(1000);
    expect(cashLine.periodDebit).toBe(2000);
    expect(cashLine.periodCredit).toBe(0);
    expect(cashLine.endingBalance).toBe(3000); // beginning + period movement
  });

  it('date boundaries: entries exactly on fromDate and asOfDate are included; before/after are handled correctly', async () => {
    const h = await setupTenant();
    await journalizeIncome(h, '2026-01-09', 100, 'before fromDate'); // excluded from period -> beginning
    await journalizeIncome(h, '2026-01-10', 200, 'on fromDate'); // included in period
    await journalizeIncome(h, '2026-01-20', 400, 'on asOfDate'); // included in period (asOfDate below)
    await journalizeIncome(h, '2026-01-21', 800, 'after asOfDate'); // excluded entirely

    const report = await h.trialBalanceService.getTrialBalance('t1', { fromDate: '2026-01-10', asOfDate: '2026-01-20' });
    const cashLine = report.lines.find((l) => l.chartOfAccountId === h.cashGl.id)!;

    expect(cashLine.beginningBalance).toBe(100); // only the before-fromDate entry
    expect(cashLine.periodDebit).toBe(600); // 200 + 400, the after-asOfDate entry excluded
    expect(cashLine.endingBalance).toBe(700); // 100 + 600
  });

  it('an abnormal balance (e.g. a debit-heavy liability) is preserved as a negative number, never clamped', async () => {
    const h = await setupTenant();
    // Directly construct a JournalEntry debiting a liability account — not
    // something the normal Cash-mapping flow can produce, but a real
    // scenario a general ledger must be able to represent.
    await h.journalEntryRepo.create({
      entry: { tenantId: 't1', entryDate: '2026-01-10', amount: 500, memo: 'abnormal liability test', sourceCashEntryId: 'synthetic', sourceType: 'system', sourceModule: 'SYSTEM', sourceReferenceId: 'synthetic', createdAt: new Date() },
      lines: [
        { chartOfAccountId: h.liabilityGl.id, debit: 500, credit: 0 },
        { chartOfAccountId: h.cashGl.id, debit: 0, credit: 500 },
      ],
    });

    const report = await h.trialBalanceService.getTrialBalance('t1', { asOfDate: '2026-01-31' });
    const liabilityLine = report.lines.find((l) => l.chartOfAccountId === h.liabilityGl.id)!;
    expect(liabilityLine.endingBalance).toBe(-500); // debit on a credit-normal account -> negative, not 0
  });
});

describe('Accounting Module v0.2 — IncomeStatementService', () => {
  it('computes revenue, expense, and net income correctly over a date range', async () => {
    const h = await setupTenant();
    await journalizeIncome(h, '2026-01-10', 30000, '學費');
    await journalizeExpense(h, '2026-01-15', 5000, '房租');
    await journalizeIncome(h, '2026-02-01', 10000, '二月學費'); // outside the tested range

    const report = await h.incomeStatementService.getIncomeStatement('t1', { fromDate: '2026-01-01', toDate: '2026-01-31' });
    expect(report.totalRevenue).toBe(30000);
    expect(report.totalExpense).toBe(5000);
    expect(report.netIncome).toBe(25000);
  });
});

describe('Accounting Module v0.2 — BalanceSheetService', () => {
  it('Assets = Liabilities + Equity + Current Earnings, within GL-reflected scope', async () => {
    const h = await setupTenant();
    await journalizeIncome(h, '2026-01-10', 30000, '學費');
    await journalizeExpense(h, '2026-01-15', 5000, '房租');

    const report = await h.balanceSheetService.getBalanceSheet('t1', '2026-01-31');
    expect(report.totalAssets).toBe(report.totalLiabilities + report.totalEquity + report.currentEarnings);
    expect(report.totalAssets).toBe(report.totalLiabilitiesAndEquity);
    expect(report.currentEarnings).toBe(25000); // no liability/equity activity in this fixture, so currentEarnings carries the whole asset balance
  });

  it('Income Statement net income and Balance Sheet current earnings agree for the same as-of date', async () => {
    const h = await setupTenant();
    await journalizeIncome(h, '2026-01-10', 30000, '學費');
    await journalizeExpense(h, '2026-01-15', 5000, '房租');

    const incomeStatement = await h.incomeStatementService.getIncomeStatement('t1', { toDate: '2026-01-31' });
    const balanceSheet = await h.balanceSheetService.getBalanceSheet('t1', '2026-01-31');
    expect(balanceSheet.currentEarnings).toBe(incomeStatement.netIncome);
  });

  it('an abnormal balance sheet component is still preserved (not clamped) and the invariant still holds', async () => {
    const h = await setupTenant();
    await journalizeIncome(h, '2026-01-05', 30000, '學費');
    await h.journalEntryRepo.create({
      entry: { tenantId: 't1', entryDate: '2026-01-10', amount: 500, memo: 'abnormal liability test', sourceCashEntryId: 'synthetic', sourceType: 'system', sourceModule: 'SYSTEM', sourceReferenceId: 'synthetic', createdAt: new Date() },
      lines: [
        { chartOfAccountId: h.liabilityGl.id, debit: 500, credit: 0 },
        { chartOfAccountId: h.cashGl.id, debit: 0, credit: 500 },
      ],
    });

    const report = await h.balanceSheetService.getBalanceSheet('t1', '2026-01-31');
    const liabilityLine = report.liabilityLines.find((l) => l.chartOfAccountId === h.liabilityGl.id)!;
    expect(liabilityLine.balance).toBe(-500);
    expect(report.totalAssets).toBe(report.totalLiabilities + report.totalEquity + report.currentEarnings);
  });
});

describe('Accounting Module v0.2 — no regression on Cash Module data or v0.1 accounting behavior', () => {
  it('running all three financial statements never mutates Cash Module or v0.1 accounting data', async () => {
    const h = await setupTenant();
    await journalizeIncome(h, '2026-01-10', 30000, '學費');
    await journalizeExpense(h, '2026-01-15', 5000, '房租');

    const cashEntriesBefore = JSON.stringify([...h.db.entries.values()]);
    const journalEntriesBefore = JSON.stringify([...h.accountingDb.journalEntries.values()]);
    const vouchersBefore = JSON.stringify([...h.accountingDb.vouchers.values()]);

    await h.trialBalanceService.getTrialBalance('t1', { asOfDate: '2026-01-31' });
    await h.incomeStatementService.getIncomeStatement('t1', { toDate: '2026-01-31' });
    await h.balanceSheetService.getBalanceSheet('t1', '2026-01-31');

    expect(JSON.stringify([...h.db.entries.values()])).toBe(cashEntriesBefore);
    expect(JSON.stringify([...h.accountingDb.journalEntries.values()])).toBe(journalEntriesBefore);
    expect(JSON.stringify([...h.accountingDb.vouchers.values()])).toBe(vouchersBefore);
  });
});
