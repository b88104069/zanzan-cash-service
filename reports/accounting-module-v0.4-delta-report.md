[Accounting Module v0.4 Delta Report — Manual Journal Entry + General Voucher]

BASELINE
- Branch: `feature/accounting-module` (continues from v0.3, still unmerged
  per Option B — v0.4 directly extends v0.3's scope on the same branch).
- Plan: PASS on revision 3, Slack `#ai-gate-test`, final review message ts
  `1790744075.874229` ("STATUS: PASS ✅ — CODING APPROVED"). Revision 1 got
  3 MUST FIX items (no real atomic-posting primitive across the JE→Voucher→
  draft-status sequence; inactive-COA blocking scoped only to Manual
  Voucher rather than GL-wide; manual voucher lines lacked an explicit
  tenant-scoped existence/ownership/active validation contract at Post
  time). Revision 2 got 1 further MUST FIX item (the plan updated the
  TypeScript type but not the migration path for already-persisted v0.1-
  v0.3-shaped `localStorage` data). All 4 items are addressed below.
- Prior v0.3 state: implementation PASS, deployment-validation PASS, kept
  unmerged (Option B).

FILES CHANGED
New:
- `backend/src/domain/accounting/repositories/GeneralVoucherDraftRepository.ts`
- `backend/src/domain/accounting/services/GeneralVoucherService.ts` —
  createDraft/updateDraft/deleteDraft/listDrafts/getDraft/postDraft;
  independent of `JournalEntryService` but posts into the same
  JournalEntry/JournalLine/Voucher repositories (single GL, no second
  ledger).
- `backend/src/infra/memory/accounting/AccountingUnitOfWork.ts` —
  snapshot/restore `runAtomic()` over `journalEntries`, `journalLines`,
  `vouchers`, `generalVoucherDrafts`, with a deep copy of each draft's
  `lines` array (not just a shallow Map copy) so post-restore mutation
  can't corrupt the snapshot or vice versa.
- `backend/src/infra/memory/accounting/InMemoryGeneralVoucherDraftRepository.ts`
- `backend/test/accounting/generalVoucher.test.ts` (19 tests)
- `backend/test/accounting/journalProvenanceMigration.test.ts` (5 tests)
- `frontend/src/features/accounting/GeneralVoucherView.tsx` — draft create
  form with dynamic add/remove line rows, draft list, Post/Delete actions.
- `frontend/src/localdb/accounting/journalProvenanceMigration.ts` — the
  pure `migrateJournalEntryProvenance()` function, isolated into its own
  DOM/localStorage-free file so the backend test suite can import and unit
  test it directly (kept out of `accountingPersistence.ts` itself, which
  uses `localStorage` and is not `tsc`-clean under backend's `lib`).
- `frontend/e2e/generalVoucher.spec.ts`
- `docs/architecture/accounting-module-v0.4.md`

Modified (additive/behavioral per the approved plan):
- `backend/src/domain/accounting/types.ts` — added
  `JournalEntrySourceType` (`'manual'|'module'|'system'`),
  `JournalEntrySourceModule`
  (`'GL'|'CASH'|'AP'|'AR'|'FA'|'PAYROLL'|'INVENTORY'|'SYSTEM'`), and
  `GeneralVoucherDraftStatus`/`GeneralVoucherDraftLine`/
  `GeneralVoucherDraft`. On `JournalEntry`: `sourceCashEntryId` becomes
  **optional** (was required); new **required-for-new-postings**
  `sourceType`/`sourceModule` fields plus optional `sourceReferenceId`. No
  existing field removed.
- `backend/src/domain/accounting/errors.ts` — added 6 new error codes:
  `GENERAL_VOUCHER_DRAFT_NOT_FOUND`, `GENERAL_VOUCHER_ALREADY_POSTED`,
  `GENERAL_VOUCHER_MIN_LINES`, `GENERAL_VOUCHER_INVALID_LINE`,
  `GENERAL_VOUCHER_UNBALANCED`, `CHART_OF_ACCOUNT_INACTIVE`.
- `backend/src/domain/accounting/repositories/ChartOfAccountRepository.ts`
  — added the minimal `update`/`save` method needed by
  `setChartOfAccountActive`.
- `backend/src/domain/accounting/services/ChartOfAccountService.ts` —
  added `getActiveOwnedAccount(tenantId, chartOfAccountId)` (tenant-scoped
  existence + active-status check, the **single shared** enforcement point
  used by both the Cash-mapping and Manual-voucher posting paths — there is
  exactly one posting rule, never two) and
  `setChartOfAccountActive(tenantId, id, active)`.
- `backend/src/domain/accounting/services/JournalEntryService.ts` —
  constructor now also takes `ChartOfAccountService`; `journalizeEntry`
  calls `getActiveOwnedAccount` for the mapped account before creating a
  JournalEntry (throws `CHART_OF_ACCOUNT_INACTIVE`, creates nothing);
  `processPending` classifies in the locked order `alreadyJournaled →
  excluded → unmapped → inactiveAccount → periodClosed → journaled`, with
  a new `inactiveAccount` count on `ProcessPendingResult`; every
  Cash-derived JournalEntry now also carries `sourceType='module'`,
  `sourceModule='CASH'`, `sourceReferenceId=cashEntry.id` (in addition to
  the existing `sourceCashEntryId`).
- `backend/src/infra/memory/accounting/AccountingDatabase.ts` — added a
  `generalVoucherDrafts` Map.
- `backend/src/infra/memory/accounting/InMemoryChartOfAccountRepository.ts`
  — implements the new `update` method.
- `backend/test/accounting/accountingHarness.ts` — wires
  `GeneralVoucherDraftRepository`/`AccountingUnitOfWork`/
  `GeneralVoucherService`, and passes `ChartOfAccountService` into
  `JournalEntryService`.
- `backend/test/accounting/financialStatements.test.ts` — two pre-existing
  direct `journalEntryRepo.create` fixture literals updated to include the
  now-required `sourceType`/`sourceModule` fields; no assertion or
  behavior changes.
- `frontend/src/localdb/accounting/accountingPersistence.ts` — applies
  `migrateJournalEntryProvenance()` to every loaded `JournalEntry` before
  any service code runs; applies the same `?? []` defaulting pattern
  already used for `fiscalPeriods` to the new `generalVoucherDrafts` field.
- `frontend/src/localdb/accounting/accountingServices.ts` — wires
  `GeneralVoucherService`/`AccountingUnitOfWork` into the frontend service
  graph, and passes `ChartOfAccountService` into `JournalEntryService`.
- `frontend/src/features/accounting/AccountingDashboard.tsx` — "產生分錄"
  result message gains an inactive-account note mirroring the existing
  `periodClosed` note pattern, so a skipped-for-inactive-account entry is
  never silently dropped from view.
- `frontend/src/features/accounting/AccountingPage.tsx` — adds the new
  `GeneralVoucherView` section; no new hash route.
- `frontend/src/features/accounting/ChartOfAccountsManage.tsx` — adds a
  停用/啟用 toggle per COA row, plus a warning badge on any Cash Mapping row
  whose target COA is now inactive.
- `frontend/src/features/accounting/JournalEntryList.tsx`,
  `VoucherView.tsx` — add a "來源" column (人工過帳(GL) vs 記帳模組(CASH)).

Verified via `git show --stat 2a727c8`: zero changes to any Cash Module
file (`backend/src/domain/types.ts`, `errors.ts`, `services/**`
(Cash), `repositories/**` (Cash), `InMemoryDatabase.ts`, `Dashboard.tsx`,
`api/**`) — the Cash Module remains completely untouched.

IMPLEMENTED
- **Draft/Posted separation** (core architectural decision): `JournalEntry`
  keeps meaning "already posted to GL." A `GeneralVoucherDraft` is never
  itself a `JournalEntry` — create/update freely permitted on an unposted
  draft with no strict line validation; only `postDraft` performs full
  validation and, on success, creates the real
  `JournalEntry`+`JournalLine`s+`Voucher` in the one GL. A draft never
  affects Trial Balance/Income Statement/Balance Sheet while unposted
  (verified directly).
- **Journal provenance contract** (MUST FIX 4 resolved):
  `sourceType`×`sourceModule`×optional `sourceReferenceId`, additive to
  `JournalEntry`. Cash-derived entries: `module`/`CASH`/cashEntryId (plus
  `sourceCashEntryId`, now optional but still populated for Cash entries).
  Manual-voucher entries: `manual`/`GL`/draftId (`sourceCashEntryId`
  omitted). AP/AR/FA/PAYROLL/INVENTORY/SYSTEM are established as future
  extension points in the type union, not implemented in v0.4.
- **Single shared inactive-COA invariant** (MUST FIX 2 resolved):
  `ChartOfAccountService.getActiveOwnedAccount()` is the one enforcement
  point for "an inactive chart-of-account cannot receive a new posting,"
  used by both `JournalEntryService.journalizeEntry`/`processPending`
  (Cash path) and `GeneralVoucherService.postDraft` (Manual path) — proven
  by a test that deactivates a COA and shows both paths blocked by the
  same rule, never two different rules.
- **`postDraft` full validation contract** (MUST FIX 3 resolved, checked in
  order): ≥2 lines (`GENERAL_VOUCHER_MIN_LINES`) → no line with both
  debit>0 and credit>0, no negative amounts, no blank/zero-both lines
  (`GENERAL_VOUCHER_INVALID_LINE`) → every line's chart-of-account is
  tenant-owned and active via `getActiveOwnedAccount`
  (`CHART_OF_ACCOUNT_NOT_FOUND`/`CHART_OF_ACCOUNT_INACTIVE`) → ΣDebit=
  ΣCredit (`GENERAL_VOUCHER_UNBALANCED`) → posting date not in a closed
  fiscal period (`JOURNAL_ENTRY_PERIOD_CLOSED`, reusing v0.3's lock). Every
  rejection branch creates zero artifacts. A posted draft can never be
  updated or deleted (`GENERAL_VOUCHER_ALREADY_POSTED`) — deferred to
  v0.6 reversal/adjustment.
- **Atomic posting via `AccountingUnitOfWork`** (MUST FIX 1 resolved):
  `postDraft`'s four mutations (JournalEntry, JournalLines, Voucher,
  draft status transition) run inside `runAtomic()`; an injected failure
  at a **late** failure point (after Voucher creation) rolls back all four
  together — proven by a dedicated test, not just an early-failure case.
- **`processPending`'s new `inactiveAccount` bucket**: counted separately,
  does not abort a mixed batch, and sits in the locked classification
  order `alreadyJournaled → excluded → unmapped → inactiveAccount →
  periodClosed → journaled`.
- **Backward-compatible persisted-data migration**: `frontend/src/localdb/
  accounting/journalProvenanceMigration.ts`'s `migrateJournalEntryProvenance()`
  is pure — already-migrated rows pass through unchanged; a pre-v0.4 row
  (`sourceCashEntryId` set, no provenance) is backfilled to
  `module`/`CASH`/`sourceCashEntryId` as reference; an unrecognized shape
  (neither provenance nor `sourceCashEntryId`) throws rather than guessing
  or silently producing an empty database, and nothing is written back to
  `localStorage` before that throw propagates. Applied at
  `loadAccountingDatabase()`'s load boundary, before any service code runs.
- **Frontend**: `GeneralVoucherView` (dynamic line-row form, draft list,
  Post/Delete); COA 停用/啟用 toggle + stale-mapping warning badge; 來源
  column on `JournalEntryList`/`VoucherView`; Dashboard surfaces the new
  inactive-account skip count.

TEST / EVIDENCE
- `cd backend && npm run typecheck && npm test` → clean; **109/109 tests
  pass** (24 new: 19 in `generalVoucher.test.ts` + 5 in
  `journalProvenanceMigration.test.ts`; all 85 pre-existing v0.1-v0.3/Gate
  2-4 tests unchanged in outcome, zero regressions).
- New backend tests (`generalVoucher.test.ts`, 19): draft CRUD + tenant
  isolation on every operation; <2 lines blocked
  (`GENERAL_VOUCHER_MIN_LINES`); a line with both debit and credit blocked;
  negative amounts blocked; unbalanced ΣDebit≠ΣCredit blocked
  (`GENERAL_VOUCHER_UNBALANCED`); posting to an inactive COA blocked, with
  the Cash-mapping path also proven blocked by the same COA/rule; posting
  to a cross-tenant COA blocked (`CHART_OF_ACCOUNT_NOT_FOUND`); posting
  into a closed fiscal period blocked; a successful post creates exactly
  one JournalEntry + correct JournalLines + one Voucher, sets
  `status='posted'`/`postedJournalEntryId`, and the new JournalEntry
  carries `sourceType='manual'`/`sourceModule='GL'`/
  `sourceReferenceId=draft.id`; a posted draft rejects update/delete
  (`GENERAL_VOUCHER_ALREADY_POSTED`); a posted manual JournalEntry flows
  correctly into Trial Balance/Income Statement/Balance Sheet while the
  unposted draft affects none of them; UnitOfWork atomicity proven at both
  an early and a **late** (post-Voucher-creation) injected failure point,
  with zero partial state surviving either; Cash-derived JournalEntries
  continue to work unchanged and now carry the module/CASH provenance;
  `processPending`'s `inactiveAccount` bucket counted separately without
  aborting the batch, in the locked classification order.
- New backend tests (`journalProvenanceMigration.test.ts`, 5): a v0.3-shaped
  row (has `sourceCashEntryId`, no provenance) backfills correctly; an
  already-migrated row passes through unchanged; an unrecognized shape
  (neither provenance nor `sourceCashEntryId`) throws; a save→reload round
  trip is idempotent; function purity (no mutation of the input row).
- `cd frontend && npx tsc -b && npm run build` → clean, 83 modules
  transformed (up from v0.3's 78).
- `cd frontend && npx playwright test` (local dev server, all 5 specs) →
  **5 passed**:
  - `e2e/parity.spec.ts` (Gate 5 suite) — unmodified, still green.
  - `e2e/accounting.spec.ts` (v0.1 suite) — unmodified, still green.
  - `e2e/financialStatements.spec.ts` (v0.2 suite) — unmodified, still
    green.
  - `e2e/fiscalPeriod.spec.ts` (v0.3 suite) — unmodified, still green.
  - `e2e/generalVoucher.spec.ts` (new) — real-browser flow: a manual
    voucher draft with 2+ lines created and confirmed absent from Trial
    Balance while unposted; posted, then confirmed present in Trial
    Balance/statements; JournalEntryList shows the correct 來源 label for
    the manual entry; an unbalanced draft rejected with a clear error
    message; posting blocked after deactivating a target COA; existing
    Cash Module flows and v0.1-v0.3 behavior unaffected throughout.

DEVIATIONS
None from the Gate-Review-approved (revision 3) plan's locked contract.
Two implementation-level notes, both within the plan's own stated
flexibility:
- `migrateJournalEntryProvenance()` was placed in its own DOM/localStorage-
  free file (`journalProvenanceMigration.ts`) rather than inline in
  `accountingPersistence.ts`, specifically so the backend test suite could
  import and unit-test the pure function directly without breaking
  backend's `tsc --noEmit` (which does not have DOM/`localStorage` in its
  `lib`). `accountingPersistence.ts`'s public behavior (migration applied
  before any service code runs; `generalVoucherDrafts ?? []` defaulting)
  is unchanged from the approved plan.
- `journalizeEntry`'s **internal** check ordering (not the locked
  `processPending` bucket order) now runs the closed-period check after
  mapping classification rather than before, to place the new inactive-COA
  check sensibly; no pre-existing test's outcome changed.

