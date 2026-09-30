# Accounting Module v0.4 — Manual Journal Entry + General Voucher

Extends `docs/architecture/accounting-module-v0.3.md` with manual journal
entry (a "General Voucher") and a general provenance model for every
`JournalEntry`, regardless of which module produced it. Same branch
(`feature/accounting-module`), same "Accounting Module is a consumer, never
a mutator [of the Cash Module]" architecture.

This plan went through a full Gate Review cycle (3 rounds) and received a
final PASS before any code was written; the design below is exactly what
was approved, not a redesign made during implementation.

## Draft / Posted separation

The core rule locked in by Gate Review: **`JournalEntry` permanently means
"already posted to GL."** A draft manual voucher is a SEPARATE entity,
`GeneralVoucherDraft`, never itself a `JournalEntry`.

```
Draft (freely add/remove/edit lines)
  -> validate ΣDebit = ΣCredit, active COAs, open period   [at post time]
  -> Post
  -> creates a real JournalEntry + JournalLines (same single GL, no second ledger)
  -> Voucher
  -> feeds into Trial Balance / Income Statement / Balance Sheet exactly like any other JournalEntry
```

A draft never affects any financial statement while unposted — those
statements only ever read `JournalEntry`/`JournalLine`, and a draft is not
one until it posts. Once posted, a draft is immutable: no update, no
delete, no un-post. Adjustments to a posted voucher (reversal/correction)
are explicitly out of scope for v0.4, deferred to a future version.

## Journal provenance model

Every `JournalEntry`, from any source, now carries where it came from:

```ts
type JournalEntrySourceType = 'manual' | 'module' | 'system';
type JournalEntrySourceModule = 'GL' | 'CASH' | 'AP' | 'AR' | 'FA' | 'PAYROLL' | 'INVENTORY' | 'SYSTEM';

interface JournalEntry {
  // ...v0.1-v0.3 fields unchanged...
  sourceCashEntryId?: string; // now OPTIONAL — kept for backward Cash traceability
  sourceType: JournalEntrySourceType;
  sourceModule: JournalEntrySourceModule;
  sourceReferenceId?: string; // the id of whatever produced this entry within sourceModule
}
```

Worked examples:

| Producer | sourceType | sourceModule | sourceReferenceId | sourceCashEntryId |
|---|---|---|---|---|
| Cash Module mapping (`JournalEntryService.journalizeEntry`/`processPending`) | `module` | `CASH` | the CashEntry's id | still set (unchanged from v0.1-v0.3) |
| Manual voucher (`GeneralVoucherService.postDraft`) | `manual` | `GL` | the `GeneralVoucherDraft`'s id | omitted/undefined |

`AP`, `AR`, `FA`, `PAYROLL`, `INVENTORY`, and the `system` sourceType are
declared now as future extension points — no v0.4 code produces them. This
means the provenance model doesn't need another breaking type change when
those modules eventually post their own journal entries; they simply pick
the matching `sourceModule` and follow the same contract.

## `GeneralVoucherDraft` domain model

