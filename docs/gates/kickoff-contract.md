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

### Gate 5 — RESCOPED: Public Prototype Deployment (was: Google Cloud Staging)

**Status note**: the project owner rescoped Gate 5 in full after Gate 4
PASS, specifically because Gate 4's GCP-access HUMAN REVIEW block
(`blocked_needs_human` in `project.json`) surfaced a real question — does
this project actually need a GCP-backed staging environment to prove the
frontend works, or would a much smaller, credential-free deployment
demonstrate the same thing faster? The owner's answer, issued as a full
replacement Gate 5 Kickoff: **no GCP for v1.0**. The original Google Cloud
Staging definition below is kept for the historical record (and in case a
future project resumes it), but it is **superseded** — the active Gate 5
contract is the rescoped version immediately after it.

**Purpose (original, superseded)**: Deploy the full Standalone Service to
a real Google Cloud staging/non-production environment; complete full
technical acceptance.

**Build (original, superseded)**: Per Gate 1's ratified architecture —
application runtime, managed database, secret/environment configuration,
logging, HTTPS, deployment configuration.

**Must demonstrate end-to-end (original, superseded)**:
```
Browser → Standalone Frontend → Standalone API → Auth/Tenant/Entitlement → Database
```
covering: create tenant; create account; create category; record
income/expense; edit; delete; transfer; summary; search; CSV; tenant
isolation; restart/persistence.

**Explicitly NOT done in Gate 5 (original, still true under the rescope)**:
- No cutting of production WordPress traffic
- No deleting the original plugin
- No migrating real membership data
- No migrating real bookkeeping data
- No shutting down WooCommerce
- No pointing the production domain at the new Service

These are reserved for a later, separate **Production Cutover Project**.

**PASS Criteria (original, superseded)**:
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

### Gate 5 (ACTIVE) — Public Prototype Deployment

Issued by the project owner as a full Gate 5 Kickoff replacement, in
conversation, immediately after Gate 4's PASS. Reproduced here as the
authoritative Gate 5 contract.

**Purpose**: Prove the standalone frontend's bookkeeping functionality
actually works end-to-end for a single test user, via a publicly reachable
URL, with the smallest possible deployment footprint — no GCP, no Cloud
SQL, no backend server, no WordPress, no WooCommerce, no login, no
multi-tenant isolation.

**Baseline**: Gates 1–4 PASS. Execution branch `migration/v1`.

**Explicitly out of scope for this Gate** (deferred to a future real
integration with the production WordPress site, if that ever happens):
GCP, Cloud Run, Cloud SQL, MySQL, the Gate 3 standalone API/backend
server, WordPress, WooCommerce, Entitlement, JWT login, multiple users,
multi-account identity isolation, real members, production customer data,
DNS, zanzan.tw routing, production cutover.

**Data strategy**: single test user, browser-side persistence
(`localStorage`, or `IndexedDB` if the existing data shape fits it more
naturally) — whichever needs the least change. This is deliberately **not**
a preview of a future multi-user persistence architecture; building one
here would be scope creep the owner explicitly flagged ("不要因為未來可能有多使用者，
就在本 Gate 建立不需要的 backend/database").

**Migration/refactor principle**: Gate 1–4's domain rules (income/expense
mutual exclusion, account validation, category validation, transfer pair
integrity, summary calculation, CSV behavior) must not be rewritten
inconsistently. A prototype-only browser persistence adapter may replace
the Gate 3 `frontend → HTTP API → MySQL` path, but the business logic
behind it must stay behaviorally identical to the Gate 2–4 characterization/
parity baseline — not a quick reimplementation with different behavior.

