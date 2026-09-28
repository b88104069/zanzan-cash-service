import type { CashEntry } from '../types.js';

export interface CashEntryFilter {
  startDate?: string;
  endDate?: string;
  keyword?: string;
  order?: 'asc' | 'desc';
  limit?: number;
}

export interface CashEntryWithAccountName extends CashEntry {
  accountName: string;
}

export interface AmountTotals {
  income: number;
  expense: number;
}

// listByFilter/countByFilter back both the list endpoint and the CSV export
// endpoint — see docs/architecture/api-contract-principles.md principle 3
// ("one shared query builder for list vs export"). ExportService and
// CashEntryService.list must call the same method here, never duplicate
// filter-building logic themselves.
export interface CashEntryRepository {
  create(entry: Omit<CashEntry, 'id' | 'createdAt'> & { createdAt: Date }): Promise<CashEntry>;
  /** Atomic paired insert for a transfer — both rows or neither. */
  createTransferPair(
    outEntry: Omit<CashEntry, 'id' | 'createdAt'> & { createdAt: Date },
    inEntry: Omit<CashEntry, 'id' | 'createdAt'> & { createdAt: Date },
  ): Promise<[CashEntry, CashEntry]>;

  findById(tenantId: string, entryId: string): Promise<CashEntry | null>;
  update(tenantId: string, entryId: string, patch: Partial<Pick<CashEntry, 'entryDate' | 'memo' | 'category' | 'accountId' | 'income' | 'expense' | 'note'>>): Promise<CashEntry>;
  deleteById(tenantId: string, entryId: string): Promise<number>;

  countByTransferCode(tenantId: string, transferCode: string): Promise<number>;
  /** Deletes every row sharing this transfer_code for this tenant, atomically. Returns the count deleted. */
  deleteByTransferCode(tenantId: string, transferCode: string): Promise<number>;

  listByFilter(tenantId: string, filter: CashEntryFilter): Promise<CashEntryWithAccountName[]>;

  /** Lifetime totals, EXCLUDING transfer-linked entries (parity with zzscs_api_cash_summary). */
  getLifetimeTotals(tenantId: string): Promise<AmountTotals>;
  /** Totals within [startDate, endDate] inclusive, EXCLUDING transfer-linked entries. */
  getRangeTotals(tenantId: string, startDate: string, endDate: string): Promise<AmountTotals>;
  /** Totals for one account, INCLUDING transfer-linked entries (parity with zzscs_api_account_summary balance formula). */
  getAccountTotals(tenantId: string, accountId: string): Promise<AmountTotals>;
}
