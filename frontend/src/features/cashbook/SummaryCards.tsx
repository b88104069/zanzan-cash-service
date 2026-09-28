import { useEffect, useState } from 'react';
import { useApi } from '../../api/useApi';
import type { Summary } from '../../api/types';

function formatNumber(n: number): string {
  return n.toLocaleString('zh-TW');
}

/** Parity: legacy zzscs-summary cards (總收入/總支出/目前資金餘額/本月收入/本月支出/本月損益). */
export function SummaryCards({ refreshKey }: { refreshKey: number }) {
  const api = useApi();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<Summary>('/cash-entries/summary')
      .then((data) => {
        if (!cancelled) setSummary(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : '讀取摘要失敗');
      });
    return () => {
      cancelled = true;
    };
  }, [api, refreshKey]);

  if (error) return <div className="error-text">{error}</div>;
  if (!summary) return <div>讀取中...</div>;

  const cards: { title: string; note: string; value: number }[] = [
    { title: '總收入', note: '不含轉帳', value: summary.incomeTotal },
    { title: '總支出', note: '不含轉帳', value: summary.expenseTotal },
    { title: '目前資金餘額', note: '', value: summary.balance },
    { title: '本月收入', note: '不含轉帳', value: summary.monthIncome },
    { title: '本月支出', note: '不含轉帳', value: summary.monthExpense },
    { title: '本月損益', note: '', value: summary.monthBalance },
  ];

  return (
    <div className="summary-grid">
      {cards.map((card) => (
        <div className="card" key={card.title}>
          <div className="card-title">
            {card.title}
            {card.note && <small>{card.note}</small>}
          </div>
          <div className="card-value">{formatNumber(card.value)}</div>
        </div>
      ))}
    </div>
  );
}
