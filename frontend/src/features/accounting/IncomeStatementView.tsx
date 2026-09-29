import { useState } from 'react';
import { useAccountingServices } from '../../localdb/accounting/AccountingDataProvider.js';
import type { IncomeStatementReport } from '../../../../backend/src/domain/accounting/types.js';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function IncomeStatementView() {
  const accounting = useAccountingServices();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState(todayIso());
  const [report, setReport] = useState<IncomeStatementReport | null>(null);

  async function handleQuery(e: React.FormEvent) {
    e.preventDefault();
    const result = await accounting.incomeStatementService.getIncomeStatement(accounting.tenantId, {
      fromDate: fromDate || undefined,
      toDate,
    });
    setReport(result);
  }

  return (
    <section id="sec-income-statement" className="panel">
      <h3>損益表（Income Statement）</h3>
      <form className="filter-grid" onSubmit={handleQuery}>
        <div>
          <label htmlFor="is-from">起始日（選填）</label>
          <input id="is-from" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </div>
        <div>
          <label htmlFor="is-to">截至日</label>
          <input id="is-to" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} required />
        </div>
        <div className="actions">
          <button type="submit">查詢</button>
        </div>
      </form>

      {report && (
        <>
          <h4>收入</h4>
          <div className="table-wrap">
            <table>
              <tbody>
                {report.revenueLines.map((line) => (
                  <tr key={line.chartOfAccountId}>
                    <td>
                      {line.code} {line.name}
                    </td>
                    <td>{line.amount.toLocaleString()}</td>
                  </tr>
                ))}
                <tr>
                  <td>
                    <strong>收入合計</strong>
                  </td>
                  <td>
                    <strong>{report.totalRevenue.toLocaleString()}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <h4>費用</h4>
          <div className="table-wrap">
            <table>
              <tbody>
                {report.expenseLines.map((line) => (
                  <tr key={line.chartOfAccountId}>
                    <td>
                      {line.code} {line.name}
                    </td>
                    <td>{line.amount.toLocaleString()}</td>
                  </tr>
                ))}
                <tr>
                  <td>
                    <strong>費用合計</strong>
                  </td>
                  <td>
                    <strong>{report.totalExpense.toLocaleString()}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="summary-grid">
            <div className="card">
              <div className="card-title">本期損益（Net Income）</div>
              <div className="card-value">{report.netIncome.toLocaleString()}</div>
            </div>
          </div>
          <p className="debug-note">{report.limitationNotice}</p>
        </>
      )}
    </section>
  );
}