RISKS / KNOWN LIMITATIONS
- v0.4 manual postings cannot be modified or deleted once posted — this is
  intentional, deferred to v0.6's reversal/adjustment workflow, not an
  oversight.
- `GeneralVoucherDraft` validation is deliberately lenient on
  create/update (incomplete/invalid lines allowed) and strict only at
  `postDraft` — by design, so a draft functions as genuine scratch space.
- The `AccountingUnitOfWork` snapshot/restore mechanism is specific to this
  in-memory prototype; a real-DB implementation would replace it with an
  actual transaction, but the interface (`runAtomic()`) is shaped so that
  swap requires no change to `GeneralVoucherService`.
- Carried over from v0.1-v0.3, unchanged and re-disclosed on every
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
pipeline used for v0.1-v0.3.

FIX DELTA — MUST FIX 1 & 2
===========================

Gate Review returned CONDITIONAL PASS on the v0.4 submission above, with
exactly 2 MUST FIX items. This section records what changed to resolve
each, appended after the original REQUEST section above rather than
rewriting it, so the original submission remains intact for the audit
trail.

MUST FIX 1 — Posted draft metadata contract incomplete
-------------------------------------------------------
The approved plan requires `GeneralVoucherDraft` to carry
`postedJournalEntryId?`, `postedVoucherId?`, AND `postedAt?`, all three set
together when a draft is posted. The implementation only had
`postedJournalEntryId?`.

