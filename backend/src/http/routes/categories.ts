import type { FastifyInstance } from 'fastify';
import type { CategoryType } from '../../domain/types.js';
import type { AppDependencies } from '../app.js';

interface CategoryBody {
  categoryName: string;
  categoryType?: CategoryType;
}

export function registerCategoryRoutes(app: FastifyInstance, deps: AppDependencies): void {
  const guard = [app.authenticate, app.requireEntitlement, app.requireTenantContext];

  app.get('/categories', { preHandler: guard }, async (request) => {
    const categories = await deps.categoryService.listActiveCategories(request.tenantId!);
    return { status: 'ok', data: categories.map((c) => ({ name: c.categoryName, type: c.categoryType })) };
  });

  app.get('/categories/admin', { preHandler: guard }, async (request) => {
    const categories = await deps.categoryService.listForAdmin(request.tenantId!);
    return { status: 'ok', data: categories };
  });

  app.post<{ Body: CategoryBody }>('/categories', { preHandler: guard }, async (request, reply) => {
    const category = await deps.categoryService.createCategory(request.tenantId!, request.body);
    reply.code(201).send({ status: 'ok', data: category });
  });

  app.put<{ Params: { id: string }; Body: CategoryBody }>('/categories/:id', { preHandler: guard }, async (request) => {
    const category = await deps.categoryService.updateCategory(request.tenantId!, request.params.id, request.body);
    return { status: 'ok', data: category };
  });

  app.post<{ Params: { id: string } }>('/categories/:id/disable', { preHandler: guard }, async (request) => {
    await deps.categoryService.disableCategory(request.tenantId!, request.params.id);
    return { status: 'ok' };
  });

  app.post<{ Params: { id: string } }>('/categories/:id/enable', { preHandler: guard }, async (request) => {
    await deps.categoryService.enableCategory(request.tenantId!, request.params.id);
    return { status: 'ok' };
  });
}
