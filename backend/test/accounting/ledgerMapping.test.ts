import { describe, expect, it } from 'vitest';
import { OWNER } from '../testHarness.js';
import { createAccountingHarness } from './accountingHarness.js';

// Accounting Module Prototype v0.1 — required evidence per the Gate Review
// PASS on the revised pre-implementation plan (Slack #ai-gate-test).

describe('Accounting Module v0.1 — LedgerMappingService + JournalEntryService', () => {
  async function setupMappedTenant() {
    const h = createAccountingHarness();
    const account = await h.accountService.createAccount('t1', { accountName: '現金' });
    await h.categoryService.createCategory('t1', { categoryName: '課程收入', categoryType: 'income' });
    await h.categoryService.createCategory('t1', { categoryName: '房租', categoryType: 'expense' });

    const cash = await h.chartOfAccountService.createChartOfAccount('t1', { code: '1101', name: '庫存現金', type: 'asset' });
    const revenue = await h.chartOfAccountService.createChartOfAccount('t1', { code: '4101', name: '課程收入科目', type: 'revenue' });
    const rentExpense = await h.chartOfAccountService.createChartOfAccount('t1', { code: '5101', name: '房租費用', type: 'expense' });

    await h.chartOfAccountService.setAccountMapping('t1', account.id, cash.id);
    await h.chartOfAccountService.setCategoryMapping('t1', '課程收入', revenue.id);
    await h.chartOfAccountService.setCategoryMapping('t1', '房租', rentExpense.id);

    return { ...h, account, cash, revenue, rentExpense };
  }

  it('mapped income → debit the account GL, credit the category GL, journal entry created', async () => {
    const h = await setupMappedTenant();
    const entry = await h.cashEntryService.addEntry('t1', OWNER, {
      entryDate: '2026-09-28',
      memo: '九月學費',
      category: '課程收入',
      accountName: '現金',
      income: 30000,
      expense: 0,
    });

    const classification = await h.mappingService.classify('t1', entry);
    expect(classification.status).toBe('mapped');
    expect(classification.debitChartOfAccountId).toBe(h.cash.id);
    expect(classification.creditChartOfAccountId).toBe(h.revenue.id);

    const journalEntry = await h.journalEntryService.journalizeEntry('t1', entry);
    expect(journalEntry.sourceCashEntryId).toBe(entry.id);
    expect(journalEntry.amount).toBe(30000);
    expect(journalEntry.lines).toHaveLength(2);

    const debitLine = journalEntry.lines.find((l) => l.debit > 0)!;
    const creditLine = journalEntry.lines.find((l) => l.credit > 0)!;
    expect(debitLine.chartOfAccountId).toBe(h.cash.id);
    expect(debitLine.debit).toBe(30000);
    expect(creditLine.chartOfAccountId).toBe(h.revenue.id);
    expect(creditLine.credit).toBe(30000);
  });

  it('mapped expense → debit the category GL, credit the account GL', async () => {
    const h = await setupMappedTenant();
    const entry = await h.cashEntryService.addEntry('t1', OWNER, {
      entryDate: '2026-09-28',
      memo: '九月房租',
      category: '房租',
      accountName: '現金',
      income: 0,
      expense: 15000,
    });

    const journalEntry = await h.journalEntryService.journalizeEntry('t1', entry);
    const debitLine = journalEntry.lines.find((l) => l.debit > 0)!;
    const creditLine = journalEntry.lines.find((l) => l.credit > 0)!;
    expect(debitLine.chartOfAccountId).toBe(h.rentExpense.id);
    expect(creditLine.chartOfAccountId).toBe(h.cash.id);
  });

  it('journal entry lines are always balanced (Σdebit === Σcredit === amount)', async () => {
    const h = await setupMappedTenant();
    const entry = await h.cashEntryService.addEntry('t1', OWNER, {
      entryDate: '2026-09-28',
      memo: '平衡測試',
      category: '課程收入',
      accountName: '現金',
      income: 500,
      expense: 0,
    });
    const journalEntry = await h.journalEntryService.journalizeEntry('t1', entry);
    const totalDebit = journalEntry.lines.reduce((sum, l) => sum + l.debit, 0);
    const totalCredit = journalEntry.lines.reduce((sum, l) => sum + l.credit, 0);
    expect(totalDebit).toBe(500);
    expect(totalCredit).toBe(500);
  });

  it('missing account mapping → unmapped, no journal entry created', async () => {
    const h = createAccountingHarness();
    await h.accountService.createAccount('t1', { accountName: '現金' });
    await h.categoryService.createCategory('t1', { categoryName: '課程收入', categoryType: 'income' });
    const revenue = await h.chartOfAccountService.createChartOfAccount('t1', { code: '4101', name: '課程收入科目', type: 'revenue' });
    await h.chartOfAccountService.setCategoryMapping('t1', '課程收入', revenue.id);
    // deliberately no setAccountMapping call

    const entry = await h.cashEntryService.addEntry('t1', OWNER, {
      entryDate: '2026-09-28',
      memo: '未設定帳戶對應',
      category: '課程收入',
      accountName: '現金',
      income: 100,
      expense: 0,
    });

    const classification = await h.mappingService.classify('t1', entry);
    expect(classification.status).toBe('unmapped');

    await expect(h.journalEntryService.journalizeEntry('t1', entry)).rejects.toMatchObject({ code: 'CASH_ENTRY_NOT_MAPPED' });
    expect(await h.journalEntryService.getJournalEntryBySource('t1', entry.id)).toBeNull();
  });

  it('missing category mapping → unmapped, no journal entry created', async () => {
    const h = createAccountingHarness();
    const account = await h.accountService.createAccount('t1', { accountName: '現金' });
    await h.categoryService.createCategory('t1', { categoryName: '課程收入', categoryType: 'income' });
    const cash = await h.chartOfAccountService.createChartOfAccount('t1', { code: '1101', name: '庫存現金', type: 'asset' });
    await h.chartOfAccountService.setAccountMapping('t1', account.id, cash.id);
    // deliberately no setCategoryMapping call

    const entry = await h.cashEntryService.addEntry('t1', OWNER, {
      entryDate: '2026-09-28',
      memo: '未設定科目對應',
      category: '課程收入',
      accountName: '現金',
      income: 100,
      expense: 0,
    });

    const classification = await h.mappingService.classify('t1', entry);
    expect(classification.status).toBe('unmapped');
    await expect(h.journalEntryService.journalizeEntry('t1', entry)).rejects.toMatchObject({ code: 'CASH_ENTRY_NOT_MAPPED' });
  });

  it('transfer legs → excluded, no journal entry, but counted (visible) by processPending', async () => {
    const h = await setupMappedTenant();
    const account2 = await h.accountService.createAccount('t1', { accountName: '銀行' });
    await h.chartOfAccountService.setAccountMapping('t1', account2.id, h.cash.id);

    await h.transferService.createTransfer('t1', OWNER, {
      entryDate: '2026-09-28',
      amount: 1000,
      fromAccountName: '現金',
      toAccountName: '銀行',
    });

    const entries = await h.cashEntryService.listEntries('t1', {});
    const transferEntries = entries.filter((e) => e.transferCode);
    expect(transferEntries).toHaveLength(2);

    for (const entry of transferEntries) {
      const classification = await h.mappingService.classify('t1', entry);
      expect(classification.status).toBe('excluded');
    }

    const result = await h.journalEntryService.processPending('t1', entries);
    expect(result.excluded).toBe(2);
    expect(await h.journalEntryService.getJournalEntryBySource('t1', transferEntries[0]!.id)).toBeNull();
  });

  it('processPending is idempotent — a second run journals nothing new and reports alreadyJournaled', async () => {
    const h = await setupMappedTenant();
    await h.cashEntryService.addEntry('t1', OWNER, {
      entryDate: '2026-09-28',
      memo: '學費',
      category: '課程收入',
      accountName: '現金',
      income: 2000,
      expense: 0,
    });

    const entries = await h.cashEntryService.listEntries('t1', {});
    const first = await h.journalEntryService.processPending('t1', entries);
    expect(first.journaled).toBe(1);

    const second = await h.journalEntryService.processPending('t1', entries);
    expect(second.journaled).toBe(0);
    expect(second.alreadyJournaled).toBe(1);
  });

  it('JournalEntry ↔ Voucher traceability: v0.1 creates exactly one voucher per journal entry, referencing it', async () => {
    const h = await setupMappedTenant();
    const entry = await h.cashEntryService.addEntry('t1', OWNER, {
      entryDate: '2026-09-28',
      memo: '傳票追溯測試',
      category: '課程收入',
      accountName: '現金',
      income: 800,
      expense: 0,
    });
    const journalEntry = await h.journalEntryService.journalizeEntry('t1', entry);

    const vouchers = await h.voucherService.listVouchers('t1');
    expect(vouchers).toHaveLength(1);
    expect(vouchers[0]!.journalEntryIds).toEqual([journalEntry.id]);
    expect(vouchers[0]!.voucherNo).toBe('JV00001');
  });

  it('the whole accounting flow never mutates Cash Module data', async () => {
    const h = await setupMappedTenant();
    const entry = await h.cashEntryService.addEntry('t1', OWNER, {
      entryDate: '2026-09-28',
      memo: '不變性測試',
      category: '課程收入',
      accountName: '現金',
      income: 999,
      expense: 0,
    });
    const before = JSON.stringify([...h.db.entries.values()]);
    const beforeAccounts = JSON.stringify([...h.db.accounts.values()]);

    await h.journalEntryService.journalizeEntry('t1', entry);
    await h.journalEntryService.listJournalEntries('t1');
    await h.voucherService.listVouchers('t1');

    expect(JSON.stringify([...h.db.entries.values()])).toBe(before);
    expect(JSON.stringify([...h.db.accounts.values()])).toBe(beforeAccounts);
  });
});
