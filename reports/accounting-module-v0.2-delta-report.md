[Accounting Module v0.2 Delta Report — Financial Statements]

BASELINE
- Branch: `feature/accounting-module` (continues from v0.1, still unmerged
  per the Option B decision — same branch, since v0.2 is a direct
  extension of v0.1's own scope, per the project owner's own rationale).
- Plan: PASS on revision 2, Slack `#ai-gate-test`, message ts
  `1790647486.040289` (revision 1 got CONDITIONAL PASS with 2 MUST FIX
  items — a mis-shaped Trial Balance and a missing Current Earnings line
  on the Balance Sheet — both addressed in the revision).
- Prior v0.1 state: implementation PASS, deployment-validation PASS, kept
  unmerged by explicit project-owner decision (Option B).

FILES CHANGED
New:
- `backend/src/domain/accounting/services/accountPresentation.ts` — shared
  normal-balance sign helper (`normalBalanceOf`, `normalize`) used by all
  three new services, so every statement presents the same account with
  the same sign convention.
- `backend/src/domain/accounting/services/TrialBalanceService.ts`
- `backend/src/domain/accounting/services/IncomeStatementService.ts`
- `backend/src/domain/accounting/services/BalanceSheetService.ts`
- `backend/test/accounting/financialStatements.test.ts` (11 tests)
- `frontend/src/features/accounting/TrialBalanceView.tsx`,
  `IncomeStatementView.tsx`, `BalanceSheetView.tsx`
- `frontend/e2e/financialStatements.spec.ts`
- `docs/architecture/accounting-module-v0.2.md`

Modified (additive only):
- `backend/src/domain/accounting/types.ts` — added
  `TrialBalanceReport`/`IncomeStatementReport`/`BalanceSheetReport` (+
  their line types) and the `GL_ONLY_LIMITATION_NOTICE` constant (the
  exact wording Gate Review required, naming the three concrete gaps).
  No existing type changed.
