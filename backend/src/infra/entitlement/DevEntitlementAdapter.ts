import type { EntitlementService } from '../../domain/entitlement/EntitlementService.js';

export type DevEntitlementMode = 'allow-all' | 'deny-all' | 'allow-list';

export interface DevEntitlementConfig {
  mode: DevEntitlementMode;
  allowedUserIds?: ReadonlySet<string>;
}

/**
 * Config-driven entitlement for local/dev/staging use without a real
 * billing system — this is what Gate 5's staging environment runs, since
 * staging has no live WooCommerce connection (see
 * docs/architecture/auth-entitlement-abstraction.md, "What Gate 3 must
 * prove": swapping this in via configuration alone).
 */
export class DevEntitlementAdapter implements EntitlementService {
  constructor(private readonly config: DevEntitlementConfig) {}

  async isEntitled(userId: string): Promise<boolean> {
    switch (this.config.mode) {
      case 'allow-all':
        return true;
      case 'deny-all':
        return false;
      case 'allow-list':
        return this.config.allowedUserIds?.has(userId) ?? false;
    }
  }
}
