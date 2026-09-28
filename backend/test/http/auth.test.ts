import { describe, expect, it } from 'vitest';
import { createHttpTestApp } from './httpTestHarness.js';

describe('Auth', () => {
  it('registers a user and returns a usable JWT', async () => {
    const { app } = createHttpTestApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: 'alice@example.test', password: 'hunter22' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().token).toBeTypeOf('string');
  });

  it('rejects duplicate registration', async () => {
    const { app } = createHttpTestApp();
    await app.inject({ method: 'POST', url: '/api/v1/auth/register', payload: { email: 'bob@example.test', password: 'x' } });
    const res = await app.inject({ method: 'POST', url: '/api/v1/auth/register', payload: { email: 'bob@example.test', password: 'y' } });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('EMAIL_ALREADY_REGISTERED');
  });

  it('logs in with correct credentials and rejects wrong ones', async () => {
    const { app } = createHttpTestApp();
    await app.inject({ method: 'POST', url: '/api/v1/auth/register', payload: { email: 'carol@example.test', password: 'correct-horse' } });

    const good = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: 'carol@example.test', password: 'correct-horse' } });
    expect(good.statusCode).toBe(200);

    const bad = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: 'carol@example.test', password: 'wrong' } });
    expect(bad.statusCode).toBe(401);
    expect(bad.json().code).toBe('INVALID_CREDENTIALS');
  });

  /** P — unauthorized request -> 401 */
  it('rejects requests with no token', async () => {
    const { app } = createHttpTestApp();
    const res = await app.inject({ method: 'GET', url: '/api/v1/tenants' });
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe('UNAUTHENTICATED');
  });

  it('rejects requests with a garbage token', async () => {
    const { app } = createHttpTestApp();
    const res = await app.inject({ method: 'GET', url: '/api/v1/tenants', headers: { authorization: 'Bearer not-a-real-token' } });
    expect(res.statusCode).toBe(401);
  });
});