```ts
type GeneralVoucherDraftStatus = 'draft' | 'posted';

interface GeneralVoucherDraftLine {
  id: string;
  chartOfAccountId: string;
  debit: number;  // >= 0
  credit: number; // >= 0
}

interface GeneralVoucherDraft {
  id: string;
  tenantId: string;
  entryDate: string; // ISO date
  memo: string;
  lines: GeneralVoucherDraftLine[];
  status: GeneralVoucherDraftStatus;
  postedJournalEntryId?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

- **Create / update**: no strict validation. Lines may be incomplete,
  unbalanced, or reference nothing yet — a draft is a scratchpad, not a
  commitment.
- **Delete**: only while `status === 'draft'`; `GENERAL_VOUCHER_ALREADY_POSTED`
  otherwise.
- **Post** (`GeneralVoucherService.postDraft`) is the ONLY path that ever
  turns a draft into GL data. Validation order is structural → account
  existence/active → balance → period lock:
  1. draft exists (tenant-scoped), not already posted
  2. at least 2 lines (`GENERAL_VOUCHER_MIN_LINES`)
  3. every line individually well-formed — no negative amounts, not both
     debit and credit set, not both zero, a non-blank `chartOfAccountId`
     (`GENERAL_VOUCHER_INVALID_LINE`)
  4. every line's `chartOfAccountId` exists, is owned by this tenant, and is
     active (`CHART_OF_ACCOUNT_NOT_FOUND` / `CHART_OF_ACCOUNT_INACTIVE`) —
     see the shared enforcement point below
  5. ΣDebit === ΣCredit within a small epsilon (`GENERAL_VOUCHER_UNBALANCED`)
  6. `entryDate` is not inside a closed FiscalPeriod
     (`JOURNAL_ENTRY_PERIOD_CLOSED` — the same lock semantics Cash
     journalization already respects)

  Any failure at any step creates zero artifacts. A successful post
  atomically creates exactly one `JournalEntry` + its `JournalLine`s + one
  `Voucher`, and marks the draft `posted` with `postedJournalEntryId` set.

## The single shared inactive-COA enforcement point

`ChartOfAccountService.getActiveOwnedAccount(tenantId, chartOfAccountId)` is
the ONLY place that decides whether a ChartOfAccount can receive a new
posting: it enforces tenant ownership (`CHART_OF_ACCOUNT_NOT_FOUND` for
missing/cross-tenant) and active status (`CHART_OF_ACCOUNT_INACTIVE`) in one
call. Both posting paths call it and neither duplicates the rule:

- **Cash-mapping path**: `JournalEntryService.journalizeEntry` calls it for
  both resolved GL accounts before creating a JournalEntry — an inactive
  mapped account now blocks Cash journalization too, not just manual
  postings. `processPending` cannot let one bad account abort a batch, so
  it probes the same method and turns the throw into a new
  `inactiveAccount` count instead of raising: classification order is
  **alreadyJournaled → excluded → unmapped → inactiveAccount →
  periodClosed → journaled** (inserted at that position; the other buckets'
  relative order from v0.3 is unchanged).
- **Manual-voucher path**: `GeneralVoucherService.postDraft` calls it for
  every line's `chartOfAccountId`.

`ChartOfAccountService.setChartOfAccountActive(tenantId, id, active)`
activates/deactivates a COA. Deactivating never touches any existing
`JournalEntry`/`JournalLine` — it only blocks new postings via the method
above; historical figures are untouched.

## `AccountingUnitOfWork` — atomic posting

This is an in-memory prototype with no real database transactions.
`AccountingUnitOfWork.runAtomic(fn)` fakes all-or-nothing semantics with
explicit snapshot/restore over the four collections a post mutates
(`journalEntries`, `journalLines`, `vouchers`, `generalVoucherDrafts`): it
deep-copies them (including each draft's nested `lines` array, so a
post-restore mutation of the live object can never corrupt the snapshot or
vice versa) before `fn` runs, and restores them wholesale if `fn` throws —
no matter how late the failure happens, even after every mutation but the
last has already landed on the live Maps. `GeneralVoucherService.postDraft`
wraps its four mutations in exactly one `runAtomic` call.

The class is deliberately interface-isolated (`{ runAtomic }` over an
`AccountingDatabase`) so a future real-database implementation can satisfy
the same shape with an actual transaction, without any caller changing.

## Frontend

`GeneralVoucherView.tsx` (`#sec-general-voucher`) — a draft-creation form
with dynamic add/remove line rows (COA `<select>` populated from active
COAs only, debit/credit inputs), and a table of existing drafts with a 過帳
(Post) button and a 刪除 (Delete) button per still-draft row. Follows the
same visual/structural conventions as `FiscalPeriodsView.tsx`.

`ChartOfAccountsManage.tsx` gained a 停用/啟用 toggle per COA row, and a
warning badge on any Cash Mapping row (account or category) whose target
COA is now inactive — so a stale mapping is visible, never silently broken.

`JournalEntryList.tsx` and `VoucherView.tsx` gained a 來源 (source) column:
"人工過帳 (GL)" for `sourceType === 'manual'`, "記帳模組 (CASH)" for
`sourceType === 'module' && sourceModule === 'CASH'`.

## Persistence migration

A pre-v0.4 persisted `JournalEntry` never had `sourceType`/`sourceModule` —
only `sourceCashEntryId`, since v0.1-v0.3 only ever produced Cash-derived
entries. `loadAccountingDatabase()` applies a pure function,
`migrateJournalEntryProvenance`, to every loaded `JournalEntry` row BEFORE
any service code runs on the data:

- already has `sourceType` and `sourceModule` → returned as-is (already
  v0.4-shaped)
- has `sourceCashEntryId`, missing provenance → backfilled to
  `sourceType='module'`, `sourceModule='CASH'`,
  `sourceReferenceId=sourceCashEntryId`; `sourceCashEntryId` itself is kept
- neither → an unrecognized/corrupt shape. **Throws** rather than silently
  guessing or returning an empty/default database; nothing is written back
  before the throw propagates, so the original localStorage content is
  never touched by a failed migration.

The function is pure (no mutation, always returns a new object) and lives
in its own file
(`frontend/src/localdb/accounting/journalProvenanceMigration.ts`) with no
`localStorage`/DOM dependency, specifically so it can be imported and
unit-tested directly from the backend test suite — frontend has no unit
test runner configured for localdb files as of v0.4, and per the plan's
documented fallback this avoids inventing a new frontend test-runner setup.

`loadAccountingDatabase()`'s existing `?? []` defaulting pattern (already
used for `fiscalPeriods`) is applied the same way to the new
`generalVoucherDrafts` field for payloads saved before v0.4.

## Test evidence

`backend/test/accounting/generalVoucher.test.ts` (19 tests): draft
CRUD + tenant isolation on every operation; `<2` lines rejected
(`GENERAL_VOUCHER_MIN_LINES`) with zero artifacts; invalid lines (both
debit and credit set, negative amounts, a fully empty line, a blank COA)
rejected (`GENERAL_VOUCHER_INVALID_LINE`); unbalanced totals rejected
(`GENERAL_VOUCHER_UNBALANCED`); an inactive target COA blocks posting
(`CHART_OF_ACCOUNT_INACTIVE`) with zero artifacts, and the SAME rule is
proven to also block the Cash-mapping path; a cross-tenant COA is rejected
(`CHART_OF_ACCOUNT_NOT_FOUND`); a closed fiscal period blocks posting
(`JOURNAL_ENTRY_PERIOD_CLOSED`); a posted draft cannot be updated, deleted,
or re-posted (`GENERAL_VOUCHER_ALREADY_POSTED`); a successful post creates
exactly one JournalEntry + correct JournalLines + one Voucher with
manual/GL provenance and marks the draft posted; a posted manual entry
flows into Trial Balance / Income Statement / Balance Sheet while an
unposted draft affects none of them; UnitOfWork atomicity for both a late
injected failure (after JournalEntry/JournalLines/Voucher already exist)
and an early failure point, both leaving zero artifacts and the draft at
`status: 'draft'`; Cash-derived entries keep working and now carry
module/CASH provenance with `sourceCashEntryId` still set; and a mixed
`processPending` batch exercising every classification bucket
(`alreadyJournaled`/`inactiveAccount`/`periodClosed`/`unmapped`) in one run.

`backend/test/accounting/journalProvenanceMigration.test.ts` (5 tests):
backfill of a v0.3-shaped entry, an already-migrated entry passed through
unchanged, an unrecognized shape throwing, purity (no input mutation), and
save→reload idempotency (migrating an already-migrated entry a second time
is a no-op).

`frontend/e2e/generalVoucher.spec.ts` — real-browser evidence: a manual
voucher draft with 2 lines is created and confirmed absent from Trial
Balance while a draft; posting it is confirmed to make Trial Balance
include it and the Journal Entry list show "人工過帳 (GL)"; an unbalanced
draft is rejected at post time with a visible error message; a draft
referencing a COA that is deactivated after the draft was created is
blocked from posting with a visible error; and a subsequent Cash Module
entry is journalized and shown with the "記帳模組 (CASH)" source label,
confirming v0.1-v0.3 flows are unaffected.

All 3 pre-existing backend accounting test files
(`fiscalPeriod.test.ts`, `financialStatements.test.ts`,
`ledgerMapping.test.ts`) and all 4 pre-existing e2e specs continue to pass
unmodified in behavior (two direct `journalEntryRepo.create` calls in
`financialStatements.test.ts` needed the new required `sourceType`/
`sourceModule` fields added to their literal payloads, since those fields
are part of the `JournalEntry` shape now — no assertions or behavior in
those tests changed).
