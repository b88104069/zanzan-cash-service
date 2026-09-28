import { useState } from 'react';
import { EntryForm } from './cashbook/EntryForm';
import { EntryList } from './cashbook/EntryList';
import { SummaryCards } from './cashbook/SummaryCards';
import { AccountSummaryCards } from './accounts/AccountSummaryCards';
import { AccountManage } from './accounts/AccountManage';
import { CategoryManage } from './categories/CategoryManage';
import { TransferForm } from './transfer/TransferForm';
import { DebugPanel } from './debug/DebugPanel';
import type { CashEntry } from '../api/types';

const NAV_ITEMS = [
  { href: '#sec-entry', label: '記帳' },
  { href: '#sec-summary', label: '儀表板' },
  { href: '#sec-transfer', label: '轉帳' },
  { href: '#sec-accounts', label: '帳戶設定' },
  { href: '#sec-categories', label: '科目設定' },
  { href: '#sec-list', label: '明細表' },
];

/**
 * The main (and only) workspace. Gate 5 (ACTIVE) is single-test-user, no
 * login, no multi-tenant switching — by the time this renders,
 * LocalDataProvider has already auto-provisioned the one ledger this
 * prototype needs, so there's no "no tenant yet" state to branch on here
 * (unlike Gate 4's HTTP-backed version).
 */
export function Dashboard() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [editingEntry, setEditingEntry] = useState<CashEntry | null>(null);

  const bump = () => setRefreshKey((k) => k + 1);

  return (
    <div className="wrap">
      <h2>贊贊記帳（Prototype）</h2>

      <nav className="top-nav">
        {NAV_ITEMS.map((item) => (
          <a key={item.href} href={item.href}>
            {item.label}
          </a>
        ))}
      </nav>

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

      <DebugPanel refreshKey={refreshKey} />
    </div>
  );
}
