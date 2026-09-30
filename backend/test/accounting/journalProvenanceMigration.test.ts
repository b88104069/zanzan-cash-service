import { describe, expect, it } from 'vitest';
import { migrateJournalEntryProvenance } from '../../../frontend/src/localdb/accounting/journalProvenanceMigration.js';

// Accounting Module v0.4 — persistence migration. Gate Review flagged this
// as a real risk (not cosmetic): a v0.1-v0.3 persisted JournalEntry never
// had sourceType/sourceModule, so loadAccountingDatabase() must backfill it
// before any service code runs on the data, fail loudly on an
// unrecognized shape, and never mutate its input. Frontend has no unit
// test runner configured for localdb files as of v0.4, so this
// function-level test lives in the backend suite instead (per the spec's
// documented fallback) — the function itself has no DOM/localStorage
// dependency, so it's a plain, portable function to import and test here.

describe('Accounting Module v0.4 — migrateJournalEntryProvenance', () => {
  it('backfills a v0.3-shaped entry (sourceCashEntryId set, no provenance fields)', () => {
    const legacy = {
      id: 'je_1',
      tenantId: 't1',
      entryDate: '2026-01-10',
      amount: 1000,
      memo: '學費',
      sourceCashEntryId: 'cash_1',
      createdAt: new Date('2026-01-10T00:00:00Z'),
    };

    const migrated = migrateJournalEntryProvenance(legacy);

    expect(migrated.sourceType).toBe('module');
    expect(migrated.sourceModule).toBe('CASH');
    expect(migrated.sourceReferenceId).toBe('cash_1');
    expect(migrated.sourceCashEntryId).toBe('cash_1');
    expect(migrated.id).toBe('je_1');
  });

  it('passes an already-migrated entry through unchanged', () => {
    const modern = {
      id: 'je_2',
      tenantId: 't1',
      entryDate: '2026-02-01',
      amount: 500,
      memo: '手動分錄',
      sourceType: 'manual' as const,
      sourceModule: 'GL' as const,
      sourceReferenceId: 'gvd_1',
      createdAt: new Date('2026-02-01T00:00:00Z'),
    };

    const migrated = migrateJournalEntryProvenance(modern);

    expect(migrated).toEqual(modern);
    expect(migrated).not.toBe(modern); // pure function — a new object, never the same reference
  });

  it('throws on an unrecognized shape (no provenance AND no sourceCashEntryId), never silently guessing', () => {
    const corrupt = {
      id: 'je_3',
      tenantId: 't1',
      entryDate: '2026-01-01',
      amount: 100,
      memo: '??',
      createdAt: new Date(),
    };

    expect(() => migrateJournalEntryProvenance(corrupt)).toThrow();
  });

  it('is pure: never mutates its input', () => {
    const legacy = {
      id: 'je_4',
      tenantId: 't1',
      entryDate: '2026-01-10',
      amount: 1000,
      memo: '學費',
      sourceCashEntryId: 'cash_4',
      createdAt: new Date('2026-01-10T00:00:00Z'),
    };
    const snapshot = JSON.stringify(legacy);

    migrateJournalEntryProvenance(legacy);

    expect(JSON.stringify(legacy)).toBe(snapshot);
    expect((legacy as any).sourceType).toBeUndefined();
  });

  it('a save->reload round trip is idempotent: migrating an already-migrated entry twice gives the same result', () => {
    const legacy = {
      id: 'je_5',
      tenantId: 't1',
      entryDate: '2026-01-10',
      amount: 1000,
      memo: '學費',
      sourceCashEntryId: 'cash_5',
      createdAt: new Date('2026-01-10T00:00:00Z'),
    };

    const once = migrateJournalEntryProvenance(legacy);
    const twice = migrateJournalEntryProvenance(once);

    expect(twice).toEqual(once);
  });
});
