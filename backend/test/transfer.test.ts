import { beforeEach, describe, expect, it } from 'vitest';
import { createHarness, OWNER } from './testHarness.js';

// Spec: docs/gates/characterization-test-spec.md § Transfer

describe('Transfer', () => {
  let harness: ReturnType<typeof createHarness>;

  beforeEach(async () => {
    harness = createHarness();
    await harness.accountService.createAccount('t1', { accountName: '現金' });
    await harness.accountService.createAccount('t1', { accountName: '銀行' });
  });

  it('X1 — creates exactly two linked entries: expense on source, income on destination', async () => {
    const result = await harness.transferService.createTransfer('t1', OWNER, {
      entryDate: '2026-01-01',
      fromAccountName: '現金',
      toAccountName: '銀行',
      amount: 200,
      note: '提款備用',
    });

    expect(result.entries).toHaveLength(2);
    const [outEntry, inEntry] = result.entries;
    expect(outEntry.expense).toBe(200);
    expect(outEntry.income).toBe(0);
    expect(inEntry.income).toBe(200);
    expect(inEntry.expense).toBe(0);
    expect(outEntry.transferCode).toBe(result.transferCode);
    expect(inEntry.transferCode).toBe(result.transferCode);
  });

  it('X2 — rejects a transfer to the same account', async () => {
    await expect(
      harness.transferService.createTransfer('t1', OWNER, {
        entryDate: '2026-01-01',
        fromAccountName: '現金',
        toAccountName: '現金',
        amount: 100,
      }),
    ).rejects.toMatchObject({ code: 'TRANSFER_SAME_ACCOUNT' });
  });

  it('X3 — rejects a non-positive amount', async () => {
    await expect(
      harness.transferService.createTransfer('t1', OWNER, {
        entryDate: '2026-01-01',
        fromAccountName: '現金',
        toAccountName: '銀行',
        amount: 0,
      }),
    ).rejects.toMatchObject({ code: 'TRANSFER_INVALID_AMOUNT' });
  });

  it('X4 — rejects a transfer involving an inactive account', async () => {
    const bank = await harness.accountService.createAccount('t1', { accountName: '停用戶' });
    await harness.accountService.disableAccount('t1', bank.id);

    await expect(
      harness.transferService.createTransfer('t1', OWNER, {
        entryDate: '2026-01-01',
        fromAccountName: '現金',
        toAccountName: '停用戶',
        amount: 100,
      }),
    ).rejects.toMatchObject({ code: 'TRANSFER_ACCOUNT_UNAVAILABLE' });
  });

  it('X5 — deleting one entry of a transfer pair deletes both atomically', async () => {
    const { entries } = await harness.transferService.createTransfer('t1', OWNER, {
      entryDate: '2026-01-01',
      fromAccountName: '現金',
      toAccountName: '銀行',
      amount: 150,
    });

    const result = await harness.cashEntryService.deleteEntry('t1', entries[0].id);
    expect(result.deletedCount).toBe(2);

    const remaining = await harness.cashEntryService.listEntries('t1', {});
    expect(remaining).toHaveLength(0);
  });

  it('X6 — refuses to delete a transfer entry whose pair count is not exactly 2', async () => {
    const { entries, transferCode } = await harness.transferService.createTransfer('t1', OWNER, {
      entryDate: '2026-01-01',
      fromAccountName: '現金',
      toAccountName: '銀行',
      amount: 150,
    });

    // Simulate corrupted state: manually remove one of the paired rows so
    // only 1 remains sharing the transfer_code, then attempt to delete it.
    harness.db.entries.delete(entries[1].id);
    expect(harness.db.entries.size).toBeGreaterThanOrEqual(1);

    await expect(harness.cashEntryService.deleteEntry('t1', entries[0].id)).rejects.toMatchObject({
      code: 'TRANSFER_INTEGRITY_VIOLATION',
    });

    // the row must still be there — the guard refused the delete entirely
    const stillThere = await harness.cashEntryService.listEntries('t1', {});
    expect(stillThere.some((e) => e.transferCode === transferCode)).toBe(true);
  });
});
