import { useEffect, useState } from 'react';
import { useAccountingServices } from '../../localdb/accounting/AccountingDataProvider.js';
import type { FiscalPeriod } from '../../../../backend/src/domain/accounting/types.js';

/**
 * Fiscal Period management (v0.3) — create / list / close only, no reopen.
 * Closing sets a one-way lock flag: it blocks NEW journalization for dates
 * inside it (enforced by JournalEntryService), but never posts a closing
 * JournalEntry and never touches GL data. See
 * docs/architecture/accounting-module-v0.3.md.
 */
export function FiscalPeriodsView({ refreshKey, onChanged }: { refreshKey: number; onChanged: () => void }) {
  const accounting = useAccountingServices();
  const [periods, setPeriods] = useState<FiscalPeriod[]>([]);
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function refresh() {
    setPeriods(await accounting.fiscalPeriodService.listFiscalPeriods(accounting.tenantId));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      await accounting.fiscalPeriodService.createFiscalPeriod(accounting.tenantId, { name, startDate, endDate });
      accounting.save();
      setName('');
      setStartDate('');
      setEndDate('');
      setSuccess('會計期間新增成功');
      await refresh();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : '新增失敗');
    }
  }

  async function handleClose(id: string) {
    setError(null);
    setSuccess(null);
    try {
      await accounting.fiscalPeriodService.closePeriod(accounting.tenantId, id);
      accounting.save();
      setSuccess('會計期間已關帳');
      await refresh();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : '關帳失敗');
    }
  }

  return (
    <section id="sec-fiscal-periods" className="panel">
      <h3>會計期間（Fiscal Period）</h3>
      <p className="debug-note">
        「關帳」是過帳鎖定，不是完整的會計結帳流程：關帳後該期間內的交易日期將無法新增分錄，但不會產生結帳分錄、不影響損益轉入權益、也無法重新開帳。
      </p>

      <form className="form-grid" onSubmit={handleCreate}>
        <div>
          <label htmlFor="fp-name">期間名稱</label>
          <input id="fp-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="fp-start">起始日</label>
          <input id="fp-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="fp-end">結束日</label>
          <input id="fp-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
        </div>
        <div className="span-2 actions">
          <button type="submit">新增會計期間</button>
        </div>
      </form>
      {error && <p className="error-text">{error}</p>}
      {success && <p className="success-text">{success}</p>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>名稱</th>
              <th>起始日</th>
              <th>結束日</th>
              <th>狀態</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {periods.map((period) => (
              <tr key={period.id}>
                <td>{period.name}</td>
                <td>{period.startDate}</td>
                <td>{period.endDate}</td>
                <td>{period.status === 'closed' ? '已關帳' : '開放中'}</td>
                <td>
                  {period.status === 'open' && (
                    <button type="button" onClick={() => handleClose(period.id)}>
                      關帳 / 停止過帳
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
