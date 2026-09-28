import type { CashEntryFilter, CashEntryRepository } from '../repositories/CashEntryRepository.js';

export interface CsvRow {
  entryDate: string;
  account: string;
  category: string;
  memo: string;
  income: number;
  expense: number;
  note: string;
}

/**
 * Parity source: zzscs_api_cash_export. Reuses CashEntryRepository.listByFilter
 * directly — the same method CashEntryService.listEntries calls — so list
 * and export can never drift apart (docs/architecture/api-contract-principles.md
 * principle 3). This service only shapes the CSV row projection; it does not
 * duplicate any filter-building logic.
 */
export class ExportService {
  constructor(private readonly entries: CashEntryRepository) {}

  /** CSV1 — same filtered/sorted rows as the list endpoint, projected to CSV columns. */
  async getCsvRows(tenantId: string, filter: CashEntryFilter): Promise<CsvRow[]> {
    const rows = await this.entries.listByFilter(tenantId, filter);
    return rows.map((row) => ({
      entryDate: row.entryDate,
      account: row.accountName,
      category: row.category,
      memo: row.memo,
      income: row.income,
      expense: row.expense,
      note: row.note,
    }));
  }
}
