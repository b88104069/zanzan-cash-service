[Gate 2 Delta Report]

BASELINE
- previous PASS commit: Gate 1 not yet formally reviewed (see Gate 1 Delta
  Report's REQUEST — Gate Review channel decision still pending with the
  project owner). Proceeding into Gate 2 was explicitly authorized by the
  owner directly in-conversation ("你現在可以開始gate2"), with the browser/
  Gate-Review-channel question deferred to be revisited separately.
- current gate: Gate 2 — Characterization Tests + Standalone Core
- branch: `migration/v1`

FILES CHANGED
- `.gitignore` (new) — excludes `node_modules/`, `dist/`, env files
- `backend/package.json`, `package-lock.json`, `tsconfig.json`,
  `vitest.config.ts` (new) — project scaffold per `docs/architecture/tech-stack.md`
  (Node.js + TypeScript, Vitest)
- `backend/src/domain/types.ts` — core types (Tenant, TenantMembership,
  Account, Category, CashEntry) + default seed constants
- `backend/src/domain/errors.ts` — `DomainError` with a stable `code` per
  `docs/architecture/api-contract-principles.md` principle 6
- `backend/src/domain/repositories/{Tenant,Account,Category,CashEntry}Repository.ts`
  — persistence interfaces; every method is explicitly tenant-scoped per
  `docs/architecture/database-strategy.md`
- `backend/src/infra/memory/InMemoryDatabase.ts` +
  `InMemory{Tenant,Account,Category,CashEntry}Repository.ts` — Gate 2
  test/dev backing store (no real DB yet — real Prisma/MySQL adapter is
  Gate 3+ scope per `docs/architecture/migration-sequence.md`)
- `backend/src/domain/services/{Tenant,Account,Category,CashEntry,Transfer,Export}Service.ts`
  — the six standalone core services from `docs/architecture/service-boundaries.md`
- `backend/test/testHarness.ts` + 8 test files (33 tests total) — the
  characterization suite implementing `docs/gates/characterization-test-spec.md`

IMPLEMENTED
- All six domain services (`TenantService`, `AccountService`,
  `CategoryService`, `CashEntryService`, `TransferService`,
  `ExportService`) built with zero WordPress/WooCommerce dependency —
  mechanically enforced by `test/noWordpressDependency.test.ts`, which
  scans every file under `backend/src` for `$wpdb`, `get_current_user_id()`,
  `user_meta`, `wc_get_order`, `wcs_user_has_subscription`, `WooCommerce`,
  `WP_REST_*` (comments stripped first, so legacy-source citation comments
  like "Parity source: zzscs_api_add_cash_entry" don't false-positive —
  only actual code references would fail this test).
- 25 of the spec's 29 cases implemented as executable tests (T1-T4, A1-A5,
  C1-C4, E1-E6, S1-S3, X1-X6, CSV1 — the `CSV1` case is covered by 2 tests).
  P1-P4 (entitlement/access) are explicitly **not** implemented this Gate —
  see DEVIATIONS.
- Every repository method takes an explicit `tenantId` and every service
  method that reads/writes tenant data receives it explicitly — no method
  anywhere infers "current tenant" from stored state (this is the
  standalone-side fix for the legacy `user_meta`-based "current tenant"
  design, applied now rather than deferred).
- `CashEntryRepository.listByFilter` is the single shared method behind both
  `CashEntryService.listEntries` and `ExportService.getCsvRows` — verified by
  `csvExport.test.ts` asserting identical row sets for the same filter
  (parity with `api-contract-principles.md` principle 3).
- Transfer creation (`TransferService.createTransfer`) inserts both paired
  rows via one repository call (`createTransferPair`) that either produces
  both rows or throws before mutating the store — no partial-pair state is
  reachable through the public API surface.
- The exactly-2-rows integrity guard on transfer deletion
  (`CashEntryService.deleteEntry`) is implemented and tested against a
  deliberately corrupted 1-row state (X6), refusing the delete entirely.

