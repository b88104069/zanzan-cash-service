import { useState } from 'react';
import { useAccountingServices } from '../../localdb/accounting/AccountingDataProvider.js';
import type { TrialBalanceReport } from '../../../../backend/src/domain/accounting/types.js';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function TrialBalanceView() {
  const accounting = useAccountingServices();
  const [fromDate, setFromDate] = useState('');
  const [asOfDate, setAsOfDate] = useState(todayIso());
  const [report, setReport] = useState<TrialBalanceReport | null>(null);

  async function handleQuery(e: React.FormEvent) {
    e.preventDefault();
    const result = await accounting.trialBalanceService.getTrialBalance(accounting.tenantId, {
      fromDate: fromDate || undefined,
      asOfDate,
    });
    setReport(result);
  }

  return (
    <section id="sec-trial-balance" className="panel">
      <h3>試算表（Trial Balance）</h3>
      <form className="filter-grid" onSubmit={handleQuery}>
        <div>
          <label htmlFor="tb-from">起始日（選填）</label>
          <input id="tb-from" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </div>
        <div>
          <label htmlFor="tb-asof">截至日</label>
          <input id="tb-asof" type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} required />
        </div>
        <div className="actions">
          <button type="submit">查詢</button>
        </div>
      </form>

      {report && (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>代碼</th>
                  <th>科目</th>
                  <th>期初餘額</th>
                  <th>本期借方</th>
                  <th>本期貸方</th>
                  <th>期末餘額</th>
                </tr>
              </thead>
              <tbody>
                {report.lines.map((line) => (
                  <tr key={line.chartOfAccountId}>
                    <td>{line.code}</td>
                    <td>{line.name}</td>
                    <td>{line.beginningBalance.toLocaleString()}</td>
                    <td>{line.periodDebit.toLocaleString()}</td>
                    <td>{line.periodCredit.toLocaleString()}</td>
                    <td>{line.endingBalance.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>合計</td>
                  <td>{report.totalPeriodDebit.toLocaleString()}</td>
                  <td>{report.totalPeriodCredit.toLocaleString()}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="debug-note">
            餘額為各科目「正常餘方」表示法（借方科目：借方為正；貸方科目：貸方為正）。若科目出現負數，代表該科目本期為異常方向餘額，並未被強制歸零或轉正。
          </p>
          <p className="debug-note">{report.limitationNotice}</p>
        </>
      )}
    </section>
  );
}
