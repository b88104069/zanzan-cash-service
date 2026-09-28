import { describe, expect, it } from 'vitest';
import { DomainError } from '../src/domain/errors.js';
import { createHarness, OTHER_USER, OWNER } from './testHarness.js';

// Spec: docs/gates/characterization-test-spec.md § Tenant

describe('Tenant', () => {
  it('T1 — creating a tenant seeds one 現金 account and four default categories', async () => {
    const { tenantService, accountService, categoryService } = createHarness();

    const tenant = await tenantService.createTenant({ ownerUserId: OWNER, companyName: '贊贊投資帳' });

    const accounts = await accountService.listForAdmin(tenant.id);
    expect(accounts).toHaveLength(1);
    expect(accounts[0]?.accountName).toBe('現金');
    expect(accounts[0]?.openingBalance).toBe(0);

    const categories = await categoryService.listForAdmin(tenant.id);
    expect(categories.map((c) => [c.categoryName, c.categoryType]).sort()).toEqual(
      [
        ['一般收入', 'income'],
        ['交通', 'expense'],
        ['住宿', 'expense'],
        ['餐費', 'expense'],
      ].sort(),
    );
  });

  it('T2 — rejects a duplicate (owner, company name) tenant', async () => {
    const { tenantService } = createHarness();
    await tenantService.createTenant({ ownerUserId: OWNER, companyName: 'X' });

    await expect(tenantService.createTenant({ ownerUserId: OWNER, companyName: 'X' })).rejects.toMatchObject({
      code: 'DUPLICATE_TENANT_NAME',
    } satisfies Partial<DomainError>);
  });

  it('T3 — a member of two tenants has isolated data per tenant', async () => {
    const { tenantService, accountService } = createHarness();
    const tenantA = await tenantService.createTenant({ ownerUserId: OWNER, companyName: 'A' });
    const tenantB = await tenantService.createTenant({ ownerUserId: OWNER, companyName: 'B' });

    await accountService.createAccount(tenantA.id, { accountName: 'A的銀行' });
    await accountService.createAccount(tenantB.id, { accountName: 'B的銀行' });

    const namesA = await accountService.listActiveAccountNames(tenantA.id);
    const namesB = await accountService.listActiveAccountNames(tenantB.id);

    expect(namesA).toContain('A的銀行');
    expect(namesA).not.toContain('B的銀行');
    expect(namesB).toContain('B的銀行');
    expect(namesB).not.toContain('A的銀行');
  });

  it('T4 — a non-member cannot pass the membership check for a tenant', async () => {
    const { tenantService } = createHarness();
    const tenant = await tenantService.createTenant({ ownerUserId: OWNER, companyName: 'C' });

    await expect(tenantService.assertMembership(tenant.id, OTHER_USER)).rejects.toMatchObject({
      code: 'TENANT_MEMBERSHIP_REQUIRED',
    } satisfies Partial<DomainError>);

    // the owner, in contrast, passes
    await expect(tenantService.assertMembership(tenant.id, OWNER)).resolves.toBeUndefined();
  });

  it('purchase-provisioning: a user with no tenant gets one auto-created', async () => {
    const { tenantService, accountService } = createHarness();
    const result = await tenantService.provisionFromPurchase({ ownerUserId: OWNER, suggestedName: '王小明的帳本' });

    expect(result.created).toBe(true);
    expect(result.tenant.companyName).toBe('王小明的帳本');
    const accounts = await accountService.listForAdmin(result.tenant.id);
    expect(accounts).toHaveLength(1);
  });

  it('purchase-provisioning: a user who already owns a tenant is not re-provisioned', async () => {
    const { tenantService } = createHarness();
    const first = await tenantService.createTenant({ ownerUserId: OWNER, companyName: 'Existing' });

    const result = await tenantService.provisionFromPurchase({ ownerUserId: OWNER, suggestedName: 'Ignored' });

    expect(result.created).toBe(false);
    expect(result.tenant.id).toBe(first.id);
  });
});
