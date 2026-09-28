import { useCallback, useEffect, useState } from 'react';
import { useApi } from '../../api/useApi';
import { useAuth } from '../../auth/AuthContext';
import { useTenant } from '../../tenant/TenantContext';
import { downloadCsv } from '../../api/client';
import type { CashEntry, EntryFilter } from '../../api/types';

function formatNumber(n: number): string {
  return n.toLocaleString('zh-TW');
}

interface Props {
  refreshKey: number;
  onEdit: (entry: CashEntry) => void;
  onDeleted: () => void;
}

/** Parity: legacy 明細表 — filterable/sortable list, edit/delete row actions, CSV export. */
export function EntryList({ refreshKey, onEdit, onDeleted }: Props) {
  const api = useApi();
  const { token } = useAuth();
  const { currentTenantId } = useTenant();

  const [rows, setRows] = useState<CashEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [keyword, setKeyword] = useState('');
  const [limit, setLimit] = useState(10);
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');

  const filter: EntryFilter = { start_date: startDate || undefined, end_date: endDate || undefined, keyword: keyword || undefined, limit, order };

  const load = useCallback(() => {
    api<{ data: CashEntry[] }>('/cash-entries', { query: filter as Record<string, string | number | undefined> })
      .then((res) => setRows(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : '讀取明細失敗'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, startDate, endDate, keyword, limit, order, refreshKey]);

  useEffect(() => {
    load();
  }, [load]);

  function clearFilters() {
    setStartDate('');
    setEndDate('');
    setKeyword('');
    setLimit(10);
    setOrder('desc');
  }

  async function handleDelete(entry: CashEntry) {
    if (!confirm(entry.transferCode ? '這是一筆轉帳紀錄，刪除將同時移除轉入與轉出兩筆分錄，確定要刪除嗎？' : '確定要刪除這筆記錄嗎？')) return;
    try {
      await api(`/cash-entries/${entry.id}`, { method: 'DELETE' });
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : '刪除失敗');
    }
  }

  async function handleExport() {
    if (!token || !currentTenantId) return;
    try {
      await downloadCsv('/cash-entries/export', { token, tenantId: currentTenantId, query: filter as Record<string, string | number | undefined> }, `cash-export-${Date.now()}.csv`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '匯出失敗');
    }
  }

  return (
    <section id="sec-list" className="panel">
      <h3>最近記帳資料</h3>
      <div className="filter-grid">
        <div>
          <label>日期起</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div>
          <label>日期迄</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <div className="span-2">
          <label>搜尋</label>
          <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="摘要 / 科目 / 帳戶 / 備註" />
        </div>
        <div>
          <label>筆數</label>
          <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>排序</label>
          <select value={order} onChange={(e) => setOrder(e.target.value as 'asc' | 'desc')}>
            <option value="desc">最新</option>
            <option value="asc">最舊</option>
          </select>
        </div>
        <div className="span-2 actions">
          <button type="button" onClick={load}>
            搜尋
          </button>
          <button type="button" className="secondary" onClick={clearFilters}>
            清除
          </button>
          <button type="button" className="export-btn" onClick={handleExport}>
            匯出CSV
          </button>
        </div>
      </div>

      {error && <div className="error-text">{error}</div>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>日期</th>
              <th>帳戶</th>
              <th>科目</th>
              <th>摘要</th>
              <th>收入</th>
              <th>支出</th>
              <th>備註</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8}>沒有資料</td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.entryDate}</td>
                <td>{row.accountName}</td>
                <td>
                  {row.category}
                  {row.transferCode && <span className="badge">轉帳</span>}
                </td>
                <td>{row.memo}</td>
                <td>{row.income > 0 ? formatNumber(row.income) : ''}</td>
                <td>{row.expense > 0 ? formatNumber(row.expense) : ''}</td>
                <td>{row.note}</td>
                <td className="row-actions">
                  <button type="button" className="small-btn" onClick={() => onEdit(row)} disabled={Boolean(row.transferCode)} title={row.transferCode ? '轉帳紀錄不可單獨修改' : ''}>
                    編輯
                  </button>
                  <button type="button" className="small-btn danger" onClick={() => handleDelete(row)}>
                    刪除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
