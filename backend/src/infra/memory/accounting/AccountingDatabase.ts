import type { AccountMapping, CategoryMapping, ChartOfAccount, FiscalPeriod, JournalEntry, JournalLine, Voucher } from '../../../domain/accounting/types.js';

let nextAccountingId = 1;
/** Independent counter from the Cash Module's generateId (InMemoryDatabase.ts) — this module's ids never need to compare against or collide with Cash Module ids. */
export function generateAccountingId(prefix: string): string {
  return `acct_${prefix}_${nextAccountingId++}`;
}

/**
 * Backs every Accounting Module in-memory repository. Fully separate from
 * the Cash Module's InMemoryDatabase — no shared Maps, no shared file. See
 * docs/architecture/accounting-module-v0.1.md.
 */
export class AccountingDatabase {
  readonly chartOfAccounts = new Map<string, ChartOfAccount>();
  readonly accountMappings = new Map<string, AccountMapping>();
  readonly categoryMappings = new Map<string, CategoryMapping>();
  readonly journalEntries = new Map<string, JournalEntry>();
  readonly journalLines = new Map<string, JournalLine>();
  readonly vouchers = new Map<string, Voucher>();
  readonly fiscalPeriods = new Map<string, FiscalPeriod>();
}
