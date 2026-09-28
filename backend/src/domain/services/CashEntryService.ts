import { DomainError } from '../errors.js';
import type { CashEntryFilter, CashEntryRepository, CashEntryWithAccountName } from '../repositories/CashEntryRepository.js';
import type { AccountService } from './AccountService.js';
import type { CategoryService } from './CategoryService.js';

export interface AddCashEntryInput {
  entryDate: string;
  memo: string;
  category: string;
  accountName: string;
  income: number;
  expense: number;
  note?: string;
}

export interface CashSummary {
  incomeTotal: number;
  expenseTotal: number;
  balance: number;
  monthIncome: number;
  monthExpense: number;
  monthBalance: number;
}

/**
 * Parity source: zzscs_api_add_cash_entry, zzscs_api_update_cash_entry,
 * zzscs_api_delete_cash_entry, zzscs_api_cash_summary, zzscs_api_cash_list
 * (see docs/architecture/domain-boundaries.md → Cash Entry, Summary).
 *
 * Note on the delete path: the legacy `zzscs_api_delete_cash_entry`
 * endpoint handles both a plain delete and a transfer-pair delete in one
 * function. This service mirrors that 1:1 (see `deleteEntry` below) rather
 * than splitting it into CashEntryService/TransferService, even though
 * service-boundaries.md nominally assigns "paired-entry deletion" to
 * TransferService — the split isn't worth a cross-service call for a single
 * guarded repository operation. TransferService still owns transfer
 * *creation* exclusively. This refinement is recorded in the Gate 2 Delta
 * Report rather than left as a silent deviation from Gate 1's docs.
 */
export class CashEntryService {
  constructor(
    private readonly entries: CashEntryRepository,
    private readonly accountService: AccountService,
    private readonly categoryService: CategoryService,
  ) {}

  /** E1-E4 — validates required fields, income/expense mutual exclusion, account and category. */
  async addEntry(tenantId: string, userId: string, input: AddCashEntryInput) {
    this.validateBasic(input);
    const account = await this.accountService.requireActiveAccountByName(tenantId, input.accountName);
    await this.categoryService.requireActiveCategory(tenantId, input.category.trim(), input.income > 0 ? 'income' : 'expense');

    return this.entries.create({
      tenantId,
      entryDate: input.entryDate,
      memo: input.memo.trim(),
      category: input.category.trim(),
      accountId: account.id,
      income: input.income,
      expense: input.expense,
      note: input.note?.trim() ?? '',
      transferCode: null,
      createdBy: userId,
      createdAt: new Date(),
    });
  }

  /**
   * E5 — rejects updates to transfer-linked entries. Order matters here and
   * mirrors the legacy zzscs_api_update_cash_entry exactly: basic field
   * validation first, THEN fetch-and-check transfer immutability, and only
   * THEN validate the account/category exist — so a transfer-linked entry
   * is rejected on its transfer_code before its (synthetic) "帳戶轉帳"
   * category is ever checked against the category table.
   */
  async updateEntry(tenantId: string, entryId: string, input: AddCashEntryInput) {
    this.validateBasic(input);

    const current = await this.entries.findById(tenantId, entryId);
    if (!current) throw new DomainError('ENTRY_NOT_FOUND', '找不到這筆資料。');
    if (current.transferCode) {
      throw new DomainError('ENTRY_TRANSFER_IMMUTABLE', '轉帳紀錄不可單獨修改，請刪除後重新轉帳。');
    }

    const account = await this.accountService.requireActiveAccountByName(tenantId, input.accountName);
    await this.categoryService.requireActiveCategory(tenantId, input.category.trim(), input.income > 0 ? 'income' : 'expense');

    return this.entries.update(tenantId, entryId, {
      entryDate: input.entryDate,
      memo: input.memo.trim(),
      category: input.category.trim(),
      accountId: account.id,
      income: input.income,
      expense: input.expense,
      note: input.note?.trim() ?? '',
    });
  }

  /** E6, X5, X6 — plain delete, or atomic paired delete with an exactly-2-rows integrity guard. */
  async deleteEntry(tenantId: string, entryId: string): Promise<{ deletedCount: number; transferCode: string | null }> {
    const current = await this.entries.findById(tenantId, entryId);
    if (!current) throw new DomainError('ENTRY_NOT_FOUND', '找不到資料。');

    if (!current.transferCode) {
      const deleted = await this.entries.deleteById(tenantId, entryId);
      return { deletedCount: deleted, transferCode: null };
    }

    const pairCount = await this.entries.countByTransferCode(tenantId, current.transferCode);
    if (pairCount !== 2) {
      throw new DomainError(
        'TRANSFER_INTEGRITY_VIOLATION',
        '轉帳資料異常（筆數不符），為保護帳本平衡，拒絕刪除。',
      );
    }

    const deleted = await this.entries.deleteByTransferCode(tenantId, current.transferCode);
    return { deletedCount: deleted, transferCode: current.transferCode };
  }

  async listEntries(tenantId: string, filter: CashEntryFilter): Promise<CashEntryWithAccountName[]> {
    return this.entries.listByFilter(tenantId, filter);
  }

  /** S1-S3 — lifetime and month-to-date totals, EXCLUDING transfer-linked entries. */
  async getSummary(tenantId: string, referenceDate: Date = new Date()): Promise<CashSummary> {
    const lifetime = await this.entries.getLifetimeTotals(tenantId);

    const year = referenceDate.getFullYear();
    const month = referenceDate.getMonth();
    const startOfMonth = new Date(year, month, 1);
    const endOfMonth = new Date(year, month + 1, 0);
    const toIso = (d: Date) => d.toISOString().slice(0, 10);

    const monthTotals = await this.entries.getRangeTotals(tenantId, toIso(startOfMonth), toIso(endOfMonth));

    return {
      incomeTotal: lifetime.income,
      expenseTotal: lifetime.expense,
      balance: lifetime.income - lifetime.expense,
      monthIncome: monthTotals.income,
      monthExpense: monthTotals.expense,
      monthBalance: monthTotals.income - monthTotals.expense,
    };
  }

  /** Required-field and mutual-exclusion checks only — no repository lookups. Order-sensitive; see updateEntry's comment. */
  private validateBasic(input: AddCashEntryInput): void {
    if (!input.entryDate) throw new DomainError('VALIDATION_REQUIRED_FIELD', '請填寫日期。');
    if (!input.memo?.trim()) throw new DomainError('VALIDATION_REQUIRED_FIELD', '請填寫摘要。');
    if (!input.category?.trim()) throw new DomainError('VALIDATION_REQUIRED_FIELD', '請選擇或填寫科目。');
    if (!input.accountName?.trim()) throw new DomainError('VALIDATION_REQUIRED_FIELD', '請選擇帳戶。');

    const { income, expense } = input;
    if (income > 0 && expense > 0) {
      throw new DomainError('INCOME_EXPENSE_MUTUAL_EXCLUSION', '收入與支出不可同時大於0。');
    }
    if (income <= 0 && expense <= 0) {
      throw new DomainError('INCOME_EXPENSE_MUTUAL_EXCLUSION', '請輸入大於0的金額。');
    }
  }
}
