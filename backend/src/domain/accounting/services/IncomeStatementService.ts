import type { ChartOfAccountService } from './ChartOfAccountService.js';
import type { JournalEntryService } from './JournalEntryService.js';
import { normalize } from './accountPresentation.js';
import { GL_ONLY_LIMITATION_NOTICE } from '../types.js';
import type { IncomeStatementLine, IncomeStatementReport } from '../types.js';

export interface IncomeStatementInput {
  /** Omit for "since inception through toDate". */
  fromDate?: string;
  toDate: string;
}

/** Income Statement (損益表) — revenue vs. expense ChartOfAccounts over a date range, read-only derived from JournalEntry/JournalLine. */
export class IncomeStatementService {
  constructor(
    private readonly journalEntryService: JournalEntryService,
    private readonly chartOfAccountService: ChartOfAccountService,
  ) {}

  async getIncomeStatement(tenantId: string, input: IncomeStatementInput): Promise<IncomeStatementReport> {
    const [accounts, entries] = await Promise.all([
      this.chartOfAccountService.listChartOfAccounts(tenantId),
      this.journalEntryService.listJournalEntries(tenantId),
    ]);

    const relevantEntries = entries.filter(
      (entry) => (input.fromDate === undefined || entry.entryDate >= input.fromDate) && entry.entryDate <= input.toDate,
    );

    const revenueLines: IncomeStatementLine[] = [];
    const expenseLines: IncomeStatementLine[] = [];

    for (const account of accounts) {
      if (account.type !== 'revenue' && account.type !== 'expense') continue;

      let raw = 0;
      for (const entry of relevantEntries) {
        for (const line of entry.lines) {
          if (line.chartOfAccountId === account.id) raw += line.debit - line.credit;
        }
      }

      const amount = normalize(raw, account.type);
      const line: IncomeStatementLine = { chartOfAccountId: account.id, code: account.code, name: account.name, type: account.type, amount };
      if (account.type === 'revenue') revenueLines.push(line);
      else expenseLines.push(line);
    }

    const totalRevenue = revenueLines.reduce((sum, l) => sum + l.amount, 0);
    const totalExpense = expenseLines.reduce((sum, l) => sum + l.amount, 0);

    return {
      tenantId,
      fromDate: input.fromDate,
      toDate: input.toDate,
      revenueLines,
      expenseLines,
      totalRevenue,
      totalExpense,
      netIncome: totalRevenue - totalExpense,
      limitationNotice: GL_ONLY_LIMITATION_NOTICE,
    };
  }
}
