import type { FastifyInstance } from 'fastify';
import type { AppDependencies } from '../app.js';
import type { JwtPayload } from '../types.js';

interface TransferBody {
  date: string;
  from_account: string;
  to_account: string;
  amount: number;
  note?: string;
}

export function registerTransferRoutes(app: FastifyInstance, deps: AppDependencies): void {
  const guard = [app.authenticate, app.requireEntitlement, app.requireTenantContext];

  app.post<{ Body: TransferBody }>('/transfers', { preHandler: guard }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const result = await deps.transferService.createTransfer(request.tenantId!, user.sub, {
      entryDate: request.body.date,
      fromAccountName: request.body.from_account,
      toAccountName: request.body.to_account,
      amount: request.body.amount,
      note: request.body.note,
    });
    reply.code(201).send({ status: 'ok', transferCode: result.transferCode });
  });
}
