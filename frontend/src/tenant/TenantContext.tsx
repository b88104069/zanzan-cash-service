import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiFetch } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import type { Tenant } from '../api/types';

const STORAGE_KEY = 'zzcs_tenant';

interface TenantContextValue {
  tenants: Tenant[];
  currentTenantId: string | null;
  currentTenant: Tenant | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  switchTenant: (tenantId: string) => void;
  createTenant: (companyName: string) => Promise<void>;
}

const TenantContext = createContext<TenantContextValue | null>(null);

/**
 * Standalone equivalent of the legacy "公司" switcher — but per
 * docs/architecture/domain-boundaries.md's deliberate deviation, "current
 * tenant" is client-side state (which tenant this browser tab is looking
 * at) sent as an explicit X-Tenant-Id header on every request, not
 * server-side session state the way the legacy `zz_default_tenant_id`
 * user meta worked.
 */
export function TenantProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [currentTenantId, setCurrentTenantId] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch<{ data: Tenant[] }>('/tenants', { token });
      setTenants(result.data);
      setCurrentTenantId((current) => {
        if (current && result.data.some((t) => t.id === current)) return current;
        return result.data[0]?.id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '無法讀取公司清單');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (currentTenantId) localStorage.setItem(STORAGE_KEY, currentTenantId);
  }, [currentTenantId]);

  const switchTenant = useCallback((tenantId: string) => {
    setCurrentTenantId(tenantId);
  }, []);

  const createTenant = useCallback(
    async (companyName: string) => {
      if (!token) return;
      await apiFetch<{ data: Tenant }>('/tenants', { method: 'POST', token, body: { companyName } });
      await refresh();
    },
    [token, refresh],
  );

  const currentTenant = useMemo(
    () => tenants.find((t) => t.id === currentTenantId) ?? null,
    [tenants, currentTenantId],
  );

  const value = useMemo<TenantContextValue>(
    () => ({ tenants, currentTenantId, currentTenant, loading, error, refresh, switchTenant, createTenant }),
    [tenants, currentTenantId, currentTenant, loading, error, refresh, switchTenant, createTenant],
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant must be used within TenantProvider');
  return ctx;
}
