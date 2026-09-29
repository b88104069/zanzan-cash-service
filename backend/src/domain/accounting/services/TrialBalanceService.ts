import type { ChartOfAccountService } from './ChartOfAccountService.js';
import type { FiscalPeriodService } from './FiscalPeriodService.js';
import type { JournalEntryService } from './JournalEntryService.js';
import { normalBalanceOf, normalize } from './accountPresentation.js';
import { GL_ONLY_LIMITATION_NOTICE } from '../types.js';
import type { TrialBalanceReport } from '../types.js';

export interface TrialBalanceInput {
  /** Omit for an as-of report (beginning balance = 0 for every account, i.e. "since inception through asOfDate"). Ignored when fiscalPeriodId is given. */
  fromDate?: string;
  asOfDate?: string;
  /**
   * v0.3: resolve fromDate/asOfDate from a FiscalPeriod instead of explicit
   * dates — fromDate = period.startDate, asOfDate = period.endDate.
   * Identical result to passing those dates explicitly (single source of
   * truth, never a second calculation). When given, fromDate/asOfDate above
   * are ignored.
   */
  fiscalPeriodId?: string;
}

/**
 * Trial Balance — beginning / period / ending balances per ChartOfAccount,
 * derived read-only from JournalEntry/JournalLine. Approved shape (Gate
 * Review MUST FIX): NOT a bare "debit/credit sum within a date range" —
 * that would be a period-activity report, not a Trial Balance. Dates
 * compare against JournalEntry.entryDate, never createdAt.
 */
export class TrialBalanceService {
  constructor(
    private readonly journalEntryService: JournalEntryService,
    private readonly chartOfAccountService: ChartOfAccountService,
    private readonly fiscalPeriodService?: FiscalPeriodService,
  ) {}

  async getTrialBalance(tenantId: string, input: TrialBalanceInput): Promise<TrialBalanceReport> {
    let fromDate = input.fromDate;
    let asOfDate = input.asOfDate;
    if (input.fiscalPeriodId !== undefined) {
      const period = await this.fiscalPeriodService!.getFiscalPeriod(tenantId, input.fiscalPeriodId);
      fromDate = period.startDate;
      asOfDate = period.endDate;
    }
    if (asOfDate === undefined) {
      throw new Error('TrialBalanceService.getTrialBalance requires either asOfDate or fiscalPeriodId');
    }

    const [accounts, entries] = await Promise.all([
      this.chartOfAccountService.listChartOfAccounts(tenantId),
      this.journalEntryService.listJournalEntries(tenantId),
    ]);

    let totalPeriodDebit = 0;
    let totalPeriodCredit = 0;

    const lines = accounts.map((account) => {
      let rawBeginning = 0;
      let periodDebit = 0;
      let periodCredit = 0;

      for (const entry of entries) {
        const beforePeriod = fromDate !== undefined && entry.entryDate < fromDate;
        const withinPeriod = (fromDate === undefined || entry.entryDate >= fromDate) && entry.entryDate <= asOfDate;

        for (const line of entry.lines) {
          if (line.chartOfAccountId !== account.id) continue;
          if (beforePeriod) {
            rawBeginning += line.debit - line.credit;
          } else if (withinPeriod) {
            periodDebit += line.debit;
            periodCredit += line.credit;
          }
        }
      }

      const rawEnding = rawBeginning + periodDebit - periodCredit;
      totalPeriodDebit += periodDebit;
      totalPeriodCredit += periodCredit;

      return {
        chartOfAccountId: account.id,
        code: account.code,
        name: account.name,
        type: account.type,
        normalBalance: normalBalanceOf(account.type),
        beginningBalance: normalize(rawBeginning, account.type),
        periodDebit,
        periodCredit,
        endingBalance: normalize(rawEnding, account.type),
      };
    });

    return {
      tenantId,
      fromDate,
      asOfDate,
      fiscalPeriodId: input.fiscalPeriodId,
      lines,
      totalPeriodDebit,
      totalPeriodCredit,
      limitationNotice: GL_ONLY_LIMITATION_NOTICE,
    };
  }
}
