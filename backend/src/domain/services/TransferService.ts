import { DomainError } from '../errors.js';
import type { CashEntryRepository } from '../repositories/CashEntryRepository.js';
import type { CashEntry } from '../types.js';
import type { AccountService } from './AccountService.js';

export interface CreateTransferInput {
  entryDate: string;
  fromAccountName: string;
  toAccountName: string;
  amount: number;
  note?: string;
}

function generateTransferCode(): string {
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const random = Math.floor(100 + Math.random() * 900);
  return `TRF${stamp}${random}`;
}

/**
 * Owns transfer creation: a compound, atomic two-entry transaction between
 * two accounts of the same tenant. Deliberately separate from
 * CashEntryService (see docs/architecture/service-boundaries.md) because a
 * transfer is a distinct business concept, not plain entry CRUD — future
 * double-entry-ledger work extends this service. Paired *deletion* lives in
 * CashEntryService.deleteEntry for parity with the legacy single endpoint
 * (see that service's class comment).
 *
 * Parity source: zzscs_api_transfer_create.
 */
export class TransferService {
  constructor(
    private readonly entries: CashEntryRepository,
    private readonly accountService: AccountService,
  ) {}

  /** X1-X4 — validates accounts differ, both active, amount > 0, then inserts an atomic pair. */
  async createTransfer(tenantId: string, userId: string, input: CreateTransferInput): Promise<{ transferCode: string; entries: [CashEntry, CashEntry] }> {
    if (!input.entryDate) throw new DomainError('VALIDATION_REQUIRED_FIELD', '請填寫轉帳日期。');
    if (!input.fromAccountName) throw new DomainError('VALIDATION_REQUIRED_FIELD', '請選擇轉出帳戶。');
    if (!input.toAccountName) throw new DomainError('VALIDATION_REQUIRED_FIELD', '請選擇轉入帳戶。');
    if (input.fromAccountName === input.toAccountName) {
      throw new DomainError('TRANSFER_SAME_ACCOUNT', '轉出帳戶與轉入帳戶不可相同。');
    }
    if (input.amount <= 0) {
      throw new DomainError('TRANSFER_INVALID_AMOUNT', '轉帳金額必須大於0。');
    }

    const fromAccount = await this.accountService.requireActiveAccountByName(tenantId, input.fromAccountName).catch(() => {
      throw new DomainError('TRANSFER_ACCOUNT_UNAVAILABLE', '找不到轉出帳戶，或帳戶已停用。');
    });
    const toAccount = await this.accountService.requireActiveAccountByName(tenantId, input.toAccountName).catch(() => {
      throw new DomainError('TRANSFER_ACCOUNT_UNAVAILABLE', '找不到轉入帳戶，或帳戶已停用。');
    });

    const transferCode = generateTransferCode();
    const createdAt = new Date();
    const note = input.note?.trim() ?? '';

    const [outEntry, inEntry] = await this.entries.createTransferPair(
      {
        tenantId,
        entryDate: input.entryDate,
        memo: '帳戶轉帳',
        category: '帳戶轉帳',
        accountId: fromAccount.id,
        income: 0,
        expense: input.amount,
        note,
        transferCode,
        createdBy: userId,
        createdAt,
      },
      {
        tenantId,
        entryDate: input.entryDate,
        memo: '帳戶轉帳',
        category: '帳戶轉帳',
        accountId: toAccount.id,
        income: input.amount,
        expense: 0,
        note,
        transferCode,
        createdBy: userId,
        createdAt,
      },
    );

    return { transferCode, entries: [outEntry, inEntry] };
  }
}