- `backend/test/accounting/accountingHarness.ts` — wires the three new
  services (plus exposes `journalEntryRepo` for one test scenario that
  needs to construct an abnormal-balance JournalEntry directly, something
  the normal Cash→GL mapping flow can't produce).
- `backend/test/accounting/ledgerMapping.test.ts` — 3 pre-existing
  `noUncheckedIndexedAccess` TypeScript errors fixed (non-null assertions
  on array-index reads); unrelated to this feature, found while running
  `npm run typecheck` for this Delta.
- `frontend/src/localdb/accounting/accountingServices.ts` — wires the
  three new services into `AccountingServices`.
- `frontend/src/features/accounting/AccountingPage.tsx` — adds 3 nav
  items + 3 new sections; no new hash route (these are Accounting Module
  sections, same pattern as the existing four).

Verified via `git diff --stat` before committing: zero changes to
`backend/src/domain/types.ts`, `errors.ts`, `services/**`,
`repositories/**`, `backend/src/infra/memory/InMemoryDatabase.ts`,
`frontend/src/features/Dashboard.tsx`, `frontend/src/api/**` — the Cash
Module remains completely untouched.

IMPLEMENTED
- **Trial Balance** (MUST FIX 1 from plan review): beginning balance
  (cumulative activity before `fromDate`, 0 if omitted) + period
  debit/credit (activity within `[fromDate, asOfDate]`) + ending balance
  (beginning + period movement), per `ChartOfAccount`. Report-level
  `Σ(periodDebit) === Σ(periodCredit)` always, asserted directly in tests
  — not merely a period-activity sum.
- **Balance Sheet Current Earnings** (MUST FIX 2): a presentation-only
  line inside Equity = cumulative revenue − cumulative expense as of the
  same `asOfDate`, computed by calling `IncomeStatementService` (never a
  separate calculation, so it can't drift from the Income Statement's own
  number for the same date). No closing `JournalEntry` is ever posted —
  purely a computed display value. `totalAssets === totalLiabilities + totalEquity + currentEarnings`
  holds within GL-reflected scope.
- **Income Statement**: revenue/expense per `ChartOfAccount` over an
  optional date range → net income, using `JournalEntry.entryDate`
  throughout (never `createdAt`).
- **Shared normal-balance sign convention**: asset/expense are
  debit-normal, liability/equity/revenue are credit-normal, defined once
  in `accountPresentation.ts` and used by all three services identically.
  **Abnormal balances are never clamped to zero or forced positive** — a
  liability with a debit balance shows as a negative number in its
  normal-balance presentation, verified directly by constructing such a
  scenario in tests via a raw `JournalEntry`.
- **GL-only limitation notice**: the exact wording Gate Review specified,
  naming the three concrete unincluded-data categories (unmapped
  entries, excluded transfers, Cash Module account opening balances)
  rather than a vague disclaimer — shown on every statement view.
- **Frontend**: three new sections on `AccountingPage.tsx` (Trial
  Balance / Income Statement / Balance Sheet), each with a date form, a
  results table, and the limitation notice rendered verbatim.

TEST / EVIDENCE
- `cd backend && npm run typecheck && npm test` → clean; **71/71 tests
  pass** (11 new financial-statement tests + all 60 pre-existing v0.1/
  Gate 2-4 tests, zero regressions).
- New backend tests (`financialStatements.test.ts`, 11): normal-balance
  sign helper correctness for all 5 account types; as-of Trial Balance
  (beginning=0, ending=normalized period activity, `Σdebit=Σcredit`);
  beginning-balance carry-forward when `fromDate` is set; exact
  date-boundary behavior (entries before `fromDate`, exactly on
  `fromDate`, exactly on `asOfDate`, after `asOfDate` — all classified
  correctly); an abnormal (debit-heavy) liability balance preserved as a
  negative number, not clamped, in both the Trial Balance and Balance
  Sheet; Income Statement revenue/expense/net-income correctness; Balance
  Sheet `Assets = Liabilities + Equity + CurrentEarnings`; Income
  Statement net income and Balance Sheet current earnings equal for the
  same date; running all three statements never mutates Cash Module or
  v0.1 accounting data (byte-for-byte snapshot comparison before/after).
- `cd frontend && npx tsc -b && npm run build` → clean, 75 modules
  transformed (up from v0.1's 67).
- `cd frontend && npx playwright test` (local dev server, all 3 specs) →
  **3 passed**:
  - `e2e/parity.spec.ts` (Gate 5 suite) — unmodified, still green.
  - `e2e/accounting.spec.ts` (v0.1 suite) — unmodified, still green.
  - `e2e/financialStatements.spec.ts` (new) — real-browser flow: a mapped
    income (¥30,000) and expense (¥5,000) entry journalized via the
    Dashboard's "產生分錄" action; Trial Balance queried and shows
    correct ending balances for 庫存現金 (¥25,000), 一般收入科目
    (¥30,000), 餐費支出 (¥5,000), with period debit total equal to
    period credit total; Income Statement shows the same revenue/expense/
    net-income figures; Balance Sheet shows Assets (¥25,000) equal to
    Liabilities + Equity + Current Earnings (¥25,000); the GL-only
    limitation notice is visible on both Trial Balance and Balance Sheet;
    Cash Module's own dashboard summary is unaffected throughout.

DEVIATIONS
None from the Gate-Review-approved revised plan — both MUST FIX items
(Trial Balance shape, Balance Sheet Current Earnings) and the exact
required limitation-notice wording are fully incorporated as approved.

RISKS / KNOWN LIMITATIONS
- Carried over from v0.1, unchanged and re-disclosed on every statement:
  unmapped entries, excluded transfers, and Cash Module account opening
  balances are not reflected in any of these statements, so none of them
  represent the Cash Module's full ledger position — only what has been
  journalized.
- No fiscal-period close/lock mechanism — a "period" here is purely an
  ad-hoc date-range filter, as scoped. No tax logic, multi-currency, or
  consolidated/multi-entity statements — all explicitly out of scope per
  the Kickoff and unchanged by this Gate.
- Monetary amounts remain whole-number (no fractional currency) across
  all three services, consistent with the existing Gate 2-4/v0.1 number
  model — no per-service rounding divergence was introduced.
- Not merged to `main` — `feature/accounting-module` stays a reviewable,
  pushed feature branch, per the standing Option B decision. This Delta
  is submitted for review only; no merge action will be taken without an
  explicit go-ahead from the project owner.

REQUEST
Gate Review of this implementation via the same Slack `#ai-gate-test`
pipeline used for v0.1 and the v0.2 plan review.

GATE REVIEW RESULT
- **STATUS: PASS** — Slack `#ai-gate-test`, message ts `1790649040.799089`,
  sender verified as the ChatGPT Slack app (`<@U0C5PSTQMEC>`).
- Reviewer confirmed the implementation commit (`53fc41c`), all three
  statement services, the shared normal-balance sign helper, the 11
  `financialStatements.test.ts` cases, the three frontend views, the E2E
  spec, and this Delta Report directly against GitHub.
- **MUST FIX: NONE.**
- Verified/kept as correct: Trial Balance beginning/period/ending shape
  and `Σ(periodDebit) === Σ(periodCredit)`; normal-balance sign handling
  (no clamping, abnormal balances preserved negative, including the
  liability debit-balance case); Income Statement correctness with no
  second calculation path; Balance Sheet `currentEarnings` computed only
  via `IncomeStatementService` (never duplicated) and
  `Assets = Liabilities + Equity + Current Earnings` verified including
  the abnormal-balance case; the exact required GL-only limitation
  wording shown identically on all three statement views; read-only
  behavior confirmed via the Cash/Accounting-data snapshot test; 71/71
  backend tests and all 3 Playwright E2E specs green.
- Non-blocking review notes (no rework required for this Gate): (1)
  service layer does not yet explicitly validate `fromDate <= asOfDate/
  toDate` — UI inputs reduce the risk; deferred to a future accounting
  period/input-validation pass, not this Gate. (2) Trial Balance totals
  validate period debit/credit while line ending balances use
  normal-balance signed presentation — reviewer confirmed this matches
  the already-approved v0.2 contract, not a gap. (3) whole-number
  monetary model is unchanged from baseline, no new rounding divergence.
- Reviewer's suggested next step (a v0.2 GitHub Pages preview-deployment
  validation pass) is **not undertaken by this Delta** — held for the
  project owner to decide before any further scope is opened.
- **`feature/accounting-module` remains unmerged**, per the standing
  Option B decision. No merge action taken or proposed.

**VERDICT: Accounting Module v0.2 (Financial Statements) — implementation PASS.**

---

[Accounting Module v0.2 — Prototype Deployment Validation] (closure delta)

Requested by the project owner as a follow-up to the implementation PASS
and the reviewer's non-blocking suggestion in the same review, to confirm
the already-approved code behaves identically once actually deployed.

WHAT WAS BUILT
Nothing new. The v0.2 implementation commit (`53fc41c`, `frontend/**`
changes) already matched the existing
`.github/workflows/deploy-pages-preview.yml` trigger path (push to
`feature/accounting-module` touching `frontend/**`), so it had already
built and deployed automatically — confirmed via GitHub Actions run
`36512369317` (workflow "Deploy Accounting Module v0.1 preview to GitHub
Pages", run #3, `conclusion: success`, head commit `53fc41c`). The
existing `playwright.preview.config.ts` from the v0.1 closure delta
already pointed at the correct preview subpath and needed no changes —
it runs whatever specs are in `e2e/`, so `financialStatements.spec.ts`
was picked up automatically alongside the two v0.1-era specs.

PREVIEW URL
**https://b88104069.github.io/zanzan-cash-service/preview/accounting-module/**
(production root, https://b88104069.github.io/zanzan-cash-service/,
confirmed unchanged and still HTTP 200)

```
$ curl -sS -o /dev/null -w "%{http_code}\n" https://b88104069.github.io/zanzan-cash-service/
200
$ curl -sS -o /dev/null -w "%{http_code}\n" https://b88104069.github.io/zanzan-cash-service/preview/accounting-module/
200
```

TEST / EVIDENCE
```
$ npx playwright test --config=playwright.preview.config.ts
...
2 passed (1.7m)
1 flaky (e2e/parity.spec.ts)
```
All three specs — `e2e/parity.spec.ts` (Gate 5, 18 steps), `e2e/accounting.spec.ts`
(v0.1, `#/cash` + `#/accounting` checklist), and `e2e/financialStatements.spec.ts`
(v0.2, Trial Balance/Income Statement/Balance Sheet) — ran against the
real deployed preview URL through the environment's real Chromium.
`accounting.spec.ts` and `financialStatements.spec.ts` passed clean on
every attempted run. `parity.spec.ts` hit this sandbox's own
egress-proxy flakiness (`ERR_TOO_MANY_RETRIES`, and once a `h2` locator
timeout on a slow initial paint) across several runs — the same
pre-existing, already-documented sandbox limitation recorded in both the
Gate 5 closure delta and the v0.1 deployment-validation closure delta,
not a defect in the deployed app. Its final status was `passed` (with a
flaky retry) on the run recorded above; `playwright.preview.config.ts`'s
existing `retries: 2` handles this the same way it did for v0.1.

The `financialStatements.spec.ts` real-browser run against the deployed
build confirms the same figures as the local evidence in this report's
implementation section: mapped income (¥30,000) + expense (¥5,000) →
Trial Balance ending balances (庫存現金 ¥25,000, 一般收入科目 ¥30,000,
餐費支出 ¥5,000) with period debit = period credit; Income Statement
matching revenue/expense/net income; Balance Sheet Assets (¥25,000) =
Liabilities + Equity + Current Earnings (¥25,000); GL-only limitation
notice visible; Cash Module dashboard unaffected — all against the real
deployed GitHub Pages build, not just the local dev server.

DEVIATIONS
None. This closure delta adds no new files and no code changes — it only
runs the existing preview deployment/test tooling (already built for
v0.1) against the new v0.2 build that was already live from the ordinary
push-triggered deploy.

REQUEST
This completes the project owner's requested v0.2 prototype deployment
validation. `feature/accounting-module` remains unmerged, pending the
project owner's own merge decision — no PR opened, no merge action
taken.

GATE REVIEW RESULT
- **STATUS: PASS** — Slack `#ai-gate-test`, message ts `1790661565.028929`,
  sender verified as the ChatGPT Slack app (`<@U0C5PSTQMEC>`).
- Reviewer confirmed directly against GitHub: closure commit `7e17846`,
  GitHub Actions run `36512369317` (`build` job success, `deploy` job
  success), and the Delta Report's deployment-validation closure section.
  No new production code in this round — deployment/browser validation
  only — consistent with the already-approved v0.2 implementation PASS.
- **MUST FIX: NONE.**
- Verified: deployment actually succeeded (both `build` and `deploy` jobs
  `conclusion: success`, existing preview workflow correctly built both
  the unchanged `main` root and the feature-branch preview); no code
  deviation (closure commit touches only the report, no domain/UI/
  business-logic change); real-browser preview evidence for
  `accounting.spec.ts` (PASS) and `financialStatements.spec.ts` (PASS)
  reproducing the same figures as local evidence (income ¥30,000, expense
  ¥5,000, Trial Balance ending ¥25,000, period debit = period credit,
  Income Statement net income ¥25,000, Balance Sheet Assets ¥25,000 =
  Liabilities + Equity + Current Earnings ¥25,000, GL-only limitation
  notice visible, Cash dashboard unaffected); `parity.spec.ts` flakiness
  judged as the same pre-existing sandbox egress-proxy/initial-paint
  instability already documented in the Gate 5 and v0.1 closure deltas,
  not a v0.2-specific regression, since it passed on retry and the other
  two specs ran clean.
- Non-blocking note (no rework required for this Gate): the preview
  workflow's display name still reads "Deploy Accounting Module v0.1
  preview to GitHub Pages" even though it now also carries v0.2;
  reviewer suggests renaming it to a version-neutral "Deploy Accounting
  Module preview to GitHub Pages" if the branch continues into v0.3+, to
  avoid future audit confusion. Deferred — not required for this Gate.
- **`feature/accounting-module` remains unmerged.** This PASS represents
  completion of the v0.2 Prototype Deployment Validation only — it does
  not itself authorize a merge to `main`. Per reviewer and the standing
  Option B decision, the next step (continue on this branch into v0.3,
  or move to a PR/merge decision) is for the project owner to decide.

**VERDICT: Accounting Module v0.2 Prototype Deployment Validation — PASS.**
