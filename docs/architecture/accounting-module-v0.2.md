# Accounting Module v0.2 — Financial Statements

Extends `docs/architecture/accounting-module-v0.1.md` with three read-only
financial statements: Trial Balance, Income Statement, and Balance Sheet.
Same branch (`feature/accounting-module`), same "Accounting Module is a
consumer, never a mutator" architecture — these statements only read
v0.1's `JournalEntry`/`JournalLine`/`ChartOfAccount` data, and add zero new
mutation surface anywhere.

Approved by Gate Review (Slack `#ai-gate-test`) after a revision that
corrected two real accounting-correctness gaps in the first draft:

1. **Trial Balance is not a bare date-range activity sum.** A report that
   only shows "Σdebit/Σcredit within a date range" is a period-activity
   report, not a Trial Balance. `TrialBalanceService` computes, per
   `ChartOfAccount`: a **beginning balance** (net activity before
   `fromDate`, 0 if `fromDate` is omitted), **period debit/credit**
   (activity within `[fromDate, asOfDate]`), and an **ending balance**
   (beginning + period movement). `Σ(periodDebit) === Σ(periodCredit)`
   always, by construction — every `JournalEntry` v0.1 creates is itself
   balanced — and this is asserted directly in tests, not just implied.

2. **Balance Sheet needs a presentation-only Current Earnings line.** v0.1
   posts no closing entries, so revenue/expense balances never move into
   equity. Without a Current Earnings line, `Assets` would not equal
   `Liabilities + Equity` even on fully-mapped, fully-balanced journal
   data. `BalanceSheetService` computes `currentEarnings` by calling
   `IncomeStatementService` for the same `asOfDate` (never a separate
   calculation, so it can't drift), and presents it as its own labeled
   line inside Equity: "本期損益（Current Earnings, presentation only —
   no closing entry posted）". No `JournalEntry` is ever created for this
   — it's a computed display value only.

## Normal-balance sign convention (shared across all three statements)

`accountPresentation.ts` defines, once, for the whole module:

- `asset`, `expense` → **debit-normal**: positive when debit > credit
- `liability`, `equity`, `revenue` → **credit-normal**: positive when
  credit > debit

Every balance shown by any statement is *normalized* to this convention
(`normalize(rawDebitMinusCredit, type)`), and — per an explicit Gate
Review guardrail — **an abnormal balance is never clamped to zero or
forced positive**. A liability account with a debit balance (an unusual
but real situation) shows as a negative number in its normal-balance
presentation, not silently hidden. This is covered directly by tests that
construct such a scenario via a raw `JournalEntry` (something the normal
Cash→GL mapping flow can't produce on its own).

## What each statement computes

- **`TrialBalanceService.getTrialBalance(tenantId, { fromDate?, asOfDate })`**
  → beginning/period/ending per `ChartOfAccount`, using
  `JournalEntry.entryDate` (never `createdAt`) for all date comparisons.
- **`IncomeStatementService.getIncomeStatement(tenantId, { fromDate?, toDate })`**
  → revenue/expense per `ChartOfAccount` over the range, `netIncome = totalRevenue - totalExpense`.
- **`BalanceSheetService.getBalanceSheet(tenantId, asOfDate)`**
  → asset/liability/equity per `ChartOfAccount` as of the date, plus
  `currentEarnings` (via `IncomeStatementService`), with
  `totalLiabilitiesAndEquity = totalLiabilities + totalEquity + currentEarnings`,
  which the Balance Sheet's own test asserts equals `totalAssets` (within
  GL-reflected scope — see limitation below).

## The GL-only limitation (exact required wording)

Every statement carries and displays:

> 本報表僅反映已進入總帳（journalized）的交易；尚未設定科目對應、未處理轉帳，
> 以及記帳模組帳戶的期初餘額均不包含在內，因此不代表 Cash Module 全部帳務餘額。

This names the three concrete gaps explicitly (unmapped entries, excluded
transfers, Cash Module account opening balances) rather than a vague
"GL-reflected only" disclaimer, per Gate Review's specific correction.
v0.2 does **not** attempt an opening-balance backfill or a full
Cash→GL reconciliation — that remains a deliberately deferred decision.

## Frontend

`TrialBalanceView.tsx`, `IncomeStatementView.tsx`, `BalanceSheetView.tsx`
are added as new sections on the existing `AccountingPage.tsx` (same
pattern as Dashboard/Chart of Accounts/Journal Entries/Vouchers — no new
hash route, since these are Accounting Module sections, not a new ERP
module). Each has a date-range/as-of-date form, a results table, and the
limitation notice above rendered verbatim.

## Test evidence

`backend/test/accounting/financialStatements.test.ts` (11 tests): as-of
and period Trial Balance correctness, beginning-balance carry-forward,
exact date-boundary handling (before/on `fromDate`, on/after `asOfDate`),
an abnormal (debit-heavy liability) balance preserved as negative rather
than clamped, Income Statement revenue/expense/net-income correctness,
Balance Sheet `Assets = Liabilities + Equity + CurrentEarnings`, Income
Statement/Balance Sheet current-earnings equality for the same date, and
that running all three statements never mutates Cash Module or v0.1
accounting data (snapshot comparison).

`frontend/e2e/financialStatements.spec.ts` — real-browser evidence: a
mapped income + expense entry journalized, then all three statements
queried through the real UI and checked for the same correctness
properties as the backend tests, plus visible GL-only limitation copy on
each, plus confirmation the Cash Module dashboard is unaffected.
