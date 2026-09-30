import type { JournalEntry } from '../../../../backend/src/domain/accounting/types.js';

// Accounting Module v0.4 — backward-compatible provenance migration.
//
// Deliberately its own file, with no localStorage/DOM dependency, so this
// pure logic can be imported and unit-tested directly from the backend test
// suite (see backend/test/accounting/journalProvenanceMigration.test.ts) —
// frontend has no unit test runner configured for localdb files as of
// v0.4, and this keeps the migration logic itself testable without
// inventing a new frontend test-runner setup.
//
// Pure function: never mutates its input, always returns a new object (or
// the same reference is never relied upon by callers — a fresh object is
// returned in every branch below).

/**
 * Backfills the v0.4 provenance fields (`sourceType`/`sourceModule`/
 * `sourceReferenceId`) onto a JournalEntry loaded from pre-v0.4 persisted
 * data.
 *
 * - Already-migrated (has sourceType AND sourceModule): returned as-is
 *   (new object, same values).
 * - Pre-v0.4 shape (has `sourceCashEntryId`, missing provenance): the only
 *   shape v0.1-v0.3 ever produced (they only ever created Cash-derived
 *   entries) — backfilled to sourceType='module', sourceModule='CASH',
 *   sourceReferenceId=sourceCashEntryId. `sourceCashEntryId` itself is kept
 *   unchanged.
 * - Anything else (no provenance AND no `sourceCashEntryId`): an
 *   unrecognized/corrupt shape. Throws rather than silently guessing or
 *   returning a default — never call this from anywhere that would let the
 *   throw be swallowed before the caller sees it.
 */
export function migrateJournalEntryProvenance(entry: any): JournalEntry {
  if (entry && entry.sourceType !== undefined && entry.sourceModule !== undefined) {
    return { ...entry };
  }

  if (entry && typeof entry.sourceCashEntryId === 'string' && entry.sourceCashEntryId.length > 0) {
    return {
      ...entry,
      sourceType: 'module',
      sourceModule: 'CASH',
      sourceReferenceId: entry.sourceCashEntryId,
    };
  }

  throw new Error(
    `migrateJournalEntryProvenance: unrecognized JournalEntry shape (id=${entry?.id ?? '<unknown>'}) — ` +
      'no sourceType/sourceModule and no sourceCashEntryId. Refusing to guess; the persisted data may be corrupt.',
  );
}
