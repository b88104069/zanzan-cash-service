import type {
  AmountTotals,
  CashEntryFilter,
  CashEntryRepository,
  CashEntryWithAccountName,
} from '../../domain/repositories/CashEntryRepository.js';
import type { CashEntry } from '../../domain/types.js';
import { generateId, InMemoryDatabase } from './InMemoryDatabase.js';

function isTransfer(entry: CashEntry): boolean {
  return Boolean(entry.transferCode);
}

export class InMemoryCashEntryRepository implements CashEntryRepository {
  constructor(private readonly db: InMemoryDatabase) {}

  async create(entry: Omit<CashEntry, 'id' | 'createdAt'> & { createdAt: Date }): Promise<CashEntry> {
    const row: CashEntry = { ...entry, id: generateId('entry') };
    this.db.entries.set(row.id, row);
    return row;
  }

  async createTransferPair(
    outEntry: Omit<CashEntry, 'id' | 'createdAt'> & { createdAt: Date },
    inEntry: Omit<CashEntry, 'id' | 'createdAt'> & { createdAt: Date },
  ): Promise<[CashEntry, CashEntry]> {
    // Both-or-nothing: build both rows before mutating the store, so a
    // construction error can never leave one row inserted without its pair.
    const outRow: CashEntry = { ...outEntry, id: generateId('entry') };
    const inRow: CashEntry = { ...inEntry, id: generateId('entry') };
    this.db.entries.set(outRow.id, outRow);
    this.db.entries.set(inRow.id, inRow);
    return [outRow, inRow];
  }

  async findById(tenantId: string, entryId: string): Promise<CashEntry | null> {
    const row = this.db.entries.get(entryId);
    return row && row.tenantId === tenantId ? row : null;
  }

  async update(
    tenantId: string,
    entryId: string,
    patch: Partial<Pick<CashEntry, 'entryDate' | 'memo' | 'category' | 'accountId' | 'income' | 'expense' | 'note'>>,
  ): Promise<CashEntry> {
    const row = await this.findById(tenantId, entryId);
    if (!row) throw new Error(`Entry ${entryId} not found for tenant ${tenantId}`);
    const updated = { ...row, ...patch };
    this.db.entries.set(entryId, updated);
    return updated;
  }

  async deleteById(tenantId: string, entryId: string): Promise<number> {
    const row = await this.findById(tenantId, entryId);
    if (!row) return 0;
    this.db.entries.delete(entryId);
    return 1;
  }

  async countByTransferCode(tenantId: string, transferCode: string): Promise<number> {
    let count = 0;
    for (const entry of this.db.entries.values()) {
      if (entry.tenantId === tenantId && entry.transferCode === transferCode) count++;
    }
    return count;
  }

  async deleteByTransferCode(tenantId: string, transferCode: string): Promise<number> {
    const toDelete = [...this.db.entries.values()].filter(
      (e) => e.tenantId === tenantId && e.transferCode === transferCode,
    );
    for (const entry of toDelete) this.db.entries.delete(entry.id);
    return toDelete.length;
  }

  async listByFilter(tenantId: string, filter: CashEntryFilter): Promise<CashEntryWithAccountName[]> {
    let rows = [...this.db.entries.values()].filter((e) => e.tenantId === tenantId);

    if (filter.startDate) rows = rows.filter((e) => e.entryDate >= filter.startDate!);
    if (filter.endDate) rows = rows.filter((e) => e.entryDate <= filter.endDate!);
    if (filter.keyword) {
      const kw = filter.keyword.toLowerCase();
      rows = rows.filter((e) => {
        const account = this.db.accounts.get(e.accountId);
        return (
          e.memo.toLowerCase().includes(kw) ||
          e.category.toLowerCase().includes(kw) ||
          e.note.toLowerCase().includes(kw) ||
          (account?.accountName.toLowerCase().includes(kw) ?? false)
        );
      });
    }

    const order = filter.order === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      const dateCompare = a.entryDate.localeCompare(b.entryDate);
      if (dateCompare !== 0) return dateCompare * order;
      return a.id.localeCompare(b.id) * order;
    });

    if (filter.limit && filter.limit > 0) rows = rows.slice(0, filter.limit);

    return rows.map((row) => ({
      ...row,
      accountName: this.db.accounts.get(row.accountId)?.accountName ?? '',
    }));
  }

  async getLifetimeTotals(tenantId: string): Promise<AmountTotals> {
    return this.sum(
      [...this.db.entries.values()].filter((e) => e.tenantId === tenantId && !isTransfer(e)),
    );
  }

  async getRangeTotals(tenantId: string, startDate: string, endDate: string): Promise<AmountTotals> {
    return this.sum(
      [...this.db.entries.values()].filter(
        (e) => e.tenantId === tenantId && !isTransfer(e) && e.entryDate >= startDate && e.entryDate <= endDate,
      ),
    );
  }

  async getAccountTotals(tenantId: string, accountId: string): Promise<AmountTotals> {
    return this.sum(
      [...this.db.entries.values()].filter((e) => e.tenantId === tenantId && e.accountId === accountId),
    );
  }

  private sum(rows: CashEntry[]): AmountTotals {
    return rows.reduce<AmountTotals>(
      (acc, row) => ({ income: acc.income + row.income, expense: acc.expense + row.expense }),
      { income: 0, expense: 0 },
    );
  }
}
