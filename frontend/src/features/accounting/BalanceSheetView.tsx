import { useState } from 'react';
import { useAccountingServices } from '../../localdb/accounting/AccountingDataProvider.js';
import type { BalanceSheetLine, BalanceSheetReport } from '../../../../backend/src/domain/accounting/types.js';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function LineRows({ lines }: { lines: BalanceSheetLine[] }) {
  return (
    <>
      {lines.map((line) => (
        <tr key={line.chartOfAccountId}>
          <td>
            {line.code} {line.name}
          </td>
          <td>{line.balance.toLocaleString()}</td>
        </tr>
      ))}
    </>
  );
}

export function BalanceSheetView() {
  const accounting = useAccountingServices();
  const [asOfDate, setAsOfDate] = useState(todayIso());
  const [report, setReport] = useState<BalanceSheetReport | null>(null);

  async function handleQuery(e: React.FormEvent) {
    e.preventDefault();
    const result = await accounting.balanceSheetService.getBalanceSheet(accounting.tenantId, asOfDate);
    setReport(result);
  }

  return (
    <section id="sec-balance-sheet" className="panel">
      <h3>資產負債表（Balance Sheet）</h3>
      <form className="filter-grid" onSubmit={handleQuery}>
        <div>
          <label htmlFor="bs-asof">截至日</label>
          <input id="bs-asof" type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} required />
        </div>
        <div className="actions">
          <button type="submit">查詢</button>
        </div>
      </form>

      {report && (
        <>
          <h4>資產</h4>
          <div className="table-wrap">
            <table>
              <tbody>
                <LineRows lines={report.assetLines} />
                <tr>
                  <td>
                    <strong>資產合計</strong>
                  </td>
                  <td>
                    <strong>{report.totalAssets.toLocaleString()}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <h4>負債</h4>
          <div className="table-wrap">
            <table>
              <tbody>
                <LineRows lines={report.liabilityLines} />
                <tr>
                  <td>
                    <strong>負債合計</strong>
                  </td>
                  <td>
                    <strong>{report.totalLiabilities.toLocaleString()}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <h4>權益</h4>
          <div className="table-wrap">
            <table>
              <tbody>
                <LineRows lines={report.equityLines} />
                <tr>
                  <td>本期損益（Current Earnings, presentation only — no closing entry posted）</td>
                  <td>{report.currentEarnings.toLocaleString()}</td>
                </tr>
                <tr>
                  <td>
                    <strong>權益合計（含本期損益）</strong>
                  </td>
                  <td>
                    <strong>{(report.totalEquity + report.currentEarnings).toLocaleString()}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="summary-grid">
            <div className="card">
              <div className="card-title">資產合計</div>
              <div className="card-value">{report.totalAssets.toLocaleString()}</div>
            </div>
            <div className="card">
              <div className="card-title">負債 + 權益 + 本期損益</div>
              <div className="card-value">{report.totalLiabilitiesAndEquity.toLocaleString()}</div>
            </div>
          </div>
          <p className="debug-note">{report.limitationNotice}</p>
        </>
      )}
    </section>
  );
}
