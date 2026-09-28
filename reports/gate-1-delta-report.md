[Gate 1 Delta Report]

BASELINE
- previous PASS commit: none (project start) — `main` @ `9c2b09a` ("Add
  files via upload"), verified to contain exactly `README.md`,
  `docs/migration/README.md`,
  `docs/migration/zanzan-simple-cash-saas_1-8-33_合併原始碼.txt`
  (`git ls-tree -r --name-only origin/main`). Baseline Status: SYNC
  CONFIRMED.
- current gate: Gate 1 — Project Contract + Architecture Freeze
- execution branch: `migration/v1`, created from `origin/main`

FILES CHANGED
- `CLAUDE.md` (new) — project posture, gate workflow summary, pointers into
  the contract and architecture docs, for any future session working in
  this repo
- `project.json` (new) — machine-readable gate/status/scope metadata
- `docs/gates/kickoff-contract.md` (new) — the full Kickoff (Gate Roadmap,
  PASS Criteria, Scope, Source of Truth, Delta Report format, Gate Review
  contract, Operating Authorization, HUMAN REVIEW stop conditions) as
  issued, plus one amendment noted inline (see DEVIATIONS)
- `docs/gates/characterization-test-spec.md` (new) — 27 characterization
  test cases across Tenant/Account/Category/CashEntry/Summary/Transfer/
  CSV/Entitlement, each cited to a specific legacy source function
- `docs/architecture/legacy-architecture-map.md` (new) — plugin layout, DB
  schema, REST surface, sourced from the Gate 0.2 audit
- `docs/architecture/wordpress-dependency-inventory.md` (new) — every
  WordPress/WooCommerce API touched, classified Deprecate / Keep-as-Adapter
  / Concept-kept-mechanism-replaced
- `docs/architecture/domain-boundaries.md` (new) — six domains
  (Tenant/Account/Category/CashEntry/Transfer/Entitlement) with a
  cited `[INV]` invariant list
- `docs/architecture/service-boundaries.md` (new) — domain services (Gate
  2), API layer + adapters (Gate 3), explicit "not migrated" list
- `docs/architecture/database-strategy.md` (new) — MySQL retained, schema
  carry-over rules, migration-tool policy, repository/transaction pattern
- `docs/architecture/api-contract-principles.md` (new) — 8 ground rules
  (tenant context always explicit, uniform auth envelope, structured error
  codes, versioned OpenAPI contract, no logic in controllers, etc.)
- `docs/architecture/auth-entitlement-abstraction.md` (new) —
  `EntitlementService` interface design, adapter split
  (Dev/WooCommerce), what Gate 3 must prove about the boundary
- `docs/architecture/gcp-target-architecture.md` (new) — Gate 5 target
  (Cloud Run × 2, Cloud SQL for MySQL, Secret Manager, isolation from
  production)
- `docs/architecture/migration-sequence.md` (new) — why Gates 1→5 are
  ordered this way, explicit non-sequencing rules
- `docs/architecture/tech-stack.md` (new) — Node/TS/Fastify, Prisma, MySQL,
  React/Vite, Vitest, Cloud Run — with rationale for each choice

No legacy reference file was modified. No application/backend/frontend code
was written this Gate (correct per Gate 1 scope — architecture only).

IMPLEMENTED
- Re-verified Baseline against Kickoff's stated contents (exact match).
- Created `migration/v1` execution branch from `origin/main`.
- Folded the existing Gate 0.2 Architecture Audit into formal, structured
  Source-of-Truth documents rather than re-running the audit (per Kickoff
  Gate 1 constraint).
- Defined backend/frontend/DB/auth/entitlement boundaries explicitly
  (`service-boundaries.md`, `auth-entitlement-abstraction.md`).
- Marked which WordPress-specific code is kept-as-Adapter vs. deprecated
  entirely (`wordpress-dependency-inventory.md`).
- Documented all 5 existing tables and their core invariants
  (`legacy-architecture-map.md`, `domain-boundaries.md`).
- Produced the Gate 2 characterization test *specification* (implementation
  deferred to Gate 2 per Kickoff).
- Selected and justified the technical stack
  (`tech-stack.md`): Node.js/TypeScript/Fastify, Prisma, MySQL/Cloud SQL,
  React/Vite, Vitest, Cloud Run.

TEST / EVIDENCE
- No automated tests are expected or produced at Gate 1 (no code exists
  yet); N/A.
- Baseline verification evidence:
  `git fetch origin main && git ls-tree -r --name-only origin/main` →
  exactly the 3 files listed in BASELINE above.
- Every `[INV]` invariant in `domain-boundaries.md` and every
  characterization test case in `characterization-test-spec.md` cites the
  specific legacy function/file it was derived from, so this Gate's output
  is independently auditable against
  `docs/migration/zanzan-simple-cash-saas_1-8-33_合併原始碼.txt` line by
  line without needing to re-run the original audit.

DEVIATIONS
- The Kickoff's Gate Review Contract assumes an autonomous browser-driven
  submission to a ChatGPT conversation. This session (Claude Code Remote /
  cloud) has no browser-automation tool loaded (confirmed via live tool
  search: no `Claude_Browser`, `claude-in-chrome`, or `remote-devices`
  browser tool present). This is a tooling-availability fact, not a scope
  decision, and is recorded as a live amendment in
  `docs/gates/kickoff-contract.md` §Gate Review Contract →
  "session-reality note", along with a standing exception (added under
  Operating Authorization) that money-spending, real-cloud-resource, or
  real-production-touching actions get a one-line heads-up before
  execution even within an otherwise-authorized Gate. Everything else in
  the committed contract is the Kickoff verbatim.
- This Gate 1 Delta Report is therefore being handed to the project owner
  directly in this conversation for Gate Review, rather than being
  autonomously submitted to a separate ChatGPT session — until the owner
  designates a resolved Gate Review channel (see the request below).

RISKS / KNOWN LIMITATIONS
- All 12 items from the Gate 0.2 Migration Risk List still apply and are
  not yet mitigated by code (that starts at Gate 2); this Gate only ensures
  they're carried into the formal architecture docs rather than lost. Most
  directly referenced here: #4 (stateful "current tenant"), #5 (transfer
  integrity is application-layer only), #10 (manual transaction
  management), #12 (zero existing automated tests).
- The `cash_entries.category`-as-string-not-foreign-key question
  (`domain-boundaries.md` → Category) is flagged but not yet decided;
  Gate 2 must make an explicit call (fix vs. preserve) rather than drift
  into either option.
- The Gate Review channel gap above blocks fully autonomous Gate
  advancement until resolved; Gate 2 work itself is not blocked.

REQUEST
Gate Review — plus a decision on which Gate Review channel to use going
forward (see DEVIATIONS above): (a) manual relay of Delta Report text to
the existing ChatGPT conversation, (b) a browser tool enabled for this
session so the described automated flow becomes possible, or (c) treating
this conversation itself as the Gate Reviewer role for this project.
