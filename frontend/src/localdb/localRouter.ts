import { DomainError } from '../../../backend/src/domain/errors.js';
import type { CashEntryFilter } from '../../../backend/src/domain/repositories/CashEntryRepository.js';
import type { CategoryType } from '../../../backend/src/domain/types.js';
import { ApiError, type RequestOptions } from '../api/client.js';
import { LOCAL_USER_ID, type LocalServices } from './services.js';

// Mirrors backend/src/http/routes/*.ts route-by-route (same paths, same
// request/response shapes) but dispatches directly to the imported domain
// services instead of going over HTTP — this is the "prototype-only browser
// adapter" the Gate 5 (ACTIVE) contract calls for, replacing the
// frontend → HTTP API → MySQL path without touching the business rules
// behind it. Deliberately NOT proxying every backend route (no /tenants,
// no /auth/*) since this Gate has no login and no multi-tenant switching.

function parseFilter(query?: RequestOptions['query']): CashEntryFilter {
  return {
    startDate: query?.start_date as string | undefined,
    endDate: query?.end_date as string | undefined,
    keyword: query?.keyword as string | undefined,
    order: query?.order === 'asc' ? 'asc' : 'desc',
    limit: query?.limit ? Number(query.limit) : undefined,
  };
}

function match(path: string, pattern: string): Record<string, string> | null {
  const pathParts = path.split('/').filter(Boolean);
  const patternParts = pattern.split('/').filter(Boolean);
  if (pathParts.length !== patternParts.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    const p = patternParts[i]!;
    const v = pathParts[i]!;
    if (p.startsWith(':')) params[p.slice(1)] = v;
    else if (p !== v) return null;
  }
  return params;
}

export async function localApiCall<T>(services: LocalServices, path: string, options: RequestOptions = {}): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase();
  const tenantId = services.tenantId;
  const body = (options.body ?? {}) as Record<string, unknown>;
  let params: Record<string, string> | null;

  try {
    // --- accounts ---
    if (method === 'GET' && (params = match(path, '/accounts'))) {
      return { status: 'ok', data: await services.accountService.listActiveAccountNames(tenantId) } as T;
    }
    if (method === 'GET' && (params = match(path, '/accounts/admin'))) {
      return { status: 'ok', data: await services.accountService.listForAdmin(tenantId) } as T;
    }
    if (method === 'GET' && (params = match(path, '/accounts/summary'))) {
      return { status: 'ok', data: await services.accountService.getAccountSummaries(tenantId) } as T;
    }
    if (method === 'POST' && (params = match(path, '/accounts'))) {
      const result = { status: 'ok', data: await services.accountService.createAccount(tenantId, body as never) };
      services.save();
      return result as T;
    }
    if (method === 'PUT' && (params = match(path, '/accounts/:id'))) {
      const result = { status: 'ok', data: await services.accountService.updateAccount(tenantId, params.id!, body as never) };
      services.save();
      return result as T;
    }
    if (method === 'POST' && (params = match(path, '/accounts/:id/disable'))) {
      await services.accountService.disableAccount(tenantId, params.id!);
      services.save();
      return { status: 'ok' } as T;
    }
    if (method === 'POST' && (params = match(path, '/accounts/:id/enable'))) {
      await services.accountService.enableAccount(tenantId, params.id!);
      services.save();
      return { status: 'ok' } as T;
    }

    // --- categories ---
    if (method === 'GET' && (params = match(path, '/categories'))) {
      const categories = await services.categoryService.listActiveCategories(tenantId);
      return { status: 'ok', data: categories.map((c) => ({ name: c.categoryName, type: c.categoryType })) } as T;
    }
    if (method === 'GET' && (params = match(path, '/categories/admin'))) {
      return { status: 'ok', data: await services.categoryService.listForAdmin(tenantId) } as T;
    }
    if (method === 'POST' && (params = match(path, '/categories'))) {
      const result = {
        status: 'ok',
        data: await services.categoryService.createCategory(tenantId, {
          categoryName: body.categoryName as string,
          categoryType: body.categoryType as CategoryType,
        }),
      };
      services.save();
      return result as T;
    }
    if (method === 'PUT' && (params = match(path, '/categories/:id'))) {
      const result = {
        status: 'ok',
        data: await services.categoryService.updateCategory(tenantId, params.id!, {
          categoryName: body.categoryName as string,
          categoryType: body.categoryType as CategoryType,
        }),
      };
      services.save();
      return result as T;
    }
    if (method === 'POST' && (params = match(path, '/categories/:id/disable'))) {
      await services.categoryService.disableCategory(tenantId, params.id!);
      services.save();
      return { status: 'ok' } as T;
    }
    if (method === 'POST' && (params = match(path, '/categories/:id/enable'))) {
      await services.categoryService.enableCategory(tenantId, params.id!);
      services.save();
      return { status: 'ok' } as T;
    }

    // --- cash entries ---
    if (method === 'GET' && (params = match(path, '/cash-entries'))) {
      return { status: 'ok', data: await services.cashEntryService.listEntries(tenantId, parseFilter(options.query)) } as T;
    }
    if (method === 'GET' && (params = match(path, '/cash-entries/summary'))) {
      const summary = await services.cashEntryService.getSummary(tenantId);
      return { status: 'ok', ...summary } as T;
    }
    if (method === 'POST' && (params = match(path, '/cash-entries'))) {
      const result = {
        status: 'ok',
        data: await services.cashEntryService.addEntry(tenantId, LOCAL_USER_ID, {
          entryDate: body.date as string,
          memo: body.memo as string,
          category: body.category as string,
          accountName: body.account as string,
          income: Number(body.income),
          expense: Number(body.expense),
          note: body.note as string | undefined,
        }),
      };
      services.save();
      return result as T;
    }
    if (method === 'PUT' && (params = match(path, '/cash-entries/:id'))) {
      const result = {
        status: 'ok',
        data: await services.cashEntryService.updateEntry(tenantId, params.id!, {
          entryDate: body.date as string,
          memo: body.memo as string,
          category: body.category as string,
          accountName: body.account as string,
          income: Number(body.income),
          expense: Number(body.expense),
          note: body.note as string | undefined,
        }),
      };
      services.save();
      return result as T;
    }
    if (method === 'DELETE' && (params = match(path, '/cash-entries/:id'))) {
      const result = { status: 'ok', ...(await services.cashEntryService.deleteEntry(tenantId, params.id!)) };
      services.save();
      return result as T;
    }

    // --- transfers ---
    if (method === 'POST' && (params = match(path, '/transfers'))) {
      const result = await services.transferService.createTransfer(tenantId, LOCAL_USER_ID, {
        entryDate: body.date as string,
        fromAccountName: body.from_account as string,
        toAccountName: body.to_account as string,
        amount: Number(body.amount),
        note: body.note as string | undefined,
      });
      services.save();
      return { status: 'ok', transferCode: result.transferCode } as T;
    }

    throw new Error(`No local route for ${method} ${path}`);
  } catch (error) {
    if (error instanceof DomainError) {
      throw new ApiError(400, error.code, error.message);
    }
    throw error;
  }
}

export async function localCsvExport(services: LocalServices, query?: RequestOptions['query']) {
  return services.exportService.getCsvRows(services.tenantId, parseFilter(query));
}
