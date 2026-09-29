# Accounting Module v0.3 — Fiscal Period + Close Lock

Extends `docs/architecture/accounting-module-v0.2.md` with Fiscal Period
management and a one-way posting lock. Same branch
(`feature/accounting-module`), same "Accounting Module is a consumer, never
a mutator [of the Cash Module]" architecture. v0.3 is deliberately narrow —
create/list/close only, no reopen, no closing entries, no tax logic.

Approved by Gate Review (Slack `#ai-gate-test`) after a revision that made
two real behavioral gaps explicit before coding:

1. **Balance Sheet fiscal-period semantics.** A Balance Sheet is an as-of
   statement, not a range statement (established in v0.2). When resolving
   `fiscalPeriodId`, the Balance Sheet uses **`asOfDate = period.endDate`
   only** — `period.startDate` is never read by `BalanceSheetService`.
   Critically, `currentEarnings` stays **cumulative since inception through
   `period.endDate`**, computed via the same `IncomeStatementService` call
   shape v0.2 already used (`toDate` only, `fromDate` omitted). Scoping
   Current Earnings to just the fiscal period's own activity would have
   broken the v0.2 invariant `Assets = Liabilities + Equity + Current
   Earnings`, since v0.1 still posts no closing entries and prior-period
   earnings never move into equity on their own.
2. **`processPending` batch semantics across closed/open periods.** A
   mixed pending batch must not abort partway through because one entry's
   date falls in a closed period. `journalizeEntry` (direct single-entry
   call) stays strict — it throws `JOURNAL_ENTRY_PERIOD_CLOSED` and creates
   nothing. `processPending` instead classifies every entry independently:
   alreadyJournaled → excluded → unmapped → **periodClosed** → journaled,
   in that order. `alreadyJournaled` is checked *before* `periodClosed` so
   a historical entry journalized before its period closed is never
   re-counted as "skipped" after the fact. Skipped entries are counted in
   a new `ProcessPendingResult.periodClosed` field and surfaced in the
   Dashboard's result message — never silently dropped.

## Domain model

```ts
type FiscalPeriodStatus = 'open' | 'closed';

interface FiscalPeriod {
  id: string;
  tenantId: string;
  name: string;
  startDate: string; // ISO date, inclusive
  endDate: string;   // ISO date, inclusive; startDate <= endDate
  status: FiscalPeriodStatus;
  closedAt?: Date;
  createdAt: Date;
}
```

- **Create**: validates `startDate <= endDate`
  (`FISCAL_PERIOD_INVALID_RANGE`) and rejects any date-range overlap with
  an existing period of the **same tenant** (`FISCAL_PERIOD_OVERLAPS`).
  Periods partition time per tenant; gaps (dates covered by no period) are
  allowed. An identical date range for a *different* tenant is unrelated
  and allowed — tenant isolation applies to overlap checking, listing, and
  closing alike (`findById` is tenant-scoped, so closing another tenant's
  period id returns `FISCAL_PERIOD_NOT_FOUND`, never a cross-tenant leak).
- **Close**: one-directional. Sets `status = 'closed'` and records
  `closedAt`. No reopen in v0.3. Closing an already-closed period throws
  `FISCAL_PERIOD_ALREADY_CLOSED` rather than silently no-op-ing, so callers
  never observe two different "already closed" outcomes.
- **The lock itself**: `FiscalPeriodService.isDateInClosedPeriod(tenantId,
  date)` — inclusive boundary (`startDate <= date <= endDate`). A date
  outside every defined period is never considered closed, and v0.3 does
  not require every date to belong to a period.
- **What the lock blocks**: only *new* journalization
  (`JournalEntryService.journalizeEntry`, and therefore `processPending`).
  v0.1/v0.2 never added a `JournalEntry` update/delete surface, so "no
  modify" inside a closed period is already true by construction — v0.3
  does not add a redundant mutation-lock for a mutation surface that
  doesn't exist.
- **What closing never does**: post a closing `JournalEntry`, touch
  retained earnings, or mutate any existing GL data. It is a pure lock
  flag — exactly as presentation-only as v0.2's Current Earnings line.

