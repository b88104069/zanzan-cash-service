import { useEffect, useState, type FormEvent } from 'react';
import { useApi } from '../../api/useApi';
import { ApiError } from '../../api/client';
import type { CashEntry, CategoryType } from '../../api/types';
import { useOptions } from './useOptions';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

interface Props {
  editingEntry: CashEntry | null;
  onCancelEdit: () => void;
  onSaved: () => void;
  refreshKey: number;
}

/** Parity: legacy 記帳 form (zzscs-form) — add or edit one income/expense entry. */
export function EntryForm({ editingEntry, onCancelEdit, onSaved, refreshKey }: Props) {
  const api = useApi();
  const { accounts, categories } = useOptions(refreshKey);

  const [date, setDate] = useState(todayIso());
  const [account, setAccount] = useState('');
  const [type, setType] = useState<CategoryType>('expense');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('0');
  const [memo, setMemo] = useState('');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!editingEntry) return;
    setDate(editingEntry.entryDate);
    setAccount(editingEntry.accountName);
    setMemo(editingEntry.memo);
    setNote(editingEntry.note);
    if (editingEntry.income > 0) {
      setType('income');
      setAmount(String(editingEntry.income));
    } else {
      setType('expense');
      setAmount(String(editingEntry.expense));
    }
    setCategory(editingEntry.category);
    setMessage(null);
  }, [editingEntry]);

  function resetForm() {
    setDate(todayIso());
    setAccount('');
    setType('expense');
    setCategory('');
    setAmount('0');
    setMemo('');
    setNote('');
  }

  const filteredCategories = categories.filter((c) => c.type === type);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);

    const numericAmount = parseFloat(amount) || 0;
    if (!date) return setMessage({ text: '請先填寫日期', isError: true });
    if (!account) return setMessage({ text: '請選擇帳戶', isError: true });
    if (!category) return setMessage({ text: '請填寫科目', isError: true });
    if (numericAmount <= 0) return setMessage({ text: '請輸入大於0的金額', isError: true });
    if (!memo) return setMessage({ text: '請先填寫摘要', isError: true });

    const payload = {
      date,
      memo,
      category,
      account,
      income: type === 'income' ? numericAmount : 0,
      expense: type === 'expense' ? numericAmount : 0,
      note,
    };

    setSubmitting(true);
    try {
      if (editingEntry) {
        await api(`/cash-entries/${editingEntry.id}`, { method: 'PUT', body: payload });
        setMessage({ text: '更新成功', isError: false });
        onCancelEdit();
      } else {
        const result = await api<{ data: { id: string } }>('/cash-entries', { method: 'POST', body: payload });
        setMessage({ text: `記帳成功，編號：${result.data.id}`, isError: false });
      }
      resetForm();
      onSaved();
    } catch (err) {
      const text = err instanceof ApiError ? err.message : '送出失敗';
      setMessage({ text, isError: true });
    } finally {
      setSubmitting(false);
    }
  }

  function handleCancelEdit() {
    resetForm();
    setMessage(null);
    onCancelEdit();
  }

  return (
    <section id="sec-entry" className="panel">
      <h3>記帳</h3>
      <form onSubmit={handleSubmit} className="form-grid">
        <div>
          <label htmlFor="entry-date">日期</label>
          <input id="entry-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label htmlFor="entry-account">帳戶</label>
          <select id="entry-account" value={account} onChange={(e) => setAccount(e.target.value)}>
            <option value="">-- 請選擇帳戶 --</option>
            {accounts.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="entry-type">收支類型</label>
          <select id="entry-type" value={type} onChange={(e) => setType(e.target.value as CategoryType)}>
            <option value="expense">支出</option>
            <option value="income">收入</option>
          </select>
        </div>
        <div>
          <label htmlFor="entry-category">科目</label>
          <input
            id="entry-category"
            list="entry-category-list"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="下拉選擇或自行輸入"
            autoComplete="off"
          />
          <datalist id="entry-category-list">
            {filteredCategories.map((c) => (
              <option key={c.name} value={c.name} />
            ))}
          </datalist>
        </div>
        <div>
          <label htmlFor="entry-amount">金額</label>
          <input id="entry-amount" type="number" min={0} step={1} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div>
          <label htmlFor="entry-memo">摘要</label>
          <input id="entry-memo" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="例如：午餐、專案尾款" />
        </div>
        <div className="span-2">
          <label htmlFor="entry-note">備註</label>
          <textarea id="entry-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div className="span-2 actions">
          <button type="submit" disabled={submitting}>
            {editingEntry ? '更新記帳' : '送出記帳'}
          </button>
          {editingEntry && (
            <button type="button" className="secondary" onClick={handleCancelEdit}>
              取消編輯
            </button>
          )}
        </div>
      </form>
      {message && <div className={message.isError ? 'error-text' : 'success-text'}>{message.text}</div>}
    </section>
  );
}
