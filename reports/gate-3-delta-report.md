[Gate 3 Delta Report]

BASELINE
- previous PASS commit: `088a599` (Gate 2, STATUS: PASS, verified via Slack
  `#ai-gate-test`)
- current gate: Gate 3 — Standalone API + Identity/Entitlement Boundary
- branch: `migration/v1`

FILES CHANGED
- `backend/prisma/schema.prisma` + `backend/prisma/migrations/` (new) —
  MySQL schema (5 legacy tables + new `users` table), `note` fixed to
  nullable (MySQL rejects a default on TEXT columns — caught during
  migration, not left broken)
- `backend/src/infra/prisma/*.ts` (new) — Prisma-backed implementations of
  every Gate 2 repository interface, plus `PrismaUnitOfWork` for real
  transactional tenant provisioning
- `backend/src/domain/repositories/UnitOfWork.ts` (new) +
  `backend/src/infra/memory/InMemoryUnitOfWork.ts` (new) — delivers the
  real-transaction requirement Gate 2 explicitly deferred
- `backend/src/domain/services/TenantService.ts` (changed) — refactored to
  run provisioning through `UnitOfWork.runInTransaction` instead of
  individually-injected repos (see DEVIATIONS)
- `backend/src/domain/repositories/UserRepository.ts`,
  `backend/src/domain/services/AuthService.ts` (new) — standalone
  authentication (replaces `is_user_logged_in()`/`get_current_user_id()`)
- `backend/src/domain/entitlement/EntitlementService.ts` (new interface),
  `backend/src/infra/entitlement/{Dev,WooCommerce}EntitlementAdapter.ts`
  (new) — the entitlement abstraction Gate 1/Gate 2 review called for
- `backend/src/http/**` (new) — Fastify API: `app.ts` (auth/entitlement/
  tenant-context middleware + error mapping), 6 route modules, `server.ts`
  production entrypoint
- `backend/openapi.yaml` (new) — full API contract, 19 paths, validated
  ($ref resolution checked programmatically)
- `backend/test/http/**` (new, 4 files, 17 tests) — HTTP-layer tests:
  auth/401, entitlement P1-P4, cross-tenant isolation, business-rule
  parity through the HTTP boundary
- `backend/test/integration/**` (new, 6 tests) — tests against a REAL
  MySQL database, not the in-memory store
- `backend/test/noWordpressDependency.test.ts` (changed) — extended with an
  allowlist for the one designated WooCommerce adapter file, plus a second
  assertion that the domain layer never imports that adapter directly
- `backend/test/testHarness.ts` (changed) — updated for `TenantService`'s
  new `UnitOfWork`-based constructor
- `backend/.env.example` (new), `backend/vitest.integration.config.ts` (new)

IMPLEMENTED
- **Standalone API** covering every legacy endpoint: auth (register/login,
  new — legacy had none, WordPress handled this), tenants, accounts,
  categories, cash-entries (+ summary, + CSV export), transfers.
- **Auth boundary**: JWT-based (`@fastify/jwt`), independent user store
  (scrypt password hashing, no external dependency).
- **EntitlementService abstraction**: core domain and API middleware call
  only the interface; `DevEntitlementAdapter` (config-driven, what Gate 5
  staging runs) and `WooCommerceEntitlementAdapter` (contract + fail-closed
  wrapper, mock-tested) are the only two implementations, and the
  WordPress-independence test now mechanically enforces that the
  WooCommerce adapter is the *only* file in `src/` allowed to mention
  WooCommerce, and that the domain layer never imports it directly.
- **Tenant-context middleware**: every tenant-scoped route requires an
  explicit `X-Tenant-Id` header, validated via `TenantService.assertMembership`
  before the route handler runs — no server-side "current tenant" state.
- **Real transactions delivered**: `PrismaUnitOfWork` wraps tenant creation
  + seed (membership + account + 4 categories) in one
  `prisma.$transaction`; `PrismaCashEntryRepository.createTransferPair`
  and `deleteByTransferCode` are single atomic DB operations. Proven, not
  just asserted — see TEST/EVIDENCE.
