import { DomainError } from '../errors.js';
import type { AccountRepository } from '../repositories/AccountRepository.js';
import type { CashEntryRepository } from '../repositories/CashEntryRepository.js';
import type { Account } from '../types.js';

export interface AccountSummary {
  id: string;
  accountName: string;
  totalIncome: number;
  totalExpense: number;
  balance: number;
}

/** Parity source: zzscs_api_account_* (see docs/architecture/domain-boundaries.md → Account). */
export class AccountService {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly entries: CashEntryRepository,
  ) {}

  /** A1, A2 — unique account name per tenant. */
  async createAccount(tenantId: string, input: { accountName: string; accountType?: string; openingBalance?: number }): Promise<Account> {
    const accountName = input.accountName.trim();
    if (!accountName) throw new DomainError('VALIDATION_REQUIRED_FIELD', '請填寫帳戶名稱。');

    const existing = await this.accounts.findByName(tenantId, accountName);
    if (existing) throw new DomainError('DUPLICATE_ACCOUNT_NAME', '此帳戶名稱已存在。');

    return this.accounts.create({
      tenantId,
      accountName,
      accountType: input.accountType?.trim() || 'cash',
      openingBalance: input.openingBalance ?? 0,
      status: 'active',
      createdAt: new Date(),
    });
  }

  async updateAccount(
    tenantId: string,
    accountId: string,
    input: { accountName: string; accountType?: string; openingBalance?: number },
  ): Promise<Account> {
    const accountName = input.accountName.trim();
    if (!accountName) throw new DomainError('VALIDATION_REQUIRED_FIELD', '請填寫帳戶名稱。');

    const current = await this.accounts.findById(tenantId, accountId);
    if (!current) throw new DomainError('ACCOUNT_NOT_FOUND', '找不到這個帳戶，或無權限修改。');

    const duplicate = await this.accounts.findByName(tenantId, accountName);
    if (duplicate && duplicate.id !== accountId) {
      throw new DomainError('DUPLICATE_ACCOUNT_NAME', '此帳戶名稱已存在。');
    }

    return this.accounts.update(tenantId, accountId, {
      accountName,
      accountType: input.accountType?.trim() || 'cash',
      openingBalance: input.openingBalance ?? current.openingBalance,
    });
  }

  /** A3 — soft-delete only; disabled accounts drop out of listActiveByTenant. */
  async disableAccount(tenantId: string, accountId: string): Promise<void> {
    const current = await this.accounts.findById(tenantId, accountId);
    if (!current) throw new DomainError('ACCOUNT_NOT_FOUND', '找不到這個帳戶。');
    await this.accounts.setStatus(tenantId, accountId, 'inactive');
  }

  async enableAccount(tenantId: string, accountId: string): Promise<void> {
    const current = await this.accounts.findById(tenantId, accountId);
    if (!current) throw new DomainError('ACCOUNT_NOT_FOUND', '找不到這個帳戶。');
    await this.accounts.setStatus(tenantId, accountId, 'active');
  }

  async listActiveAccountNames(tenantId: string): Promise<string[]> {
    const rows = await this.accounts.listActiveByTenant(tenantId);
    return rows.map((a) => a.accountName).sort();
  }

  async listForAdmin(tenantId: string): Promise<Account[]> {
    return this.accounts.listByTenant(tenantId);
  }

  /** A5 — balance = opening_balance + Σincome − Σexpense (transfers included). */
  async getAccountSummaries(tenantId: string): Promise<AccountSummary[]> {
    const accounts = await this.accounts.listActiveByTenant(tenantId);
    return Promise.all(
      accounts.map(async (account) => {
        const totals = await this.entries.getAccountTotals(tenantId, account.id);
        return {
          id: account.id,
          accountName: account.accountName,
          totalIncome: totals.income,
          totalExpense: totals.expense,
          balance: account.openingBalance + totals.income - totals.expense,
        };
      }),
    );
  }

  /** Validates an active account exists for entry/transfer creation (A4). Throws ACCOUNT_NOT_FOUND_OR_INACTIVE. */
  async requireActiveAccountByName(tenantId: string, accountName: string): Promise<Account> {
    const account = await this.accounts.findByName(tenantId, accountName);
    if (!account || account.status !== 'active') {
      throw new DomainError('ACCOUNT_NOT_FOUND_OR_INACTIVE', '選擇的帳戶不存在或已停用。');
    }
    return account;
  }
}
