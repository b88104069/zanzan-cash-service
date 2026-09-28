# Zanzan Cash Service Migration v1.0 — Kickoff Contract

Status: **ACTIVE** (Kickoff issued and accepted; Gate 1 in progress)
Issued by: Project owner (b88104069@gmail.com), via ChatGPT-drafted Kickoff per project SOP §13.4
Accepted by: Claude Code (execution agent), on `migration/v1`

This document is the authoritative Gate Roadmap, PASS Criteria, authorization
scope, and stop conditions for this project. It supersedes ad-hoc scoping —
any future Gate work should be checked against this file, not re-derived.

---

## Baseline

**Git Repository**: `b88104069/zanzan-cash-service`

**Execution Baseline** (confirmed at Kickoff): `main` contains exactly:

```
README.md
docs/
└─ migration/
   ├─ README.md
   └─ zanzan-simple-cash-saas_1-8-33_合併原始碼.txt
```

**Legacy Snapshot**: `zanzan-simple-cash-saas` v1.8.33

**Pre-Kickoff Discovery** (Gate 0.2 Architecture Audit — completed before this
Kickoff, treated as input, not redone):
- Architecture Audit completed (legacy plugin architecture, no-layering
  finding, all business logic embedded in REST callback functions)
- WordPress / WooCommerce / WooCommerce Subscriptions confirmed as the
  primary external dependencies, with Subscriptions as the sole entitlement
  source of truth
- Core domains identified: Tenant, Account, Category, Cash Entry, Transfer,
  Entitlement
- Confirmed: **zero automated tests** exist in the legacy codebase

**Baseline Status**: SYNC CONFIRMED (re-verified at Gate 1 start: `main`
tree matches exactly the three files listed above — see Gate 1 Delta
Report for the verification command output).

Going forward, baseline sync is maintained via **git commits + Delta
Reports**, not full-repository re-submission each Gate. A full baseline
re-check is only triggered by: Baseline Drift, a major refactor, a
detected conflict, or a long execution gap.

---

## Goal

Convert the WordPress/WooCommerce-dependent "贊贊記帳" plugin into an
independently deployable, independently testable Standalone Web Service
that preserves existing functionality and multi-tenant logic.

**This project's first priority is parity migration, not a product
redesign.**

```
WordPress Plugin
        ↓
   remove environment coupling
        ↓
Standalone Cash Service
```

Not:

```
Legacy system → throw it all away → build a new bookkeeping product
```

---

## Final Deliverable (Gate 5 PASS state)

Repository must contain at minimum:

```
zanzan-cash-service/
├─ application / backend source
├─ frontend source
├─ database schema / migrations
├─ automated tests
├─ migration tooling
├─ deployment configuration
├─ project / gate documentation
└─ legacy reference
```

And must achieve:

1. Starts without a WordPress runtime.
2. Core existing functionality reaches parity.
3. Tenant isolation preserved.
4. Transfer double-entry and data integrity preserved.
5. Account, category, entry, summary, CSV capabilities preserved.
6. WordPress/WooCommerce authorization logic isolated into an Adapter, not
   present in core Domain.
7. Deployable to a Google Cloud **non-production** environment.
8. Has automated characterization / regression tests.
9. Original WordPress production is unaffected.
10. Forms a stable baseline for future v1.1 feature work.

---

## Gate Roadmap

### Gate 1 — Project Contract + Architecture Freeze

**Purpose**: Turn the Architecture Audit from a temporary analysis into a
formal engineering contract inside the repository, establishing fixed
boundaries for Gates 2–5.

**Build**:
- `CLAUDE.md`, `project.json`, `docs/architecture/`, `docs/gates/`, `reports/`
- Formal definition of: legacy architecture map; WordPress dependency
  inventory; domain boundaries; service boundaries; database strategy; API
  contract principles; authentication/entitlement abstraction; Google Cloud
  target architecture; migration sequence; technical stack choice + rationale
- Initial characterization test **specification** (not full implementation)

