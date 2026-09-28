import { useEffect, useState } from 'react';
import { useAccountingServices } from '../../localdb/accounting/AccountingDataProvider.js';
import type { ChartOfAccount, Voucher } from '../../../../backend/src/domain/accounting/types.js';
import type { JournalEntryWithLines } from '../../../../backend/src/domain/accounting/repositories/JournalEntryRepository.js';

export function VoucherView({ refreshKey }: { refreshKey: number }) {
  const accounting = useAccountingServices();
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntryWithLines[]>([]);
  const [chartOfAccounts, setChartOfAccounts] = useState<ChartOfAccount[]>([]);

  useEffect(() => {
    accounting.voucherService.listVouchers(accounting.tenantId).then((rows) => setVouchers([...rows].reverse()));
    accounting.journalEntryService.listJournalEntries(accounting.tenantId).then(setJournalEntries);
    accounting.chartOfAccountService.listChartOfAccounts(accounting.tenantId).then(setChartOfAccounts);
  }, [refreshKey, accounting]);

  function glName(id: string): string {
    const coa = chartOfAccounts.find((c) => c.id === id);
    return coa ? coa.name : id;
  }

  return (
    <section id="sec-vouchers" className="panel">
      <h3>傳票（Vouchers）</h3>
      {vouchers.length === 0 ? (
        <p className="empty-text">尚無傳票。</p>
      ) : (
        vouchers.map((voucher) => {
          // v0.1: exactly one journal entry per voucher.
          const journalEntry = journalEntries.find((j) => j.id === voucher.journalEntryIds[0]);
          const debitLine = journalEntry?.lines.find((l) => l.debit > 0);
          const creditLine = journalEntry?.lines.find((l) => l.credit > 0);
          return (
            <div key={voucher.id} className="card" style={{ marginBottom: 12, fontFamily: 'ui-monospace, Consolas, monospace' }}>
              <div>
                傳票 <strong>{voucher.voucherNo}</strong>
              </div>
              <div>日期：{voucher.voucherDate}</div>
              <div style={{ marginTop: 8 }}>
                借：{debitLine ? `${glName(debitLine.chartOfAccountId)}　${debitLine.debit.toLocaleString()}` : '-'}
              </div>
              <div>
                貸：{creditLine ? `${glName(creditLine.chartOfAccountId)}　${creditLine.credit.toLocaleString()}` : '-'}
              </div>
            </div>
          );
        })
      )}
    </section>
  );
}
