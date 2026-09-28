# Legacy → Standalone migration tooling (Gate 4)

Per the Kickoff's Gate 4 scope, this directory delivers **schema mapping +
migration script + a fixture/synthetic-data dry run only**. There is no
code path here that connects to a production database, and `migrate.ts`
actively refuses to run unless `MIGRATION_DRYRUN_DATABASE_URL` looks like a
dry-run database name. Real customer/member data migration is a future,
separate Production Cutover Project (`docs/gates/kickoff-contract.md` →
排除範圍).

## Schema mapping

| Legacy (WordPress, `wp_` prefix) | Standalone | Notes |
|---|---|---|
| `wp_users` (`ID`, `user_email`) | `users` | New table — WordPress identity has no standalone equivalent to copy beyond email. **Password cannot be migrated**: WordPress hashes with phpass, the standalone `AuthService` uses scrypt. Every migrated user gets `passwordHash = 'MIGRATED_ACCOUNT_REQUIRES_PASSWORD_RESET'` (see `transform.ts`) — a real cutover needs a forced password-reset flow before these accounts are usable. This is flagged here, not silently glossed over. |
| `wp_zz_tenants` | `tenants` | Direct field mapping (`company_name`→`companyName`, etc.); `owner_user_id` resolved through the new `users` id map. |
| `wp_zz_tenant_users` | `tenant_memberships` | Direct mapping; legacy only ever has `tenant_role = 'owner'`, matching the standalone enum today. |
| `wp_zz_cash_accounts` | `cash_accounts` | Direct mapping. `opening_balance` parsed from the legacy string-decimal into a number for Prisma's `Decimal`. |
| `wp_zz_cash_categories` | `cash_categories` | Direct mapping. |
| `wp_zz_cash_entries` | `cash_entries` | Direct mapping. `category` copied **verbatim as a string, no lookup against categories** — see `docs/architecture/category-decision.md`, the Gate 4 decision this migration tooling deliberately follows. `transfer_code`: legacy `''` means "not a transfer"; standalone uses `NULL` for the same meaning (mapped in `transform.ts`). |

All legacy integer IDs are re-issued as the standalone schema's own
`cuid()` string IDs — the migration script builds in-memory id maps
(`userIdMap`, `tenantIdMap`, `accountIdMap`) as it inserts each table, in
FK-safe order (users → tenants → memberships → accounts → categories →
entries), and uses those maps to resolve foreign keys on every subsequent
insert.

## Running the dry run

```bash
cd backend
# create a database whose name makes it obviously a throwaway target —
# migrate.ts refuses to run against anything else
mysql -uroot -e "CREATE DATABASE zanzan_cash_migration_dryrun CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
DATABASE_URL="mysql://zanzan_app:zanzan_dev_password@localhost:3306/zanzan_cash_migration_dryrun" npx prisma migrate deploy

MIGRATION_DRYRUN_DATABASE_URL="mysql://zanzan_app:zanzan_dev_password@localhost:3306/zanzan_cash_migration_dryrun" \
  npx tsx scripts/migration/migrate.ts
```

Optionally pass a different fixture file as the first argument:
`npx tsx scripts/migration/migrate.ts path/to/other-fixture.json`.

## What the dry run verifies

`verify.ts` independently recomputes, from the **source fixture's own
numbers** (not trusting the migration script's bookkeeping), and compares
against what actually landed in the destination database:

- Row counts for every table
- Every account's balance (`opening_balance + Σincome − Σexpense`,
  transfers included)
- Every tenant's lifetime income/expense totals (transfers **excluded**,
  matching `cash_summary` parity)
- Every transfer's pair integrity (exactly 2 legs, in both source and
  destination)

The script prints a ✓/✗ line per check and exits non-zero if any check
fails.

## Repeatability

`migrate.ts` clears the target database's tables (in FK-safe order) before
every run, so re-running against the same fixture is idempotent and
produces the same verification result — this is the "migration dry-run
must be repeatable" PASS criterion from the Kickoff's Gate 4 section.

## Fixture data

`fixtures/legacy-sample.json` is entirely synthetic — two tenants, several
accounts/categories, a transfer pair, and one entry referencing a
**disabled** category (to exercise the "preserve historical entries
against a category that was later disabled" behavior). It is not derived
from, and does not contain, any real customer data.
