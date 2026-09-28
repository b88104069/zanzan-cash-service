import type { FastifyInstance } from 'fastify';
import type { CashEntryFilter } from '../../domain/repositories/CashEntryRepository.js';
import type { AppDependencies } from '../app.js';
import type { JwtPayload } from '../types.js';

interface CashEntryBody {
  date: string;
  memo: string;
  category: string;
  account: string;
  income: number;
  expense: number;
  note?: string;
}

interface ListQuery {
  start_date?: string;
  end_date?: string;
  keyword?: string;
  order?: 'asc' | 'desc';
  limit?: string;
}

function parseFilter(query: ListQuery): CashEntryFilter {
  return {
    startDate: query.start_date,
    endDate: query.end_date,
    keyword: query.keyword,
    order: query.order === 'asc' ? 'asc' : 'desc',
    limit: query.limit ? Number(query.limit) : undefined,
  };
}

function toCsv(rows: { entryDate: string; account: string; category: string; memo: string; income: number; expense: number; note: string }[]): string {
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const header = ['日期', '帳戶', '科目', '摘要', '收入', '支出', '備註'].map(escape).join(',');
  const lines = rows.map((r) =>
    [r.entryDate, r.account, r.category, r.memo, String(r.income), String(r.expense), r.note].map(escape).join(','),
  );
  return ['﻿' + header, ...lines].join('\r\n');
}

export function registerCashEntryRoutes(app: FastifyInstance, deps: AppDependencies): void {
  const guard = [app.authenticate, app.requireEntitlement, app.requireTenantContext];

  app.get<{ Querystring: ListQuery }>('/cash-entries', { preHandler: guard }, async (request) => {
    const rows = await deps.cashEntryService.listEntries(request.tenantId!, parseFilter(request.query));
    return { status: 'ok', data: rows };
  });

  app.get('/cash-entries/summary', { preHandler: guard }, async (request) => {
    const summary = await deps.cashEntryService.getSummary(request.tenantId!);
    return { status: 'ok', ...summary };
  });

  app.get<{ Querystring: ListQuery }>('/cash-entries/export', { preHandler: guard }, async (request, reply) => {
    const rows = await deps.exportService.getCsvRows(request.tenantId!, parseFilter(request.query));
    reply
      .header('Content-Type', 'text/csv; charset=UTF-8')
      .header('Content-Disposition', `attachment; filename="cash-export-${Date.now()}.csv"`)
      .send(toCsv(rows.map((r) => ({ ...r, note: r.note }))));
  });

  app.post<{ Body: CashEntryBody }>('/cash-entries', { preHandler: guard }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const entry = await deps.cashEntryService.addEntry(request.tenantId!, user.sub, {
      entryDate: request.body.date,
      memo: request.body.memo,
      category: request.body.category,
      accountName: request.body.account,
      income: request.body.income,
      expense: request.body.expense,
      note: request.body.note,
    });
    reply.code(201).send({ status: 'ok', data: entry });
  });

  app.put<{ Params: { id: string }; Body: CashEntryBody }>('/cash-entries/:id', { preHandler: guard }, async (request) => {
    const entry = await deps.cashEntryService.updateEntry(request.tenantId!, request.params.id, {
      entryDate: request.body.date,
      memo: request.body.memo,
      category: request.body.category,
      accountName: request.body.account,
      income: request.body.income,
      expense: request.body.expense,
      note: request.body.note,
    });
    return { status: 'ok', data: entry };
  });

  app.delete<{ Params: { id: string } }>('/cash-entries/:id', { preHandler: guard }, async (request) => {
    const result = await deps.cashEntryService.deleteEntry(request.tenantId!, request.params.id);
    return { status: 'ok', ...result };
  });
}
