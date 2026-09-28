# Technical Stack Choice and Rationale

These are Gate 1 decisions; changing them later requires a documented
deviation, not a silent swap mid-Gate.

## Backend: Node.js + TypeScript, Fastify

- **Why Node/TS**: the legacy frontend is already JavaScript
  (`cashbook.js`), and the team producing/maintaining this service is
  working through a JS-fluent toolchain end to end (backend, frontend,
  migration scripts) reduces context-switching for a parity project where
  the goal is faithful behavior reproduction, not exploring a new language.
  TypeScript gives static typing for the `[INV]` invariants in
  `domain-boundaries.md` (e.g. income/expense mutual exclusion is easy to
  model as a discriminated union) without the runtime rewrite cost of a
  heavier framework migration.
- **Why Fastify over Express/Nest**: lower overhead than Nest (no need for
  Nest's DI/module ceremony for a bounded, five-table domain), better
  built-in schema validation than bare Express (maps directly onto
  `api-contract-principles.md` principle 6 — structured errors — via
  Fastify's schema/validation hooks), and it runs well on Cloud Run.

## Database access: Prisma (or Knex if migrations prove awkward — decided at
Gate 2 implementation time, not re-litigated here)

- **Why an ORM/query-builder over raw SQL**: the legacy code's raw
  `$wpdb->prepare()` calls are exactly the pattern
  `database-strategy.md` says not to reproduce. Prisma gives typed
  queries, a migration tool out of the box (satisfying
  `database-strategy.md`'s "no dbDelta-style" requirement), and works
  against MySQL without changing the chosen engine.

## Database: MySQL 8 / Cloud SQL for MySQL

See `database-strategy.md` for the full rationale (schema/type continuity
with the legacy WordPress database).

## Frontend: React + Vite, TypeScript

- **Why React**: the parity checklist (Gate 4) is a form-heavy CRUD app
  (entries, accounts, categories, transfers, filters) — a mainstream
  component framework with a large ecosystem minimizes bespoke UI
  infrastructure work, which is explicitly not the point of this project.
  Vite for fast local dev and a simple static build output deployable
  behind Cloud Run or a static host.
- Not choosing a meta-framework (Next.js/Remix) because this is a
  client-rendered SPA behind an authenticated API, not a
  content/SEO-driven site — SSR buys nothing here and adds deployment
  surface area Gate 5 doesn't need.

## Testing

- **Vitest** for both backend unit/characterization tests and frontend
  component tests (one test runner, one config style, less tooling surface
  for a project that starts from zero tests).
- **Supertest** (or Fastify's built-in `inject`) for Gate 3 API-level tests
  (auth/entitlement/tenant-isolation scenarios).

## Deployment target: Google Cloud Run (app) + Cloud SQL (MySQL) + Secret
Manager

See `gcp-target-architecture.md` for the full Gate 5 target.

## What this rules out (explicitly, so it isn't re-debated per Gate)

- No PHP anywhere in the standalone service — the legacy PHP is reference
  material only (`docs/migration/...txt`), never a dependency of the new
  codebase.
- No switching database engines (no Postgres/Mongo) for v1.0 — see
  `database-strategy.md`.
- No GraphQL for v1.0 — the API surface is small and REST matches the
  legacy endpoint shape closely enough that a 1:1 mental mapping during
  Gate 3 review is more valuable than GraphQL's flexibility.