**Constraint**: Do not redo the existing Architecture Audit — treat it as
Pre-Kickoff discovery and fold it into this formal Source of Truth.

**PASS Criteria**:
- Repository has a formal project contract.
- Backend/frontend/DB/authentication/entitlement boundaries are explicit.
- WordPress-specific code is explicitly marked: kept as Adapter vs.
  deprecated.
- The five existing tables and core invariants are documented.
- Each subsequent Gate's inputs/outputs are objectively verifiable.
- No large-scale feature rewriting has started.

**Gate 1 Review**: Claude Code submits a Delta Report to the Gate Review
channel → Review returns STATUS / MUST FIX / KEEP / NEXT → PASS advances
automatically to Gate 2.

---

### Gate 2 — Characterization Tests + Standalone Core

**Purpose**: Lock in legacy behavior before moving functionality; then build
a core Domain with zero WordPress dependency.

**Build**:
- Characterization tests covering at least: tenant creation/switching; cash
  entry create/update/delete; income/expense mutual exclusion; account
  validation; category type validation; account summary; monthly summary;
  transfer double-entry; transfer paired-deletion guard; disabled
  account/category behavior; CSV export behavior
- Standalone: `TenantService`, `AccountService`, `CategoryService`,
  `CashEntryService`, `TransferService`, `ExportService`
- Repository / persistence abstraction

**Out of scope this Gate**: WooCommerce integration, real membership
integration, production deployment.

**PASS Criteria**:
- Core Domain runs entirely without WordPress.
- Automated tests run independently.
- Legacy's main business rules have characterization coverage.
- Every data operation has explicit tenant context.
- Transfer transaction atomicity is tested.
- Core code never calls `$wpdb`, `get_current_user_id()`, user meta, or any
  WooCommerce function.

Gate 2 PASS → auto-advance to Gate 3.

---

### Gate 3 — Standalone API + Identity / Entitlement Boundary

**Purpose**: Package core services as a real API for a web app, and
extract "membership identity" and "paid entitlement" out of WordPress core.

**Build**:
- Standalone API: tenants, accounts, categories, cash entries, transfer,
  summary, export
- Authentication Layer, Tenant Context, `EntitlementService` interface —
  entitlement **must** be an abstraction:
  ```
  Cash Service → EntitlementService → {Development Adapter, Future WooCommerce Adapter}
  ```
  not `Cash Service → wcs_user_has_subscription()` directly.
- The WooCommerce Adapter may be interface/contract/mock only this Gate; a
  real production integration is not required yet.

**Security/isolation must be verified**, at minimum:
- User A cannot read User B's tenant
- Tenant A's entry cannot be queried via Tenant B's ID
- Unauthorized request → 401
- Authenticated but no entitlement → 403
- Invalid tenant context → reject

**PASS Criteria**:
- All core functionality operable via HTTP API.
- API automated tests pass.
- Tenant isolation tests pass.
- Auth and Entitlement are not bound to the WordPress implementation.
- API contract has formal documentation.
- Legacy business rules were not altered by API-ification.

Gate 3 PASS → auto-advance to Gate 4.

---

### Gate 4 — Standalone Frontend + Migration Parity

**Purpose**: Convert the WordPress shortcode/JS UI into an independent web
app, completing user-visible functional parity.

**Build**: Standalone frontend preserving at least: company/ledger
switching; company creation; add income/expense; edit/delete; dashboard
summary; account settings; category settings; account transfer; detail
search; sorting; CSV export. (Pixel-parity not required; **capability
parity with v1.8.33 is required**.)

Also: data migration tooling (Legacy WordPress DB → export/transform →
Standalone DB) — **this Gate only** does schema mapping, migration script,
and fixture/sample/synthetic-data dry-run. **Production customer data must
not be migrated directly in this Gate.**

**PASS Criteria**:
- Frontend usable in an environment with zero WordPress.
- All frontend functionality calls the standalone API.
- Parity checklist fully PASS.
- Migration dry-run is repeatable.
- Pre/post-migration count/amount/balance verifiable.
- Production DB was never touched.