## Financial statements — optional fiscal-period selection

`TrialBalanceService.getTrialBalance`, `IncomeStatementService
.getIncomeStatement`, and `BalanceSheetService.getBalanceSheet` each gain
an optional `fiscalPeriodId` parameter. When given, the service resolves
the period **once** (a single source of truth, never a second parallel
date-resolution path) and derives dates as follows — exactly the contract
Gate Review required:

| Statement | with `fiscalPeriodId` |
|---|---|
| Trial Balance | `fromDate = period.startDate`, `asOfDate = period.endDate` |
| Income Statement | `fromDate = period.startDate`, `toDate = period.endDate` |
| Balance Sheet | `asOfDate = period.endDate` **only** (startDate unused) |

Explicit `fromDate`/`toDate`/`asOfDate` parameters remain fully supported
when `fiscalPeriodId` is omitted — v0.2 callers and behavior are
unaffected. `BalanceSheetService.getBalanceSheet`'s signature accepts
either a plain ISO date string (the v0.2 call shape, unchanged) or a
`{ asOfDate?, fiscalPeriodId? }` object, so no v0.2 call site needed to
change. Every report type gains an optional `fiscalPeriodId` echo field
for traceability, present only when the report was actually resolved from
a period.

Tests assert byte-for-byte equivalence between a `fiscalPeriodId` query and
its explicit-date equivalent for all three statements, and that Balance
Sheet's `Assets = Liabilities + Equity + Current Earnings` invariant
(established in v0.2) survives a `fiscalPeriodId` query, including a case
where earnings predate the fiscal period itself (proving Current Earnings
is genuinely cumulative-since-inception, not period-scoped).

## Frontend

`FiscalPeriodsView.tsx` is a new `AccountingPage.tsx` section (same
pattern as v0.1/v0.2 — no new hash route): a create form (name/start/end),
a list with status, and a 關帳 button per open period. Its explanatory copy
is careful to call this a "過帳鎖定" (posting lock), not a full accounting
close, so users don't mistake it for closing entries / retained-earnings
transfer / a completed fiscal-year close.

`TrialBalanceView.tsx`, `IncomeStatementView.tsx`, and
`BalanceSheetView.tsx` each gain an optional 會計期間 `<select>` that, when
chosen, queries the corresponding service with `fiscalPeriodId` (not by
merely copying dates into the existing inputs client-side) — so the
resolution logic lives in exactly one place, the backend service. Editing
a date field manually clears the period selection, so the two input modes
never silently disagree.

The Dashboard's "產生分錄" result message gains a "期間已關帳，略過 N 筆"
clause whenever `periodClosed > 0`, so a skipped entry is always visible,
never silently dropped from view.

## Test evidence

`backend/test/accounting/fiscalPeriod.test.ts` (14 tests): period creation
range/overlap validation and tenant isolation on create/list/close; one-way
close with idempotent-safe re-close rejection; inclusive boundary
correctness for the closed-period lock; an entry outside every period still
journalizes; direct `journalizeEntry` into a closed period rejected with
zero `JournalEntry`/`JournalLine`/`Voucher` rows created; a mixed
`processPending` batch (closed + open + no-period) journalizes the eligible
entries and counts the skipped one without aborting; repeated
`processPending` stays idempotent and never re-classifies a historical
entry as `periodClosed`; `fiscalPeriodId` vs. explicit-date equivalence for
all three statements; Balance Sheet Current Earnings verified cumulative
since inception (including prior-period earnings) rather than scoped to
just the fiscal period; and a snapshot test confirming fiscal-period
creation/closing/querying never mutates Cash Module or existing
JournalEntry/Voucher data.

`frontend/e2e/fiscalPeriod.spec.ts` — real-browser evidence: two January
entries journalized, a January fiscal period created and closed, a new
January-dated entry submitted afterward, "產生分錄" run again to confirm it
is blocked and explicitly counted (`期間已關帳，略過 1 筆`) while not
affecting other processing, Trial Balance and Balance Sheet queried via the
fiscal-period selector confirming the blocked entry's amount never posted
and the reports still balance, and a final check that all Cash Module
entries (including the blocked one) remain visible and untouched.
