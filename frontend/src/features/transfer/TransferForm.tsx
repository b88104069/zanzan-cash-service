import { useState, type FormEvent } from 'react';
import { useApi } from '../../api/useApi';
import { ApiError } from '../../api/client';
import { useOptions } from '../cashbook/useOptions';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

interface Props {
  refreshKey: number;
  onSaved: () => void;
}

/** Parity: legacy 帳戶轉帳 form. */
export function TransferForm({ refreshKey, onSaved }: Props) {
  const api = useApi();
  const { accounts } = useOptions(refreshKey);

  const [date, setDate] = useState(todayIso());
  const [amount, setAmount] = useState('0');
  const [fromAccount, setFromAccount] = useState('');
  const [toAccount, setToAccount] = useState('');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function resetForm() {
    setDate(todayIso());
    setAmount('0');
    setFromAccount('');
    setToAccount('');
    setNote('');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);

    const numericAmount = parseFloat(amount) || 0;
    if (!date) return setMessage({ text: '請填寫轉帳日期', isError: true });
    if (!fromAccount) return setMessage({ text: '請選擇轉出帳戶', isError: true });
    if (!toAccount) return setMessage({ text: '請選擇轉入帳戶', isError: true });
    if (fromAccount === toAccount) return setMessage({ text: '轉出帳戶與轉入帳戶不可相同', isError: true });
    if (numericAmount <= 0) return setMessage({ text: '轉帳金額必須大於0', isError: true });

    setSubmitting(true);
    try {
      await api('/transfers', {
        method: 'POST',
        body: { date, from_account: fromAccount, to_account: toAccount, amount: numericAmount, note },
      });
      setMessage({ text: '轉帳成功', isError: false });
      resetForm();
      onSaved();
    } catch (err) {
      setMessage({ text: err instanceof ApiError ? err.message : '轉帳失敗', isError: true });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section id="sec-transfer" className="panel">
      <h3>帳戶轉帳</h3>
      <form onSubmit={handleSubmit} className="form-grid">
        <div>
          <label htmlFor="transfer-date">日期</label>
          <input id="transfer-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label htmlFor="transfer-amount">金額</label>
          <input id="transfer-amount" type="number" min={0} step={1} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div>
          <label htmlFor="transfer-from">轉出帳戶</label>
          <select id="transfer-from" value={fromAccount} onChange={(e) => setFromAccount(e.target.value)}>
            <option value="">-- 請選擇帳戶 --</option>
            {accounts.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="transfer-to">轉入帳戶</label>
          <select id="transfer-to" value={toAccount} onChange={(e) => setToAccount(e.target.value)}>
            <option value="">-- 請選擇帳戶 --</option>
            {accounts.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div className="span-2">
          <label htmlFor="transfer-note">備註</label>
          <textarea id="transfer-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="例如：提款備用" />
        </div>
        <div className="span-2 actions">
          <button type="submit" disabled={submitting}>
            送出轉帳
          </button>
        </div>
      </form>
      {message && <div className={message.isError ? 'error-text' : 'success-text'}>{message.text}</div>}
    </section>
  );
}
