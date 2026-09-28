import { useState } from 'react';
import { useTenant } from '../tenant/TenantContext';
import { TenantSwitcher } from '../tenant/TenantSwitcher';
import { EntryForm } from './cashbook/EntryForm';
import { EntryList } from './cashbook/EntryList';
import { SummaryCards } from './cashbook/SummaryCards';
import { AccountSummaryCards } from './accounts/AccountSummaryCards';
import { AccountManage } from './accounts/AccountManage';
import { CategoryManage } from './categories/CategoryManage';
import { TransferForm } from './transfer/TransferForm';
import type { CashEntry } from '../api/types';

const NAV_ITEMS = [
  { href: '#sec-entry', label: '記帳' },
  { href: '#sec-summary', label: '儀表板' },
  { href: '#sec-transfer', label: '轉帳' },
  { href: '#sec-accounts', label: '帳戶設定' },
  { href: '#sec-categories', label: '科目設定' },
  { href: '#sec-list', label: '明細表' },
];

/** The main workspace, shown once a user is logged in and (optionally) has a tenant selected. */
export function Dashboard() {
  const { loading, currentTenantId, tenants } = useTenant();
  const [refreshKey, setRefreshKey] = useState(0);
  const [editingEntry, setEditingEntry] = useState<CashEntry | null>(null);

  const bump = () => setRefreshKey((k) => k + 1);
  const hasTenant = Boolean(currentTenantId);

  return (
    <div className="wrap">
      <h2>贊贊記帳</h2>

      {hasTenant && (
        <nav className="top-nav">
          {NAV_ITEMS.map((item) => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>
      )}

      {!loading && !hasTenant && tenants.length === 0 && (
        <div className="welcome-box">
          <h3>歡迎使用贊贊記帳！</h3>
          <p>請先建立您的第一家公司（或帳本）來開始使用。</p>
        </div>
      )}

      <TenantSwitcher />

      {hasTenant && (
        <>
          <EntryForm editingEntry={editingEntry} onCancelEdit={() => setEditingEntry(null)} onSaved={bump} refreshKey={refreshKey} />

          <section id="sec-summary" className="panel">
            <h3>儀表板</h3>
            <SummaryCards refreshKey={refreshKey} />
            <h3>帳戶餘額</h3>
            <AccountSummaryCards refreshKey={refreshKey} />
          </section>

          <TransferForm refreshKey={refreshKey} onSaved={bump} />
          <AccountManage refreshKey={refreshKey} onChanged={bump} />
          <CategoryManage refreshKey={refreshKey} onChanged={bump} />
          <EntryList
            refreshKey={refreshKey}
            onEdit={(entry) => {
              setEditingEntry(entry);
              document.getElementById('sec-entry')?.scrollIntoView({ behavior: 'smooth' });
            }}
            onDeleted={bump}
          />
        </>
      )}
    </div>
  );
}
