import { DomainError } from '../errors.js';
import type { AccountRepository } from '../repositories/AccountRepository.js';
import type { CategoryRepository } from '../repositories/CategoryRepository.js';
import type { TenantRepository } from '../repositories/TenantRepository.js';
import { DEFAULT_SEED_ACCOUNT_NAME, DEFAULT_SEED_CATEGORIES, type Tenant } from '../types.js';

export interface CreateTenantInput {
  ownerUserId: string;
  companyName: string;
}

/**
 * Owns tenant lifecycle: creation (self-service and purchase-triggered),
 * membership, and the default account/category seed that every new tenant
 * gets. Parity source: zzscs_api_create_tenant, zzscs_auto_create_tenant_on_purchase
 * (see docs/architecture/domain-boundaries.md → Tenant).
 */
export class TenantService {
  constructor(
    private readonly tenants: TenantRepository,
    private readonly accounts: AccountRepository,
    private readonly categories: CategoryRepository,
  ) {}

  /** T1, T2 — self-service tenant creation; rejects duplicate (owner, name). */
  async createTenant(input: CreateTenantInput): Promise<Tenant> {
    const companyName = input.companyName.trim();
    if (!companyName) {
      throw new DomainError('VALIDATION_REQUIRED_FIELD', '請填寫公司名稱。');
    }

    const existing = await this.tenants.findByOwnerAndName(input.ownerUserId, companyName);
    if (existing) {
      throw new DomainError('DUPLICATE_TENANT_NAME', '您已經擁有相同名稱的公司。');
    }

    const tenant = await this.tenants.create({
      companyName,
      ownerUserId: input.ownerUserId,
      planCode: 'simple-cash-saas',
      status: 'active',
      createdAt: new Date(),
    });

    await this.seedDefaults(tenant, input.ownerUserId);
    return tenant;
  }

  /**
   * Purchase-triggered provisioning. If the user already owns a tenant,
   * returns it without creating a new one (parity: no duplicate-name check
   * here, unlike createTenant — the legacy hook checks "does this user
   * already have ANY tenant", not "any tenant with this name").
   */
  async provisionFromPurchase(input: { ownerUserId: string; suggestedName: string }): Promise<{ tenant: Tenant; created: boolean }> {
    const existing = await this.tenants.findFirstByOwner(input.ownerUserId);
    if (existing) {
      return { tenant: existing, created: false };
    }

    const name = input.suggestedName.trim() || '我的記帳本';
    const tenant = await this.tenants.create({
      companyName: name,
      ownerUserId: input.ownerUserId,
      planCode: 'simple-cash-saas',
      status: 'active',
      createdAt: new Date(),
    });

    await this.seedDefaults(tenant, input.ownerUserId);
    return { tenant, created: true };
  }

  /** T3 — switch requires active membership; T4 — rejects non-members. */
  async assertMembership(tenantId: string, userId: string): Promise<void> {
    const membership = await this.tenants.findMembership(tenantId, userId);
    if (!membership) {
      throw new DomainError('TENANT_MEMBERSHIP_REQUIRED', '您沒有權限。');
    }
  }

  async listTenantsForUser(userId: string): Promise<Tenant[]> {
    const memberships = await this.tenants.listMembershipsForUser(userId);
    const tenants = await Promise.all(memberships.map((m) => this.tenants.findById(m.tenantId)));
    return tenants.filter((t): t is Tenant => t !== null);
  }

  private async seedDefaults(tenant: Tenant, ownerUserId: string): Promise<void> {
    const createdAt = new Date();

    await this.tenants.addMembership({
      tenantId: tenant.id,
      userId: ownerUserId,
      role: 'owner',
      status: 'active',
      createdAt,
    });

    await this.accounts.create({
      tenantId: tenant.id,
      accountName: DEFAULT_SEED_ACCOUNT_NAME,
      accountType: 'cash',
      openingBalance: 0,
      status: 'active',
      createdAt,
    });

    for (const seed of DEFAULT_SEED_CATEGORIES) {
      await this.categories.create({
        tenantId: tenant.id,
        categoryName: seed.name,
        categoryType: seed.type,
        status: 'active',
        createdAt,
      });
    }
  }
}
