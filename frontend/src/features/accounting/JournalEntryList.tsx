import { useEffect, useState } from 'react';
import { useAccountingServices } from '../../localdb/accounting/AccountingDataProvider.js';
import type { ChartOfAccount } from '../../../../backend/src/domain/accounting/types.js';
import type { JournalEntryWithLines } from '../../../../backend/src/domain/accounting/repositories/JournalEntryRepository.js';

export function JournalEntryList({ refreshKey }: { refreshKey: number }) {
  const accounting = useAccountingServices();
  const [entries, setEntries] = useState<JournalEntryWithLines[]>([]);
  const [chartOfAccounts, setChartOfAccounts] = useState<ChartOfAccount[]>([]);

  useEffect(() => {
    accounting.journalEntryService.listJournalEntries(accounting.tenantId).then((rows) => setEntries([...rows].reverse()));
    accounting.chartOfAccountService.listChartOfAccounts(accounting.tenantId).then(setChartOfAccounts);
  }, [refreshKey, accounting]);

  function glName(id: string): string {
    const coa = chartOfAccounts.find((c) => c.id === id);
    return coa ? `${coa.code} ${coa.name}` : id;
  }

  return (
    <section id="sec-journal-entries" className="panel">
      <h3>會計分錄（Journal Entries）</h3>
      {entries.length === 0 ? (
        <p className="empty-text">尚無分錄。請先在 Dashboard 執行「產生分錄」。</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>日期</th>
                <th>摘要</th>
                <th>借方科目</th>
                <th>貸方科目</th>
                <th>金額</th>
                <th>來源交易</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const debitLine = entry.lines.find((l) => l.debit > 0);
                const creditLine = entry.lines.find((l) => l.credit > 0);
                return (
                  <tr key={entry.id}>
                    <td>{entry.entryDate}</td>
                    <td>{entry.memo}</td>
                    <td>{debitLine ? glName(debitLine.chartOfAccountId) : '-'}</td>
                    <td>{creditLine ? glName(creditLine.chartOfAccountId) : '-'}</td>
                    <td>{entry.amount.toLocaleString()}</td>
                    <td>
                      <span className="badge">{entry.sourceCashEntryId}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
