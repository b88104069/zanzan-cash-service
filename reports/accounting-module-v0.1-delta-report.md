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

---

GATE REVIEW RESULT (appended after review)

- Channel: Slack `#ai-gate-test`, same thread as the plan review:
  https://w1790566585-i2d716150.slack.com/archives/C0C4P9C6JF5/p1790603326267939
  Turnaround: ~2 minutes.
- Verified independently via `slack_read_thread` before acting: sender is
  the ChatGPT Slack app (`<@U0C5PSTQMEC>`).
- **STATUS: PASS**
- MUST FIX: NONE
- KEEP: frozen Cash baseline protection (accounting code is a fully
  separate subtree; `App.tsx`/`styles.css` changes are additive-only
  module-navigation integration); the separated `ChartOfAccount`/
  `AccountMapping`/`CategoryMapping`/`MappingStatus` data model, with its
  own `AccountingDatabase`/`zzcs_accounting_db_v1` (upsert mapping
  semantics support re-pointing a mapping from the UI, consistent with
  the report); the Cash→Accounting contract (mapped income/expense
  debit/credit rules, unmapped → no journal, transfer → excluded but
  visible, `sourceCashEntryId` traceability without writing back to
  CashEntry); the Journal/Voucher foundation (line model, not just two
  flat account columns; tested balanced debit/credit; 1:1 Voucher in
  v0.1; Voucher→JournalEntry traceability); the `#/cash`/`#/accounting`
  hash-routed module page pattern with shared `ModuleShell`, no router
  dependency added; the regression evidence (60/60 backend tests
  including 9 new; unmodified Gate 5 Cash parity suite still 18/18;
  Cash-data snapshot unchanged before/after the whole accounting flow).
- REVIEW NOTES: the `CategoryMapping`-by-name limitation is correctly
  documented and acceptable for this prototype, to be revisited as a
  stable id in a production version; the transfer-excluded scope boundary
  is an already-approved v0.1 limit, not a gap; the current E2E evidence
  is against the local dev server, which is acceptable for this Gate
  since its scope is module architecture and behavior, not a public
  deployment closure (unlike Gate 5) — but ChatGPT recommends one
  post-merge public-Pages smoke/E2E once merged, to confirm the
  live-deployed build behaves the same way.
- NEXT (ChatGPT's suggestion): open a PR from `feature/accounting-module`
  to `main` and merge via the repo's existing flow, then verify the
  GitHub Pages workflow redeploys successfully and re-run a smoke/E2E
  against the real public URL (`#/cash`, `#/accounting`, module switch,
  mapped entry → journal/voucher, reload persistence).
- **However**, per this project's own Kickoff for the Accounting Module
  (explicitly distinct from the original Gate 1-5 auto-merge flow): *"不要
  直接 merge main"* — the plan requires asking the project owner before
  merging `feature/accounting-module` into `main`, even on a Gate Review
  PASS. This Delta Report's review is therefore recorded as complete, but
  the merge itself is deferred pending the project owner's decision (see
  the chat reply accompanying this report).
- The project owner reviewed independently (outside the ChatGPT relay)
  and confirmed: keep the branch unmerged, and first complete a
  **prototype deployment validation** — a real GitHub Pages preview
  deployment with real-browser E2E for both `#/cash` and `#/accounting` —
  before any merge decision. Instruction: *"Keep feature/accounting-module
  branch. Do not merge. Prepare Accounting Module v0.1 prototype
  deployment validation against GitHub Pages preview URL, including real
  browser E2E for both #/cash and #/accounting. Submit Delta Report after
  completion."* See the closure section below.

---

[Accounting Module v0.1 — Prototype Deployment Validation] (closure delta)

WHAT WAS BUILT
- `frontend/vite.config.ts` — added a `PAGES_BASE_PATH` env override
  (defaults to the existing production `/zanzan-cash-service/` path when
  unset, so the production build is byte-for-byte unaffected).
- `.github/workflows/deploy-pages-preview.yml` (new) — triggers on push to
  `feature/accounting-module`. GitHub Pages under the native Actions
  source model serves exactly one live deployment per repo, so rather than
  standing up a second Pages site or an external host (Netlify/Vercel —
  which would need a new credential, explicitly out of scope), this
  workflow builds BOTH refs in one job and combines them into one
  artifact:
  - `main` (production, unchanged) → deployed at the existing root
  - `feature/accounting-module` (this branch, `PAGES_BASE_PATH=/zanzan-cash-service/preview/accounting-module/`)
    → deployed under `/preview/accounting-module/`
  Both are then published together via `actions/upload-pages-artifact` +
  `actions/deploy-pages`, so the already-approved production prototype at
  the root is untouched while the feature branch gets a real, public,
  directly-linkable preview URL.
