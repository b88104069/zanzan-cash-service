import type { EntitlementService } from '../../domain/entitlement/EntitlementService.js';

/**
 * The contract a real WooCommerce integration must satisfy. Gate 3 only
 * needs this interface plus a mock/fake implementation for tests — a real
 * HTTP client hitting a live WooCommerce/Subscriptions REST API is
 * explicitly deferred to a future production-cutover project (see
 * docs/architecture/auth-entitlement-abstraction.md and
 * docs/gates/kickoff-contract.md Gate 3 section: "contract/mock is
 * sufficient this Gate").
 *
 * Parity notes for whoever implements the real client later:
 * - legacy check is `wcs_user_has_subscription($uid, $productId, 'active')
 *   || wcs_user_has_subscription($uid, $productId, 'pending-cancel')`
 * - `$productId` is `ZZSCS_REQUIRED_PRODUCT_ID`, which
 *   wordpress-dependency-inventory.md requires to move from a hardcoded
 *   constant to adapter configuration (env var / settings row), not a
 *   second hardcoded value here.
 */
export interface WooCommerceClient {
  hasActiveOrPendingCancelSubscription(userId: string, productId: string): Promise<boolean>;
}

export interface WooCommerceEntitlementConfig {
  requiredProductId: string;
}

/**
 * Wraps a WooCommerceClient. Fails closed: if the client throws (the
 * legacy behavior when the Subscriptions plugin itself is unavailable —
 * see domain-boundaries.md → Entitlement invariant), access is denied,
 * never silently granted.
 */
export class WooCommerceEntitlementAdapter implements EntitlementService {
  constructor(
    private readonly client: WooCommerceClient,
    private readonly config: WooCommerceEntitlementConfig,
  ) {}

  async isEntitled(userId: string): Promise<boolean> {
    try {
      return await this.client.hasActiveOrPendingCancelSubscription(userId, this.config.requiredProductId);
    } catch {
      return false;
    }
  }
}
