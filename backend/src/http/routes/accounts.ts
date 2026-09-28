import type { FastifyInstance } from 'fastify';
import type { AppDependencies } from '../app.js';

interface AccountBody {
  accountName: string;
  accountType?: string;
  openingBalance?: number;
}

export function registerAccountRoutes(app: FastifyInstance, deps: AppDependencies): void {
  const guard = [app.authenticate, app.requireEntitlement, app.requireTenantContext];

  app.get('/accounts', { preHandler: guard }, async (request) => {
    const names = await deps.accountService.listActiveAccountNames(request.tenantId!);
    return { status: 'ok', data: names };
  });

  app.get('/accounts/admin', { preHandler: guard }, async (request) => {
    const accounts = await deps.accountService.listForAdmin(request.tenantId!);
    return { status: 'ok', data: accounts };
  });

  app.get('/accounts/summary', { preHandler: guard }, async (request) => {
    const summaries = await deps.accountService.getAccountSummaries(request.tenantId!);
    return { status: 'ok', data: summaries };
  });

  app.post<{ Body: AccountBody }>('/accounts', { preHandler: guard }, async (request, reply) => {
    const account = await deps.accountService.createAccount(request.tenantId!, request.body);
    reply.code(201).send({ status: 'ok', data: account });
  });

  app.put<{ Params: { id: string }; Body: AccountBody }>('/accounts/:id', { preHandler: guard }, async (request) => {
    const account = await deps.accountService.updateAccount(request.tenantId!, request.params.id, request.body);
    return { status: 'ok', data: account };
  });

  app.post<{ Params: { id: string } }>('/accounts/:id/disable', { preHandler: guard }, async (request) => {
    await deps.accountService.disableAccount(request.tenantId!, request.params.id);
    return { status: 'ok' };
  });

  app.post<{ Params: { id: string } }>('/accounts/:id/enable', { preHandler: guard }, async (request) => {
    await deps.accountService.enableAccount(request.tenantId!, request.params.id);
    return { status: 'ok' };
  });
}
