import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { apiFetch } from '../api/client';
import type { User } from '../api/types';

interface AuthState {
  token: string | null;
  user: User | null;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const STORAGE_KEY = 'zzcs_auth';

const AuthContext = createContext<AuthContextValue | null>(null);

function loadStoredAuth(): AuthState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { token: null, user: null };
    return JSON.parse(raw) as AuthState;
  } catch {
    return { token: null, user: null };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(loadStoredAuth);

  const persist = useCallback((next: AuthState) => {
    setState(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // localStorage may be unavailable (private mode); auth still works for this session.
    }
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await apiFetch<{ token: string; user: User }>('/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      persist({ token: result.token, user: result.user });
    },
    [persist],
  );

  const register = useCallback(
    async (email: string, password: string) => {
      const result = await apiFetch<{ token: string; user: User }>('/auth/register', {
        method: 'POST',
        body: { email, password },
      });
      persist({ token: result.token, user: result.user });
    },
    [persist],
  );

  const logout = useCallback(() => {
    persist({ token: null, user: null });
    try {
      localStorage.removeItem('zzcs_tenant');
    } catch {
      // ignore
    }
  }, [persist]);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, login, register, logout }),
    [state, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
