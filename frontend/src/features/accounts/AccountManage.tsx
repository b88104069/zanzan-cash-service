import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useApi } from '../../api/useApi';
import { ApiError } from '../../api/client';
import type { Account } from '../../api/types';

interface Props {
  refreshKey: number;
  onChanged: () => void;
}

/** Parity: legacy 帳戶管理 — create/update/disable/enable accounts. */
export function AccountManage({ refreshKey, onChanged }: Props) {
  const api = useApi();
  const [rows, setRows] = useState<Account[]>([]);
  const [name, setName] = useState('');
  const [type, setType] = useState('cash');
  const [opening, setOpening] = useState('0');
  const [editId, setEditId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [tableMessage, setTableMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    api<{ data: Account[] }>('/accounts/admin')
      .then((res) => setRows(res.data))
      .catch((err) => setTableMessage(err instanceof Error ? err.message : '讀取帳戶清單失敗'));
  }, [api]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  function resetForm() {
    setName('');
    setType('cash');
    setOpening('0');
    setEditId(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (!name.trim()) return setMessage({ text: '請填寫帳戶名稱', isError: true });

    const body = { accountName: name, accountType: type, openingBalance: parseFloat(opening) || 0 };
    try {
      if (editId) {
        await api(`/accounts/${editId}`, { method: 'PUT', body });
        setMessage({ text: '帳戶更新成功', isError: false });
      } else {
        await api('/accounts', { method: 'POST', body });
        setMessage({ text: '帳戶新增成功', isError: false });
      }
      resetForm();
      load();
      onChanged();
    } catch (err) {
      setMessage({ text: err instanceof ApiError ? err.message : '操作失敗', isError: true });
    }
  }

  function startEdit(account: Account) {
    setEditId(account.id);
    setName(account.accountName);
    setType(account.accountType);
    setOpening(String(account.openingBalance));
    setMessage(null);
  }

  async function toggleStatus(account: Account) {
    setTableMessage(null);
    try {
      await api(`/accounts/${account.id}/${account.status === 'active' ? 'disable' : 'enable'}`, { method: 'POST' });
      load();
      onChanged();
    } catch (err) {
      setTableMessage(err instanceof ApiError ? err.message : '操作失敗');
    }
  }

  return (
    <section id="sec-accounts" className="panel">
      <h3>帳戶管理</h3>
      <form onSubmit={handleSubmit} className="form-grid">
        <div>
          <label htmlFor="account-name">帳戶名稱</label>
          <input id="account-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：零用金、玉山銀行" />
        </div>
        <div>
          <label htmlFor="account-type">帳戶類型</label>
          <select id="account-type" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="cash">現金</option>
            <option value="bank">銀行</option>
            <option value="other">其他</option>
          </select>
        </div>
        <div>
          <label htmlFor="account-opening">期初餘額</label>
          <input id="account-opening" type="number" step={1} value={opening} onChange={(e) => setOpening(e.target.value)} />
        </div>
        <div className="actions">
          <button type="submit">{editId ? '更新帳戶' : '新增帳戶'}</button>
          {editId && (
            <button type="button" className="secondary" onClick={resetForm}>
              取消編輯
            </button>
          )}
        </div>
      </form>
      {message && <div className={message.isError ? 'error-text' : 'success-text'}>{message.text}</div>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>帳戶名稱</th>
              <th>類型</th>
              <th>期初餘額</th>
              <th>狀態</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((account) => (
              <tr key={account.id}>
                <td>{account.accountName}</td>
                <td>{account.accountType}</td>
                <td>{account.openingBalance.toLocaleString('zh-TW')}</td>
                <td>{account.status === 'active' ? '啟用中' : '已停用'}</td>
                <td className="row-actions">
                  <button type="button" className="small-btn" onClick={() => startEdit(account)}>
                    編輯
                  </button>
                  <button type="button" className={`small-btn ${account.status === 'active' ? 'danger' : ''}`} onClick={() => toggleStatus(account)}>
                    {account.status === 'active' ? '停用' : '啟用'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {tableMessage && <div className="error-text">{tableMessage}</div>}
      </div>
    </section>
  );
}
