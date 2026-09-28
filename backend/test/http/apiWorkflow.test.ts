import { describe, expect, it } from 'vitest';
import { createHttpTestApp, createTenant, registerUser } from './httpTestHarness.js';

// Kickoff Gate 3 PASS criterion: "Legacy business rules were not altered by
// API-ification." Gate 2's 34 characterization tests already prove the
// domain services are correct in isolation; this suite samples the same
// invariants through the actual HTTP boundary (routing, auth, request/
// response shaping) rather than re-deriving all 29 cases here.

describe('API workflow (business rules survive HTTP-ification)', () => {
  async function setup() {
    const { app } = createHttpTestApp();
    const { token } = await registerUser(app, `workflow-${Date.now()}@example.test`);
    const tenantId = await createTenant(app, token, 'Workflow Co');
    const headers = { authorization: `Bearer ${token}`, 'x-tenant-id': tenantId };
    return { app, headers };
  }

  it('income/expense mutual exclusion is enforced at the API layer (400)', async () => {
    const { app, headers } = await setup();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/cash-entries',
      headers,
      payload: { date: '2026-03-01', memo: 'x', category: '一般收入', account: '現金', income: 100, expense: 50 },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('INCOME_EXPENSE_MUTUAL_EXCLUSION');
  });

  it('full CRUD + transfer + summary + CSV export round trip through HTTP', async () => {
    const { app, headers } = await setup();

    await app.inject({ method: 'POST', url: '/api/v1/accounts', headers, payload: { accountName: '銀行' } });
    await app.inject({ method: 'POST', url: '/api/v1/categories', headers, payload: { categoryName: '餐費', categoryType: 'expense' } });

    const entryRes = await app.inject({
      method: 'POST',
      url: '/api/v1/cash-entries',
      headers,
      payload: { date: '2026-03-05', memo: '午餐', category: '餐費', account: '現金', income: 0, expense: 80 },
    });
    expect(entryRes.statusCode).toBe(201);

    const transferRes = await app.inject({
      method: 'POST',
      url: '/api/v1/transfers',
      headers,
      payload: { date: '2026-03-06', from_account: '現金', to_account: '銀行', amount: 200 },
    });
    expect(transferRes.statusCode).toBe(201);

    const summaryRes = await app.inject({ method: 'GET', url: '/api/v1/cash-entries/summary', headers });
    expect(summaryRes.statusCode).toBe(200);
    expect(summaryRes.json().expenseTotal).toBe(80); // transfer excluded from summary totals

    const listRes = await app.inject({ method: 'GET', url: '/api/v1/cash-entries', headers });
    expect(listRes.json().data).toHaveLength(3); // 1 entry + 2 transfer legs

    const csvRes = await app.inject({ method: 'GET', url: '/api/v1/cash-entries/export', headers });
    expect(csvRes.statusCode).toBe(200);
    expect(csvRes.headers['content-type']).toContain('text/csv');
    expect(csvRes.body).toContain('午餐');

    const accountSummaryRes = await app.inject({ method: 'GET', url: '/api/v1/accounts/summary', headers });
    const bank = accountSummaryRes.json().data.find((a: { accountName: string }) => a.accountName === '銀行');
    expect(bank.balance).toBe(200);
  });

  it('a transfer-linked entry cannot be individually updated via the API (409)', async () => {
    const { app, headers } = await setup();
    await app.inject({ method: 'POST', url: '/api/v1/accounts', headers, payload: { accountName: '銀行' } });
    await app.inject({
      method: 'POST',
      url: '/api/v1/transfers',
      headers,
      payload: { date: '2026-03-07', from_account: '現金', to_account: '銀行', amount: 50 },
    });

    const listRes = await app.inject({ method: 'GET', url: '/api/v1/cash-entries', headers });
    const transferEntry = listRes.json().data[0];

    const updateRes = await app.inject({
      method: 'PUT',
      url: `/api/v1/cash-entries/${transferEntry.id}`,
      headers,
      payload: { date: '2026-03-08', memo: 'hacked', category: '帳戶轉帳', account: '現金', income: 0, expense: 999 },
    });
    expect(updateRes.statusCode).toBe(409);
    expect(updateRes.json().code).toBe('ENTRY_TRANSFER_IMMUTABLE');
  });
});
