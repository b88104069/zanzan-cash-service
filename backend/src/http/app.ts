import jwtPlugin from '@fastify/jwt';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import { DomainError } from '../domain/errors.js';
import type { EntitlementService } from '../domain/entitlement/EntitlementService.js';
import type { AccountService } from '../domain/services/AccountService.js';
import type { AuthService } from '../domain/services/AuthService.js';
import type { CashEntryService } from '../domain/services/CashEntryService.js';
import type { CategoryService } from '../domain/services/CategoryService.js';
import type { ExportService } from '../domain/services/ExportService.js';
import type { TenantService } from '../domain/services/TenantService.js';
import type { TransferService } from '../domain/services/TransferService.js';
import { statusForDomainErrorCode } from './errorMapper.js';
import { registerAccountRoutes } from './routes/accounts.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerCashEntryRoutes } from './routes/cashEntries.js';
import { registerCategoryRoutes } from './routes/categories.js';
import { registerTenantRoutes } from './routes/tenants.js';
import { registerTransferRoutes } from './routes/transfers.js';
import type { JwtPayload } from './types.js';
import './types.js';

export interface AppDependencies {
  jwtSecret: string;
  authService: AuthService;
  entitlementService: EntitlementService;
  tenantService: TenantService;
  accountService: AccountService;
  categoryService: CategoryService;
  cashEntryService: CashEntryService;
  transferService: TransferService;
  exportService: ExportService;
}

/**
 * The authorization envelope every protected route goes through, in this
 * order, per docs/architecture/api-contract-principles.md #4 — no route
 * special-cases its own auth logic inline:
 *   1. authenticate  — 401 if not logged in
 *   2. requireEntitlement — 403 if not entitled (platform_admin bypasses)
 *   3. requireTenantContext — 400/403 if tenant context missing/invalid
 */
export function buildApp(deps: AppDependencies): FastifyInstance {
  const app = Fastify({ logger: false });

  app.register(jwtPlugin, { secret: deps.jwtSecret });

  app.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch {
      reply.code(401).send({ status: 'error', code: 'UNAUTHENTICATED', message: 'Authentication required.' });
    }
  });

  app.decorate('requireEntitlement', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as JwtPayload;
    if (user.role === 'platform_admin') return; // domain-boundaries.md: admin bypasses entitlement, still needs tenant

    let entitled: boolean;
    try {
      entitled = await deps.entitlementService.isEntitled(user.sub);
    } catch {
      // P4 / domain-boundaries.md: if the entitlement backend can't answer,
      // fail closed with an explicit "unavailable" status — parity with
      // the legacy 503 when the Subscriptions plugin itself is down,
      // rather than a generic 500 or (worse) silently granting access.
      reply.code(503).send({ status: 'error', code: 'ENTITLEMENT_SERVICE_UNAVAILABLE', message: 'Entitlement check is temporarily unavailable.' });
      return;
    }

    if (!entitled) {
      reply.code(403).send({ status: 'error', code: 'NOT_ENTITLED', message: 'An active subscription is required.' });
    }
  });

  app.decorate('requireTenantContext', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as JwtPayload;
    const tenantId = request.headers['x-tenant-id'];
    if (!tenantId || typeof tenantId !== 'string') {
      reply.code(400).send({ status: 'error', code: 'INVALID_TENANT_CONTEXT', message: 'Missing X-Tenant-Id header.' });
      return;
    }
    try {
      await deps.tenantService.assertMembership(tenantId, user.sub);
      request.tenantId = tenantId;
    } catch (error) {
      if (error instanceof DomainError) {
        reply.code(statusForDomainErrorCode(error.code)).send({ status: 'error', code: error.code, message: error.message });
        return;
      }
      throw error;
    }
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof DomainError) {
      reply.code(statusForDomainErrorCode(error.code)).send({ status: 'error', code: error.code, message: error.message });
      return;
    }
    reply.code(500).send({ status: 'error', code: 'INTERNAL_ERROR', message: 'Unexpected server error.' });
  });

  app.register(async (api) => {
    registerAuthRoutes(api, deps);
    registerTenantRoutes(api, deps);
    registerAccountRoutes(api, deps);
    registerCategoryRoutes(api, deps);
    registerCashEntryRoutes(api, deps);
    registerTransferRoutes(api, deps);
  }, { prefix: '/api/v1' });

  return app;
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireEntitlement: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireTenantContext: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
