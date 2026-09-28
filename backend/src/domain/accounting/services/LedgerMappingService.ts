import type { MappingRepository } from '../repositories/MappingRepository.js';
import type { MappingClassification } from '../types.js';

/**
 * A minimal shape of the Cash Module's CashEntry that this service needs —
 * declared locally instead of importing backend/src/domain/types.ts's
 * CashEntry, so this module's dependency on Cash Module shapes is explicit
 * and narrow (structural typing: any CashEntry satisfies this).
 */
export interface CashEntryLike {
  id: string;
  accountId: string;
  category: string;
  income: number;
  expense: number;
  transferCode: string | null;
}

/**
 * Classifies a CashEntry against the Accounting Module's own mapping
 * tables. Pure lookup logic — config-driven, not a hardcoded account-name
 * rule. Never guesses a GL account when a mapping is missing.
 */
export class LedgerMappingService {
  constructor(private readonly mappings: MappingRepository) {}

  async classify(tenantId: string, entry: CashEntryLike): Promise<MappingClassification> {
    if (entry.transferCode) {
      return { cashEntryId: entry.id, status: 'excluded', reason: '轉帳分錄目前不納入 v0.1 自動記帳範圍。' };
    }

    const accountMapping = await this.mappings.findAccountMapping(tenantId, entry.accountId);
    const categoryMapping = await this.mappings.findCategoryMapping(tenantId, entry.category);

    if (!accountMapping || !categoryMapping) {
      const missing = [!accountMapping && '帳戶對應', !categoryMapping && '科目對應'].filter(Boolean).join('、');
      return { cashEntryId: entry.id, status: 'unmapped', reason: `缺少${missing}，尚未設定會計科目對應。` };
    }

    const isIncome = entry.income > 0;
    return {
      cashEntryId: entry.id,
      status: 'mapped',
      debitChartOfAccountId: isIncome ? accountMapping.chartOfAccountId : categoryMapping.chartOfAccountId,
      creditChartOfAccountId: isIncome ? categoryMapping.chartOfAccountId : accountMapping.chartOfAccountId,
    };
  }
}
