# Service Boundaries

Maps the domains in `domain-boundaries.md` onto concrete services/modules
for the standalone codebase, and states what's built in which Gate.

## Core domain services (Gate 2)

| Service | Owns | Depends on |
|---|---|---|
| `TenantService` | Tenant CRUD, tenant membership, "seed defaults on creation" | Repository layer only |
| `AccountService` | Account CRUD, soft-delete, balance calculation | Repository layer only |
| `CategoryService` | Category CRUD, soft-delete | Repository layer only |
| `CashEntryService` | Entry create/update/delete, list/filter, summary aggregation | Repository layer; calls `AccountService`/`CategoryService` for validation, not their internals |
| `TransferService` | Paired-entry creation and paired-entry deletion, transfer integrity guard | Repository layer; may delegate the actual row writes to `CashEntryService`'s repository, but owns the atomicity/pairing logic itself — this is intentionally **not** folded into `CashEntryService` because a transfer is a distinct compound transaction, and future double-entry-ledger features extend this service, not entry CRUD |
| `ExportService` | CSV generation | Reuses `CashEntryService`'s query/filter construction — the legacy code duplicates this SQL between list and export; the standalone version must share one query builder |

None of the above may import a persistence driver directly — they depend on
a `Repository`/`UnitOfWork` abstraction (see `database-strategy.md`), so the
whole Gate-2 core can run against an in-memory or test database with zero
WordPress and zero real DB required.

## API layer (Gate 3)

| Component | Purpose |
|---|---|
| HTTP router / controllers | Thin adapters: parse request → call a domain service → shape response. No business logic here (this is the #1 anti-pattern being fixed from the legacy code). |
| Auth middleware | Verifies identity (replaces `is_user_logged_in`/`get_current_user_id`) |
| Tenant-context middleware | Resolves and validates the active tenant for the request (replaces `zzscs_get_current_tenant_id`); rejects if the tenant doesn't belong to the authenticated user |
| `EntitlementService` (interface) | Decides "can this user use the system" — see `auth-entitlement-abstraction.md` |

## Adapters (Gate 3 interface, Gate 5 may still be mock/dev)

| Adapter | Implements | Notes |
|---|---|---|
| `DevEntitlementAdapter` | `EntitlementService` | Always-allow or config-driven allow, for local/dev/staging use without a real billing system |
| `WooCommerceEntitlementAdapter` | `EntitlementService` | Wraps `wcs_user_has_subscription()`-equivalent logic; contract/mock is enough for Gate 3, a real HTTP integration to a live WooCommerce instance is not required until a future cutover project |
| `BillingWebhookHandler` | Receives a purchase-completed event, calls `TenantService.provisionFromPurchase()` | Replaces `woocommerce-hooks.php`; the event shape is provider-agnostic even though the only real event source for now is WooCommerce |

## Frontend (Gate 4)

A standalone frontend app is a *consumer* of the Gate-3 API, not a service
boundary in this backend sense. It replaces `shortcode-cashbook.php` +
`cashbook.js` + `cashbook.css` entirely; none of that code is ported, only
its feature list (see `docs/gates/kickoff-contract.md` Gate 4 parity
checklist).

## Explicitly out of the standalone service

- `my-account.php` (WooCommerce "My Account" tab mounting) — no equivalent.
- Shortcode rendering / `wp_enqueue_scripts` FOUC handling — no equivalent.
- Anything that exists only to integrate with the WordPress *page rendering*
  lifecycle, as opposed to the *business* lifecycle (orders, entitlements).
