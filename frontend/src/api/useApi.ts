import { useCallback } from 'react';
import { useLocalServices } from '../localdb/LocalDataProvider.js';
import { localApiCall } from '../localdb/localRouter.js';
import type { RequestOptions } from './client.js';

/**
 * Gate 5 (ACTIVE): dispatches to the local, browser-persisted domain
 * services instead of the Gate 3 HTTP API — see
 * docs/gates/kickoff-contract.md Gate 5 (ACTIVE) "migration/refactor
 * principle". Every component that calls `useApi()` (EntryForm, EntryList,
 * AccountManage, CategoryManage, TransferForm, useOptions, SummaryCards,
 * AccountSummaryCards) is unchanged — same path/method/body/query call
 * shape as before, only the transport changed.
 */
export function useApi() {
  const services = useLocalServices();

  return useCallback(
    <T>(path: string, options: Omit<RequestOptions, 'token' | 'tenantId'> = {}) => localApiCall<T>(services, path, options),
    [services],
  );
}