TEST / EVIDENCE
- `cd backend && npm run typecheck` → clean, no errors (`tsc --noEmit`).
- `cd backend && npm test` → **8 test files, 33 tests, all passing**:
  ```
  ✓ test/account.test.ts (5 tests)
  ✓ test/transfer.test.ts (6 tests)
  ✓ test/tenant.test.ts (6 tests)
  ✓ test/cashEntry.test.ts (6 tests)
  ✓ test/summary.test.ts (3 tests)
  ✓ test/csvExport.test.ts (2 tests)
  ✓ test/noWordpressDependency.test.ts (1 test)
  ✓ test/category.test.ts (4 tests)
  Test Files  8 passed (8)
       Tests  33 passed (33)
  ```
- Every test traces to a spec ID (`T1`…`CSV1`) and, transitively via the
  spec file, to a specific legacy function/line — auditable against
  `docs/migration/zanzan-simple-cash-saas_1-8-33_合併原始碼.txt`.
- Two implementation bugs were caught and fixed by the tests themselves
  before this report was written (not left for review to find):
  1. `updateEntry` originally ran category-active validation before the
     transfer-immutability check, causing E5 to fail with the wrong error
     code. Fixed by splitting validation into `validateBasic` (required
     fields + mutual exclusion) run first, then the transfer-code check,
     then account/category existence checks — matching
     `zzscs_api_update_cash_entry`'s actual order.
  2. The WordPress-independence test itself initially false-flagged a
     legacy-source citation comment ("see woocommerce-hooks.php") as a real
     dependency. Fixed by stripping comments before pattern-matching.

DEVIATIONS
- **P1-P4 (entitlement/access) deferred to Gate 3, not implemented here.**
  The characterization spec listed these under "cross-cutting — deepened
  further in Gate 3", and Gate 1's `service-boundaries.md` places
  `EntitlementService` and the Auth/Tenant-context middleware in Gate 3's
  scope, not Gate 2's core-domain scope. Building even a placeholder
  entitlement check into Gate 2's core services would pull forward Gate 3
  work, which `docs/architecture/migration-sequence.md`'s "explicit
  non-sequencing rules" says not to do. This is a scope clarification, not
  a scope gap — P1-P4 are tracked and will be implemented as Gate 3's HTTP-
  layer tests (401/403/entitlement-adapter tests) alongside the additional
  cross-tenant security cases the Kickoff's Gate 3 PASS criteria already
  require.
- **Paired-entry deletion implemented inside `CashEntryService.deleteEntry`,
  not `TransferService`.** Gate 1's `service-boundaries.md` nominally
  assigned "paired-entry deletion" to `TransferService`. In practice this
  mirrors the legacy `zzscs_api_delete_cash_entry` endpoint 1:1 (one
  function handles both plain and paired delete), and splitting it into a
  cross-service call added indirection without a corresponding benefit —
  `TransferService` still owns transfer *creation* exclusively, matching
  the "distinct compound transaction" rationale in `service-boundaries.md`.
  Recorded here as the required deviation note rather than silently
  diverging from the committed Gate 1 doc.
- **No generic cross-repository `UnitOfWork`/transaction wrapper was built.**
  `docs/architecture/database-strategy.md` calls for real transactions
  wrapping multi-row writes (tenant+seed creation, transfer create/delete).
  For Gate 2's in-memory store, atomicity is achieved directly at the
  repository method level instead (`createTransferPair` and
  `deleteByTransferCode` build/validate before mutating the Map, and
  Node's single-threaded execution means no interleaving is possible within
  an unawaited synchronous section) rather than through a general
  `runInTransaction()` abstraction. **This is a Gate 2-only simplification,
  not a decision for the real system**: when the Prisma/MySQL adapter is
  built (Gate 3+, per `migration-sequence.md`), the same call sites
  (tenant+seed creation, transfer create, transfer delete) must be wrapped
  in a real DB transaction (`prisma.$transaction`), and that work is
  tracked as a Gate 3+ carry-over, not considered done by this Gate.
- **`cash_entries.category`-as-string decision**: per Gate 1's flag in
  `domain-boundaries.md`, this was an open decision. Gate 2 **preserves**
  the legacy behavior (string, not a foreign key) rather than fixing it —
  chosen because Gate 2's job is characterization (lock in current
  behavior), not improvement; the fix-vs-preserve call is deferred to Gate
  4's data-migration design, where it has more context (whether historical
  entries need retroactive category renaming matters most once we're
  writing migration/export tooling).

