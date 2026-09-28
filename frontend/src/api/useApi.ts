import { useCallback } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useTenant } from '../tenant/TenantContext';
import { apiFetch, type RequestOptions } from './client';

/** Convenience wrapper: every tenant-scoped call needs the same token + X-Tenant-Id pair. */
export function useApi() {
  const { token } = useAuth();
  const { currentTenantId } = useTenant();

  return useCallback(
    <T>(path: string, options: Omit<RequestOptions, 'token' | 'tenantId'> = {}) =>
      apiFetch<T>(path, { ...options, token, tenantId: currentTenantId }),
    [token, currentTenantId],
  );
}
