[Gate 4 Delta Report]

BASELINE
- previous PASS commit: `b2a9c14` (Gate 3, STATUS: PASS, verified via Slack, ~1 min turnaround)
- current gate: Gate 4 — Standalone Frontend + Migration Parity
- branch: `migration/v1`

FILES CHANGED
- `docs/architecture/category-decision.md` (new) — the Gate 3 review's
  required `cash_entries.category` preserve-vs-normalize decision,
  finalized: **preserve** (rationale inside)
- `frontend/**` (new, ~30 files) — React + Vite + TypeScript standalone
  frontend: auth screens, tenant switcher, cashbook entry form/list,
  dashboard summary, account/category management, transfer form, CSV
  export; `frontend/e2e/parity.spec.ts` — Playwright end-to-end test
  covering the full Gate 4 parity checklist against a real running backend
- `backend/scripts/migration/**` (new) — migration tooling: schema mapping
  doc, legacy type definitions, pure transform functions, verification
  logic, and the dry-run driver script
- `backend/tsconfig.json` — added `scripts` to `include` so migration
  tooling is typechecked
- `backend/package.json` — added `migrate:dryrun` script
- `.gitignore` — added Playwright's `test-results/`/`playwright-report/`

IMPLEMENTED
- **Standalone frontend, zero WordPress runtime dependency**: a plain
  React SPA that only talks to the Gate 3 API (`/api/v1/...`) — no
  shortcode, no WordPress asset pipeline, no PHP anywhere in this
  directory.
- **Full legacy parity checklist**, per the Kickoff's Gate 4 list:
  - company/ledger switching — `TenantSwitcher`
  - create company — same component, seeds default account+categories via
    the existing API
  - add income/expense — `EntryForm`
  - edit/delete — `EntryForm` (edit mode) + `EntryList` (delete, with a
    transfer-aware confirm message)
  - dashboard summary — `SummaryCards` + `AccountSummaryCards`
  - account settings — `AccountManage` (create/update/disable/enable)
  - category settings — `CategoryManage` (create/update/disable/enable)
  - account transfer — `TransferForm`
  - detail search — `EntryList` keyword/date filters
  - sorting — `EntryList` order control
  - CSV export — `EntryList`'s export button (fetches with auth header as
    a blob, since a plain `<a href>` can't carry the JWT)
