import { useEffect, useState } from 'react';
import { useApi } from '../../api/useApi';
import type { CategoryType } from '../../api/types';

export interface CategoryOption {
  name: string;
  type: CategoryType;
}

/** Active account names + categories, for the entry/transfer form dropdowns. Re-fetches whenever refreshKey changes. */
export function useOptions(refreshKey: number) {
  const api = useApi();
  const [accounts, setAccounts] = useState<string[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api<{ data: string[] }>('/accounts'), api<{ data: CategoryOption[] }>('/categories')])
      .then(([accountsRes, categoriesRes]) => {
        if (cancelled) return;
        setAccounts(accountsRes.data);
        setCategories(categoriesRes.data);
      })
      .catch(() => {
        if (!cancelled) {
          setAccounts([]);
          setCategories([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [api, refreshKey]);

  return { accounts, categories };
}
