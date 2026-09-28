import type { FastifyInstance } from 'fastify';
import type { AppDependencies } from '../app.js';
import type { JwtPayload } from '../types.js';

interface CreateTenantBody {
  companyName: string;
}

/**
 * Tenant routes deliberately do NOT go through requireTenantContext — they
 * are how a user gets/creates a tenant in the first place. Parity source:
 * zzscs_api_tenant_permission_check (login + entitlement, no tenant
 * requirement), as opposed to zzscs_api_permission_check used everywhere
 * else. See docs/architecture/domain-boundaries.md → Tenant.
 */
export function registerTenantRoutes(app: FastifyInstance, deps: AppDependencies): void {
  app.get('/tenants', { preHandler: [app.authenticate, app.requireEntitlement] }, async (request) => {
    const user = request.user as JwtPayload;
    const tenants = await deps.tenantService.listTenantsForUser(user.sub);
    return { status: 'ok', data: tenants };
  });

  app.post<{ Body: CreateTenantBody }>(
    '/tenants',
    { preHandler: [app.authenticate, app.requireEntitlement] },
    async (request, reply) => {
      const user = request.user as JwtPayload;
      const tenant = await deps.tenantService.createTenant({ ownerUserId: user.sub, companyName: request.body.companyName });
      reply.code(201).send({ status: 'ok', data: tenant });
    },
  );
}