Changes:
- `backend/src/domain/accounting/types.ts`: added `postedVoucherId?: string`
  and `postedAt?: Date` to `GeneralVoucherDraft`.
- `backend/src/domain/accounting/services/GeneralVoucherService.ts`:
  `postDraft()` now captures the `Voucher` returned by
  `voucherService.createForJournalEntry(...)` and, inside the same
  `AccountingUnitOfWork.runAtomic()` transaction as the JournalEntry/
  JournalLine/Voucher creation, updates the draft with all four fields:
  `status='posted'`, `postedJournalEntryId=journalEntry.id`,
  `postedVoucherId=voucher.id`, `postedAt=new Date()`. No change to
  transaction boundaries — this was already the last mutation inside
  `runAtomic()`.
- `frontend/src/localdb/accounting/accountingPersistence.ts`: extended the
  existing `reviveGeneralVoucherDraft()` helper to also revive `postedAt`
  from a JSON string back into a `Date` (same optional-field pattern
  already used for `FiscalPeriod.closedAt`), so a reloaded posted draft
  does not leave `postedAt` as a raw string.
- `backend/test/accounting/generalVoucher.test.ts`:
  - The "successful post" test now additionally asserts
    `postedDraft.postedVoucherId` equals the id of the `Voucher` actually
    created (fetched via `voucherService.listVouchers`), and that
    `postedDraft.postedAt` is a `Date` instance and truthy.
  - The late-failure `AccountingUnitOfWork` rollback test now additionally
    asserts that after rollback `stillDraft.postedVoucherId` and
    `stillDraft.postedAt` are both `undefined` (in addition to the
    pre-existing `postedJournalEntryId` / `status==='draft'` assertions),
    confirming all of the posted-metadata mutations rolled back together.
