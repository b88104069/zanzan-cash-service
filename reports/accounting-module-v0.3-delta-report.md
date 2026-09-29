[Accounting Module v0.3 Delta Report — Fiscal Period + Close Lock]

BASELINE
- Branch: `feature/accounting-module` (continues from v0.2, still unmerged
  per Option B — v0.3 directly extends v0.2's scope on the same branch).
- Plan: PASS on revision 2, Slack `#ai-gate-test` message ts
  `1790693047.945799` (revision 1 got CONDITIONAL PASS with 2 MUST FIX
  items — Balance Sheet fiscal-period semantics, `processPending` batch
  behavior across closed/open periods — both addressed in the revision).
- Prior v0.2 state: implementation PASS, deployment-validation PASS, kept
  unmerged (Option B).

FILES CHANGED
New:
- `backend/src/domain/accounting/repositories/FiscalPeriodRepository.ts`
- `backend/src/domain/accounting/services/FiscalPeriodService.ts` —
  create/list/close with overlap+range validation, tenant isolation,
  idempotent-safe close, and the closed-period lock check used by
  `JournalEntryService`.
- `backend/src/infra/memory/accounting/InMemoryFiscalPeriodRepository.ts`
- `backend/test/accounting/fiscalPeriod.test.ts` (14 tests)
- `frontend/src/features/accounting/FiscalPeriodsView.tsx`
- `frontend/e2e/fiscalPeriod.spec.ts`
- `docs/architecture/accounting-module-v0.3.md`

Modified (additive/behavioral per the approved plan):
- `backend/src/domain/accounting/types.ts` — added `FiscalPeriod`/
  `FiscalPeriodStatus`, and an optional `fiscalPeriodId` echo field on
  `TrialBalanceReport`/`IncomeStatementReport`/`BalanceSheetReport`. No
  existing field removed or renamed.
- `backend/src/domain/accounting/errors.ts` — added 5 new error codes
  (`FISCAL_PERIOD_INVALID_RANGE`, `FISCAL_PERIOD_OVERLAPS`,
  `FISCAL_PERIOD_NOT_FOUND`, `FISCAL_PERIOD_ALREADY_CLOSED`,
  `JOURNAL_ENTRY_PERIOD_CLOSED`).
- `backend/src/domain/accounting/services/JournalEntryService.ts` —
  constructor now takes `FiscalPeriodService`; `journalizeEntry` throws
  `JOURNAL_ENTRY_PERIOD_CLOSED` strictly (creates nothing);
  `processPending` classifies each entry independently
  (alreadyJournaled → excluded → unmapped → periodClosed → journaled) so
  one closed-period entry never aborts the batch; `ProcessPendingResult`
  gains a `periodClosed` count.
- `backend/src/domain/accounting/services/{TrialBalance,IncomeStatement,
  BalanceSheet}Service.ts` — each gains an optional `fiscalPeriodId`
  input that resolves dates through `FiscalPeriodService` (single source
  of truth); all pre-existing explicit-date call shapes remain supported
  unchanged. `BalanceSheetService.getBalanceSheet`'s second parameter now
  accepts either a plain ISO string (v0.2 shape, unchanged) or a
  `{ asOfDate?, fiscalPeriodId? }` object.
- `backend/src/infra/memory/accounting/AccountingDatabase.ts` — added a
  `fiscalPeriods` Map.
- `backend/test/accounting/accountingHarness.ts` — wires
  `FiscalPeriodService`/`InMemoryFiscalPeriodRepository` and passes
  `fiscalPeriodService` into `JournalEntryService`/statement services.
- `frontend/src/localdb/accounting/accountingServices.ts` — same wiring
  for the frontend service graph.
- `frontend/src/localdb/accounting/accountingPersistence.ts` — persists
  `fiscalPeriods` to/from `localStorage` (own key, unchanged from v0.1),
  including `closedAt` date revival.
- `frontend/src/features/accounting/AccountingDashboard.tsx` — "產生分錄"
  result message gains a "期間已關帳，略過 N 筆" clause when
  `periodClosed > 0`.
- `frontend/src/features/accounting/AccountingPage.tsx` — adds a
  "會計期間" nav item + `FiscalPeriodsView` section; no new hash route;
  page title bumped to v0.3.
- `frontend/src/features/accounting/{TrialBalance,IncomeStatement,
  BalanceSheet}View.tsx` — each gains an optional 會計期間 `<select>` that
  queries via `fiscalPeriodId`; manually editing a date field clears the
  period selection so the two input modes never silently disagree.

Verified via `git status`/`git diff --stat`: zero changes to
`backend/src/domain/types.ts`, `errors.ts`, `services/**` (Cash Module),
`repositories/**` (Cash Module), `InMemoryDatabase.ts`, `Dashboard.tsx`,
`api/**` — the Cash Module remains completely untouched.

IMPLEMENTED
- **Fiscal Period domain + service**: tenant-scoped, non-overlapping
  periods (gaps allowed); one-way close (`closedAt` recorded, no reopen);
  closing an already-closed period is an explicit
  `FISCAL_PERIOD_ALREADY_CLOSED` error, never a silent no-op or a second
  kind of state; `findById` is tenant-scoped so cross-tenant list/close
  attempts surface as `FISCAL_PERIOD_NOT_FOUND`, never a leak.
- **Closed-period posting lock** (MUST FIX 2): inclusive boundary
  (`startDate <= entryDate <= endDate`); a date outside every period is
  unaffected; `journalizeEntry` stays strict for a direct call (zero
  artifacts created on rejection); `processPending` handles a mixed batch
  entry-by-entry — closed-period entries are skipped and counted in a new
  `periodClosed` field, never aborting eligible entries in the same batch;
  `alreadyJournaled` is classified *before* `periodClosed` so a
  historically-journalized entry is never miscounted after its period
  closes later (verified by a repeated-`processPending` idempotency test).
- **Fiscal-period statement selection** (MUST FIX 1): Trial
  Balance/Income Statement resolve `[period.startDate, period.endDate]`;
  Balance Sheet resolves `asOfDate = period.endDate` **only** —
  `period.startDate` is never read by `BalanceSheetService`. Current
  Earnings stays cumulative-since-inception through `period.endDate`
  (verified directly with a fixture where earnings predate the fiscal
  period itself), preserving the v0.2 invariant
  `Assets = Liabilities + Equity + Current Earnings`.
- **No closing-entry mutation anywhere**: closing a period never posts a
  `JournalEntry`, never touches retained earnings, never mutates existing
  GL data — purely a lock flag, exactly as presentation-only as v0.2's
  Current Earnings line.
- **Frontend**: `FiscalPeriodsView` (create/list/close, with copy that
  explicitly calls this a posting lock, not a full accounting close);
  optional fiscal-period selectors on all three statement views; Dashboard
  surfaces skipped-entry counts.

TEST / EVIDENCE
- `cd backend && npm run typecheck && npm test` → clean; **85/85 tests
  pass** (14 new fiscal-period tests + all 71 pre-existing v0.1/v0.2/Gate
  2-4 tests, zero regressions).
- New backend tests (`fiscalPeriod.test.ts`, 14): invalid-range rejection;
  same-tenant overlap rejection with cross-tenant identical-range allowed;
  tenant isolation on list/close; one-way close + idempotent-safe re-close
  rejection; inclusive boundary correctness (exactly on start/end date,
  before/after); an entry outside every period still journalizes; direct
  `journalizeEntry` into a closed period rejected with zero
  JournalEntry/JournalLine/Voucher rows created; mixed `processPending`
  batch (closed + open + no-period) journalizes eligible entries and
  counts the skipped one without aborting; repeated `processPending` stays
  idempotent and never re-classifies a historical entry as `periodClosed`;
  Trial Balance/Income Statement/Balance Sheet via `fiscalPeriodId`
  produce an accounting-result equivalent to the explicit-date query, with
  `fiscalPeriodId` echoed only as selection metadata (dates, lines,
  totals, and `currentEarnings` all match — the report object itself is
  not byte-identical, since the `fiscalPeriodId` field is only present on
  the period-resolved query);
  Balance Sheet Current Earnings verified cumulative since inception
  (including prior-period earnings) and the A=L+E+CE invariant holds under
  `fiscalPeriodId`; a snapshot test confirms fiscal-period
  creation/closing/querying never mutates Cash Module or existing
  JournalEntry/Voucher data.
- `cd frontend && npx tsc -b && npm run build` → clean, 78 modules
  transformed (up from v0.2's 75).
- `cd frontend && npx playwright test` (local dev server, all 4 specs) →
  **4 passed**:
  - `e2e/parity.spec.ts` (Gate 5 suite) — unmodified, still green.
  - `e2e/accounting.spec.ts` (v0.1 suite) — unmodified, still green.
  - `e2e/financialStatements.spec.ts` (v0.2 suite) — unmodified, still
    green.
  - `e2e/fiscalPeriod.spec.ts` (new) — real-browser flow: two January
    entries journalized (¥20,000 income, ¥3,000 expense); a January fiscal
    period created and closed; a new January-dated entry (¥5,000) submitted
    afterward; "產生分錄" run again shows `已產生 0 筆分錄` with
    `期間已關帳，略過 1 筆` explicitly visible; Trial Balance via the
    fiscal-period selector shows 庫存現金 ending ¥17,000 (excludes the
    blocked entry) with period debit total = period credit total; Balance
    Sheet via the fiscal-period selector shows Assets = Liabilities +
    Equity + Current Earnings = ¥17,000; GL-only limitation notice still
    visible; all three Cash Module entries (including the blocked one)
    remain visible and untouched throughout.

DEVIATIONS
None from the Gate-Review-approved revised plan — both MUST FIX items
(Balance Sheet fiscal-period semantics, `processPending` batch handling)
and every listed test guardrail are fully incorporated as approved.

RISKS / KNOWN LIMITATIONS
- v0.3's "關帳" is a posting lock only, not a complete accounting close
  cycle — it does not represent completed closing entries, retained
  earnings transfer, tax close, or full reconciliation. This matches the
  approved scope; the UI and this report are careful to call it "關帳／
  停止過帳" rather than implying a full year-end close.
- No reopen mechanism in v0.3 (explicitly deferred, one-way close only).
- The closed-period lock only blocks new postings; v0.1/v0.2 never added a
  `JournalEntry` update/delete mutation surface, so "no modify" inside a
  closed period is already true by construction — this scope boundary is
  documented, not silently narrowed.
- Carried over from v0.1/v0.2, unchanged and re-disclosed on every
  statement: unmapped entries, excluded transfers, and Cash Module account
  opening balances are not reflected in any of these statements.
- No tax logic, multi-currency, or consolidated/multi-entity statements —
  all explicitly out of scope per the Kickoff and unchanged by this Gate.
- Not merged to `main` — `feature/accounting-module` stays a reviewable,
  pushed feature branch, per the standing Option B decision. This Delta is
  submitted for review only; no merge action will be taken without an
  explicit go-ahead from the project owner.

REQUEST
Gate Review of this implementation via the same Slack `#ai-gate-test`
pipeline used for v0.1 and v0.2.

GATE REVIEW RESULT
- **STATUS: PASS** — Slack `#ai-gate-test`, message ts `1790712960.487459`,
  sender verified as the ChatGPT Slack app (`<@U0C5PSTQMEC>`).
- Reviewer confirmed directly against GitHub: implementation commit
  `a1baf59`, `FiscalPeriodService`, `JournalEntryService`, the 14
  fiscal-period backend tests, `FiscalPeriodsView`, the v0.3 E2E spec, and
  this Delta Report. Implementation matches the approved Revised Plan with
  no blocking issues.
- **MUST FIX: NONE.**
- Verified: fiscal-period domain/tenant isolation (inclusive overlap
  check, cross-tenant identical ranges allowed, list/get/close all
  tenant-scoped, invalid range rejected, one-way close with
  `FISCAL_PERIOD_ALREADY_CLOSED` on re-close, never a second closed
  state); closed-period posting lock (inclusive boundary, entries outside
  every period unaffected, direct `journalizeEntry` rejects with zero
  JE/JL/Voucher writes, `processPending` classifies independently in the
  approved order `alreadyJournaled → excluded → unmapped → periodClosed →
  journaled`, and a historical entry re-run after its period closes still
  counts as `alreadyJournaled`, never drifting into `periodClosed`);
  statement `fiscalPeriodId` semantics exactly as specified (TB/IS resolve
  `[start,end]`; BS uses `period.endDate` only; Current Earnings stays
  cumulative since inception, verified via the prior-period-earnings
  fixture; the v0.2 `Assets = Liabilities + Equity + Current Earnings`
  invariant holds); no closing-entry mutation anywhere; persistence/UI/
  regression evidence (fiscal periods persist with `closedAt` revival,
  Dashboard shows the skip count explicitly, 85/85 backend tests, all 4
  Playwright specs green, Cash Module core untouched).
- **Documentation correction (non-blocking, applied in this report)**: the
  original TEST/EVIDENCE wording "byte-identical results" was imprecise —
  the `fiscalPeriodId`-resolved report object cannot be byte-identical to
  the explicit-date one because it additionally echoes `fiscalPeriodId` as
  selection metadata. Corrected above to describe accounting-result
  equivalence (dates, lines, totals, `currentEarnings` all match) per the
  reviewer's exact suggested phrasing. This is a documentation-precision
  fix only; it does not change any code, test, or the PASS verdict.
- Non-blocking note: `journalizeEntry`'s direct-call path checks
  closed-period status before mapping classification, so a direct call on
  an unmapped/excluded entry in a closed period returns
  `JOURNAL_ENTRY_PERIOD_CLOSED` first. Reviewer confirmed this does not
  violate the direct-call strict contract (the batch path already
  preserves `excluded`/`unmapped` precedence per the approved order); a
  unified error-precedence contract across both paths, if ever wanted, is
  deferred as a separate future decision — not required for this Gate.
- Reviewer's suggested next step (a v0.3 GitHub Pages preview-deployment
  validation pass, mirroring v0.1/v0.2) is **not undertaken by this
  Delta** — held for the project owner to decide before any further scope
  is opened.
- **`feature/accounting-module` remains unmerged.** This PASS is the v0.3
  implementation Gate only; it does not itself authorize a merge to
  `main`. Per the standing Option B decision, the next step (deployment
  validation, v0.4, or a PR/merge decision) is for the project owner to
  decide.

**VERDICT: Accounting Module v0.3 Fiscal Period + Close Lock — implementation PASS.**
