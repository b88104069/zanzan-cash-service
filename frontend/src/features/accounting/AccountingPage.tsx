import { useState } from 'react';
import { AccountingDataProvider } from '../../localdb/accounting/AccountingDataProvider.js';
import { AccountingDashboard } from './AccountingDashboard.js';
import { ChartOfAccountsManage } from './ChartOfAccountsManage.js';
import { JournalEntryList } from './JournalEntryList.js';
import { VoucherView } from './VoucherView.js';

const NAV_ITEMS = [
  { href: '#sec-accounting-dashboard', label: '儀表板' },
  { href: '#sec-coa', label: '會計科目 / 對應' },
  { href: '#sec-journal-entries', label: '分錄' },
  { href: '#sec-vouchers', label: '傳票' },
];

/**
 * Accounting Module Prototype v0.1 — a second, independent ERP module page
 * (see docs/architecture/accounting-module-v0.1.md). Reads Cash Module
 * data (via LocalDataProvider, already mounted by App.tsx) but never
 * writes to it; keeps its own state entirely inside AccountingDataProvider.
 */
export function AccountingPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const bump = () => setRefreshKey((k) => k + 1);

  return (
    <AccountingDataProvider>
      <div className="wrap">
        <h2>贊贊 ERP — 會計模組（Prototype v0.1）</h2>
        <nav className="top-nav">
          {NAV_ITEMS.map((item) => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>
        <AccountingDashboard refreshKey={refreshKey} onProcessed={bump} />
        <ChartOfAccountsManage refreshKey={refreshKey} onChanged={bump} />
        <JournalEntryList refreshKey={refreshKey} />
        <VoucherView refreshKey={refreshKey} />
      </div>
    </AccountingDataProvider>
  );
}