- `docs/architecture/accounting-module-v0.4.md`: the `GeneralVoucherDraft`
  type block and the Post-success prose now show/describe all three
  `posted*` fields and state they are set atomically together.

Test evidence: `cd backend && npm test` — 109 tests passed across 17 test
files (up from 107/17 before this fix; `generalVoucher.test.ts` itself is
now 19 tests, up from 17, both new assertions added to existing tests
rather than new test cases). `npm run typecheck` clean.

Status: RESOLVED. Verified by rerunning the full backend suite, not just
inspecting the diff — the new assertions actually execute against the real
`postDraft()` code path and the real rollback path.

MUST FIX 2 — Provenance migration lacked a real persistence-boundary
integration test
----------------------------------------------------------------------
The existing `journalProvenanceMigration.test.ts` only called the pure
`migrateJournalEntryProvenance()` function twice in a row, proving
migration-function idempotency but never exercising
`loadAccountingDatabase()` / `saveAccountingDatabase()` themselves — the
actual code that reads/writes `localStorage['zzcs_accounting_db_v1']`.

Investigation: the frontend package (`frontend/package.json`) had no test
runner configured at all (no `vitest`/`jest` devDependency, no vitest
config). Per the reviewer's guidance, the minimal fix was to add a scoped
vitest + jsdom setup — not stub a fake `localStorage`, since jsdom already
gives a real one — colocated with `accountingPersistence.ts`.

