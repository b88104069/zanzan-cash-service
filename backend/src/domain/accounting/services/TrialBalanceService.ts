import type { ChartOfAccountService } from './ChartOfAccountService.js';
import type { JournalEntryService } from './JournalEntryService.js';
import { normalBalanceOf, normalize } from './accountPresentation.js';
import { GL_ONLY_LIMITATION_NOTICE } from '../types.js';
import type { TrialBalanceReport } from '../types.js';

export interface TrialBalanceInput {
  /** Omit for an as-of report (beginning balance = 0 for every account, i.e. "since inception through asOfDate"). */
  fromDate?: string;
  asOfDate: string;
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
  ) {}

  async getTrialBalance(tenantId: string, input: TrialBalanceInput): Promise<TrialBalanceReport> {
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
        const beforePeriod = input.fromDate !== undefined && entry.entryDate < input.fromDate;
        const withinPeriod = (input.fromDate === undefined || entry.entryDate >= input.fromDate) && entry.entryDate <= input.asOfDate;

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
      fromDate: input.fromDate,
      asOfDate: input.asOfDate,
      lines,
      totalPeriodDebit,
      totalPeriodCredit,
      limitationNotice: GL_ONLY_LIMITATION_NOTICE,
    };
  }
}
