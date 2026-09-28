import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useLocalServices } from '../LocalDataProvider.js';
import { initAccountingServices, type AccountingServices } from './accountingServices.js';

const AccountingDataContext = createContext<AccountingServices | null>(null);

export function AccountingDataProvider({ children }: { children: ReactNode }) {
  const cash = useLocalServices();
  const [services, setServices] = useState<AccountingServices | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initAccountingServices(cash)
      .then(setServices)
      .catch((err) => setError(err instanceof Error ? err.message : '無法初始化會計模組資料'));
    // cash services are created once for the app's lifetime by LocalDataProvider, so this effect intentionally runs once too.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) return <div className="error-text" style={{ padding: 24 }}>會計模組初始化失敗：{error}</div>;
  if (!services) return <div style={{ padding: 24 }}>會計模組載入中...</div>;

  return <AccountingDataContext.Provider value={services}>{children}</AccountingDataContext.Provider>;
}

export function useAccountingServices(): AccountingServices {
  const ctx = useContext(AccountingDataContext);
  if (!ctx) throw new Error('useAccountingServices must be used within AccountingDataProvider');
  return ctx;
}
