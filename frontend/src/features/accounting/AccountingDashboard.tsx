import { useEffect, useState } from 'react';
import { useLocalServices } from '../../localdb/LocalDataProvider.js';
import { useAccountingServices } from '../../localdb/accounting/AccountingDataProvider.js';
import type { MappingStatus } from '../../../../backend/src/domain/accounting/types.js';

interface Counts {
  pending: number; // mapped, not yet journaled
  unmapped: number;
  excluded: number; // transfers
  journaled: number;
}

export function AccountingDashboard({ refreshKey, onProcessed }: { refreshKey: number; onProcessed: () => void }) {
  const cash = useLocalServices();
  const accounting = useAccountingServices();
  const [counts, setCounts] = useState<Counts | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const entries = await cash.cashEntryService.listEntries(cash.tenantId, {});
      const journalEntries = await accounting.journalEntryService.listJournalEntries(accounting.tenantId);
      const journaledSourceIds = new Set(journalEntries.map((j) => j.sourceCashEntryId));

      let pending = 0;
      let unmapped = 0;
      let excluded = 0;
      for (const entry of entries) {
        if (journaledSourceIds.has(entry.id)) continue;
        const classification = await accounting.mappingService.classify(accounting.tenantId, entry);
        const status: MappingStatus = classification.status;
        if (status === 'mapped') pending += 1;
        else if (status === 'unmapped') unmapped += 1;
        else excluded += 1;
      }

      if (!cancelled) setCounts({ pending, unmapped, excluded, journaled: journalEntries.length });
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [refreshKey, cash, accounting]);

  async function handleProcess() {
    setMessage(null);
    const entries = await cash.cashEntryService.listEntries(cash.tenantId, {});
    const result = await accounting.journalEntryService.processPending(accounting.tenantId, entries);
    accounting.save();
    const periodClosedNote = result.periodClosed > 0 ? `、期間已關帳，略過 ${result.periodClosed} 筆` : '';
    const inactiveAccountNote = result.inactiveAccount > 0 ? `、對應科目已停用，略過 ${result.inactiveAccount} 筆` : '';
    setMessage(
      `已產生 ${result.journaled} 筆分錄（已略過：已存在 ${result.alreadyJournaled} 筆、待設定科目對應 ${result.unmapped} 筆、未處理轉帳 ${result.excluded} 筆${inactiveAccountNote}${periodClosedNote}）`,
    );
    onProcessed();
  }

  return (
    <section id="sec-accounting-dashboard" className="panel">
      <h3>會計儀表板</h3>
      {!counts ? (
        <p>載入中...</p>
      ) : (
        <div className="summary-grid">
          <div className="card">
            <div className="card-title">待處理交易</div>
            <div className="card-value">{counts.pending}</div>
          </div>
          <div className="card">
            <div className="card-title">
              待設定科目對應
              <small>Unmapped</small>
            </div>
            <div className="card-value">{counts.unmapped}</div>
          </div>
          <div className="card">
            <div className="card-title">
              未處理轉帳
              <small>Excluded（v0.1 不自動記帳）</small>
            </div>
            <div className="card-value">{counts.excluded}</div>
          </div>
          <div className="card">
            <div className="card-title">已建立分錄</div>
            <div className="card-value">{counts.journaled}</div>
          </div>
        </div>
      )}
      <div className="actions">
        <button type="button" onClick={handleProcess} disabled={!counts || counts.pending === 0}>
          產生分錄（{counts?.pending ?? 0} 筆待處理）
        </button>
      </div>
      {message && <p className="success-text">{message}</p>}
    </section>
  );
}
