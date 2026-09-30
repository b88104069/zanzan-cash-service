import type { GeneralVoucherDraft, JournalEntry, JournalLine, Voucher } from '../../../domain/accounting/types.js';
import type { AccountingDatabase } from './AccountingDatabase.js';

interface Snapshot {
  journalEntries: Map<string, JournalEntry>;
  journalLines: Map<string, JournalLine>;
  vouchers: Map<string, Voucher>;
  generalVoucherDrafts: Map<string, GeneralVoucherDraft>;
}

/**
 * Explicit snapshot/restore atomicity over the 4 collections a General
 * Voucher post mutates. This is an in-memory prototype with no real DB
 * transactions — `runAtomic` fakes all-or-nothing semantics by deep-copying
 * those collections before `fn` runs and restoring them wholesale if `fn`
 * throws, however late the failure happens (even after every mutation but
 * the last has already been applied to the live Maps).
 *
 * Deliberately interface-isolated (a small class over `AccountingDatabase`
 * exposing only `runAtomic`) so a future real-DB implementation can satisfy
 * the same shape via an actual transaction, without callers changing.
 */
export class AccountingUnitOfWork {
  constructor(private readonly db: AccountingDatabase) {}

  async runAtomic<T>(fn: () => Promise<T>): Promise<T> {
    const snapshot = this.snapshot();
    try {
      return await fn();
    } catch (err) {
      this.restore(snapshot);
      throw err;
    }
  }

  private snapshot(): Snapshot {
    return {
      journalEntries: new Map([...this.db.journalEntries].map(([id, row]) => [id, { ...row }])),
      journalLines: new Map([...this.db.journalLines].map(([id, row]) => [id, { ...row }])),
      vouchers: new Map([...this.db.vouchers].map(([id, row]) => [id, { ...row, journalEntryIds: [...row.journalEntryIds] }])),
      // Deep-copy each draft's `lines` array (and each line object within it)
      // — a shallow Map copy would still share the same nested array/object
      // references with the live object, so a post-restore mutation of the
      // live draft could silently corrupt the snapshot, or vice versa.
      generalVoucherDrafts: new Map(
        [...this.db.generalVoucherDrafts].map(([id, row]) => [id, { ...row, lines: row.lines.map((line) => ({ ...line })) }]),
      ),
    };
  }

  private restore(snapshot: Snapshot): void {
    this.db.journalEntries.clear();
    for (const [id, row] of snapshot.journalEntries) this.db.journalEntries.set(id, row);

    this.db.journalLines.clear();
    for (const [id, row] of snapshot.journalLines) this.db.journalLines.set(id, row);

    this.db.vouchers.clear();
    for (const [id, row] of snapshot.vouchers) this.db.vouchers.set(id, row);

    this.db.generalVoucherDrafts.clear();
    for (const [id, row] of snapshot.generalVoucherDrafts) this.db.generalVoucherDrafts.set(id, row);
  }
}