Gate 4 PASS → auto-advance to Gate 5.

---

### Gate 5 — Google Cloud Staging + End-to-End Freeze

**Purpose**: Deploy the full Standalone Service to a real Google Cloud
staging/non-production environment; complete full technical acceptance.

**Build**: Per Gate 1's ratified architecture — application runtime,
managed database, secret/environment configuration, logging, HTTPS,
deployment configuration.

**Must demonstrate end-to-end**:
```
Browser → Standalone Frontend → Standalone API → Auth/Tenant/Entitlement → Database
```
covering: create tenant; create account; create category; record
income/expense; edit; delete; transfer; summary; search; CSV; tenant
isolation; restart/persistence.

**Explicitly NOT done in Gate 5**:
- No cutting of production WordPress traffic
- No deleting the original plugin
- No migrating real membership data
- No migrating real bookkeeping data
- No shutting down WooCommerce
- No pointing the production domain at the new Service

These are reserved for a later, separate **Production Cutover Project**.

**PASS Criteria**:
- Google Cloud staging deployment succeeds.
- Full E2E flow PASS.
- Automated regression PASS.
- Data persists correctly after restart.
- Secrets are not in Git.
- Staging is fully isolated from production WordPress.
- Deployment/rollback procedure documented.
- Repository documentation matches actual implementation.
- Final Gate Review PASS.
- Project marked: **v1.0 MIGRATION BASELINE FROZEN**.

---

## Scope

**In scope**: WordPress Plugin → Standalone Web Service → Google Cloud
Staging, including architecture, backend, database, API, frontend, tests,
migration tooling, staging deployment.

**Out of scope (must not leak into Gates 2–5)**:
- New advanced financial features
- AI bookkeeping
- OCR invoice recognition
- New reporting product lines
- Mobile app
- Real production cutover
- Real WooCommerce production migration
- Real membership data migration
- Real customer bookkeeping data migration
- Removing the original WordPress plugin

First-round goal: **Independent + Parity + Tested + Deployable** — not
feature expansion.

---

## Source of Truth

Primary Source of Truth: GitHub `b88104069/zanzan-cash-service`.

- `main` = stable baseline
- `migration/v1` = this project's Gate-driven execution branch

Per Gate: commit → Delta Report → Gate Review → PASS → next Gate.
`migration/v1` merges back into `main` only after Gate 5's Final PASS.

---

## Delta Report Format

After Kickoff, full-repository resubmission is not repeated. Normal
submission is a Delta Report only:

```
[Gate X Delta Report]

BASELINE
- previous PASS commit
- current gate

FILES CHANGED
- ...

IMPLEMENTED
- ...

TEST / EVIDENCE
- ...

DEVIATIONS
- ...

RISKS / KNOWN LIMITATIONS
- ...

REQUEST
Gate Review
```

---

## Gate Review Contract

Per Gate, the execution agent submits directly to the Gate Review channel.
The human user is not responsible for: copying Deltas, pasting test
results, relaying between agents, or deciding "whether to start the next
Gate."

Review reply format:
```
STATUS: PASS / CONDITIONAL PASS / BLOCKED
MUST FIX: ...
KEEP: ...
NEXT: ...
```

If MUST FIX: execution agent fixes and resubmits on its own.
If STATUS = PASS and next Gate's inputs are complete: proceed to the next
Gate directly, without asking the user.

### Gate Review channel — session-reality note (added at Gate 1 start)

The original Kickoff assumes the execution agent can autonomously drive a
browser to `chatgpt.com`, paste the Delta Report, and read back the
verdict. **In the Claude Code Remote (cloud) session actually running this
project, no browser-automation tool is loaded** — there is no
`Claude_Browser`, `claude-in-chrome`, or `remote-devices` browser tool
available, confirmed by a live tool-search at Gate 1 start. This is a
session/tooling fact, not a policy choice, and no amount of pre-authorization
text changes it: the capability is simply not present.

