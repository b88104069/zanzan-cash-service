import { useState } from 'react';
import { AccountingDataProvider } from '../../localdb/accounting/AccountingDataProvider.js';
import { AccountingDashboard } from './AccountingDashboard.js';
import { ChartOfAccountsManage } from './ChartOfAccountsManage.js';
import { JournalEntryList } from './JournalEntryList.js';
import { VoucherView } from './VoucherView.js';
import { TrialBalanceView } from './TrialBalanceView.js';
import { IncomeStatementView } from './IncomeStatementView.js';
import { BalanceSheetView } from './BalanceSheetView.js';

const NAV_ITEMS = [
  { href: '#sec-accounting-dashboard', label: '儀表板' },
  { href: '#sec-coa', label: '會計科目 / 對應' },
  { href: '#sec-journal-entries', label: '分錄' },
  { href: '#sec-vouchers', label: '傳票' },
  { href: '#sec-trial-balance', label: '試算表' },
  { href: '#sec-income-statement', label: '損益表' },
  { href: '#sec-balance-sheet', label: '資產負債表' },
];

/**
 * Accounting Module — a second, independent ERP module page (see
 * docs/architecture/accounting-module-v0.1.md, v0.2.md). Reads Cash Module
 * data (via LocalDataProvider, already mounted by App.tsx) but never
 * writes to it; keeps its own state entirely inside AccountingDataProvider.
 * v0.2 adds three read-only financial statements (Trial Balance, Income
 * Statement, Balance Sheet), all derived from v0.1's JournalEntry/
 * JournalLine/ChartOfAccount data — see TrialBalanceView/IncomeStatementView/
 * BalanceSheetView, each of which surfaces the GL-only limitation notice.
 */
export function AccountingPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const bump = () => setRefreshKey((k) => k + 1);

  return (
    <AccountingDataProvider>
      <div className="wrap">
        <h2>贊贊 ERP — 會計模組（Prototype v0.2）</h2>
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
        <TrialBalanceView />
        <IncomeStatementView />
        <BalanceSheetView />
      </div>
    </AccountingDataProvider>
  );
}