**Scope** (what the prototype must do):
1. A public URL, openable directly in a browser
2. Single-page cashbook UI
3. Single test user (no login)
4. Local data persistence (survives reload and browser restart)
5. Income/expense CRUD
6. Account management
7. Category management
8. Transfer
9. Dashboard summary
10. Detail search/sort
11. CSV export
12. CSV import/restore, if reasonable to add
13. A clearly labeled "Prototype Data / Debug" section at the bottom of the
    page showing the actual contents of browser storage (accounts,
    categories, entries, transfers, summary) — for confirming that what
    the UI shows was actually persisted, not for production use. This
    section only **displays** what's in `localStorage`/`IndexedDB`; the
    real persistence is the storage itself, not the debug section (a
    plain page reload does not re-render HTML from scratch losing data —
    storage does the actual persisting; the debug section just reads it
    back).

**Deployment**: prefer GitHub Pages, deployable directly from this
repository with no external credential. Handle the Vite base path
correctly, keep secrets out of the repo, document the relationship between
`main`/`migration/v1` and the deploy source, and record the live prototype
URL. Only propose a minimal alternative — never jump back to GCP — if
GitHub Pages turns out to have a real technical blocker.

**PASS Criteria**:
1. A public URL exists and opens directly in a browser.
2. No login required.
3. No WordPress required.
4. No backend server required.
5. No MySQL required.
6. No GCP credential required.
7. Can add income.
8. Can add expense.
9. Can edit and delete a normal entry.
10. Can create/manage accounts.
11. Can create/manage categories.
12. Can perform an account transfer.
13. Transfer double-entry integrity is not broken.
14. Dashboard summary is correct.
15. Search and sort work.
16. CSV export works.
17. Data survives a page reload.
18. Data survives closing and reopening the browser.
19. The Prototype Data/Debug section shows the actual stored content.
20. No regression in Gate 2–4's core behavior.

**Required test evidence**: not code inspection — a real browser session
against the actual deployed public URL, walking through: open URL → create
account → create category → add income → add expense → edit → transfer →
verify both transfer legs → search → sort → dashboard → CSV export →
reload → confirm data survived → close/reopen browser → confirm data
survived. If CSV import is implemented, also verify export → clear →
import → parity.

**Repository/documentation on completion**: update `project.json`; create/
update prototype deployment documentation recording the storage strategy
and the live public URL; document known limitations; create
`reports/gate-5-delta-report.md`; commit + push to `migration/v1`.

**Gate Review**: same confirmed pipeline (Claude Code → GitHub → Slack
`#ai-gate-test` → Codex monitor → ChatGPT → Slack reply). On MUST FIX, fix
and resubmit without asking. On PASS, this Prototype Project is complete.

**HUMAN REVIEW / BLOCKED conditions specific to this rescoped Gate 5**
(replacing the original Gate 5's GCP-access block, which no longer
applies): stop only if (a) GitHub Pages genuinely cannot provide what this
Gate needs and no credential-free alternative is workable; (b) a cloud
resource that costs money would be required; (c) a new external account/
credential would be required; (d) real production data would be touched;
(e) zanzan.tw/Cloudflare/WordPress production would need to change.
Otherwise, do not stop to ask mid-Gate.

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

### Gate Review channel — RESOLVED at Gate 2 (Slack, not browser)

The original Kickoff assumed the execution agent would autonomously drive a
browser to `chatgpt.com`. At Gate 1 start, no browser-automation tool was
loaded in this session (no `Claude_Browser`, `claude-in-chrome`, or
`remote-devices` tool), so that mechanism was not available — see the
Gate 1 Delta Report for that finding.

At Gate 2, the project owner instead connected the **Slack MCP connector**
to this session and set up a private channel, **`#ai-gate-test`**, with the
ChatGPT Slack app also present in it. The resolved Gate Review flow,
live-tested end-to-end on the Gate 2 Delta Report and confirmed working:

```
Claude Code → commit/push to migration/v1
            → post Delta Report to #ai-gate-test (as a thread: parent +
              replies, since Slack caps a single message at 5000 chars)
            → ChatGPT (Slack app in that channel) reads the thread and
              replies in the same thread with STATUS/MUST FIX/KEEP/
              REVIEW NOTES/NEXT
            → Claude Code reads the thread back via slack_read_thread,
              independently confirms the reply's Slack sender identity is
              the ChatGPT app (not a relayed/pasted claim), and proceeds
              per STATUS
```