Until this is resolved, Gate Review is carried out via whatever channel the
project owner designates in their reply (manual relay of the Delta Report
text, a different Gate Reviewer role in this same conversation, or a
browser tool enabled for a future session). The resolved mechanism for the
current Gate should be noted in that Gate's Delta Report so this file
doesn't need to be rewritten each time it changes.

---

## Operating Authorization

### Local execution authorization

Within this project's defined Gates/Scope, the execution agent may
autonomously: read/search/diff repo files; create/modify/delete files
within the authorized scope; run shell/Python/project scripts, builders,
validators, tests; create/clean up temp files, fixtures, backups, rollback
points; run build/rebuild/validate/diff/audit/dry-run/QA; use version
control, cloud CLIs, deployment tools; resolve ordinary technical issues
(path differences, compatibility, CLI location, test data, deploy helpers,
formatting) without re-asking each time.

If an action is already explicitly part of a Gate/Scope, it is not paused
for re-confirmation merely because it touches a "production-adjacent" tool
category — only genuinely out-of-authorized-scope actions stop for HUMAN
REVIEW.

**Standing exception the execution agent applies regardless of the above**:
actions that spend real money, create real cloud billing resources, require
production credentials not yet provided, or touch the live WordPress/
WooCommerce production system always get a one-line heads-up before
execution, even inside an otherwise-authorized Gate — because these are
either irreversible, cost-incurring, or blocked on credentials this project
has not received. This is not a request for re-approval of the Gate itself,
just a "doing X now" notice, and it does not restart the "ask each Gate"
pattern the Kickoff is designed to avoid.

### Gate auto-advance authorization

This authorizes the full Gate workflow, not a single Gate. The execution
agent does not substitute itself for the Gate Reviewer, and does not treat
local QA PASS as equivalent to a Gate Review PASS. Per major Gate: local QA
→ submit Delta/Evidence/Result to the Gate Review channel → await review →
proceed per the review's result (PASS / NEXT / CONTINUE / MUST FIX / RETRY
/ RECHECK / FINAL / CONDITIONAL PASS follow-up, or an inserted Fix/Recheck
Gate), as long as it stays within original Goal/Scope and does not trigger
HUMAN REVIEW — without re-asking the user "should I continue."

---

## HUMAN REVIEW / BLOCKED Stop Conditions

Only the following stop automatic progress:

1. Two or more architectural options with major long-term trade-offs, where
   this Kickoff doesn't give enough rule to decide.
2. Production credentials are needed and there is no secure way to obtain
   them.
3. Modifying real WordPress/WooCommerce production.
4. Migrating real customer data.
5. Cutting DNS/URL/routing to production.
6. The Legacy Snapshot is discovered to be too incomplete to build a
   trustworthy parity baseline.
7. Runtime drift creates a real conflict with the Gate Contract.
8. All AI execution paths are infeasible and a human must physically do a
   UI/permission/hardware action.
9. A system genuinely requires a human to complete a protected action
   (password/MFA/payment/OAuth/account-permission change), or the
   credentials/tools needed simply don't exist for this agent to use
   (as with the Gate Review browser channel above, until resolved).

Outside of these, the execution agent does not hand technical work back to
the user just because of ordinary uncertainty, a tool limitation, a Gate
transition, a production-adjacent action already in scope, or a Gate
Reviewer asking for more work.

---

## Amendment log

- 2026-09-28 — Gate 1 start: Baseline re-verified (SYNC CONFIRMED).
  `migration/v1` branch created from `origin/main`. Added the Gate Review
  channel session-reality note and the standing exception for
  money/production/credential actions under Operating Authorization, since
  the original Kickoff text's blanket phrasing would otherwise conflict
  with the execution agent's own non-negotiable safety constraints around
  irreversible/production/spend actions. Everything else in this contract
  is taken verbatim from the Kickoff as issued.