Changes:
- `frontend/package.json`: added `vitest` (matching the backend's `^2.1.x`
  major) and `jsdom` as devDependencies, and a `"test": "vitest run"`
  script. No other frontend test infrastructure was added.
- `frontend/vitest.config.ts` (new, minimal): `environment: 'jsdom'`,
  `include: ['src/**/*.test.ts']`.
- `frontend/src/localdb/accounting/accountingPersistence.test.ts` (new):
  a real persistence-boundary integration test, colocated with
  `accountingPersistence.ts` per the reviewer's own suggested layout:
  1. Constructs a v0.3-shaped serialized payload (JournalEntry with
     `sourceCashEntryId` set, no `sourceType`/`sourceModule`/
     `sourceReferenceId`; chartOfAccounts/journalLines/vouchers/
     fiscalPeriods present; deliberately NO `generalVoucherDrafts` key),
     seeded into the real jsdom `localStorage` under
     `zzcs_accounting_db_v1` (imported as `STORAGE_KEY`).
  2. Calls the real `loadAccountingDatabase()` and asserts: the loaded
     JournalEntry has `sourceType='module'`, `sourceModule='CASH'`,
     `sourceReferenceId==='cash_1'` (the original `sourceCashEntryId`);
     `generalVoucherDrafts` loads as an empty Map (`.size===0`), not
     undefined/thrown; the associated JournalLines and Voucher are
     unchanged (same ids, amounts, `journalEntryIds` link).
  3. Calls the real `saveAccountingDatabase()` on the loaded/migrated data,
     then calls `loadAccountingDatabase()` again fresh, and asserts the
     provenance fields (`sourceType`/`sourceModule`/`sourceReferenceId`/
     `sourceCashEntryId`) and the JournalLine/Voucher data are still
     correct after the round trip — not lost or reset.
  4. A second test asserts that a payload with neither provenance fields
     nor `sourceCashEntryId` (unrecognized/corrupt shape) makes
     `loadAccountingDatabase()` throw, and that the raw `localStorage`
     content is byte-for-byte unchanged afterward (load only reads;
     nothing is written back before or during the throw).
  Statement-service (Trial Balance/etc.) wiring into this test was
  skipped as disproportionate per the reviewer's own stated allowance —
  the JE/JL/Voucher-integrity checks (mandatory) are covered directly.