RISKS / KNOWN LIMITATIONS
- The in-memory repositories are Gate 2 scaffolding, not a persistence
  design — they will be replaced by a real Prisma/MySQL adapter behind the
  same repository interfaces in a later Gate, per `database-strategy.md`.
  The interfaces themselves are the durable contract; nothing in the
  service layer should need to change when the backing store does.
- `generateId()` in `InMemoryDatabase.ts` is a process-lifetime incrementing
  counter — fine for tests, explicitly not suitable for and not intended to
  reach production code.
- Real transaction semantics (see DEVIATIONS above) are not yet proven
  against a real database; Gate 2's "atomicity" claim is only verified
  against the in-memory store's actual single-threaded behavior, not
  against concurrent-request conditions a real MySQL connection pool could
  introduce. This should be re-verified once Gate 3/4 wires up Prisma.
- `npm install` reported 5 vulnerabilities (3 moderate, 1 high, 1 critical)
  in the dev-dependency tree (Vitest/TypeScript toolchain, not runtime
  dependencies of the shipped service). Not remediated this Gate since none
  of these packages ship in a deployed artifact; worth a `npm audit` pass
  before Gate 5 deployment, not urgent for Gate 2.

REQUEST
Gate Review — plus the still-open question from the Gate 1 Delta Report
about which channel carries it (manual relay, a browser tool, or this
conversation acting as Reviewer). Per the owner's message, that question is
being looked at separately and did not block starting Gate 2.

---

GATE REVIEW RESULT (appended after review)

- Channel: Slack, `#ai-gate-test` (private channel), ChatGPT Slack app —
  the project owner connected the Slack MCP connector and set up this
  channel specifically to test the Gate Review loop. This report was
  posted as a thread (parent + 4 replies, due to Slack's 5000-char message
  limit): https://w1790566585-i2d716150.slack.com/archives/C0C4P9C6JF5/p1790567339921299
- ChatGPT replied in the same thread. Before acting on it, Claude Code
  independently re-read the thread via `slack_read_thread` (rather than
  trusting a pasted transcription of the reply) and confirmed the reply's
  Slack sender identity is the ChatGPT app itself, not a relayed claim.
- **STATUS: PASS**
- MUST FIX: NONE
- KEEP: all six domain services correctly abstracted; zero WordPress/
  WooCommerce dependency verified by automated check; tenant context is
  explicit (`tenantId`), removing the legacy `user_meta` implicit-state
  dependency; 33/33 characterization tests passing, with the suite shown to
  be effective (it caught a real validation-order bug and a false-positive
  in the dependency-scan test itself); transfer atomicity and paired-entry
  integrity guard preserve legacy behavior correctly.
- REVIEW NOTES: (1) entitlement P1-P4 deferred to Gate 3 — reasonable;
  (2) transfer deletion living in `CashEntryService` rather than
  `TransferService` is acceptable, since the current goal is migration
  fidelity, not redesigning the domain model; (3) in-memory repository is
  acceptable Gate 2 scaffolding, but Gate 3/4 must verify real DB
  transaction/rollback/constraint behavior; (4) `cash_entries.category` as
  a string is correctly preserved per characterization principles — Gate 4
  migration design decides whether to improve it.
- NEXT: Proceed to Gate 3 — Standalone API + Identity/Entitlement Boundary.
  ChatGPT's reply additionally scoped Gate 3 to include a Prisma/MySQL
  persistence adapter and real transaction-semantics validation alongside
  the Kickoff's original Gate 3 items (API layer, auth boundary,
  EntitlementService abstraction, tenant isolation tests) — consistent
  with `docs/architecture/migration-sequence.md`'s "Gate 3+" placement of
  the real DB adapter, not a scope expansion beyond what Gate 1 already
  anticipated.
- This exchange also served as the first live end-to-end test of the
  Slack-based Gate Review channel itself (Claude Code → GitHub →
  Slack → ChatGPT → Slack → Claude Code). It worked. See
  `docs/gates/kickoff-contract.md` §Gate Review Channel, which has been
  updated to record Slack as the resolved channel going forward.
