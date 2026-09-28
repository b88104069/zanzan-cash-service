// Accounting Module Prototype v0.1 domain types.
//
// This module is a CONSUMER of the Cash Module (backend/src/domain/types.ts,
// backend/src/infra/memory/InMemoryDatabase.ts) — it reads CashEntry/Account
// records but never writes to them, and keeps its own data in a fully
// separate store (see backend/src/infra/memory/accounting/AccountingDatabase.ts).
// See docs/architecture/accounting-module-v0.1.md for the full design and
// the Slack Gate Review thread that approved this plan before any code was
// written.

export type ChartOfAccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
export type AccountingStatus = 'active' | 'inactive';

/** The Accounting Module's own general ledger chart — independent of the Cash Module's Account/Category tables. */
export interface ChartOfAccount {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  type: ChartOfAccountType;
  status: AccountingStatus;
  createdAt: Date;
}

/**
 * Maps one Cash Module Account (by id) to one GL account. Reload-safe: keyed
 * by the Cash Module's own stable account id, not by name.
 */
export interface AccountMapping {
  id: string;
  tenantId: string;
  cashAccountId: string;
  chartOfAccountId: string;
  createdAt: Date;
}

/**
 * Maps one Cash Module Category (by its free-text name — CashEntry.category
 * is itself a free-text string, not a foreign key; see
 * docs/architecture/category-decision.md) to one GL account.
 *
 * Known limitation (flagged by Gate Review, recorded in the v0.1 Delta
 * Report): keying by name means a future category rename in the Cash
 * Module would silently orphan this mapping. Acceptable for a
 * single-tenant prototype; a production version should key by a stable
 * category identifier once the Cash Module category model supports one.
 */
export interface CategoryMapping {
  id: string;
  tenantId: string;
  cashCategoryName: string;
  chartOfAccountId: string;
  createdAt: Date;
}

export type MappingStatus = 'mapped' | 'unmapped' | 'excluded';

/** One classified CashEntry, before or after journaling. Computed live from CashEntry + mapping tables — never persisted as its own row, so it can never go stale. */
export interface MappingClassification {
  cashEntryId: string;
  status: MappingStatus;
  /** Present only when status === 'mapped'. */
  debitChartOfAccountId?: string;
  creditChartOfAccountId?: string;
  /** Human-readable reason, e.g. which side of the mapping is missing, or "transfer". */
  reason?: string;
}

/** One line of a journal entry. v0.1 entries always have exactly one debit line and one credit line, but the model itself is not limited to two lines. */
export interface JournalLine {
  id: string;
  journalEntryId: string;
  chartOfAccountId: string;
  debit: number;
  credit: number;
}

export interface JournalEntry {
  id: string;
  tenantId: string;
  entryDate: string; // ISO date, copied from the source CashEntry at journaling time
  amount: number;
  memo: string;
  /** Traceability back to the Cash Module — reference only, never written back to. */
  sourceCashEntryId: string;
  createdAt: Date;
}

export interface Voucher {
  id: string;
  tenantId: string;
  voucherNo: string; // e.g. "JV00001"
  voucherDate: string; // ISO date
  /** v0.1: always exactly one id (1 JournalEntry = 1 Voucher). Kept as an array so a later, explicitly-decided version can support combining multiple entries into one voucher without a data model change. */
  journalEntryIds: string[];
  createdAt: Date;
}