- **Parity verified by running the app, not by reading the code**: a
  Playwright E2E test (`frontend/e2e/parity.spec.ts`) drives a real browser
  (the environment's pre-installed Chromium) against the real Fastify
  backend + real MySQL through the full checklist in one continuous
  session — register → create company → add/edit/delete entries →
  transfer (and confirm the transfer leg can't be edited) → account/
  category CRUD including disable/enable → search → sort → CSV download →
  second company + switch back with data isolation intact. **This caught
  a real bug**: `EntryForm`'s edit-mode effect never restored the `memo`
  field, so clicking "編輯" silently left the summary blank. Fixed before
  this report was written (see TEST/EVIDENCE).
- **`cash_entries.category` preserve-vs-normalize decision finalized**
  (Gate 3 review's explicit carry-over): **preserve as a string**, not a
  foreign key. Full rationale in `docs/architecture/category-decision.md`
  — in short, normalizing is a data-model improvement this parity-migration
  project doesn't need, and would silently change historical-entry
  behavior (retroactive category renames) that nobody asked for.
- **Migration tooling**: schema mapping documented
  (`backend/scripts/migration/README.md`) for all 5 legacy tables +
  `wp_users` → the new `users` table; a pure, unit-testable `transform.ts`;
  and `migrate.ts`, a dry-run driver that:
  - **refuses to run** unless `MIGRATION_DRYRUN_DATABASE_URL` is set and
    its name contains an obvious dry-run marker — there is no code path
    here that can reach a real database, per the Kickoff's explicit Gate 4
    boundary
  - clears and re-populates its target database on every run (so it's
    repeatable, not just re-runnable with drift)
  - independently recomputes row counts, every account's balance, every
    tenant's income/expense totals (transfers excluded), and every
    transfer's pair integrity **from the source fixture's own numbers**,
    and compares against what actually landed in the destination — not a
    simulated assertion, an actual MySQL round-trip
  - flags, rather than silently working around, the one migration
    limitation that can't be resolved in tooling: WordPress's phpass
    password hashes can't be verified by the standalone scrypt-based
    `AuthService`, so migrated users get a sentinel `passwordHash` and the
    README documents that a real cutover needs a forced password-reset
    flow
- Synthetic fixture (`fixtures/legacy-sample.json`) deliberately includes:
  two tenants (multi-tenant isolation), a transfer pair, and one entry
  referencing a category that is later marked `inactive` (exercising
  "historical entries survive a category being disabled" — the exact
  scenario `category-decision.md`'s rationale depends on).

TEST / EVIDENCE
- `cd backend && npm run typecheck && npm test && npm run test:integration`
  → all still passing (12 files / 51 tests zero-dependency, 6/6 real-MySQL
  integration) — Gate 4 did not regress Gate 2/3.
- `cd frontend && npx tsc -b` → clean. `npm run build` → succeeds (246 KB
  JS bundle, no warnings).
- `cd frontend && npx playwright test` → **1/1 passing**, 13 `test.step`s
  covering every parity checklist item, run against the real backend +
  MySQL:
  ```
  ✓ e2e/parity.spec.ts:11:1 › Gate 4 parity checklist end-to-end (3.4s)
  ```
  First run caught the missing-memo-on-edit bug (see IMPLEMENTED); fixed,
  then reran clean.
- Migration dry run, run twice in a row against a real MySQL database
  (`zanzan_cash_migration_dryrun`) to prove repeatability — both runs:
  ```
  Verification: 7/7 checks passed
  ✓ row counts match ... users 2/2, tenants 2/2, memberships 2/2, accounts 3/3, categories 4/4, entries 6/6
  ✓ account balance matches: legacy account #1 (現金) — source=2580, dest=2580
  ✓ account balance matches: legacy account #2 (銀行) — source=5500, dest=5500
  ✓ account balance matches: legacy account #3 (現金) — source=-50, dest=-50
  ✓ tenant totals match (transfers excluded): legacy tenant #1 (Alice's Shop) — source income=3000/expense=920, dest income=3000/expense=920
  ✓ tenant totals match (transfers excluded): legacy tenant #2 (Bob's Ledger) — source income=0/expense=50, dest income=0/expense=50
  ✓ transfer pair intact: TRF20250306001 — source legs=2, dest legs=2
  Migration dry run PASSED verification.
  ```
- Safety-guard test: ran `migrate.ts` with `MIGRATION_DRYRUN_DATABASE_URL`
  pointed at `zanzan_cash_dev` (a real, non-dry-run database name) —
  confirmed it refuses to run (exit code 1) rather than silently
  proceeding.

DEVIATIONS
- **No React Router / multi-page navigation.** The frontend is a single
  scrolling page with anchor-link navigation (`#sec-entry`, `#sec-summary`,
  etc.), directly mirroring the legacy shortcode's own single-page
  `.zzscs-nav` structure. This is a deliberate parity choice, not a
  shortcut — the legacy UI has no multi-page navigation to replicate, and
  introducing one would be scope creep beyond "capability parity."
- **No design system / component library.** Plain CSS
  (`frontend/src/styles.css`), loosely structured after the legacy
  `cashbook.css` class names for readability, but not ported CSS.
  `kickoff-contract.md` Gate 4 explicitly says pixel parity is not
  required.
- **Migrated user accounts get a sentinel password hash, not a working
  password** (see IMPLEMENTED and `scripts/migration/README.md`). This is
  not a gap the dry run needed to solve — no real user data ever reaches
  this tool per the Kickoff's Gate 4 scope — but it's the single largest
  piece of unfinished design for a future real cutover, and is written
  down rather than left implicit.
- **CSV export uses a client-side blob download**, not a plain
  `<a href="...">`, because the export endpoint requires the JWT
  `Authorization` header, which a bare anchor tag can't send. Functionally
  equivalent to the legacy nonce-gated download; verified working in the
  Playwright suite.

RISKS / KNOWN LIMITATIONS
- The frontend has no automated unit tests of its own (e.g., Vitest +
  React Testing Library) — Gate 4 relies on the Playwright E2E suite for
  behavioral coverage instead of a separate unit-test layer. This was a
  deliberate scope call given the size of Gate 4 already; worth adding
  before Gate 5 if UI logic grows more complex than the current
  straightforward CRUD screens.
- The E2E suite is a single long test (13 steps) rather than several
  smaller independent tests — a failure partway through means later steps
  don't run this session. Acceptable for now given the workflow is
  inherently sequential (can't transfer money before creating a second
  account, etc.); worth revisiting if the suite grows.
- Migration tooling has only been exercised against the synthetic fixture,
  never against an actual `mysqldump` of a real WordPress installation's
  schema. The schema mapping in `scripts/migration/README.md` is based on
  the legacy `install.php` snapshot, which should still be accurate, but a
  real cutover project should re-verify column types/collations against an
  actual export before trusting this tooling on real data.
- No accessibility (ARIA, keyboard navigation beyond native form controls)
  or i18n review has been done on the frontend — not a legacy behavior to
  preserve, not called for by Gate 4's PASS criteria, flagged as a Gate 5+
  candidate.

REQUEST
Gate Review, via the confirmed Slack pipeline (`#ai-gate-test`, message
signed "Claude Code" on its own line).
