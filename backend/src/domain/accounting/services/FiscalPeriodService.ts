import { AccountingError } from '../errors.js';
import type { FiscalPeriodRepository } from '../repositories/FiscalPeriodRepository.js';
import type { FiscalPeriod } from '../types.js';

export interface CreateFiscalPeriodInput {
  name: string;
  startDate: string; // ISO date, inclusive
  endDate: string; // ISO date, inclusive
}

/**
 * Fiscal Period management (v0.3) — create/list/close only, no reopen.
 * Periods partition time per tenant: creating one rejects any date-range
 * overlap with an existing period of the SAME tenant, but identical ranges
 * across different tenants are unrelated and both allowed (tenant
 * isolation). Closing is one-directional and purely a lock flag — it never
 * posts a JournalEntry, never touches GL data. See
 * docs/architecture/accounting-module-v0.3.md.
 */
export class FiscalPeriodService {
  constructor(private readonly fiscalPeriods: FiscalPeriodRepository) {}

  async createFiscalPeriod(tenantId: string, input: CreateFiscalPeriodInput): Promise<FiscalPeriod> {
    if (input.startDate > input.endDate) {
      throw new AccountingError('FISCAL_PERIOD_INVALID_RANGE', '會計期間的結束日不可早於起始日。');
    }

    const existing = await this.fiscalPeriods.listByTenant(tenantId);
    const overlaps = existing.some((p) => p.startDate <= input.endDate && input.startDate <= p.endDate);
    if (overlaps) {
      throw new AccountingError('FISCAL_PERIOD_OVERLAPS', '此日期區間與現有會計期間重疊。');
    }

    return this.fiscalPeriods.create({
      tenantId,
      name: input.name,
      startDate: input.startDate,
      endDate: input.endDate,
      status: 'open',
      createdAt: new Date(),
    });
  }

  async listFiscalPeriods(tenantId: string): Promise<FiscalPeriod[]> {
    return this.fiscalPeriods.listByTenant(tenantId);
  }

  async getFiscalPeriod(tenantId: string, id: string): Promise<FiscalPeriod> {
    const period = await this.fiscalPeriods.findById(tenantId, id);
    if (!period) throw new AccountingError('FISCAL_PERIOD_NOT_FOUND', '找不到指定的會計期間。');
    return period;
  }

  /** One-way close: sets status='closed' + closedAt. Throws if already closed rather than silently no-op-ing, so callers never observe two different "already closed" states. No reopen in v0.3. */
  async closePeriod(tenantId: string, id: string): Promise<FiscalPeriod> {
    const period = await this.getFiscalPeriod(tenantId, id);
    if (period.status === 'closed') {
      throw new AccountingError('FISCAL_PERIOD_ALREADY_CLOSED', '此會計期間已經關帳。');
    }
    return this.fiscalPeriods.update({ ...period, status: 'closed', closedAt: new Date() });
  }

  /** Used by JournalEntryService to enforce the closed-period posting lock. Inclusive boundary: startDate <= date <= endDate. A date outside every defined period is never considered closed. */
  async isDateInClosedPeriod(tenantId: string, date: string): Promise<boolean> {
    const periods = await this.fiscalPeriods.listByTenant(tenantId);
    return periods.some((p) => p.status === 'closed' && p.startDate <= date && date <= p.endDate);
  }
}
