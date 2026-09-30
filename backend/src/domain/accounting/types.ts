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
  entryDate: string; // ISO date, copied from the source CashEntry at journaling time (or from the GeneralVoucherDraft, v0.4)
  amount: number;
  memo: string;
  /**
   * Traceability back to the Cash Module — reference only, never written
   * back to. Optional as of v0.4: only Cash-derived JournalEntries set
   * this; manual-voucher-derived entries never do. Kept for backward
   * compatibility with pre-v0.4 persisted data — see
   * `sourceType`/`sourceModule`/`sourceReferenceId` below for the general
   * provenance model that superseded it.
   */
  sourceCashEntryId?: string;
  /** See "Journal provenance model" (v0.4) below — required for every JournalEntry created from v0.4 onward. */
  sourceType: JournalEntrySourceType;
  sourceModule: JournalEntrySourceModule;
  /** The id of whatever produced this entry within sourceModule — a CashEntry id for CASH, a GeneralVoucherDraft id for manual/GL. */
  sourceReferenceId?: string;
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

// --- Accounting Module v0.2 — Financial Statements ---
//
// Trial Balance / Income Statement / Balance Sheet are all read-only
// derivations over JournalEntry/JournalLine/ChartOfAccount — see
// backend/src/domain/accounting/services/{TrialBalance,IncomeStatement,
// BalanceSheet}Service.ts and docs/architecture/accounting-module-v0.2.md.
// Approved by Gate Review (Slack #ai-gate-test) after a revision that
// fixed two real accounting-correctness gaps in the first draft plan:
// Trial Balance needed beginning/period/ending balances (not a bare
// date-range activity sum), and Balance Sheet needed a presentation-only
// Current Earnings line (v0.1 has no closing entries, so without this
// Assets would not equal Liabilities + Equity).

/** Every ChartOfAccount type has a "normal" side. A positive normalized balance means the account is in its normal direction; negative means reversed — never clamped away. */
export type NormalBalanceSide = 'debit' | 'credit';

/**
 * The single, exact wording Gate Review required for every financial
 * statement view — names the three concrete gaps (unmapped, excluded
 * transfers, Cash Module opening balances) rather than a vague
 * "GL-reflected only" disclaimer.
 */
export const GL_ONLY_LIMITATION_NOTICE =
  '本報表僅反映已進入總帳（journalized）的交易；尚未設定科目對應、未處理轉帳，以及記帳模組帳戶的期初餘額均不包含在內，因此不代表 Cash Module 全部帳務餘額。';

export interface TrialBalanceLine {
  chartOfAccountId: string;
  code: string;
  name: string;
  type: ChartOfAccountType;
  normalBalance: NormalBalanceSide;
  /** Normalized (positive = normal direction) balance immediately before fromDate; 0 when fromDate is omitted. */
  beginningBalance: number;
  /** Raw Σdebit / Σcredit within [fromDate, asOfDate] — never sign-flipped, always >= 0. */
  periodDebit: number;
  periodCredit: number;
  /** Normalized ending balance = beginningBalance's raw value +/- period movement, then normalized. */
  endingBalance: number;
}

export interface TrialBalanceReport {
  tenantId: string;
  fromDate?: string;
  asOfDate: string;
  /** Echoed only when the report was resolved from a FiscalPeriod (v0.3); undefined for an explicit-date query. */
  fiscalPeriodId?: string;
  lines: TrialBalanceLine[];
  totalPeriodDebit: number;
  totalPeriodCredit: number;
  limitationNotice: string;
}

export interface IncomeStatementLine {
  chartOfAccountId: string;
  code: string;
  name: string;
  type: 'revenue' | 'expense';
  /** Normalized (credit-normal for revenue, debit-normal for expense) amount over the period. */
  amount: number;
}

export interface IncomeStatementReport {
  tenantId: string;
  fromDate?: string;
  toDate: string;
  /** Echoed only when the report was resolved from a FiscalPeriod (v0.3); undefined for an explicit-date query. */
  fiscalPeriodId?: string;
  revenueLines: IncomeStatementLine[];
  expenseLines: IncomeStatementLine[];
  totalRevenue: number;
  totalExpense: number;
  netIncome: number;
  limitationNotice: string;
}

export interface BalanceSheetLine {
  chartOfAccountId: string;
  code: string;
  name: string;
  type: 'asset' | 'liability' | 'equity';
  normalBalance: NormalBalanceSide;
  /** Normalized (positive = normal direction) balance as of asOfDate. */
  balance: number;
}

