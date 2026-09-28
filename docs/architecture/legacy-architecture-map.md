# Legacy Architecture Map

Source: Gate 0.2 Architecture Audit (Pre-Kickoff discovery), folded in here
as the formal record. Legacy source: `docs/migration/zanzan-simple-cash-saas_1-8-33_合併原始碼.txt`.

## Plugin layout

```
zanzan-simple-cash-saas.php     — bootstrap: constants, requires, hook registration, version upgrade check
includes/install.php            — DB schema definition and creation (dbDelta)
includes/tenant.php             — "current tenant" resolution (reads user_meta)
includes/api.php                — ALL business logic + 20 REST API endpoints (incl. raw SQL)
includes/woocommerce-hooks.php  — WooCommerce order-completed → auto tenant provisioning
includes/my-account.php         — mounted under WooCommerce "My Account" tab
public/shortcode-cashbook.php   — [zanzan_cashbook] shortcode, paywall + HTML output
assets/js/cashbook.js           — frontend logic, calls REST API via fetch
assets/css/cashbook.css         — styling
```

## Architectural characteristics

- **No layering**: Controller (REST callback), Service (business rules), and
  Repository (`$wpdb` SQL) are all written inline in the same function —
  every `zzscs_api_*` function in `includes/api.php` is a single top-to-bottom
  procedure.
- **No ORM / migration tool**: schema is created via `dbDelta()` with
  hand-written `CREATE TABLE` SQL, executed idempotently via a static-flag
  guard and a stored `zzscs_version` option.
- **Multi-tenancy as "current tenant in user meta"**: `zz_default_tenant_id`
  holds a single "currently active tenant" per user — not a per-request
  tenant parameter.
- **Frontend is a shortcode + vanilla JS single-page-like widget**, not a
  framework app; it talks to `/wp-json/zanzan-erp/v1/...` via `fetch`.
- **Authorization and business logic are coupled**: subscription checks and
  tenant-existence checks are written directly inside `permission_callback`
  functions, not as a separable policy layer.

## Database tables (as created by `install.php`)

| Table | Key columns | Notes |
|---|---|---|
| `zz_tenants` | id, company_name, owner_user_id, plan_code, status, created_at | One row per company/ledger |
| `zz_tenant_users` | id, tenant_id, user_id, tenant_role, status, created_at | Membership join table; `tenant_role` currently only ever set to `owner` |
| `zz_cash_accounts` | id, tenant_id, account_name, account_type, opening_balance, status, created_at | Soft-delete via `status` |
| `zz_cash_entries` | id, tenant_id, entry_date, memo, category, account_id, income, expense, note, transfer_code, created_by, created_at | `category` stored as free text, not FK; `transfer_code` links paired transfer rows |
| `zz_cash_categories` | id, tenant_id, category_name, category_type, status, created_at | `category_type` ∈ {income, expense}; soft-delete via `status` |

All tables use `InnoDB` and are namespaced with the WordPress `$wpdb->prefix`.

## REST API surface (`includes/api.php`, namespace `zanzan-erp/v1`)

| Route | Method | Purpose |
|---|---|---|
| `/cash-entry` | POST | create entry |
| `/cash-entry-update` | POST | update entry (rejects transfer rows) |
| `/cash-entry-delete` | POST | delete entry (pairs deletion for transfers) |
| `/cash-summary` | GET | lifetime + month-to-date income/expense/balance |
| `/cash-list` | GET | filtered/sorted entry list |
| `/cash-export` | GET | CSV export (nonce-verified) |
| `/tenant-switch` | POST | change "current tenant" |
| `/account-summary` | GET | per-account balances |
| `/accounts` | GET | active account names (for dropdowns) |
| `/account-list` | GET | full account admin list |
| `/account-create` \| `-update` \| `-disable` \| `-enable` | POST | account CRUD (soft-delete) |
| `/transfer-create` | POST | double-entry transfer between two accounts |
| `/categories` | GET | active categories (for dropdowns) |
| `/category-list` | GET | full category admin list |
| `/category-create` \| `-update` \| `-disable` \| `-enable` | POST | category CRUD (soft-delete) |
| `/tenants` | GET | list tenants the user belongs to |
| `/tenant-create` | POST | create a new tenant + seed defaults |

Two permission gates are used: `zzscs_api_permission_check` (requires login +
subscription-or-admin + an existing tenant) for standard routes, and
`zzscs_api_tenant_permission_check` (requires login + subscription-or-admin,
no tenant requirement) for the tenant routes.

## What is not part of the standalone system

`my-account.php` (WooCommerce account-tab mounting), the shortcode's HTML
rendering, and the FOUC-avoidance script/style enqueue logic are pure
WordPress presentation concerns and are not migrated — see
`docs/architecture/service-boundaries.md`.
