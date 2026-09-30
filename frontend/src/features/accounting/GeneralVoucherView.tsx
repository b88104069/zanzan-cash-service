import { useEffect, useState } from 'react';
import { useAccountingServices } from '../../localdb/accounting/AccountingDataProvider.js';
import type { ChartOfAccount, GeneralVoucherDraft } from '../../../../backend/src/domain/accounting/types.js';

interface DraftLineForm {
  chartOfAccountId: string;
  debit: string;
  credit: string;
}

function emptyLine(): DraftLineForm {
  return { chartOfAccountId: '', debit: '', credit: '' };
}

/**
 * Manual Journal Entry / General Voucher (v0.4). A draft is freely editable
 * (add/remove/edit lines) and never affects Trial Balance / Income
 * Statement / Balance Sheet until it is posted — posting is the only
 * action that creates a real JournalEntry, writing into the same single GL
 * every other module posts to. See docs/architecture/accounting-module-v0.4.md.
 */
export function GeneralVoucherView({ refreshKey, onChanged }: { refreshKey: number; onChanged: () => void }) {
  const accounting = useAccountingServices();
  const [drafts, setDrafts] = useState<GeneralVoucherDraft[]>([]);
  const [chartOfAccounts, setChartOfAccounts] = useState<ChartOfAccount[]>([]);

  const [entryDate, setEntryDate] = useState('');
  const [memo, setMemo] = useState('');
  const [lines, setLines] = useState<DraftLineForm[]>([emptyLine(), emptyLine()]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function refresh() {
    setDrafts([...(await accounting.generalVoucherService.listDrafts(accounting.tenantId))].reverse());
    setChartOfAccounts(await accounting.chartOfAccountService.listChartOfAccounts(accounting.tenantId));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const activeAccounts = chartOfAccounts.filter((c) => c.status === 'active');

  function glName(id: string): string {
    const coa = chartOfAccounts.find((c) => c.id === id);
    return coa ? `${coa.code} ${coa.name}` : id;
  }

  function updateLine(index: number, patch: Partial<DraftLineForm>) {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  function resetForm() {
    setEntryDate('');
    setMemo('');
    setLines([emptyLine(), emptyLine()]);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      await accounting.generalVoucherService.createDraft(accounting.tenantId, {
        entryDate,
        memo,
        lines: lines.map((line) => ({
          chartOfAccountId: line.chartOfAccountId,
          debit: Number(line.debit) || 0,
          credit: Number(line.credit) || 0,
        })),
      });
      accounting.save();
      resetForm();
      setSuccess('傳票草稿新增成功');
      await refresh();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : '新增失敗');
    }
  }

  async function handlePost(id: string) {
    setError(null);
    setSuccess(null);
    try {
      await accounting.generalVoucherService.postDraft(accounting.tenantId, id);
      accounting.save();
      setSuccess('傳票已過帳');
      await refresh();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : '過帳失敗');
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    setSuccess(null);
    try {
      await accounting.generalVoucherService.deleteDraft(accounting.tenantId, id);
      accounting.save();
      setSuccess('草稿已刪除');
      await refresh();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : '刪除失敗');
    }
  }

  return (
    <section id="sec-general-voucher" className="panel">
      <h3>手動分錄 / 一般傳票（General Voucher）</h3>
      <p className="debug-note">
        草稿可自由新增/刪除/修改明細，過帳前完全不影響試算表、損益表、資產負債表。過帳時會一次驗證借貸平衡、科目有效性與會計期間是否已關帳，全部通過才會產生正式分錄；一旦過帳即無法修改或刪除。
      </p>

      <form className="form-grid" onSubmit={handleCreate}>
        <div>
          <label htmlFor="gv-date">交易日期</label>
          <input id="gv-date" type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="gv-memo">摘要</label>
          <input id="gv-memo" value={memo} onChange={(e) => setMemo(e.target.value)} required />
        </div>

        <div className="span-2">
          <table>
            <thead>
              <tr>
                <th>會計科目</th>
                <th>借方</th>
                <th>貸方</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => (
                <tr key={index}>
                  <td>
                    <select
                      aria-label={`gv-line-account-${index}`}
                      value={line.chartOfAccountId}
                      onChange={(e) => updateLine(index, { chartOfAccountId: e.target.value })}
                      required
                    >
                      <option value="">（請選擇科目）</option>
                      {activeAccounts.map((coa) => (
                        <option key={coa.id} value={coa.id}>
                          {coa.code} {coa.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      aria-label={`gv-line-debit-${index}`}
                      type="number"
                      min="0"
                      value={line.debit}
                      onChange={(e) => updateLine(index, { debit: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`gv-line-credit-${index}`}
                      type="number"
                      min="0"
                      value={line.credit}
                      onChange={(e) => updateLine(index, { credit: e.target.value })}
                    />
                  </td>
                  <td>
                    {lines.length > 2 && (
                      <button type="button" onClick={() => removeLine(index)}>
                        移除
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" onClick={addLine} style={{ marginTop: 8 }}>
            + 新增明細列
          </button>
        </div>

        <div className="span-2 actions">
          <button type="submit">新增傳票草稿</button>
        </div>
      </form>
      {error && <p className="error-text">{error}</p>}
      {success && <p className="success-text">{success}</p>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>日期</th>
              <th>摘要</th>
              <th>明細</th>
              <th>狀態</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {drafts.map((draft) => (
              <tr key={draft.id}>
                <td>{draft.entryDate}</td>
                <td>{draft.memo}</td>
                <td>
                  {draft.lines.map((line) => (
                    <div key={line.id}>
                      {glName(line.chartOfAccountId)}　借:{line.debit.toLocaleString()}　貸:{line.credit.toLocaleString()}
                    </div>
                  ))}
                </td>
                <td>{draft.status === 'posted' ? '已過帳' : '草稿'}</td>
                <td>
                  {draft.status === 'draft' && (
                    <>
                      <button type="button" onClick={() => handlePost(draft.id)}>
                        過帳
                      </button>{' '}
                      <button type="button" onClick={() => handleDelete(draft.id)}>
                        刪除
                      </button>
                    </>
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
