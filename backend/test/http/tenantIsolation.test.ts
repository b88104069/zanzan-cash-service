import { describe, expect, it } from 'vitest';
import { createHttpTestApp, createTenant, registerUser } from './httpTestHarness.js';

// Kickoff Gate 3 PASS criteria — security/isolation must be verified:
// - User A cannot read User B's tenant
// - Tenant A's entry cannot be queried via Tenant B's ID
// - Unauthorized request -> 401 (covered in auth.test.ts)
// - Authenticated but no entitlement -> 403 (covered in entitlement.test.ts)
// - Invalid tenant context -> reject

describe('Tenant isolation', () => {
  it('a valid tenant context resolves correctly for its owner', async () => {
    const { app } = createHttpTestApp();
    const { token } = await registerUser(app, 'owner@example.test');
    const tenantId = await createTenant(app, token, 'Owner Co');

    const res = await app.inject({ method: 'GET', url: '/api/v1/accounts', headers: { authorization: `Bearer ${token}`, 'x-tenant-id': tenantId } });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toContain('現金');
  });

  it('User A cannot use User B\'s tenant ID as their own context', async () => {
    const { app } = createHttpTestApp();
    const { token: tokenA } = await registerUser(app, 'userA@example.test');
    const { token: tokenB } = await registerUser(app, 'userB@example.test');
    const tenantB = await createTenant(app, tokenB, 'B Corp');

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/accounts',
      headers: { authorization: `Bearer ${tokenA}`, 'x-tenant-id': tenantB },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('TENANT_MEMBERSHIP_REQUIRED');
  });

  it('Tenant A\'s cash entry cannot be read/mutated via Tenant B\'s ID, even though the entry ID is valid', async () => {
    const { app } = createHttpTestApp();
    const { token: tokenA } = await registerUser(app, 'aOwner@example.test');
    const { token: tokenB } = await registerUser(app, 'bOwner@example.test');
    const tenantA = await createTenant(app, tokenA, 'A Corp');
    const tenantB = await createTenant(app, tokenB, 'B Corp');

    await app.inject({
      method: 'POST',
      url: '/api/v1/categories',
      headers: { authorization: `Bearer ${tokenA}`, 'x-tenant-id': tenantA },
      payload: { categoryName: '薪水', categoryType: 'income' },
    });

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/cash-entries',
      headers: { authorization: `Bearer ${tokenA}`, 'x-tenant-id': tenantA },
      payload: { date: '2026-02-01', memo: 'A的薪水', category: '薪水', account: '現金', income: 1000, expense: 0 },
    });
    expect(createRes.statusCode).toBe(201);
    const entryId = createRes.json().data.id as string;

    // B is a legitimate member of tenant B, but tries to reach A's entry by
    // ID while scoped to tenant B — must not find it (tenant-scoped lookup,
    // not "does this ID exist anywhere").
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/cash-entries/${entryId}`,
      headers: { authorization: `Bearer ${tokenB}`, 'x-tenant-id': tenantB },
    });
    expect(deleteRes.statusCode).toBe(404);
    expect(deleteRes.json().code).toBe('ENTRY_NOT_FOUND');

    // Confirm it's untouched from A's own perspective.
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/v1/cash-entries',
      headers: { authorization: `Bearer ${tokenA}`, 'x-tenant-id': tenantA },
    });
    expect(listRes.json().data).toHaveLength(1);
  });

  it('a nonexistent/garbage tenant ID is rejected, not silently treated as "no tenant"', async () => {
    const { app } = createHttpTestApp();
    const { token } = await registerUser(app, 'solo@example.test');

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/accounts',
      headers: { authorization: `Bearer ${token}`, 'x-tenant-id': 'totally-made-up-id' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('a missing tenant context header is rejected on tenant-scoped endpoints', async () => {
    const { app } = createHttpTestApp();
    const { token } = await registerUser(app, 'noheader@example.test');

    const res = await app.inject({ method: 'GET', url: '/api/v1/accounts', headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('INVALID_TENANT_CONTEXT');
  });
});
