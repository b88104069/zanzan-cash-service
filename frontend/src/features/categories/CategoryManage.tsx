import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useApi } from '../../api/useApi';
import { ApiError } from '../../api/client';
import type { Category, CategoryType } from '../../api/types';

interface Props {
  refreshKey: number;
  onChanged: () => void;
}

/** Parity: legacy 科目管理 — create/update/disable/enable categories. */
export function CategoryManage({ refreshKey, onChanged }: Props) {
  const api = useApi();
  const [rows, setRows] = useState<Category[]>([]);
  const [name, setName] = useState('');
  const [type, setType] = useState<CategoryType>('expense');
  const [editId, setEditId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [tableMessage, setTableMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    api<{ data: Category[] }>('/categories/admin')
      .then((res) => setRows(res.data))
      .catch((err) => setTableMessage(err instanceof Error ? err.message : '讀取科目清單失敗'));
  }, [api]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  function resetForm() {
    setName('');
    setType('expense');
    setEditId(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (!name.trim()) return setMessage({ text: '請填寫科目名稱', isError: true });

    const body = { categoryName: name, categoryType: type };
    try {
      if (editId) {
        await api(`/categories/${editId}`, { method: 'PUT', body });
        setMessage({ text: '科目更新成功', isError: false });
      } else {
        await api('/categories', { method: 'POST', body });
        setMessage({ text: '科目新增成功', isError: false });
      }
      resetForm();
      load();
      onChanged();
    } catch (err) {
      setMessage({ text: err instanceof ApiError ? err.message : '操作失敗', isError: true });
    }
  }

  function startEdit(category: Category) {
    setEditId(category.id);
    setName(category.categoryName);
    setType(category.categoryType);
    setMessage(null);
  }

  async function toggleStatus(category: Category) {
    setTableMessage(null);
    try {
      await api(`/categories/${category.id}/${category.status === 'active' ? 'disable' : 'enable'}`, { method: 'POST' });
      load();
      onChanged();
    } catch (err) {
      setTableMessage(err instanceof ApiError ? err.message : '操作失敗');
    }
  }

  return (
    <section id="sec-categories" className="panel">
      <h3>科目管理</h3>
      <form onSubmit={handleSubmit} className="form-grid">
        <div>
          <label htmlFor="category-name">科目名稱</label>
          <input id="category-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：餐費、一般收入" />
        </div>
        <div>
          <label htmlFor="category-type">收支類型</label>
          <select id="category-type" value={type} onChange={(e) => setType(e.target.value as CategoryType)}>
            <option value="expense">支出</option>
            <option value="income">收入</option>
          </select>
        </div>
        <div className="actions">
          <button type="submit">{editId ? '更新科目' : '新增科目'}</button>
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
              <th>科目名稱</th>
              <th>收支類型</th>
              <th>狀態</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((category) => (
              <tr key={category.id}>
                <td>{category.categoryName}</td>
                <td>{category.categoryType === 'income' ? '收入' : '支出'}</td>
                <td>{category.status === 'active' ? '啟用中' : '已停用'}</td>
                <td className="row-actions">
                  <button type="button" className="small-btn" onClick={() => startEdit(category)}>
                    編輯
                  </button>
                  <button type="button" className={`small-btn ${category.status === 'active' ? 'danger' : ''}`} onClick={() => toggleStatus(category)}>
                    {category.status === 'active' ? '停用' : '啟用'}
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
