import { useCallback, useEffect, useRef, useState } from 'react';
import { useApi } from '../../api/useApi';
import { useLocalServices } from '../../localdb/LocalDataProvider';
import { localCsvExport } from '../../localdb/localRouter';
import type { CashEntry, EntryFilter } from '../../api/types';

function formatNumber(n: number): string {
  return n.toLocaleString('zh-TW');
}

const CSV_HEADER = ['日期', '帳戶', '科目', '摘要', '收入', '支出', '備註'];

function toCsvText(rows: { entryDate: string; account: string; category: string; memo: string; income: number; expense: number; note: string }[]): string {
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const lines = [CSV_HEADER.map(escape).join(',')];
  for (const r of rows) {
    lines.push([r.entryDate, r.account, r.category, r.memo, String(r.income), String(r.expense), r.note].map(escape).join(','));
  }
  return '﻿' + lines.join('\r\n');
}

/** Minimal CSV parser matching the export format: quoted fields, doubled-quote escaping, CRLF or LF rows. */
function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const body = text.replace(/^﻿/, '');

  for (let i = 0; i < body.length; i++) {
    const char = body[i];
    if (inQuotes) {
      if (char === '"' && body[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\r') {
      // ignore, \n handles the row break
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

function downloadTextFile(text: string, filename: string, mime: string): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

interface Props {
  refreshKey: number;
  onEdit: (entry: CashEntry) => void;
  onDeleted: () => void;
}

/**
 * Parity: legacy 明細表 — filterable/sortable list, edit/delete row actions,
 * CSV export. CSV import is a Gate 5 addition (scope item 12, "if
 * reasonable to add") — legacy never had one. Known limitation: the
 * exported CSV (matching legacy's own export format) doesn't carry
 * transfer_code, so re-importing a file that included transfer legs
 * recreates them as ordinary unpaired entries, not reconstructed transfers
 * — documented in reports/gate-5-delta-report.md, not silently glossed
 * over.
 */
export function EntryList({ refreshKey, onEdit, onDeleted }: Props) {
  const api = useApi();
  const services = useLocalServices();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<CashEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
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
    try {
      const csvRows = await localCsvExport(services, filter as Record<string, string | number | undefined>);
      downloadTextFile(toCsvText(csvRows), `cash-export-${Date.now()}.csv`, 'text/csv;charset=utf-8');
    } catch (err) {
      setError(err instanceof Error ? err.message : '匯出失敗');
    }
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setImportMessage(null);
    setError(null);
    const text = await file.text();
    const parsedRows = parseCsvText(text);
    const dataRows = parsedRows[0]?.[0] === CSV_HEADER[0] ? parsedRows.slice(1) : parsedRows;

    let success = 0;
    let failed = 0;
    for (const [entryDate, account, category, memo, income, expense, note] of dataRows) {
      try {
        await api('/cash-entries', {
          method: 'POST',
          body: { date: entryDate, account, category, memo, income: Number(income) || 0, expense: Number(expense) || 0, note: note ?? '' },
        });
        success++;
      } catch {
        failed++;
      }
    }

    setImportMessage(`匯入完成：成功 ${success} 筆，失敗 ${failed} 筆${failed > 0 ? '（失敗原因通常是帳戶或科目不存在，請先確認帳戶/科目管理）' : ''}`);
    onDeleted(); // reuses the same "something changed, refresh everything" callback
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
          <button type="button" className="secondary" onClick={handleImportClick}>
            匯入CSV
          </button>
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={handleImportFile} />
        </div>
      </div>

      {error && <div className="error-text">{error}</div>}
      {importMessage && <div className="success-text">{importMessage}</div>}

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
