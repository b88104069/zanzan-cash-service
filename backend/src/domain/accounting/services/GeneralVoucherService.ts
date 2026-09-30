import { AccountingError } from '../errors.js';
import type { GeneralVoucherDraftRepository } from '../repositories/GeneralVoucherDraftRepository.js';
import type { JournalEntryRepository, JournalEntryWithLines } from '../repositories/JournalEntryRepository.js';
import type { GeneralVoucherDraft, GeneralVoucherDraftLine } from '../types.js';
import { generateAccountingId } from '../../../infra/memory/accounting/AccountingDatabase.js';
import type { AccountingUnitOfWork } from '../../../infra/memory/accounting/AccountingUnitOfWork.js';
import type { ChartOfAccountService } from './ChartOfAccountService.js';
import type { FiscalPeriodService } from './FiscalPeriodService.js';
import type { VoucherService } from './VoucherService.js';

/** Tolerance for ΣDebit === ΣCredit comparisons — matches the general "compare money as plain floats with a small epsilon" convention used elsewhere in this module (no fixed-point/cents representation exists yet). */
const BALANCE_EPSILON = 1e-9;

export interface GeneralVoucherLineInput {
  chartOfAccountId: string;
  debit: number;
  credit: number;
}

export interface GeneralVoucherDraftInput {
  entryDate: string;
  memo: string;
  lines: GeneralVoucherLineInput[];
}

/**
 * Manual Journal Entry / General Voucher (v0.4). A `GeneralVoucherDraft` is
 * freely editable while status === 'draft' — no strict validation happens
 * on create/update. All validation happens atomically at `postDraft` time,
 * which is the ONLY path that ever creates a JournalEntry from a draft.
 * Posting writes into the SAME JournalEntry/JournalLine/Voucher repositories
 * JournalEntryService uses — there is only one GL, never a second ledger
 * for manual postings.
 */
export class GeneralVoucherService {
  constructor(
    private readonly drafts: GeneralVoucherDraftRepository,
    private readonly journalEntries: JournalEntryRepository,
    private readonly voucherService: VoucherService,
    private readonly chartOfAccountService: ChartOfAccountService,
    private readonly fiscalPeriodService: FiscalPeriodService,
    private readonly unitOfWork: AccountingUnitOfWork,
  ) {}

  async createDraft(tenantId: string, input: GeneralVoucherDraftInput): Promise<GeneralVoucherDraft> {
    const now = new Date();
    return this.drafts.create({
      tenantId,
      entryDate: input.entryDate,
      memo: input.memo,
      lines: this.toDraftLines(input.lines),
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    });
  }

  async updateDraft(tenantId: string, draftId: string, input: GeneralVoucherDraftInput): Promise<GeneralVoucherDraft> {
    const draft = await this.getDraft(tenantId, draftId);
    if (draft.status === 'posted') {
      throw new AccountingError('GENERAL_VOUCHER_ALREADY_POSTED', '此傳票已過帳，無法修改（如需調整，請於未來版本使用沖銷/調整功能）。');
    }
    return this.drafts.update({
      ...draft,
      entryDate: input.entryDate,
      memo: input.memo,
      lines: this.toDraftLines(input.lines),
      updatedAt: new Date(),
    });
  }

  async deleteDraft(tenantId: string, draftId: string): Promise<void> {
    const draft = await this.getDraft(tenantId, draftId);
    if (draft.status === 'posted') {
      throw new AccountingError('GENERAL_VOUCHER_ALREADY_POSTED', '此傳票已過帳，無法刪除。');
    }
    await this.drafts.delete(draft.id);
  }

  async listDrafts(tenantId: string): Promise<GeneralVoucherDraft[]> {
    return this.drafts.listByTenant(tenantId);
  }

  async getDraft(tenantId: string, draftId: string): Promise<GeneralVoucherDraft> {
    const draft = await this.drafts.findById(tenantId, draftId);
    if (!draft) throw new AccountingError('GENERAL_VOUCHER_DRAFT_NOT_FOUND', '找不到這張傳票草稿。');
    return draft;
  }