export interface BalanceSheetReport {
  tenantId: string;
  asOfDate: string;
  /** Echoed only when the report was resolved from a FiscalPeriod (v0.3); undefined for an explicit-date query. */
  fiscalPeriodId?: string;
  assetLines: BalanceSheetLine[];
  liabilityLines: BalanceSheetLine[];
  equityLines: BalanceSheetLine[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  /** Presentation-only: cumulativeRevenue - cumulativeExpense as of asOfDate, computed by IncomeStatementService — never a separate calculation. No closing JournalEntry is ever posted for this. */
  currentEarnings: number;
  /** totalLiabilities + totalEquity + currentEarnings — should equal totalAssets within GL-reflected scope. */
  totalLiabilitiesAndEquity: number;
  limitationNotice: string;
}

// --- Accounting Module v0.3 — Fiscal Period + Close Lock ---
//
// A Fiscal Period is a named, non-overlapping (per tenant) date range that
// can be closed to lock further journalization within it. v0.3 is
// deliberately narrow — see docs/architecture/accounting-module-v0.3.md and
// the Slack Gate Review thread that approved this plan:
//   - create / list / close only; NO reopen (closing is one-directional).
//   - closing sets a lock flag only; it NEVER posts a closing JournalEntry,
//     never touches retained earnings, never mutates GL data.
//   - the lock only blocks NEW journalization (JournalEntryService has no
//     update/delete surface in this codebase, so "no modify" is already
//     true by construction — not something this Gate needs to add).
//   - financial statements may optionally resolve their dates from a
//     FiscalPeriod (fiscalPeriodId) instead of explicit dates, but the
//     resolution is a single source of truth (see TrialBalance/
//     IncomeStatement/BalanceSheetService) — never a second calculation.

// --- Accounting Module v0.4 — Manual Journal Entry + General Voucher ---
//
// See docs/architecture/accounting-module-v0.4.md for the full design and
// the Gate Review thread that approved this plan (3 rounds, final PASS)
// before any code was written.
//
// Core rule: `JournalEntry` permanently means "already posted to GL". A
// draft manual voucher is a SEPARATE entity, `GeneralVoucherDraft`, never
// itself a `JournalEntry` — it never affects Trial Balance / Income
// Statement / Balance Sheet while unposted. Posting a draft writes into the
// SAME JournalEntry/JournalLine/Voucher tables Cash-derived entries use —
// there is only ever one GL, never a second ledger for manual postings.

/** Every JournalEntry now carries where it came from. 'manual' = a human posted a General Voucher directly; 'module' = produced by another module's own posting logic; 'system' = reserved for future system-generated entries (e.g. closing entries) — not produced anywhere in v0.4. */
export type JournalEntrySourceType = 'manual' | 'module' | 'system';

/** Which module produced the entry. Only 'GL' (manual voucher) and 'CASH' (Cash Module mapping) are actually produced in v0.4 — AP/AR/FA/PAYROLL/INVENTORY/SYSTEM are declared now as future extension points so the provenance model doesn't need another breaking change when those modules arrive. */
export type JournalEntrySourceModule = 'GL' | 'CASH' | 'AP' | 'AR' | 'FA' | 'PAYROLL' | 'INVENTORY' | 'SYSTEM';

export type GeneralVoucherDraftStatus = 'draft' | 'posted';

/** One line of a General Voucher draft. Freely addable/removable/editable while the draft is 'draft'; frozen once posted (the resulting JournalLine is the permanent record from then on). */
export interface GeneralVoucherDraftLine {
  id: string;
  chartOfAccountId: string;
  debit: number; // >= 0
  credit: number; // >= 0
}

/**
 * A manually-entered journal voucher before it is posted to the GL. Lines
 * may be incomplete or unbalanced while status === 'draft' — full
 * validation happens only at `GeneralVoucherService.postDraft` time. Once
 * posted, a draft is immutable (no update/delete) and permanently linked to
 * the JournalEntry it produced via `postedJournalEntryId`.
 */
export interface GeneralVoucherDraft {
  id: string;
  tenantId: string;
  entryDate: string; // ISO date
  memo: string;
  lines: GeneralVoucherDraftLine[];
  status: GeneralVoucherDraftStatus;
  postedJournalEntryId?: string;
  /** Set together with postedJournalEntryId/postedAt at post time — the id of the Voucher created for postedJournalEntryId. Never set independently of the other two. */
  postedVoucherId?: string;
  /** Set together with postedJournalEntryId/postedVoucherId at post time — when this draft was posted. Never set independently of the other two. */
  postedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type FiscalPeriodStatus = 'open' | 'closed';

/** A tenant-scoped accounting period. Periods must not overlap another period of the same tenant; gaps (dates covered by no period) are allowed and unaffected by any close. */
export interface FiscalPeriod {
  id: string;
  tenantId: string;
  name: string;
  startDate: string; // ISO date, inclusive
  endDate: string; // ISO date, inclusive; startDate <= endDate
  status: FiscalPeriodStatus;
  closedAt?: Date;
  createdAt: Date;
}