- **Security/isolation verified** (Kickoff Gate 3 PASS criteria, literally
  these five cases):
  - User A cannot use User B's tenant ID as context → 403 `TENANT_MEMBERSHIP_REQUIRED`
  - Tenant A's entry cannot be reached via Tenant B's ID, even with a
    valid entry ID → 404 `ENTRY_NOT_FOUND` (repository-level tenant
    scoping, not app-level filtering after the fact)
  - Unauthenticated request → 401 `UNAUTHENTICATED`
  - Authenticated, not entitled → 403 `NOT_ENTITLED`
  - Invalid/missing tenant context → 400 `INVALID_TENANT_CONTEXT`
- **P1-P4** (deferred from Gate 2's spec) implemented as HTTP tests:
  platform-admin entitlement bypass + still-needs-tenant (P1), entitled
  member success (P2), non-entitled 403 (P3), entitlement backend failure
  → 503 fail-closed, not a silent 200 (P4).
- **OpenAPI contract**: 19 documented paths, request/response schemas,
  security scheme, the `X-Tenant-Id` header parameter used consistently —
  committed to the repo per Kickoff Gate 3 PASS criteria ("API contract
  has formal documentation").
- **Real end-to-end smoke test** run manually against the actual server +
  MySQL (register → create tenant → seeded account appears → add entry →
  summary → cross-tenant rejection) before writing the automated suite, to
  catch wiring bugs the automated tests might not (see TEST/EVIDENCE).

TEST / EVIDENCE
- `npm run typecheck` → clean.
- `npm test` (in-memory + HTTP, zero external dependencies) → **12 test
  files, 51 tests, all passing**:
  ```
  ✓ test/transfer.test.ts (6)          ✓ test/http/apiWorkflow.test.ts (3)
  ✓ test/tenant.test.ts (6)            ✓ test/http/tenantIsolation.test.ts (5)
  ✓ test/account.test.ts (5)           ✓ test/http/entitlement.test.ts (4)
  ✓ test/cashEntry.test.ts (6)         ✓ test/http/auth.test.ts (5)
  ✓ test/summary.test.ts (3)           ✓ test/noWordpressDependency.test.ts (2)
  ✓ test/csvExport.test.ts (2)         ✓ test/category.test.ts (4)
  Test Files  12 passed (12)   Tests  51 passed (51)
  ```
- `npm run test:integration` (real MySQL, `zanzan_cash_test` database) →
  **6/6 passing**, including:
  - tenant creation + seed persists atomically across 4 real tables
  - **a genuine rollback test**: a transaction that inserts a tenant then
    hits a real DB unique-constraint violation on a second write leaves
    **zero** rows in either table afterward — this is the "real DB
    transaction/rollback" proof the Gate 2 review required, not a
    simulated assertion
  - transfer creates 2 real linked rows; deleting one removes both
  - DB-level unique constraint on account name enforced independent of
    app-layer checks
  - money round-trips through `DECIMAL(14,2)` with no floating-point drift
    (1234.56 in, 1234.56 out)
- Manual E2E smoke test transcript (register/tenant/account/entry/summary/
  cross-tenant 403) run against the live server + real MySQL, prior to
  writing the automated suite — full command transcript available in this
  session's history if needed for audit.
- `npm audit --omit=dev` → 3 high-severity findings, all inside `prisma`
  CLI's own `@prisma/config`/`deepmerge-ts` dependency chain (a dev-only
  build tool, not the runtime `@prisma/client` or anything shipped in the
  deployed service). The one **critical** production-dependency
  vulnerability found mid-Gate (`@fastify/jwt` ≤9.1.0 → `fast-jwt`, JWT
  auth-bypass and algorithm-confusion CVEs) was fixed immediately by
  upgrading to `@fastify/jwt@^10.2.2`, not deferred — this is the auth
  layer, so it didn't get the "dev-dependency, defer it" treatment Gate 2
  gave its own tooling vulnerabilities.

DEVIATIONS
- **Prisma major version pinned to 6.19.3, not the newly-released 7.x.**
  `tech-stack.md` named Prisma without committing to a version; 7.x
  requires a `prisma.config.ts` + driver-adapter architecture (a breaking,
  very recent change) in place of the standard `datasource { url =
  env(...) }` pattern every guide and this project's own
  `database-strategy.md` assumes. This is exactly the "Knex if migrations
  prove awkward" fallback `tech-stack.md` already anticipated, resolved by
  staying on Prisma's stable 6.x line instead of switching ORMs entirely.
- **`TenantService`'s constructor signature changed** from
  `(tenants, accounts, categories)` to `(tenants, unitOfWork)`. Gate 2's
  review passed the original shape, but its own REVIEW NOTES required real
  DB transaction/rollback behavior in Gate 3, which is not achievable
  without either this change or a much larger one; the read-only methods
  (`assertMembership`, `listTenantsForUser`) still use the plain
  `tenants` repository since they need no transactional scope. Gate 2's
  34 characterization tests all still pass unmodified in behavior (only
  `test/testHarness.ts`'s wiring changed, not any test's assertions).
- **`cash_entries.note` changed from `@default("")` to nullable, no
  default.** MySQL rejects a default value on a `TEXT` column
  (`BLOB, TEXT, GEOMETRY or JSON column 'note' can't have a default
  value` — caught during the first migration attempt, not shipped
  broken). The application layer already normalizes `undefined`/empty to
  `''` before it reaches a domain object, so this is a storage-layer
  detail with no behavior change.
- **No `/tenant-switch` endpoint.** This was flagged as an intentional,
  pre-approved deviation back in Gate 1 (`domain-boundaries.md` → Tenant →
  "Standalone change") and Gate 2 (tenant context made explicit per
  request). Confirmed here: the standalone API has no equivalent, by
  design — tenant context is the `X-Tenant-Id` header on every request,
  not stored server-side state to "switch."
- **`WooCommerceEntitlementAdapter` has no real HTTP client** — per the
  Kickoff's own Gate 3 text ("contract/mock is enough"), it wraps an
  injectable `WooCommerceClient` interface; only a fake implementation
  exists (in `entitlement.test.ts`'s throwing-adapter case and implicitly
  via the interface contract). A real client hitting a live WooCommerce
  site is explicitly out of scope until a future production-cutover
  project, per `docs/architecture/auth-entitlement-abstraction.md`.

RISKS / KNOWN LIMITATIONS
- Local dev/test MySQL was installed directly via `apt-get install
  mysql-server` in this session's container (no Docker daemon was
  available) and granted broad privileges to create Prisma's migration
  shadow database. This is throwaway session infrastructure, not anything
  that ships — Gate 5's Cloud SQL setup starts from scratch per
  `docs/architecture/gcp-target-architecture.md` and won't inherit this.
  Worth noting so a future session doesn't assume MySQL is pre-provisioned
  elsewhere.
- No rate limiting, request body size limits, or structured request
  logging yet — none of these were legacy behavior to preserve, and
  Kickoff's Gate 3 PASS criteria don't call for them; flagging as
  candidates for Gate 5 hardening, not a Gate 3 gap.
- `WooCommerceEntitlementAdapter`'s real HTTP integration remains
  unbuilt (see DEVIATIONS) — this is intentional per Kickoff, not an
  oversight, but is the single largest remaining piece of work before any
  future production cutover could use this service against the live
  WooCommerce site.
- The three remaining `npm audit` findings (Prisma CLI's own dependency
  chain) are unresolved; a `prisma@6.12.0` downgrade would clear them but
  that's an older patch line — worth revisiting with a `prisma@6.20.x`+
  patch release before Gate 5 rather than downgrading now.
- Integration tests require a real MySQL reachable at `DATABASE_URL` (via
  `.env.test`) — they are correctly excluded from the default `npm test`
  run (see `vitest.config.ts`'s `exclude`), so this doesn't block anyone
  running the default suite without a database.

REQUEST
Gate Review, via the confirmed Slack pipeline (`#ai-gate-test`, message
signed "Claude Code" on its own line per the confirmed relay requirement).
