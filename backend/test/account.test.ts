import { describe, expect, it } from 'vitest';
import { createHarness, OWNER } from './testHarness.js';

// Spec: docs/gates/characterization-test-spec.md § Account

describe('Account', () => {
  it('A1 — creates an account, defaulting account_type to cash when omitted', async () => {
    const { accountService } = createHarness();
    const account = await accountService.createAccount('t1', { accountName: '銀行' });
    expect(account.accountType).toBe('cash');
    expect(account.status).toBe('active');
  });

  it('A2 — rejects a duplicate account name within a tenant', async () => {
    const { accountService } = createHarness();
    await accountService.createAccount('t1', { accountName: '銀行' });

    await expect(accountService.createAccount('t1', { accountName: '銀行' })).rejects.toMatchObject({
      code: 'DUPLICATE_ACCOUNT_NAME',
    });
  });

  it('A3 — disabling an account removes it from the active list but keeps history readable', async () => {
    const { accountService, cashEntryService, categoryService } = createHarness();
    const account = await accountService.createAccount('t1', { accountName: '銀行' });
    await categoryService.createCategory('t1', { categoryName: '薪水', categoryType: 'income' });

    await cashEntryService.addEntry('t1', OWNER, {
      entryDate: '2026-01-01',
      memo: '一月薪水',
      category: '薪水',
      accountName: '銀行',
      income: 1000,
      expense: 0,
    });

    await accountService.disableAccount('t1', account.id);

    expect(await accountService.listActiveAccountNames('t1')).not.toContain('銀行');

    const admin = await accountService.listForAdmin('t1');
    expect(admin.find((a) => a.id === account.id)?.status).toBe('inactive');

    const entries = await cashEntryService.listEntries('t1', {});
    expect(entries).toHaveLength(1);
    expect(entries[0]?.accountName).toBe('銀行');
  });

  it('A4 — a disabled account is rejected for new cash entries', async () => {
    const { accountService, cashEntryService, categoryService } = createHarness();
    const account = await accountService.createAccount('t1', { accountName: '銀行' });
    await categoryService.createCategory('t1', { categoryName: '薪水', categoryType: 'income' });
    await accountService.disableAccount('t1', account.id);

    await expect(
      cashEntryService.addEntry('t1', OWNER, {
        entryDate: '2026-01-01',
        memo: '薪水',
        category: '薪水',
        accountName: '銀行',
        income: 1000,
        expense: 0,
      }),
    ).rejects.toMatchObject({ code: 'ACCOUNT_NOT_FOUND_OR_INACTIVE' });
  });

  it('A5 — balance = opening_balance + income − expense', async () => {
    const { accountService, cashEntryService, categoryService } = createHarness();
    await accountService.createAccount('t1', { accountName: '銀行', openingBalance: 100 });
    await categoryService.createCategory('t1', { categoryName: '薪水', categoryType: 'income' });
    await categoryService.createCategory('t1', { categoryName: '餐費', categoryType: 'expense' });

    await cashEntryService.addEntry('t1', OWNER, {
      entryDate: '2026-01-01',
      memo: '薪水',
      category: '薪水',
      accountName: '銀行',
      income: 50,
      expense: 0,
    });
    await cashEntryService.addEntry('t1', OWNER, {
      entryDate: '2026-01-02',
      memo: '午餐',
      category: '餐費',
      accountName: '銀行',
      income: 0,
      expense: 20,
    });

    const [summary] = await accountService.getAccountSummaries('t1');
    expect(summary?.balance).toBe(130);
  });
});
