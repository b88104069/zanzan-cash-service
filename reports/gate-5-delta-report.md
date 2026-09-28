[Gate 5 Delta Report]

BASELINE
- previous PASS commit: `b2a9c14` (Gate 4 baseline, standalone frontend +
  migration parity — separately re-confirmed via `906dd42` "Record Gate 4
  PASS; mark Gate 5 blocked pending GCP access")
- rescope commit: `84e924f` — the project owner rescoped Gate 5 away from
  Google Cloud Staging entirely (no GCP, no Cloud SQL, no production
  cutover) to **Public Prototype Deployment**: a single-user, browser-only
  bookkeeping prototype on GitHub Pages. Full rescoped contract is in
  `docs/gates/kickoff-contract.md` → "Gate 5 (ACTIVE) — Public Prototype
  Deployment"; the original GCP section is kept, marked superseded, for
  historical record.
- this gate's implementation commit: `b100592`
- branch: `migration/v1`

FILES CHANGED
- `frontend/vite.config.ts` — removed the now-unused `/api` dev proxy
  (nothing in this build makes an HTTP call); added `base:
  '/zanzan-cash-service/'` for GitHub Pages project-site hosting, applied
  only when building (`command === 'build'`), so `npm run dev` is
  unaffected
- `frontend/tsconfig.app.json` — removed `erasableSyntaxOnly` (a
  type-check-only flag; required because the frontend now directly
  imports backend TypeScript files that use constructor parameter
  properties)
- `frontend/src/localdb/persistence.ts` (new) — `loadDatabase()` /
  `saveDatabase()` against a single `localStorage` key
  (`zzcs_prototype_db_v1`); `readRawStorageForDebug()` for the Debug
  panel; ID-counter warm-up (see STORAGE STRATEGY)
- `frontend/src/localdb/services.ts` (new) — wires the Gate 2 domain
  services (`AccountService`, `CategoryService`, `CashEntryService`,
  `TransferService`, `ExportService`, `TenantService`) to the loaded
  local database, auto-provisioning a single local tenant on first run
- `frontend/src/localdb/localRouter.ts` (new) — dispatches the same
  `path`/`method` shapes the frontend already used against the Gate 3 API
  directly to the local services, translating `DomainError` to the
  existing `ApiError` type so component error handling is unchanged;
  saves to `localStorage` after every mutation
- `frontend/src/localdb/LocalDataProvider.tsx` (new) — React context that
  initializes local services once and provides them to the tree
- `frontend/src/api/useApi.ts` (rewritten) — same `useApi()` call
  signature as Gate 3/4, now dispatching to `localApiCall` instead of
  `fetch`; every consuming component (`EntryForm`, `EntryList`,
  `AccountManage`, `CategoryManage`, `TransferForm`, summary cards,
  `useOptions`) needed **no changes**
- `frontend/src/App.tsx` — drops `AuthProvider`/`AuthGate`/
  `TenantProvider` in favor of `LocalDataProvider`
- `frontend/src/features/Dashboard.tsx` — removed login-gating and
  tenant-switch UI (a tenant always exists by the time this renders); adds
  the Debug panel
- `frontend/src/features/cashbook/EntryList.tsx` — CSV export now builds
  the file client-side from `exportService.getCsvRows()` instead of an
  authenticated HTTP download; adds CSV import (new feature, see IMPLEMENTED)
- `frontend/src/features/debug/DebugPanel.tsx` (new) — read-only display
  of `localStorage` content
- `frontend/src/styles.css` — `.debug-panel`/`.debug-note`/`.debug-textarea`
- `frontend/playwright.config.ts`, `frontend/e2e/README.md`,
  `frontend/e2e/parity.spec.ts` — rewritten for the no-backend, no-login
  flow (see TEST/EVIDENCE)
- `frontend/e2e/downloads/.gitignore` (new) — keeps the E2E download
  folder tracked while ignoring its downloaded artifacts
- `.github/workflows/deploy-pages.yml` (new) — builds `frontend/` and
  publishes `frontend/dist` to GitHub Pages on push to `migration/v1`
- `docs/architecture/prototype-deployment.md` (new) — architecture,
  deployment, and storage-strategy record for this Gate

`backend/**` is untouched (`git diff --stat` against the Gate 4 baseline
is empty) — Gate 5 reuses Gate 2's already-reviewed domain services and
in-memory repositories exactly as written.

IMPLEMENTED
Per the rescoped Gate 5 scope items:
1. Public URL — see DEPLOYMENT URL below (pending the repo owner's
   one-time manual step; see RISKS).
2. Single-page UI — unchanged from Gate 4's single-scrolling-page layout.
3. Single test user — one local tenant auto-provisioned on first load
   (`LOCAL_USER_ID = 'local-user'`), no login screen, no account creation.
4. Local persistence — `localStorage`, one JSON blob.
5. Income/expense add/edit/delete — unchanged Gate 2-4 business rules
   (mutual exclusion, active-account/active-category checks), now served
   locally.
6. Account management (create/disable/enable) — unchanged.
7. Category management (create/disable/enable) — unchanged.
8. Transfer — unchanged double-entry pair creation; a transfer leg still
   cannot be edited individually.
9. Dashboard summary — unchanged calculation (transfers excluded from
   income/expense totals).
10. Search/sort — unchanged.
11. CSV export — unchanged output format, now generated client-side.
12. CSV import — **new for Gate 5** (the legacy plugin never had this).
    Parses the exported CSV format (quoted-field/escaped-quote/BOM aware,
    hand-written parser — the format is small and fully controlled by our
    own exporter) and re-creates entries via the same local API calls the
    rest of the app uses, so the normal validation rules apply on import
    too.
13. Prototype Data / Debug panel — a labeled, read-only block at the
    bottom of the page showing the actual current `localStorage` content
    (accounts, categories, entries, computed via `readRawStorageForDebug()`)
    as pretty-printed JSON in a `<textarea readOnly>`. It only *displays*
    storage; it never writes to it, per the project owner's explicit
    storage-vs-display design note.

Design note on the storage/display separation (per the project owner's
guidance): real storage is `localStorage`, not the DOM — writing values
into the page and expecting them to survive a reload would not work,
since a reload re-parses `index.html` from disk, not from whatever the
browser last rendered. The Debug panel reads `localStorage` fresh on
every refresh of its own display; it is not itself a storage mechanism.

An ID-counter collision risk was found and fixed without touching the
already-reviewed backend code: `generateId()` in
`backend/src/infra/memory/InMemoryDatabase.ts` uses a module-level counter
that always starts at 1 on page load. For data that persists across
reloads via `localStorage`, a newly created record could otherwise reuse
an ID already used by a previously-saved record, silently overwriting it.
Fixed entirely in the frontend's own persistence layer
(`frontend/src/localdb/persistence.ts`): on load, scan every loaded ID for
its highest numeric suffix, then call the backend's own exported
`generateId('_warmup')` that many times to advance its counter past it.

DEPLOYMENT URL
Pending. The GitHub Actions workflow (`.github/workflows/deploy-pages.yml`)
and the `vite.config.ts` base path are in place and committed on
`migration/v1`, but GitHub Pages for this repository has not been switched
to "Source: GitHub Actions" yet — see RISKS/KNOWN LIMITATIONS for why this
is a one-time manual step nothing in this session can perform. Once the
repo owner does that and this workflow runs, the live URL will be
`https://b88104069.github.io/zanzan-cash-service/`. This report's
DEVIATIONS section documents the E2E verification that could be done
before that toggle exists; a follow-up run against the real deployed URL
is warranted once it is live (see RISKS).

STORAGE STRATEGY
See `docs/architecture/prototype-deployment.md` for the full write-up.
Summary: one `localStorage` key (`zzcs_prototype_db_v1`) holding the
entire local database as JSON (accounts, categories, entries, tenant),
loaded/saved by `frontend/src/localdb/persistence.ts`. No IndexedDB was
needed — the data volume for a single test user is small and
`localStorage`'s synchronous API was the simplest fit, per the "least
modification / least complexity" instruction in the rescope. `Date`
fields are revived on load since `JSON.parse` does not preserve them.

TEST / EVIDENCE
- `cd frontend && npx tsc -b` → clean (after removing
  `erasableSyntaxOnly`, needed for the cross-project domain-service
  import).
- `cd frontend && npm run build` → succeeds, 47 modules transformed (up
  from Gate 4's module count — confirms the backend domain code is
  actually bundled in, not tree-shaken away); `dist/index.html` correctly
  references `/zanzan-cash-service/assets/...` and
  `/zanzan-cash-service/favicon.svg`, confirming the GitHub Pages base
  path is applied at build time.
- `git diff --stat` against the Gate 4 baseline for `backend/` → empty:
  zero backend files modified.
- `cd frontend && npx playwright test` (against the local dev server,
  using the environment's pre-installed Chromium) → **1 passed**, 18
  `test.step`s covering the full rescoped PASS checklist in one continuous
  session: open with no login → create account → create category → add
  income → add expense → edit an entry → transfer creates two linked
  entries → a transfer leg cannot be edited → search filters the list →
  sorting changes list order (asc/desc, exact-date assertions) →
  dashboard summary is correct → CSV export downloads a file → Debug panel
  shows actual stored content → **data survives a page reload** → **data
  survives closing and reopening the browser** (verified by carrying
  `context.storageState()` into a brand-new, separate Playwright browser
  context — not just a reload, which would prove less) → CSV import
  round-trip (delete the entries created in this run, import the earlier
  export back, confirm the same entries reappear).
- Three real bugs were found and fixed while getting this suite green
  (not reported as passing on the first attempt):
  1. `EntryForm`'s `resetForm()` (matching the legacy `clearForm()`
     behavior) clears the selected account after every submit — a test
     step assuming the account stayed selected failed with "請選擇帳戶";
     fixed by re-selecting it before the second entry.
  2. The same reset also clears the date back to today — a sort-order
     step got today's date instead of the intended fixture date; fixed by
     re-filling the date field, and the sort assertion was tightened to
     check exact dates in both directions rather than a weak `<=`
     comparison.
  3. `getByText(...)` for an edited memo matched both the entry list *and*
     the Debug panel's JSON dump of the same data — fixed by scoping the
     locator to `#sec-list` in every step that checks list content.
- **Outstanding**: this E2E run is against the local dev server, not the
  real deployed public URL — the Kickoff requires evidence against "the
  actual deployed URL," which requires the one-time GitHub Pages toggle
  described in RISKS. Recorded as a required follow-up, not claimed as
  already satisfied.

DEVIATIONS
- CSV import is new functionality relative to the legacy plugin (which
  only ever exported). It was added because scope item 12 asks for it "if
  reasonable," and a working round-trip is directly useful for the
  Debug/prototype nature of this Gate. It is not claimed as a legacy
  parity item.
- The exported CSV does not carry `transfer_code` (matching the legacy
  export format, which also excludes it). Consequently, re-importing an
  exported CSV recreates a transfer's two legs as ordinary unpaired
  income/expense entries, not a linked transfer pair. Documented as a
  known limitation rather than silently accepted.
- The Gate 3/4 `AuthProvider`, `AuthGate`, `TenantProvider`, and
  `TenantSwitcher` components remain in the repository unmodified but
  unused — kept rather than deleted in case a future (out-of-scope for
  this project) real-backend build wants them; `App.tsx` documents this in
  a comment.
- `backend/**`, `backend/prisma/**`, and the Gate 3 HTTP API layer are
  untouched and unused by this Gate's build. They remain in the repo as
  the Gate 2/3 baseline; Gate 5 does not deploy or exercise them.

RISKS / KNOWN LIMITATIONS
- **GitHub Pages requires a one-time manual repository setting** —
  Settings → Pages → Source: "GitHub Actions" — that only the repository
  owner can toggle. No GitHub MCP tool available to this session can set
  this (confirmed via `ToolSearch`; only file/PR/Actions-listing tools
  exist, no repository-settings tool). This is not treated as a Gate 5
  HUMAN REVIEW stop condition per the rescope's own list (it needs no
  payment, no new external credential, and touches no production system)
  — it is flagged here as the one action item outside this session's
  reach. Once toggled, the existing `deploy-pages.yml` workflow (already
  pushed) will publish on the next `migration/v1` push that touches
  `frontend/**`, or can be run manually via `workflow_dispatch`.
- Until that toggle happens and the workflow runs once, there is no live
  public URL to record, and the Kickoff's "real browser against the
  actual deployed URL" E2E requirement cannot be satisfied — only the
  local-dev-server equivalent above. This is the single open item blocking
  full closure of this Gate's PASS criteria and should be resolved and
  re-verified as soon as the owner completes the toggle.
- Data lives only in the visitor's own browser (`localStorage`), so it is
  not shared across devices/browsers and is lost if site data is cleared
  — consistent with, and explicitly required by, the rescope's single-test-user,
  no-multi-user-architecture instruction.
- No production WordPress/WooCommerce system, real member data, GCP
  resource, DNS record, or Cloudflare configuration was touched at any
  point in this Gate's work.

REQUEST
Gate Review, via the confirmed Slack pipeline (`#ai-gate-test`, message
signed "Claude Code" on its own line), with the explicit caveat above:
deployment-URL and real-deployed-URL E2E evidence are pending the repo
owner's one-time GitHub Pages toggle, everything else in the rescoped
scope is implemented and verified against the local build.
