import type { TenantRepository } from '../../domain/repositories/TenantRepository.js';
import type { Tenant, TenantMembership } from '../../domain/types.js';
import type { Db } from './types.js';

function toDomainMembership(row: { tenantId: string; userId: string; tenantRole: string; status: string; createdAt: Date }): TenantMembership {
  return {
    tenantId: row.tenantId,
    userId: row.userId,
    role: row.tenantRole as TenantMembership['role'],
    status: row.status as TenantMembership['status'],
    createdAt: row.createdAt,
  };
}

export class PrismaTenantRepository implements TenantRepository {
  constructor(private readonly db: Db) {}

  async create(tenant: Omit<Tenant, 'id' | 'createdAt'> & { createdAt: Date }): Promise<Tenant> {
    return this.db.tenant.create({ data: tenant });
  }

  async findById(tenantId: string): Promise<Tenant | null> {
    return this.db.tenant.findUnique({ where: { id: tenantId } });
  }

  async findByOwnerAndName(ownerUserId: string, companyName: string): Promise<Tenant | null> {
    return this.db.tenant.findFirst({ where: { ownerUserId, companyName } });
  }

  async findFirstByOwner(ownerUserId: string): Promise<Tenant | null> {
    return this.db.tenant.findFirst({
      where: { ownerUserId, status: 'active' },
      orderBy: { id: 'asc' },
    });
  }

  async addMembership(membership: TenantMembership): Promise<void> {
    await this.db.tenantMembership.create({
      data: {
        tenantId: membership.tenantId,
        userId: membership.userId,
        tenantRole: membership.role,
        status: membership.status,
        createdAt: membership.createdAt,
      },
    });
  }

  async findMembership(tenantId: string, userId: string): Promise<TenantMembership | null> {
    const row = await this.db.tenantMembership.findFirst({ where: { tenantId, userId, status: 'active' } });
    return row ? toDomainMembership(row) : null;
  }

  async listMembershipsForUser(userId: string): Promise<TenantMembership[]> {
    const rows = await this.db.tenantMembership.findMany({ where: { userId, status: 'active' } });
    return rows.map(toDomainMembership);
  }
}
