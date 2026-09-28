import type { Prisma, PrismaClient } from '@prisma/client';
import type {
  AmountTotals,
  CashEntryFilter,
  CashEntryRepository,
  CashEntryWithAccountName,
} from '../../domain/repositories/CashEntryRepository.js';
import type { CashEntry } from '../../domain/types.js';
import { decimalToNumber, entryDateFromDb, entryDateToDb } from './mappers.js';

type EntryRow = {
  id: string;
  tenantId: string;
  entryDate: Date;
  memo: string;
  category: string;
  accountId: string;
  income: unknown;
  expense: unknown;
  note: string | null;
  transferCode: string | null;
  createdBy: string;
  createdAt: Date;
};

function toDomain(row: EntryRow): CashEntry {
  return {
    id: row.id,
    tenantId: row.tenantId,
    entryDate: entryDateFromDb(row.entryDate),
    memo: row.memo,
    category: row.category,
    accountId: row.accountId,
    income: decimalToNumber(row.income as never),
    expense: decimalToNumber(row.expense as never),
    note: row.note ?? '',
    transferCode: row.transferCode,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
  };
}

function toCreateData(entry: Omit<CashEntry, 'id' | 'createdAt'> & { createdAt: Date }) {
  return {
    tenantId: entry.tenantId,
    entryDate: entryDateToDb(entry.entryDate),
    memo: entry.memo,
    category: entry.category,
    accountId: entry.accountId,
    income: entry.income,
    expense: entry.expense,
    note: entry.note || null,
    transferCode: entry.transferCode,
    createdBy: entry.createdBy,
    createdAt: entry.createdAt,
  };
}

/**
 * `createTransferPair` and the caller's countByTransferCode+delete sequence
 * are the real-DB-transaction requirement Gate 2 flagged (see
 * reports/gate-2-delta-report.md DEVIATIONS). `PrismaClient` (not the
 * narrower `Db` type) is used deliberately: transfer create/delete never
 * need to join the tenant-provisioning transaction, so this repository
 * always owns its own `$transaction` calls.
 */
export class PrismaCashEntryRepository implements CashEntryRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(entry: Omit<CashEntry, 'id' | 'createdAt'> & { createdAt: Date }): Promise<CashEntry> {
    const row = await this.db.cashEntry.create({ data: toCreateData(entry) });
    return toDomain(row);
  }

  async createTransferPair(
    outEntry: Omit<CashEntry, 'id' | 'createdAt'> & { createdAt: Date },
    inEntry: Omit<CashEntry, 'id' | 'createdAt'> & { createdAt: Date },
  ): Promise<[CashEntry, CashEntry]> {
    const [outRow, inRow] = await this.db.$transaction([
      this.db.cashEntry.create({ data: toCreateData(outEntry) }),
      this.db.cashEntry.create({ data: toCreateData(inEntry) }),
    ]);
    return [toDomain(outRow), toDomain(inRow)];
  }

  async findById(tenantId: string, entryId: string): Promise<CashEntry | null> {
    const row = await this.db.cashEntry.findFirst({ where: { id: entryId, tenantId } });
    return row ? toDomain(row) : null;
  }

  async update(
    tenantId: string,
    entryId: string,
    patch: Partial<Pick<CashEntry, 'entryDate' | 'memo' | 'category' | 'accountId' | 'income' | 'expense' | 'note'>>,
  ): Promise<CashEntry> {
    const data: Prisma.CashEntryUpdateInput = { ...patch };
    if (patch.entryDate) data.entryDate = entryDateToDb(patch.entryDate);
    if (patch.note !== undefined) data.note = patch.note || null;
    const row = await this.db.cashEntry.update({ where: { id: entryId, tenantId }, data });
    return toDomain(row);
  }

  async deleteById(tenantId: string, entryId: string): Promise<number> {
    const result = await this.db.cashEntry.deleteMany({ where: { id: entryId, tenantId } });
    return result.count;
  }

  async countByTransferCode(tenantId: string, transferCode: string): Promise<number> {
    return this.db.cashEntry.count({ where: { tenantId, transferCode } });
  }

  async deleteByTransferCode(tenantId: string, transferCode: string): Promise<number> {
    const result = await this.db.cashEntry.deleteMany({ where: { tenantId, transferCode } });
    return result.count;
  }

  async listByFilter(tenantId: string, filter: CashEntryFilter): Promise<CashEntryWithAccountName[]> {
    const where: Prisma.CashEntryWhereInput = { tenantId };

    if (filter.startDate) where.entryDate = { ...(where.entryDate as object), gte: entryDateToDb(filter.startDate) };
    if (filter.endDate) where.entryDate = { ...(where.entryDate as object), lte: entryDateToDb(filter.endDate) };
    if (filter.keyword) {
      const contains = filter.keyword;
      where.OR = [
        { memo: { contains } },
        { category: { contains } },
        { note: { contains } },
        { account: { accountName: { contains } } },
      ];
    }

    const order = filter.order === 'asc' ? 'asc' : 'desc';
    const rows = await this.db.cashEntry.findMany({
      where,
      include: { account: true },
      orderBy: [{ entryDate: order }, { id: order }],
      take: filter.limit && filter.limit > 0 ? filter.limit : undefined,
    });

    return rows.map((row) => ({ ...toDomain(row), accountName: row.account.accountName }));
  }

  async getLifetimeTotals(tenantId: string): Promise<AmountTotals> {
    const result = await this.db.cashEntry.aggregate({
      where: { tenantId, transferCode: null },
      _sum: { income: true, expense: true },
    });
    return {
      income: result._sum.income ? decimalToNumber(result._sum.income) : 0,
      expense: result._sum.expense ? decimalToNumber(result._sum.expense) : 0,
    };
  }

  async getRangeTotals(tenantId: string, startDate: string, endDate: string): Promise<AmountTotals> {
    const result = await this.db.cashEntry.aggregate({
      where: {
        tenantId,
        transferCode: null,
        entryDate: { gte: entryDateToDb(startDate), lte: entryDateToDb(endDate) },
      },
      _sum: { income: true, expense: true },
    });
    return {
      income: result._sum.income ? decimalToNumber(result._sum.income) : 0,
      expense: result._sum.expense ? decimalToNumber(result._sum.expense) : 0,
    };
  }

  async getAccountTotals(tenantId: string, accountId: string): Promise<AmountTotals> {
    const result = await this.db.cashEntry.aggregate({
      where: { tenantId, accountId },
      _sum: { income: true, expense: true },
    });
    return {
      income: result._sum.income ? decimalToNumber(result._sum.income) : 0,
      expense: result._sum.expense ? decimalToNumber(result._sum.expense) : 0,
    };
  }
}
