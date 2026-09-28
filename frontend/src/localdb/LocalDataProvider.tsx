import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { initLocalServices, type LocalServices } from './services.js';

const LocalDataContext = createContext<LocalServices | null>(null);

export function LocalDataProvider({ children }: { children: ReactNode }) {
  const [services, setServices] = useState<LocalServices | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initLocalServices()
      .then(setServices)
      .catch((err) => setError(err instanceof Error ? err.message : '無法初始化本地資料'));
  }, []);

  if (error) return <div className="error-text" style={{ padding: 24 }}>初始化失敗：{error}</div>;
  if (!services) return <div style={{ padding: 24 }}>載入中...</div>;

  return <LocalDataContext.Provider value={services}>{children}</LocalDataContext.Provider>;
}

export function useLocalServices(): LocalServices {
  const ctx = useContext(LocalDataContext);
  if (!ctx) throw new Error('useLocalServices must be used within LocalDataProvider');
  return ctx;
}
