# WordPress Dependency Inventory

Every WordPress/WooCommerce API surface the legacy plugin touches, and what
replaces it in the standalone service. "Keep as Adapter" means the concept
survives behind an interface; "Deprecate" means it has no standalone
equivalent because it was WordPress presentation/session machinery.

| Category | Symbol(s) | Legacy purpose | Disposition |
|---|---|---|---|
| DB access | `$wpdb`, `dbDelta()` | Raw SQL + table creation | **Deprecate.** Replaced by a standard SQL migration tool + query layer (see `database-strategy.md`). |
| REST routing | `register_rest_route`, `WP_REST_Request`, `WP_REST_Response`, `WP_Error` | Route registration & response envelope | **Deprecate.** Replaced by the standalone API framework's router (see `tech-stack.md`). |
| Auth | `is_user_logged_in()`, `get_current_user_id()`, `current_user_can('manage_options')` | Session-based login state + role check | **Deprecate the mechanism, keep the concept.** Replaced by an independent Auth layer (JWT/session) with an explicit "platform admin" role — see `auth-entitlement-abstraction.md`. |
| User state | `get_user_meta()/update_user_meta()` (`zz_default_tenant_id`, `zz_saas_plan`, `zz_saas_status`) | "Current tenant" + SaaS plan/status flags stored on the WP user object | **Deprecate storage, keep the data.** Becomes normalized columns on `users`/`tenant_memberships`; "current tenant" becomes an explicit per-request value, not stored server-side session state. |
| Input sanitization | `sanitize_text_field`, `sanitize_textarea_field`, `absint`, `floatval` | Input cleaning | **Deprecate.** Replaced by a standard request-validation library at the API boundary. |
| CSRF | `wp_verify_nonce()`, `wp_create_nonce()` | Used only on the CSV export endpoint | **Deprecate.** Standard CSRF/auth-token handling applied uniformly across all endpoints (this closes an existing inconsistency — see `docs/gates/kickoff-contract.md`'s referenced Gate 0.2 risk list, item 8). |
| Time/random | `current_time('mysql')`, `wp_date()`, `wp_rand()` | Timestamps, random transfer codes | **Deprecate.** Standard language/runtime library equivalents. |
| Presentation | `add_shortcode`, `wp_enqueue_script/style`, `wp_localize_script` | Renders the `[zanzan_cashbook]` widget and injects `ZZSCS_DATA` (API base, nonce) into the page | **Deprecate entirely.** No standalone equivalent needed; the standalone frontend is a separate app, not a WP-rendered fragment. |
| Routing | `add_rewrite_endpoint`, `flush_rewrite_rules` | Mounts `/my-account/cashbook/` endpoint | **Deprecate entirely.** Standard frontend routing replaces it. |
| **WooCommerce order lifecycle** | `wc_get_order()`, `WC_Order`, `woocommerce_order_status_processing`/`completed` hooks | Auto-provisions a tenant when a matching product is purchased | **Keep as Adapter.** This becomes a `BillingWebhookHandler` that receives a purchase-completed event (from WooCommerce today, potentially another billing system later) and calls `TenantService.provisionFromPurchase()`. The event source is swappable; the provisioning logic is not WordPress-specific and moves into core. |
| **WooCommerce Subscriptions** | `wcs_user_has_subscription()` | Sole entitlement/paywall check, called on every protected API request | **Keep as Adapter, abstracted.** Becomes one concrete implementation of `EntitlementService` (see `auth-entitlement-abstraction.md`); core domain code never calls this function directly again. |
| **WooCommerce Account UI** | `woocommerce_account_menu_items` filter, `woocommerce_account_cashbook_endpoint` action | Mounts the cashbook UI under "My Account" | **Deprecate entirely.** No standalone equivalent; the standalone frontend is its own app with its own navigation. |
| Product identity | `ZZSCS_REQUIRED_PRODUCT_ID` (hardcoded `68568`) | Identifies which purchased product/variation grants access | **Keep as config, not constant.** Moves into the WooCommerce adapter's configuration (env var or settings row), not a code constant, so it can be corrected without a deploy. |

## Summary

- **Fully deprecated** (no standalone equivalent needed): DB access
  primitives, REST routing primitives, input sanitization helpers, CSRF
  nonce mechanism, time/random helpers, all shortcode/enqueue/rewrite
  presentation code, WooCommerce Account UI mounting.
- **Kept only behind an Adapter boundary** (core domain code must never call
  these directly): WooCommerce order-lifecycle hooks (→
  `BillingWebhookHandler`), WooCommerce Subscriptions entitlement check (→
  `EntitlementService` WooCommerce adapter), the hardcoded product ID (→
  adapter configuration).
- **Conceptually kept, mechanism replaced**: login/session state, "current
  tenant" and SaaS plan/status data — the *data* survives, the WordPress
  *storage mechanism* (user meta) does not.