- `frontend/playwright.preview.config.ts` (new) — points `baseURL` at the
  preview subpath; reuses `e2e/parity.spec.ts` and `e2e/accounting.spec.ts`
  completely unmodified (no separate "preview-only" test logic).

PREVIEW URL
**https://b88104069.github.io/zanzan-cash-service/preview/accounting-module/**
(production root, https://b88104069.github.io/zanzan-cash-service/, confirmed unchanged and still HTTP 200)

TEST / EVIDENCE
```
$ curl -sS -o /dev/null -w "%{http_code}\n" https://b88104069.github.io/zanzan-cash-service/
200
$ curl -sS -o /dev/null -w "%{http_code}\n" https://b88104069.github.io/zanzan-cash-service/preview/accounting-module/
200
$ npx playwright test --config=playwright.preview.config.ts
...
1 passed (1.5m)   [e2e/parity.spec.ts final status: passed, 1 flaky retry]
1 passed           [e2e/accounting.spec.ts final status: passed, 1 flaky retry]
```
Both `e2e/parity.spec.ts` (18 steps: no-login open, account/category CRUD,
income/expense CRUD, transfer double-entry integrity, search/sort,
dashboard summary, CSV export/import, Debug panel, reload persistence,
close/reopen-browser persistence) and `e2e/accounting.spec.ts` (`#/cash`
and `#/accounting` independently open/reload/bookmark; demo mapping seed
visible; mapped income → correct journal entry + traceable voucher;
unmapped category flagged, no journal created; transfer excluded but
visibly counted; accounting data survives reload; Cash Module dashboard
unaffected) pass against the real preview URL, run through the
environment's real Chromium.

Some individual attempts hit this sandbox's own egress-proxy flakiness
(`ERR_TOO_MANY_RETRIES`), the same pre-existing, already-documented
sandbox limitation from the Gate 5 closure delta — not a defect in the
deployed app. `playwright.preview.config.ts` uses the same
`retries`/timeout/proxy-args mitigation as `playwright.prod.config.ts`,
and every run's final Playwright status was `passed`, confirmed via
`test-results/.last-run.json`.

DEVIATIONS
None. This closure delta only adds deployment/test tooling
(`vite.config.ts`'s env-gated base override, the preview workflow, the
preview Playwright config) — no domain logic, UI component, or Cash
Module file changed.

REQUEST
This completes the project owner's requested prototype deployment
validation. `feature/accounting-module` remains unmerged, pending the
project owner's explicit merge decision — not automatically opened as a
PR despite ChatGPT's earlier suggestion, per this Gate's own no-auto-merge
instruction.

---

[Merge Decision] — Option B: keep as feature branch

The project owner independently reviewed the full thread (plan, revised
plan, implementation Delta Report, and this deployment-validation Delta
Report) and issued their own review judgment, matching ChatGPT's PASS:

> STATUS: PASS, MUST FIX: NONE, Deployment Validation: PASS, Merge: WAIT

**Decision: Option B — do not merge `feature/accounting-module` into
`main`.** Rationale, in the owner's own words: Accounting Module v0.1 is
closer to "the first financial-core module prototype" than a simple UI
addition. It's expected to grow further — a complete Chart of Accounts
design, financial statement models, tax logic, fiscal periods — before a
merge makes sense. Keeping it as a feature branch fits this project's
management style for larger engineering efforts: prove the new module out
fully, then merge once, rather than merging early and iterating on `main`.

This is a process choice, not a technical blocker — the module itself is
already fully evaluated as PASS at both the implementation and deployment
layers.

CURRENT STATE (final, this Gate)
```
main
 └── Cash Service v1.0 (frozen, unchanged)
     https://b88104069.github.io/zanzan-cash-service/

feature/accounting-module
 └── Accounting Module Prototype v0.1 (PASS, unmerged)
     https://b88104069.github.io/zanzan-cash-service/preview/accounting-module/
```

No further action needed on this branch unless/until the project owner
either (a) asks to proceed with additional Accounting Module scope
(reports, vouchers printing, P&L, balance sheet, import tooling) on the
same branch, or (b) decides to merge. Both `main` and
`feature/accounting-module` stay pushed and reviewable at any time.