  /**
   * Validates and posts a draft, atomically. Validation order (structural
   * → account existence/active → balance → period lock) is deliberate and
   * testable, though not itself part of the locked contract beyond what
   * the spec calls out:
   *   1. draft exists (tenant-scoped) / not already posted
   *   2. at least 2 lines
   *   3. every line individually well-formed
   *   4. every line's ChartOfAccount exists, is owned by this tenant, and is active
   *   5. ΣDebit === ΣCredit
   *   6. entryDate is not inside a closed FiscalPeriod
   * Any failure creates zero artifacts. On success, creates exactly one
   * JournalEntry + its JournalLines + one Voucher, and marks the draft
   * 'posted' — all four mutations succeed or none do.
   */
  async postDraft(tenantId: string, draftId: string): Promise<JournalEntryWithLines> {
    return this.unitOfWork.runAtomic(async () => {
      const draft = await this.getDraft(tenantId, draftId);
      if (draft.status === 'posted') {
        throw new AccountingError('GENERAL_VOUCHER_ALREADY_POSTED', '此傳票已過帳，無法重複過帳。');
      }

      if (draft.lines.length < 2) {
        throw new AccountingError('GENERAL_VOUCHER_MIN_LINES', '傳票至少需要兩筆分錄明細才能過帳。');
      }

      for (const line of draft.lines) {
        this.assertValidLine(line);
      }

      for (const line of draft.lines) {
        // Enforces both tenant-ownership (CHART_OF_ACCOUNT_NOT_FOUND) and
        // active-status (CHART_OF_ACCOUNT_INACTIVE) — the SAME single
        // enforcement point the Cash-mapping path uses.
        await this.chartOfAccountService.getActiveOwnedAccount(tenantId, line.chartOfAccountId);
      }

      const totalDebit = draft.lines.reduce((sum, l) => sum + l.debit, 0);
      const totalCredit = draft.lines.reduce((sum, l) => sum + l.credit, 0);
      if (Math.abs(totalDebit - totalCredit) > BALANCE_EPSILON) {
        throw new AccountingError('GENERAL_VOUCHER_UNBALANCED', '借方合計與貸方合計不相等，無法過帳。');
      }

      if (await this.fiscalPeriodService.isDateInClosedPeriod(tenantId, draft.entryDate)) {
        throw new AccountingError('JOURNAL_ENTRY_PERIOD_CLOSED', '此交易日期所屬的會計期間已關帳，無法新增分錄。');
      }

      const journalEntry = await this.journalEntries.create({
        entry: {
          tenantId,
          entryDate: draft.entryDate,
          amount: totalDebit,
          memo: draft.memo,
          sourceType: 'manual',
          sourceModule: 'GL',
          sourceReferenceId: draft.id,
          createdAt: new Date(),
        },
        lines: draft.lines.map((line) => ({ chartOfAccountId: line.chartOfAccountId, debit: line.debit, credit: line.credit })),
      });

      const voucher = await this.voucherService.createForJournalEntry(tenantId, journalEntry.id, draft.entryDate);

      await this.drafts.update({
        ...draft,
        status: 'posted',
        postedJournalEntryId: journalEntry.id,
        postedVoucherId: voucher.id,
        postedAt: new Date(),
        updatedAt: new Date(),
      });

      return journalEntry;
    });
  }

  private assertValidLine(line: GeneralVoucherDraftLine): void {
    if (!line.chartOfAccountId) {
      throw new AccountingError('GENERAL_VOUCHER_INVALID_LINE', '每筆分錄明細都必須選擇會計科目。');
    }
    if (line.debit < 0 || line.credit < 0) {
      throw new AccountingError('GENERAL_VOUCHER_INVALID_LINE', '借方或貸方金額不可為負數。');
    }
    if (line.debit > 0 && line.credit > 0) {
      throw new AccountingError('GENERAL_VOUCHER_INVALID_LINE', '同一筆分錄明細不可同時有借方與貸方金額。');
    }
    if (line.debit === 0 && line.credit === 0) {
      throw new AccountingError('GENERAL_VOUCHER_INVALID_LINE', '每筆分錄明細的借方或貸方金額必須擇一大於零。');
    }
  }

  private toDraftLines(lines: GeneralVoucherLineInput[]): GeneralVoucherDraftLine[] {
    return lines.map((line) => ({
      id: generateAccountingId('gvdl'),
      chartOfAccountId: line.chartOfAccountId,
      debit: line.debit,
      credit: line.credit,
    }));
  }
}
