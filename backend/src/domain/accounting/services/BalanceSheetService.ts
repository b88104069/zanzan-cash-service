import type { ChartOfAccountService } from './ChartOfAccountService.js';
import type { FiscalPeriodService } from './FiscalPeriodService.js';
import type { IncomeStatementService } from './IncomeStatementService.js';
import type { JournalEntryService } from './JournalEntryService.js';
import { normalBalanceOf, normalize } from './accountPresentation.js';
import { GL_ONLY_LIMITATION_NOTICE } from '../types.js';
import type { BalanceSheetLine, BalanceSheetReport } from '../types.js';

export interface BalanceSheetInput {
  asOfDate?: string;
  /**
   * v0.3: resolve asOfDate from a FiscalPeriod — as-of = period.endDate
   * ONLY. Balance Sheet is an as-of statement, not a range statement, so
   * period.startDate is never used here. When given, asOfDate above is
   * ignored. currentEarnings below still accumulates since inception
   * through that endDate — fiscalPeriodId never narrows Current Earnings
   * to just that period's activity (that would break the v0.2 balance
   * invariant, since v0.1 posts no closing entries).
   */
  fiscalPeriodId?: string;
}

/**
 * Balance Sheet (資產負債表) — asset/liability/equity ChartOfAccounts as of
 * a date, plus a presentation-only Current Earnings line (Gate Review MUST
 * FIX: without it, Assets would not equal Liabilities + Equity, since v0.1
 * posts no closing entries and revenue/expense balances never move into
 * equity). currentEarnings is always computed via IncomeStatementService
 * for the same asOfDate — never a separate calculation, so it can never
 * drift from what the Income Statement itself reports.
 */
export class BalanceSheetService {
  constructor(
    private readonly journalEntryService: JournalEntryService,
    private readonly chartOfAccountService: ChartOfAccountService,
    private readonly incomeStatementService: IncomeStatementService,
    private readonly fiscalPeriodService?: FiscalPeriodService,
  ) {}

  /** `asOfDateOrInput` accepts a plain ISO date (v0.2 explicit-date call, unchanged) or a v0.3 input object with fiscalPeriodId. */
  async getBalanceSheet(tenantId: string, asOfDateOrInput: string | BalanceSheetInput): Promise<BalanceSheetReport> {
    const input: BalanceSheetInput = typeof asOfDateOrInput === 'string' ? { asOfDate: asOfDateOrInput } : asOfDateOrInput;

    let asOfDate = input.asOfDate;
    if (input.fiscalPeriodId !== undefined) {
      const period = await this.fiscalPeriodService!.getFiscalPeriod(tenantId, input.fiscalPeriodId);
      asOfDate = period.endDate;
    }
    if (asOfDate === undefined) {
      throw new Error('BalanceSheetService.getBalanceSheet requires either asOfDate or fiscalPeriodId');
    }

    const [accounts, entries, incomeStatement] = await Promise.all([
      this.chartOfAccountService.listChartOfAccounts(tenantId),
      this.journalEntryService.listJournalEntries(tenantId),
      this.incomeStatementService.getIncomeStatement(tenantId, { toDate: asOfDate }),
    ]);

    const relevantEntries = entries.filter((entry) => entry.entryDate <= asOfDate);

    function balanceFor(chartOfAccountId: string): number {
      let raw = 0;
      for (const entry of relevantEntries) {
        for (const line of entry.lines) {
          if (line.chartOfAccountId === chartOfAccountId) raw += line.debit - line.credit;
        }
      }
      return raw;
    }

    const toLine = (account: (typeof accounts)[number]): BalanceSheetLine => ({
      chartOfAccountId: account.id,
      code: account.code,
      name: account.name,
      type: account.type as 'asset' | 'liability' | 'equity',
      normalBalance: normalBalanceOf(account.type),
      balance: normalize(balanceFor(account.id), account.type),
    });

    const assetLines = accounts.filter((a) => a.type === 'asset').map(toLine);
    const liabilityLines = accounts.filter((a) => a.type === 'liability').map(toLine);
    const equityLines = accounts.filter((a) => a.type === 'equity').map(toLine);

    const totalAssets = assetLines.reduce((sum, l) => sum + l.balance, 0);
    const totalLiabilities = liabilityLines.reduce((sum, l) => sum + l.balance, 0);
    const totalEquity = equityLines.reduce((sum, l) => sum + l.balance, 0);
    const currentEarnings = incomeStatement.netIncome;

    return {
      tenantId,
      asOfDate,
      fiscalPeriodId: input.fiscalPeriodId,
      assetLines,
      liabilityLines,
      equityLines,
      totalAssets,
      totalLiabilities,
      totalEquity,
      currentEarnings,
      totalLiabilitiesAndEquity: totalLiabilities + totalEquity + currentEarnings,
      limitationNotice: GL_ONLY_LIMITATION_NOTICE,
    };
  }
}
