import type { Tenant, TenantMembership } from '../types.js';

export interface TenantRepository {
  create(tenant: Omit<Tenant, 'id' | 'createdAt'> & { createdAt: Date }): Promise<Tenant>;
  findById(tenantId: string): Promise<Tenant | null>;
  findByOwnerAndName(ownerUserId: string, companyName: string): Promise<Tenant | null>;
  /** Any tenant owned by this user, regardless of name — used by purchase auto-provisioning (T-series parity, see woocommerce-hooks.php). */
  findFirstByOwner(ownerUserId: string): Promise<Tenant | null>;

  addMembership(membership: TenantMembership): Promise<void>;
  findMembership(tenantId: string, userId: string): Promise<TenantMembership | null>;
  listMembershipsForUser(userId: string): Promise<TenantMembership[]>;
}
