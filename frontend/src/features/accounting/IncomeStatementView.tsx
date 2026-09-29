import { useEffect, useState } from 'react';
import { useAccountingServices } from '../../localdb/accounting/AccountingDataProvider.js';
import type { FiscalPeriod, IncomeStatementReport } from '../../../../backend/src/domain/accounting/types.js';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function IncomeStatementView({ refreshKey }: { refreshKey?: number } = {}) {
  const accounting = useAccountingServices();
  const [periods, setPeriods] = useState<FiscalPeriod[]>([]);
  const [fiscalPeriodId, setFiscalPeriodId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState(todayIso());
  const [report, setReport] = useState<IncomeStatementReport | null>(null);

  useEffect(() => {
    accounting.fiscalPeriodService.listFiscalPeriods(accounting.tenantId).then(setPeriods);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  function handleSelectPeriod(id: string) {
    setFiscalPeriodId(id);
    const period = periods.find((p) => p.id === id);
    if (period) {
      setFromDate(period.startDate);
      setToDate(period.endDate);
    }
  }

  async function handleQuery(e: React.FormEvent) {
    e.preventDefault();
    const result = fiscalPeriodId
      ? await accounting.incomeStatementService.getIncomeStatement(accounting.tenantId, { fiscalPeriodId })
      : await accounting.incomeStatementService.getIncomeStatement(accounting.tenantId, { fromDate: fromDate || undefined, toDate });
    setReport(result);
  }

  return (
    <section id="sec-income-statement" className="panel">
      <h3>損益表（Income Statement）</h3>
      <form className="filter-grid" onSubmit={handleQuery}>
        <div>
          <label htmlFor="is-period">會計期間（選填）</label>
          <select id="is-period" value={fiscalPeriodId} onChange={(e) => handleSelectPeriod(e.target.value)}>
            <option value="">（不使用會計期間，自行輸入日期）</option>
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}（{p.startDate} ~ {p.endDate}）{p.status === 'closed' ? '已關帳' : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="is-from">起始日（選填）</label>
          <input
            id="is-from"
            type="date"
            value={fromDate}
            onChange={(e) => {
              setFiscalPeriodId('');
              setFromDate(e.target.value);
            }}
          />
        </div>
        <div>
          <label htmlFor="is-to">截至日</label>
          <input
            id="is-to"
            type="date"
            value={toDate}
            onChange={(e) => {
              setFiscalPeriodId('');
              setToDate(e.target.value);
            }}
            required
          />
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
