import type { TenantRepository } from '../../domain/repositories/TenantRepository.js';
import type { Tenant, TenantMembership } from '../../domain/types.js';
import { generateId, InMemoryDatabase } from './InMemoryDatabase.js';

export class InMemoryTenantRepository implements TenantRepository {
  constructor(private readonly db: InMemoryDatabase) {}

  async create(tenant: Omit<Tenant, 'id' | 'createdAt'> & { createdAt: Date }): Promise<Tenant> {
    const row: Tenant = { ...tenant, id: generateId('tenant') };
    this.db.tenants.set(row.id, row);
    return row;
  }

  async findById(tenantId: string): Promise<Tenant | null> {
    return this.db.tenants.get(tenantId) ?? null;
  }

  async findByOwnerAndName(ownerUserId: string, companyName: string): Promise<Tenant | null> {
    for (const tenant of this.db.tenants.values()) {
      if (tenant.ownerUserId === ownerUserId && tenant.companyName === companyName) return tenant;
    }
    return null;
  }

  async findFirstByOwner(ownerUserId: string): Promise<Tenant | null> {
    const owned = [...this.db.tenants.values()]
      .filter((t) => t.ownerUserId === ownerUserId && t.status === 'active')
      .sort((a, b) => a.id.localeCompare(b.id));
    return owned[0] ?? null;
  }

  async addMembership(membership: TenantMembership): Promise<void> {
    this.db.memberships.push(membership);
  }

  async findMembership(tenantId: string, userId: string): Promise<TenantMembership | null> {
    return (
      this.db.memberships.find((m) => m.tenantId === tenantId && m.userId === userId && m.status === 'active') ??
      null
    );
  }

  async listMembershipsForUser(userId: string): Promise<TenantMembership[]> {
    return this.db.memberships.filter((m) => m.userId === userId && m.status === 'active');
  }
}
