import { AccountingError } from '../errors.js';
import type { JournalEntryRepository, JournalEntryWithLines } from '../repositories/JournalEntryRepository.js';
import type { FiscalPeriodService } from './FiscalPeriodService.js';
import type { CashEntryLike } from './LedgerMappingService.js';
import { LedgerMappingService } from './LedgerMappingService.js';
import type { VoucherService } from './VoucherService.js';

export interface ProcessPendingResult {
  journaled: number;
  alreadyJournaled: number;
  unmapped: number;
  excluded: number;
  /** Mapped-and-eligible entries skipped because their entryDate falls in a closed FiscalPeriod (v0.3). Never silently dropped from the count. */
  periodClosed: number;
}

/**
 * Turns mapped CashEntries into JournalEntry + Voucher pairs. Reads
 * CashEntry-shaped data (see CashEntryLike) but never writes back to it —
 * the Cash Module's own data is untouched by this whole module.
 */
export class JournalEntryService {
  constructor(
    private readonly journalEntries: JournalEntryRepository,
    private readonly voucherService: VoucherService,
    private readonly mappingService: LedgerMappingService,
    private readonly fiscalPeriodService: FiscalPeriodService,
  ) {}

  async getJournalEntryBySource(tenantId: string, cashEntryId: string): Promise<JournalEntryWithLines | null> {
    return this.journalEntries.findBySourceCashEntryId(tenantId, cashEntryId);
  }

  /**
   * Journalizes a single mapped entry. Throws if not mapped, excluded,
   * already journalized, or (v0.3) the entry's date falls inside a closed
   * FiscalPeriod — strict, single-entry semantics, unlike processPending's
   * per-entry batch handling below. Creates nothing on any of these
   * rejections.
   */
  async journalizeEntry(tenantId: string, entry: CashEntryLike & { entryDate: string; memo: string }): Promise<JournalEntryWithLines> {
    const existing = await this.journalEntries.findBySourceCashEntryId(tenantId, entry.id);
    if (existing) throw new AccountingError('CASH_ENTRY_ALREADY_JOURNALED', '這筆交易已經產生過分錄。');

    if (await this.fiscalPeriodService.isDateInClosedPeriod(tenantId, entry.entryDate)) {
      throw new AccountingError('JOURNAL_ENTRY_PERIOD_CLOSED', '此交易日期所屬的會計期間已關帳，無法新增分錄。');
    }

    const classification = await this.mappingService.classify(tenantId, entry);
    if (classification.status === 'excluded') {
      throw new AccountingError('CASH_ENTRY_EXCLUDED', '轉帳分錄目前不納入 v0.1 自動記帳範圍。');
    }
    if (classification.status === 'unmapped') {
      throw new AccountingError('CASH_ENTRY_NOT_MAPPED', classification.reason ?? '尚未設定會計科目對應。');
    }

    return this.createJournalEntry(tenantId, entry, classification.debitChartOfAccountId!, classification.creditChartOfAccountId!);
  }

  private async createJournalEntry(
    tenantId: string,
    entry: CashEntryLike & { entryDate: string; memo: string },
    debitChartOfAccountId: string,
    creditChartOfAccountId: string,
  ): Promise<JournalEntryWithLines> {
    const amount = entry.income > 0 ? entry.income : entry.expense;
    const journalEntry = await this.journalEntries.create({
      entry: {
        tenantId,
        entryDate: entry.entryDate,
        amount,
        memo: entry.memo,
        sourceCashEntryId: entry.id,
        createdAt: new Date(),
      },
      lines: [
        { chartOfAccountId: debitChartOfAccountId, debit: amount, credit: 0 },
        { chartOfAccountId: creditChartOfAccountId, debit: 0, credit: amount },
      ],
    });

    await this.voucherService.createForJournalEntry(tenantId, journalEntry.id, entry.entryDate);
    return journalEntry;
  }

  /**
   * Bulk "產生分錄" action for the Dashboard: journalizes every currently
   * mapped-and-not-yet-journaled-and-not-in-a-closed-period entry, and
   * reports counts for the rest (already journaled / unmapped / excluded /
   * period closed) so nothing is silently dropped from view.
   *
   * v0.3 guardrail (Gate Review MUST FIX): one closed-period entry must
   * never abort the whole batch. Each entry is classified independently —
   * alreadyJournaled is checked BEFORE periodClosed, so a historically
   * journalized entry is never re-counted as "skipped" just because its
   * period was closed afterward.
   */
  async processPending(tenantId: string, entries: Array<CashEntryLike & { entryDate: string; memo: string }>): Promise<ProcessPendingResult> {
    const result: ProcessPendingResult = { journaled: 0, alreadyJournaled: 0, unmapped: 0, excluded: 0, periodClosed: 0 };

    for (const entry of entries) {
      const existing = await this.journalEntries.findBySourceCashEntryId(tenantId, entry.id);
      if (existing) {
        result.alreadyJournaled += 1;
        continue;
      }

      const classification = await this.mappingService.classify(tenantId, entry);
      if (classification.status === 'excluded') {
        result.excluded += 1;
        continue;
      }
      if (classification.status === 'unmapped') {
        result.unmapped += 1;
        continue;
      }

      if (await this.fiscalPeriodService.isDateInClosedPeriod(tenantId, entry.entryDate)) {
        result.periodClosed += 1;
        continue;
      }

      await this.createJournalEntry(tenantId, entry, classification.debitChartOfAccountId!, classification.creditChartOfAccountId!);
      result.journaled += 1;
    }

    return result;
  }

  async listJournalEntries(tenantId: string): Promise<JournalEntryWithLines[]> {
    return this.journalEntries.listByTenant(tenantId);
  }
}
