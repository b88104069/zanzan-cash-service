import { useEffect, useState } from 'react';
import { useLocalServices } from '../../localdb/LocalDataProvider.js';
import { useAccountingServices } from '../../localdb/accounting/AccountingDataProvider.js';
import type { Account, Category } from '../../api/types.js';
import type { AccountMapping, CategoryMapping, ChartOfAccount, ChartOfAccountType } from '../../../../backend/src/domain/accounting/types.js';

const COA_TYPES: ChartOfAccountType[] = ['asset', 'liability', 'equity', 'revenue', 'expense'];

export function ChartOfAccountsManage({ refreshKey, onChanged }: { refreshKey: number; onChanged: () => void }) {
  const cash = useLocalServices();
  const accounting = useAccountingServices();

  const [chartOfAccounts, setChartOfAccounts] = useState<ChartOfAccount[]>([]);
  const [accountMappings, setAccountMappings] = useState<AccountMapping[]>([]);
  const [categoryMappings, setCategoryMappings] = useState<CategoryMapping[]>([]);
  const [cashAccounts, setCashAccounts] = useState<Account[]>([]);
  const [cashCategories, setCashCategories] = useState<Category[]>([]);

  const [newCoaCode, setNewCoaCode] = useState('');
  const [newCoaName, setNewCoaName] = useState('');
  const [newCoaType, setNewCoaType] = useState<ChartOfAccountType>('asset');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function refresh() {
    setChartOfAccounts(await accounting.chartOfAccountService.listChartOfAccounts(accounting.tenantId));
    setAccountMappings(await accounting.chartOfAccountService.listAccountMappings(accounting.tenantId));
    setCategoryMappings(await accounting.chartOfAccountService.listCategoryMappings(accounting.tenantId));
    setCashAccounts((await cash.accountService.listForAdmin(cash.tenantId)) as unknown as Account[]);
    setCashCategories((await cash.categoryService.listForAdmin(cash.tenantId)) as unknown as Category[]);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  async function handleCreateCoa(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      await accounting.chartOfAccountService.createChartOfAccount(accounting.tenantId, {
        code: newCoaCode,
        name: newCoaName,
        type: newCoaType,
      });
      accounting.save();
      setNewCoaCode('');
      setNewCoaName('');
      setSuccess('會計科目新增成功');
      await refresh();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : '新增失敗');
    }
  }

  async function handleAccountMapping(cashAccountId: string, chartOfAccountId: string) {
    if (!chartOfAccountId) return;
    await accounting.chartOfAccountService.setAccountMapping(accounting.tenantId, cashAccountId, chartOfAccountId);
    accounting.save();
    await refresh();
    onChanged();
  }

  async function handleCategoryMapping(cashCategoryName: string, chartOfAccountId: string) {
    if (!chartOfAccountId) return;
    await accounting.chartOfAccountService.setCategoryMapping(accounting.tenantId, cashCategoryName, chartOfAccountId);
    accounting.save();
    await refresh();
    onChanged();
  }

  return (
    <section id="sec-coa" className="panel">
      <h3>會計科目表（Chart of Accounts）</h3>

      <form className="form-grid" onSubmit={handleCreateCoa}>
        <div>
          <label htmlFor="coa-code">科目代碼</label>
          <input id="coa-code" value={newCoaCode} onChange={(e) => setNewCoaCode(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="coa-name">科目名稱</label>
          <input id="coa-name" value={newCoaName} onChange={(e) => setNewCoaName(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="coa-type">科目類型</label>
          <select id="coa-type" value={newCoaType} onChange={(e) => setNewCoaType(e.target.value as ChartOfAccountType)}>
            {COA_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="span-2 actions">
          <button type="submit">新增會計科目</button>
        </div>
      </form>
      {error && <p className="error-text">{error}</p>}
      {success && <p className="success-text">{success}</p>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>代碼</th>
              <th>名稱</th>
              <th>類型</th>
            </tr>
          </thead>
          <tbody>
            {chartOfAccounts.map((coa) => (
              <tr key={coa.id}>
                <td>{coa.code}</td>
                <td>{coa.name}</td>
                <td>{coa.type}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>帳戶對應（Account Mapping）</h3>
      <p className="debug-note">將記帳模組的「帳戶」對應到會計科目表的 GL 科目。未設定對應的帳戶，其交易會標示為「待設定科目對應」，不會自動產生分錄。</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>記帳帳戶</th>
              <th>對應會計科目</th>
            </tr>
          </thead>
          <tbody>
            {cashAccounts.map((account) => {
              const mapping = accountMappings.find((m) => m.cashAccountId === account.id);
              return (
                <tr key={account.id}>
                  <td>{account.accountName}</td>
                  <td>
                    <select
                      value={mapping?.chartOfAccountId ?? ''}
                      onChange={(e) => handleAccountMapping(account.id, e.target.value)}
                    >
                      <option value="">（未設定 / Unmapped）</option>
                      {chartOfAccounts.map((coa) => (
                        <option key={coa.id} value={coa.id}>
                          {coa.code} {coa.name}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h3>科目對應（Category Mapping）</h3>
      <p className="debug-note">
        將記帳模組的「科目」對應到會計科目表的 GL 科目。目前以科目名稱作為對應鍵值——已知限制：未來若記帳模組科目可重新命名，此對應可能失效，正式版本應改用穩定識別碼。
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>記帳科目</th>
              <th>收支類型</th>
              <th>對應會計科目</th>
            </tr>
          </thead>
          <tbody>
            {cashCategories.map((category) => {
              const mapping = categoryMappings.find((m) => m.cashCategoryName === category.categoryName);
              return (
                <tr key={category.id}>
                  <td>{category.categoryName}</td>
                  <td>{category.categoryType === 'income' ? '收入' : '支出'}</td>
                  <td>
                    <select
                      value={mapping?.chartOfAccountId ?? ''}
                      onChange={(e) => handleCategoryMapping(category.categoryName, e.target.value)}
                    >
                      <option value="">（未設定 / Unmapped）</option>
                      {chartOfAccounts.map((coa) => (
                        <option key={coa.id} value={coa.id}>
                          {coa.code} {coa.name}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
