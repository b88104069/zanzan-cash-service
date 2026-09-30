import { beforeEach, describe, expect, it } from 'vitest';
import { loadAccountingDatabase, saveAccountingDatabase, STORAGE_KEY } from './accountingPersistence.js';

// Accounting Module v0.4 Gate Review MUST FIX 2 — a genuine
// persistence-boundary integration test. journalProvenanceMigration.test.ts
// (in the backend suite) proves the pure migration function is idempotent,
// but never exercises loadAccountingDatabase()/saveAccountingDatabase()
// themselves, which are the actual code that reads/writes
// `localStorage['zzcs_accounting_db_v1']` in production. This test runs
// under jsdom (see frontend/vitest.config.ts), which provides a real
// `localStorage`, so it goes through the real persistence boundary rather
// than a fake/stub.

// A v0.3-shaped serialized payload: JournalEntry has sourceCashEntryId and
// NO sourceType/sourceModule/sourceReferenceId; no `generalVoucherDrafts`
// key at all, since that field didn't exist before v0.4.
function v03Payload() {
  return {
    chartOfAccounts: [
      { id: 'coa_1', tenantId: 't1', code: '1101', name: '庫存現金', type: 'asset', status: 'active', createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 'coa_2', tenantId: 't1', code: '4101', name: '課程收入科目', type: 'revenue', status: 'active', createdAt: '2026-01-01T00:00:00.000Z' },
    ],
    accountMappings: [],
    categoryMappings: [],
    journalEntries: [
      {
        id: 'je_1',
        tenantId: 't1',
        entryDate: '2026-01-10',
        amount: 1000,
        memo: '學費',
        sourceCashEntryId: 'cash_1',
        createdAt: '2026-01-10T00:00:00.000Z',
        // NOTE: no sourceType / sourceModule / sourceReferenceId — the pre-v0.4 shape.
      },
    ],
    journalLines: [
      { id: 'jl_1', journalEntryId: 'je_1', chartOfAccountId: 'coa_1', debit: 1000, credit: 0 },
      { id: 'jl_2', journalEntryId: 'je_1', chartOfAccountId: 'coa_2', debit: 0, credit: 1000 },
    ],
    vouchers: [
      { id: 'v_1', tenantId: 't1', voucherNo: 'JV00001', voucherDate: '2026-01-10', journalEntryIds: ['je_1'], createdAt: '2026-01-10T00:00:00.000Z' },
    ],
    fiscalPeriods: [],
    // NOTE: no `generalVoucherDrafts` key — didn't exist pre-v0.4.
  };
}

describe('Accounting Module v0.4 — accountingPersistence / migration integration (MUST FIX 2)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loadAccountingDatabase() migrates a v0.3-shaped payload, and the migration survives a save->reload round trip', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v03Payload()));

    const db = loadAccountingDatabase();

    // generalVoucherDrafts loads as [] (empty Map), not undefined/error.
    expect(db.generalVoucherDrafts.size).toBe(0);

    const je = db.journalEntries.get('je_1');
    expect(je).toBeDefined();
    expect(je!.sourceType).toBe('module');
    expect(je!.sourceModule).toBe('CASH');
    expect(je!.sourceReferenceId).toBe('cash_1');
    expect(je!.sourceCashEntryId).toBe('cash_1');

    // JournalLine/Voucher tied to that JournalEntry are unchanged.
    const jl1 = db.journalLines.get('jl_1')!;
    const jl2 = db.journalLines.get('jl_2')!;
    expect(jl1.chartOfAccountId).toBe('coa_1');
    expect(jl1.debit).toBe(1000);
    expect(jl2.chartOfAccountId).toBe('coa_2');
    expect(jl2.credit).toBe(1000);

    const voucher = db.vouchers.get('v_1')!;
    expect(voucher.journalEntryIds).toEqual(['je_1']);
    expect(voucher.voucherNo).toBe('JV00001');

    // Round trip: save the migrated data, then load fresh — provenance must
    // still be present and correct, not lost or reset.
    saveAccountingDatabase(db);
    const reloaded = loadAccountingDatabase();

    const reloadedJe = reloaded.journalEntries.get('je_1')!;
    expect(reloadedJe.sourceType).toBe('module');
    expect(reloadedJe.sourceModule).toBe('CASH');
    expect(reloadedJe.sourceReferenceId).toBe('cash_1');
    expect(reloadedJe.sourceCashEntryId).toBe('cash_1');
    expect(reloaded.generalVoucherDrafts.size).toBe(0);
    expect(reloaded.journalLines.get('jl_1')).toEqual(jl1);
    expect(reloaded.journalLines.get('jl_2')).toEqual(jl2);
    expect(reloaded.vouchers.get('v_1')!.journalEntryIds).toEqual(['je_1']);
  });

  it('loadAccountingDatabase() throws on an unrecognized JournalEntry shape and leaves localStorage untouched', () => {
    const corrupt = v03Payload();
    // Strip sourceCashEntryId with no provenance fields either — an
    // unrecognized/corrupt shape migrateJournalEntryProvenance refuses to guess at.
    delete (corrupt.journalEntries[0] as any).sourceCashEntryId;
    const raw = JSON.stringify(corrupt);
    localStorage.setItem(STORAGE_KEY, raw);

    expect(() => loadAccountingDatabase()).toThrow();

    // The failed load must not have overwritten or cleared the original content.
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
  });
});
