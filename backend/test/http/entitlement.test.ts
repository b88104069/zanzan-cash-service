import { describe, expect, it } from 'vitest';
import { DevEntitlementAdapter } from '../../src/infra/entitlement/DevEntitlementAdapter.js';
import { createHttpTestApp, issuePlatformAdminToken, registerUser } from './httpTestHarness.js';

// Spec: characterization-test-spec.md § Entitlement / Access (P1-P4),
// deferred from Gate 2 to Gate 3 per that spec's own note — implemented
// here at the HTTP layer since EntitlementService only exists from Gate 3.

describe('Entitlement (P1-P4)', () => {
  it('P2 — an entitled, authenticated member can call tenant-scoped endpoints', async () => {
    const { app } = createHttpTestApp(new DevEntitlementAdapter({ mode: 'allow-all' }));
    const { token } = await registerUser(app, 'entitled@example.test');

    const res = await app.inject({ method: 'GET', url: '/api/v1/tenants', headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(200);
  });

  it('P3 — an authenticated but non-entitled member is rejected with 403', async () => {
    const { app } = createHttpTestApp(new DevEntitlementAdapter({ mode: 'deny-all' }));
    const { token } = await registerUser(app, 'notentitled@example.test');

    const res = await app.inject({ method: 'GET', url: '/api/v1/tenants', headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('NOT_ENTITLED');
  });

  it('P4 — entitlement backend unavailable (throws) fails closed with 503, not silently granted', async () => {
    const throwingAdapter = { isEntitled: async () => { throw new Error('WooCommerce down'); } };
    const { app } = createHttpTestApp(throwingAdapter);
    const { token } = await registerUser(app, 'flaky@example.test');

    const res = await app.inject({ method: 'GET', url: '/api/v1/tenants', headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(503);
    expect(res.json().code).toBe('ENTITLEMENT_SERVICE_UNAVAILABLE');
  });

  it('P1 — a platform admin bypasses entitlement but still needs a valid tenant for tenant-scoped endpoints', async () => {
    const { app } = createHttpTestApp(new DevEntitlementAdapter({ mode: 'deny-all' }));
    const { userId } = await registerUser(app, 'admin@example.test');
    const adminToken = await issuePlatformAdminToken(app, userId);

    // Bypasses entitlement (deny-all) for the non-tenant-scoped tenants endpoint:
    const tenantsRes = await app.inject({ method: 'GET', url: '/api/v1/tenants', headers: { authorization: `Bearer ${adminToken}` } });
    expect(tenantsRes.statusCode).toBe(200);

    // But a tenant-scoped endpoint still requires an actual tenant binding:
    const accountsRes = await app.inject({
      method: 'GET',
      url: '/api/v1/accounts',
      headers: { authorization: `Bearer ${adminToken}`, 'x-tenant-id': 'no-such-tenant' },
    });
    expect(accountsRes.statusCode).toBe(403);
    expect(accountsRes.json().code).toBe('TENANT_MEMBERSHIP_REQUIRED');
  });
});
