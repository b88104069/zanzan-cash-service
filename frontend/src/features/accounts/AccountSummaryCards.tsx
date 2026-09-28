import { useEffect, useState } from 'react';
import { useApi } from '../../api/useApi';
import type { AccountSummary } from '../../api/types';

function formatNumber(n: number): string {
  return n.toLocaleString('zh-TW');
}

/** Parity: legacy 帳戶餘額 section. */
export function AccountSummaryCards({ refreshKey }: { refreshKey: number }) {
  const api = useApi();
  const [summaries, setSummaries] = useState<AccountSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<{ data: AccountSummary[] }>('/accounts/summary')
      .then((res) => {
        if (!cancelled) setSummaries(res.data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : '讀取帳戶餘額失敗');
      });
    return () => {
      cancelled = true;
    };
  }, [api, refreshKey]);

  if (error) return <div className="error-text">{error}</div>;
  if (!summaries) return <div>讀取中...</div>;
  if (summaries.length === 0) return <div className="empty-text">尚無帳戶</div>;

  return (
    <div className="account-summary-grid">
      {summaries.map((account) => (
        <div className="account-card" key={account.id}>
          <div className="account-card-name">{account.accountName}</div>
          <div className="account-card-row">收入：{formatNumber(account.totalIncome)}</div>
          <div className="account-card-row">支出：{formatNumber(account.totalExpense)}</div>
          <div className="account-card-balance">餘額：{formatNumber(account.balance)}</div>
        </div>
      ))}
    </div>
  );
}
