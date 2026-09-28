# Authentication / Entitlement Abstraction

This is the single most important structural change from the legacy system
(Kickoff Gate 3 goal): identity and paid-access must never be hard-wired to
WooCommerce inside core domain code again.

## Two separate concerns, kept separate

1. **Authentication** — "who is this request from?" Replaces
   `is_user_logged_in()`/`get_current_user_id()`. Implementation: standard
   token-based auth (JWT or session token) issued by the standalone service's
   own user store. Not WordPress-specific at all; WordPress user identity is
   only relevant as a one-time migration input (Gate 4), not a runtime
   dependency.

2. **Entitlement** — "is this authenticated user currently allowed to use
   the system?" Replaces `zzscs_check_subscription_access()` /
   `wcs_user_has_subscription()`. This is the concern that must be
   abstracted, because *this* is what's genuinely WooCommerce-specific today
   and might not be tomorrow.

## The abstraction

```
CashEntryService / AccountService / ... (core domain)
                │
                ▼
        EntitlementService (interface)
        ┌───────┴────────┐
        ▼                ▼
DevEntitlementAdapter   WooCommerceEntitlementAdapter
(always-allow or        (wraps wcs_user_has_subscription()-
 config-driven,          equivalent call; contract/mock is
 for local/dev/staging)  sufficient through Gate 5)
```

Interface shape (illustrative, finalized in Gate 3):

```
interface EntitlementService {
  isEntitled(userId: string): Promise<boolean>
}
```

Core domain services and API middleware call only `isEntitled()`. No file
outside the WooCommerce adapter package may reference WooCommerce,
Subscriptions, or product IDs.

## Invariants carried forward (from `domain-boundaries.md` → Entitlement)

- Platform admins bypass entitlement checks but still need a bound tenant
  for tenant-scoped endpoints.
- Fail closed: if the entitlement backend can't answer, access is denied,
  not granted (this matches the legacy 503 behavior when Subscriptions isn't
  installed — silently defaulting to "allow" would be a parity violation,
  not an improvement).
- The "required product" concept moves from a PHP constant
  (`ZZSCS_REQUIRED_PRODUCT_ID`) to adapter configuration (env var/config
  row) — see `wordpress-dependency-inventory.md`.

## Tenant-provisioning trigger, decoupled the same way

`BillingWebhookHandler` (see `service-boundaries.md`) receives a
purchase-completed event and calls `TenantService.provisionFromPurchase()`.
The event's shape is provider-agnostic (user identifier, billing/company
name hints, idempotency key) even though the only real event producer for
this project is WooCommerce. This replaces the direct
`woocommerce_order_status_processing`/`completed` action hooks with a
handler that could just as easily be triggered by a different billing
system's webhook without touching `TenantService`.

## What Gate 3 must prove

- Deleting/disabling the `WooCommerceEntitlementAdapter` file does not break
  compilation or tests of any core domain service — the dependency direction
  only goes one way.
- Swapping `DevEntitlementAdapter` in for `WooCommerceEntitlementAdapter` via
  configuration alone (no code change) is possible and is exactly how
  Gate 5's staging environment runs, since staging has no live WooCommerce
  connection.
- The cross-tenant/entitlement security tests listed in the Kickoff's Gate 3
  PASS criteria (401/403/tenant-isolation cases) pass against whichever
  adapter is active.