- The existing `journalProvenanceMigration.test.ts` (backend suite,
  pure-function tests) was left as-is, unchanged — this is an addition,
  not a replacement.

Test evidence: `cd frontend && npx vitest run` — 1 test file,
2 tests passed. `cd frontend && npx tsc -b` and `npm run build` both clean
(the new `.test.ts` file lives under `src/`, inside `tsconfig.app.json`'s
`include`, and type-checks cleanly against the existing compiler options —
no `"types"` changes needed since the test imports `vitest`'s exports
directly rather than relying on injected globals). `npx playwright test` —
all 5 existing specs still pass (no regressions from the type/metadata
change).

Status: RESOLVED. This is a genuine addition of test-running capability to
frontend, scoped to exactly the one required test file — no other test
files, no broader CI wiring, no change to `frontend/vite.config.ts` (build
tool) since `vitest.config.ts` is a separate, additive config file.

AFTER-FIX VERIFICATION SUMMARY
- `cd backend && npm run typecheck` — clean.
- `cd backend && npm test` — 109 passed / 109 (17 test files).
- `cd frontend && npx tsc -b` — clean.
- `cd frontend && npm run build` — clean (`vite build` succeeded).
- `cd frontend && npx vitest run` — 2 passed / 2 (1 new test file).
- `cd frontend && npx playwright test` — 5 passed / 5 (no regressions).

Both MUST FIX items are resolved in code and verified by tests that
actually exercise the fixed behavior (posted-metadata atomicity via a real
rollback test; migration-at-the-persistence-boundary via a real
`localStorage`-backed load/save round trip) — not just documented as
resolved.
