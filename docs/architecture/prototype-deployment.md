# Gate 5 (ACTIVE) — Public Prototype Deployment

This document records the deployment shape and storage strategy for the
rescoped Gate 5 deliverable: a publicly browsable, single-user bookkeeping
prototype. It supersedes the original Gate 5 plan (Google Cloud Staging),
which is kept in `docs/gates/kickoff-contract.md` for historical record but
is not built.

## Architecture

```
GitHub Pages (static hosting)
        ↓
one-page React app (frontend/, Vite build)
        ↓
localStorage (single JSON blob, key: zzcs_prototype_db_v1)
        ↓
page-footer Debug panel — read-only display of the localStorage content
```

There is no backend server, no database server, no login, and no
multi-tenant isolation. The app runs entirely in the visitor's browser.

## Why this shape

- The Gate 2-4 domain logic (`backend/src/domain/**`) and the Gate 2
  in-memory repository implementations (`backend/src/infra/memory/**`) are
  pure TypeScript with no WordPress/HTTP/DB dependency, so the frontend
  imports them directly instead of duplicating business rules. This keeps
  the prototype behaviorally identical to the reviewed Gate 2-4 baseline
  for income/expense mutual exclusion, account/category validation,
  transfer double-entry integrity, and summary calculation.
- Real storage is `localStorage`, not the DOM. The Debug panel at the
  bottom of the page only *displays* what's in `localStorage` — it does
  not itself persist anything, and it re-reads storage on every refresh of
  its own display, not on page load. This keeps "storage" and "display"
  separate, as required by the Gate 5 rescope.
- A one-time "ID counter warm-up" runs on load (`frontend/src/localdb/persistence.ts`)
  so that the backend's `generateId()` — a module-level counter that
  always starts at 1 — doesn't collide with IDs already persisted from a
  previous session. This is implemented entirely in the frontend's
  persistence adapter; the backend's already-reviewed `InMemoryDatabase.ts`
  is unmodified.

## Deployment

- **Hosting**: GitHub Pages, project site, served at
  `https://b88104069.github.io/zanzan-cash-service/`.
- **Build**: `frontend/vite.config.ts` sets `base: '/zanzan-cash-service/'`
  only when building (`command === 'build'`), so `npm run dev` still serves
  from `/` locally.
- **Workflow**: `.github/workflows/deploy-pages.yml` builds `frontend/`
  on push to `migration/v1` (path-filtered to `frontend/**` and the
  workflow file itself) and publishes `frontend/dist` via
  `actions/upload-pages-artifact` + `actions/deploy-pages`.
- **One-time manual step required from the repo owner**: GitHub Pages
  must be switched to "Source: GitHub Actions" once, under
  **Settings → Pages**. No GitHub API/MCP tool available to this session
  can toggle that setting — it is a one-time console action, not a
  HUMAN REVIEW stop condition (no cost, no new credential, no production
  system touched).
- **Live URL**: to be recorded here once the repo owner has enabled Pages
  and the first deploy workflow run has completed successfully.

## Known limitations

- CSV export does not include `transfer_code`, so re-importing an exported
  CSV recreates transfer legs as ordinary unpaired entries rather than a
  linked transfer pair. Import is intended for recovering plain
  income/expense entries, not for restoring a full transfer history.
- The Gate 3/4 `AuthProvider`, `AuthGate`, `TenantProvider`, and
  `TenantSwitcher` components remain in the repository, unused by
  `App.tsx`, kept only in case a future real-backend build wants them.
- Data lives entirely in the visitor's browser; it is per-browser, not
  shared across devices, and clearing site data or using a different
  browser/profile starts a fresh, empty ledger.
