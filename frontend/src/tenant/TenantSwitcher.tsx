import { useState, type FormEvent } from 'react';
import { useTenant } from './TenantContext';
import { ApiError } from '../api/client';

/** Parity: legacy 公司 dropdown + 新增公司 box. */
export function TenantSwitcher() {
  const { tenants, currentTenantId, switchTenant, createTenant } = useTenant();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('請先填寫公司名稱');
      return;
    }
    setSubmitting(true);
    try {
      await createTenant(name.trim());
      setName('');
      setShowCreate(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '建立公司失敗');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="tenant-row">
      <label htmlFor="tenant-select">公司：</label>
      <select id="tenant-select" value={currentTenantId ?? ''} onChange={(e) => switchTenant(e.target.value)}>
        {tenants.length === 0 && <option value="">尚無公司</option>}
        {tenants.map((t) => (
          <option key={t.id} value={t.id}>
            {t.companyName}
          </option>
        ))}
      </select>
      <button type="button" className="small-btn" onClick={() => setShowCreate((v) => !v)}>
        ＋新增公司
      </button>

      {showCreate && (
        <form onSubmit={handleCreate} className="create-tenant-box">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：贊贊投資帳" autoFocus />
          <button type="submit" className="small-btn primary" disabled={submitting}>
            建立公司
          </button>
          <button type="button" className="small-btn" onClick={() => setShowCreate(false)}>
            取消
          </button>
          {error && <div className="error-text">{error}</div>}
        </form>
      )}
    </div>
  );
}
