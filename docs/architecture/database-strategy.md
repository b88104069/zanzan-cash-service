# Database Strategy

## Engine choice

**MySQL 8 (Cloud SQL for MySQL in Gate 5)**, not a switch to Postgres.

Rationale: the legacy schema, data types (`DECIMAL(14,2)` for money,
`InnoDB` engine assumptions), and Gate 4's migration tooling all start from
an actual WordPress MySQL database. Keeping the same engine family for v1.0
removes an entire class of type/collation/dialect translation risk from a
project whose stated goal is parity, not a database migration exercise. A
future v1.1 could reconsider Postgres; that's explicitly out of this
project's scope.

## Schema carry-over

The five existing tables (`legacy-architecture-map.md`) are ported with
minimal changes for Gate 2–3:

- Drop the `wp_` prefix; use plain table names (`tenants`, `tenant_users`,
  `cash_accounts`, `cash_entries`, `cash_categories`).
- Keep all five tables and their columns as-is, including
  `cash_entries.category` as a string (see `domain-boundaries.md` — this is
  a decision to make explicitly in Gate 2, not a default to drift into).
- Add standard `updated_at` columns where missing, since the legacy schema
  only tracks `created_at` — this is additive and doesn't change existing
  behavior, so it does not need a "deviation" note.

## Migration/versioning tool

Use a plain SQL migration tool checked into the repo (e.g. node-pg-migrate
style numbered `.sql` files, or the chosen backend framework's own migration
runner — final pick recorded in `tech-stack.md`). No `dbDelta()`-style
idempotent-CREATE-TABLE-on-every-request pattern; migrations run once,
explicitly, as a deploy step.

## Access pattern

- **Gate 2**: a thin `Repository` interface per aggregate (`TenantRepository`,
  `AccountRepository`, `CategoryRepository`, `CashEntryRepository`), backed
  by a query builder or lightweight ORM (see `tech-stack.md`) — never raw
  string-concatenated SQL, to close the class of risk the legacy code
  manages only through `$wpdb->prepare()` placeholders.
- Domain services depend on repository **interfaces**, not concrete
  implementations, so Gate 2's characterization tests can run against an
  in-memory or SQLite-backed fake without needing MySQL running.
- **Transactions**: every multi-row write that was wrapped in
  `START TRANSACTION`/`COMMIT`/`ROLLBACK` in the legacy code (tenant
  creation + seed data, transfer create, transfer delete) must be wrapped in
  a real transaction using the standalone framework's transaction/unit-of-
  work primitive — not manual `BEGIN`/`COMMIT` calls scattered through
  service code. This directly addresses Gate 0.2 risk #10.

## Tenant isolation at the data layer

Every repository method that reads or writes a tenant-scoped table takes an
explicit `tenantId` parameter and includes it in the `WHERE` clause — no
method may fetch a row "by id" alone and trust the caller to have checked
tenant ownership first. This mirrors the legacy code's actual pattern (every
legacy query already includes `tenant_id = %d`) but makes it structurally
required rather than a convention a future contributor could forget.

## Migration tooling for legacy data (Gate 4 scope only)

Gate 4 builds schema-mapping + transform scripts that run against
**exported/synthetic data**, never a live production connection. The
mapping is close to 1:1 given the schema carry-over above; the main
transform work is:
- Resolving `wp_users`/`wp_usermeta` (`zz_default_tenant_id`, `zz_saas_plan`,
  `zz_saas_status`) into the standalone `users`/`tenant_memberships` tables.
- Validating referential integrity (every `account_id`/tenant reference
  resolves) before import, and producing a pre/post balance-and-count report
  per Gate 4's PASS criteria.
