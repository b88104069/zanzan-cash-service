/**
 * Whether an authenticated user is currently allowed to use the system —
 * independent of tenant membership. See
 * docs/architecture/auth-entitlement-abstraction.md.
 *
 * Core domain and API middleware call ONLY this interface. No file outside
 * an adapter package may reference WooCommerce, Subscriptions, or product
 * IDs — enforced structurally the same way Gate 2 enforced zero WordPress
 * dependency in the core domain (see test/noWordpressDependency.test.ts,
 * extended in Gate 3 to also cover the API layer minus this adapter dir).
 */
export interface EntitlementService {
  isEntitled(userId: string): Promise<boolean>;
}