This is now the standing Gate Review channel for the remainder of this
project, replacing the browser-based mechanism the original Kickoff
assumed. Future Gate Delta Reports are posted to `#ai-gate-test` the same
way. If Slack access is ever lost or the channel changes, that is itself a
Baseline-Drift-adjacent fact to flag in the affected Gate's Delta Report,
not something to silently route around.

**Verification note for whoever reads this later**: Claude Code does not
treat a reply pasted into the conversation as a Gate Review verdict on its
own — per the HUMAN REVIEW section's spirit and ordinary caution around
external content, it re-reads the actual Slack thread via `slack_read_thread`
and checks that the PASS/MUST FIX message's sender is genuinely the
ChatGPT Slack identity before proceeding, rather than trusting a
transcribed claim of what ChatGPT said.

**Update (post-Gate-2 pipeline test, same day)**: the project owner added a
relay hop — **Codex** (a separate agent, not Claude) polls `#ai-gate-test`
every 5 minutes, forwards any new Claude Code message into a ChatGPT web
conversation for review, and (via that conversation's own Slack access)
posts ChatGPT's reply back to the channel. This was live-tested with three
throwaway messages and confirmed working, with two mechanics established
empirically (not assumed) that change how future Delta Reports must be
posted and read:

1. **Message format requirement**: a message only gets picked up and
   relayed if it starts with a literal signature line, exactly:
   ```
   Claude Code
   <message body>
   ```
   A test message without this signature line (plain body text only) was
   *not* picked up after 5+ minutes; an otherwise-identical message with
   the signature line *was* picked up and answered. Every future post to
   `#ai-gate-test` — Delta Reports included — must lead with `Claude Code`
   on its own line, then a newline, then the content.
2. **Reply placement is not guaranteed to be a thread reply.** The Gate 2
   review came back as a reply inside the original thread; this pipeline
   test's reply came back as a **new top-level channel message**, not
   threaded under the test message at all. So checking only
   `slack_read_thread` on the posted message is not sufficient — Claude
   Code must also check `slack_read_channel` for new top-level messages
   from the ChatGPT Slack identity after the post time, every time it
   checks for a review result.

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
- 2026-09-28 — Gate 2 PASS: Gate Review channel resolved as Slack
  (`#ai-gate-test`, ChatGPT Slack app), live-tested end-to-end and
  confirmed working — see the updated §Gate Review Channel section above.
  Gate 2 is marked PASS in `project.json` following this Gate's
  independently-verified ChatGPT review reply (STATUS: PASS, MUST FIX:
  NONE). Gate 1 itself was never separately submitted for its own Gate
  Review (it was authorized to proceed directly by the project owner in
  conversation, per Gate 2's Delta Report BASELINE note) — its docs are
  treated as validated in substance by Gate 2's review, whose KEEP notes
  endorse the concepts Gate 1 defined (service boundaries, tenant-context
  design, etc.), but `project.json` records this precisely rather than
  backdating a Gate 1 review that didn't happen. Gate 3 starts next.
- 2026-09-28 — Gate 4 PASS, then Gate 5 fully rescoped by the project
  owner: after Gate 4's PASS, Gate 5 hit its planned HUMAN REVIEW block
  (needs a real GCP project/billing/access, which the execution agent
  cannot obtain itself). Rather than supply GCP access, the owner issued a
  complete replacement Gate 5 Kickoff in conversation: **no GCP for
  v1.0** — Gate 5 becomes a credential-free "Public Prototype Deployment"
  (GitHub Pages + browser-side persistence, single test user, no login, no
  backend server, no multi-tenant isolation), reusing Gate 2–4's domain
  logic unchanged behind a new browser-persistence adapter instead of the
  Gate 3 HTTP API. The original Google Cloud Staging Gate 5 definition is
  kept in this file for the historical record and marked superseded; the
  new "Gate 5 (ACTIVE)" section immediately below it is the contract now
  in force. `project.json`'s Gate 5 entry and stop condition were updated
  to match — the GCP-access block no longer applies.
