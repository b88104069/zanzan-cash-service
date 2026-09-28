[Accounting Module Prototype v0.1 Delta Report]

BASELINE
- Frozen baseline: `main@f874583` ("v1.0 MIGRATION BASELINE FROZEN", Gate 5 Final PASS).
- Plan: PASS on revision 2, Slack `#ai-gate-test`, message ts `1790602045.993249`
  (revision 1 got CONDITIONAL PASS with 2 MUST FIX items, both addressed).
- Implementation commit: `7faa1f2`
- Branch: `feature/accounting-module` (not merged to `main`, per the plan's
  explicit "不要直接 merge main" instruction — awaiting this Delta Report's review)

FILES CHANGED
New, entirely under an `accounting/` subtree, zero changes to any existing Cash Module file:
- `backend/src/domain/accounting/` — types (ChartOfAccount, AccountMapping,
  CategoryMapping, MappingStatus, JournalEntry, JournalLine, Voucher), its
  own `AccountingError` type, repository interfaces, and
  ChartOfAccountService/LedgerMappingService/JournalEntryService/VoucherService
- `backend/src/infra/memory/accounting/` — AccountingDatabase (own Maps,
  own id counter `generateAccountingId`) + 4 InMemory*Repository implementations
- `backend/test/accounting/` — `accountingHarness.ts` + `ledgerMapping.test.ts` (9 tests)
- `frontend/src/routing/useHashRoute.ts` — minimal hash router (no new dependency)
- `frontend/src/shell/ModuleShell.tsx` — shared top-level module switcher
- `frontend/src/localdb/accounting/` — `accountingPersistence.ts` (separate
  localStorage key `zzcs_accounting_db_v1`) + `accountingServices.ts`
  (wiring + demo mapping seed) + `AccountingDataProvider.tsx`
- `frontend/src/features/accounting/` — `AccountingPage.tsx`,
  `AccountingDashboard.tsx`, `ChartOfAccountsManage.tsx`,
  `JournalEntryList.tsx`, `VoucherView.tsx`
- `frontend/e2e/accounting.spec.ts` — new E2E suite
- `docs/architecture/accounting-module-v0.1.md` — full design record

Modified (minimal, additive only):
- `frontend/src/App.tsx` — now routes between Cash Module (`Dashboard`)
  and Accounting Module (`AccountingPage`) via `useHashRoute` + `ModuleShell`,
  both still inside the existing `LocalDataProvider`
- `frontend/src/styles.css` — added `.module-switcher`/`.module-tab` styles only

Verified via `git diff --stat` before committing: zero changes to
`backend/src/domain/types.ts`, `backend/src/domain/errors.ts`,
`backend/src/domain/services/**`, `backend/src/domain/repositories/**`,
`backend/src/infra/memory/InMemoryDatabase.ts`,
`frontend/src/features/Dashboard.tsx`, `frontend/src/api/**`.

IMPLEMENTED
Per the Gate-Review-approved revised plan:
- **Chart of Accounts + Mapping Rule** (MUST FIX 1): `ChartOfAccount`,
  `AccountMapping` (keyed by Cash Module's stable account id), `CategoryMapping`
  (keyed by category name — documented known limitation below), and
  `MappingStatus: mapped | unmapped | excluded`, computed live by
  `LedgerMappingService.classify()` — never persisted, never stale.
  `income` → debit account-GL / credit category-GL; `expense` → debit
  category-GL / credit account-GL. Either mapping missing → `unmapped`,
  no journal entry created (no guessing). Transfer → `excluded`, no
  journal entry, but always counted and shown on the Dashboard.
  A demo/default mapping seeds automatically on first load (Gate 2's
  default 現金 account + 4 default categories), as config data only —
  `LedgerMappingService` itself has no hardcoded account-name knowledge.
- **Independent module URL** (MUST FIX 2): a minimal `useHashRoute()` hook
  (no React Router) resolves `#/cash` and `#/accounting` to two
  independent top-level pages, both directly openable, reloadable, and
  bookmarkable, behind a shared `ModuleShell` switcher designed to extend
  to future Sales/Purchase modules without modification.
- **Voucher grouping** (additional adjustment): dropped same-day
  auto-grouping entirely; v0.1 uses 1 JournalEntry = 1 Voucher, created
  together, with `journalEntryIds: string[]` left open for a later,
  explicitly-decided multi-entry combination feature.
- **Accounting Dashboard**: shows 待處理交易 (mapped, not yet journaled),
  待設定科目對應 (unmapped), 未處理轉帳 (excluded/transfer), and
  已建立分錄 (total journal entries) — nothing silently dropped from view.
  A "產生分錄" button runs `JournalEntryService.processPending`, which is
  idempotent (safe to click repeatedly).
- **Chart of Accounts management UI**: create new GL accounts; set/change
  Cash-account→GL and Cash-category→GL mappings via dropdowns, on top of
  the demo seed.
- **Journal Entry list** and **Voucher view** (mockup-style: 傳票 number,
  date, 借/貸 lines with GL account name and amount).

TEST / EVIDENCE
- `cd backend && npm run typecheck && npm test` → clean; **60/60 tests
  pass** (9 new accounting tests + all 51 pre-existing Gate 2-4 tests,
  zero regressions).
- New backend unit tests (`backend/test/accounting/ledgerMapping.test.ts`,
  9 tests): mapped income → correct debit/credit GL; mapped expense →
  correct debit/credit GL; journal lines always balanced (Σdebit=Σcredit=amount);
  missing account mapping → unmapped/no journal; missing category mapping
  → unmapped/no journal; transfer legs → excluded/no journal but counted
  by `processPending`; `processPending` is idempotent (second run journals
  nothing new); JournalEntry↔Voucher 1:1 traceability (`voucher.journalEntryIds`
  references the created entry, voucher number `JV00001`); the whole
  accounting flow never mutates Cash Module data (byte-for-byte snapshot
  comparison of `db.entries`/`db.accounts` before and after).
- `cd frontend && npx tsc -b && npm run build` → clean, 67 modules
  transformed (up from Gate 5's 47 — confirms the new accounting domain
  code is genuinely bundled in).
- `cd frontend && npx playwright test` (local dev server, both specs) →
  **2 passed**:
  - `e2e/parity.spec.ts` (existing Gate 5 suite) — **unmodified**, still
    18/18 steps green, confirming zero Cash Module regression.
  - `e2e/accounting.spec.ts` (new) — real-browser flow: `#/cash` and
    `#/accounting` independently open/reload/switch correctly; demo
    mapping seed visible on first load; a mapped income entry generates a
    correct journal entry (庫存現金 debit / 一般收入科目 credit, ¥30,000)
    and a traceable 1:1 voucher (`JV00001`); an entry with an unmapped
    category is flagged (待設定科目對應 count increments) and does NOT
    create a journal entry, and the "產生分錄" button correctly stays
    disabled for it; a transfer's two legs are excluded (未處理轉帳 count
    ≥ 2) but never journalized and never hidden; accounting data survives
    a page reload; Cash Module's own dashboard summary and transfer-pair
    display are unaffected throughout.

DEVIATIONS
- None from the Gate-Review-approved revised plan. The two MUST FIX items
  and the voucher-grouping adjustment from the first review round are
  fully incorporated (see IMPLEMENTED above) — this is the plan as
  approved, not a further deviation from it.

RISKS / KNOWN LIMITATIONS
- **CategoryMapping is keyed by category name, not a stable id** — flagged
  explicitly by Gate Review as acceptable for this prototype but a real
  limitation: if a Cash Module category is ever renamed, its mapping
  silently orphans (the entry would then show as `unmapped`, not
  incorrectly mapped — so this fails safe, but still loses the existing
  configuration). A production version should key by a stable category
  identifier once the Cash Module's category model supports one.
- **v0.1 mapping is a single global rule per account/category pair** —
  there's no support yet for splitting one CashEntry across multiple GL
  lines, tax handling, or anything beyond the two-line debit/credit model
  described in IMPLEMENTED. This matches the explicitly-scoped v0.1 goal
  (validate the architecture, not build a complete accounting engine).
- **Transfers are permanently excluded from v0.1 auto-mapping** — every
  transfer leg will always show under 未處理轉帳 until a future version
  defines a real transfer→GL mapping rule (cash-account-to-cash-account,
  no clearing account). This was a deliberate Gate Review-endorsed scope
  boundary, not an oversight, and is visibly counted rather than hidden.
- **No multi-entry voucher combination UI** — 1 JournalEntry = 1 Voucher
  only; combining multiple entries into one voucher is explicitly deferred
  to a future, separately-decided version per Gate Review's own
  instruction not to infer grouping rules prematurely.
- Not merged to `main` — this branch (`feature/accounting-module`) is
  intentionally kept separate per the plan's explicit instruction, pending
  this Delta Report's review.

REQUEST
Gate Review of this implementation, via the same Slack `#ai-gate-test`
pipeline used for Gates 1-5 and for the pre-implementation plan review.
