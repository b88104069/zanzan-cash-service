import { useState, type FormEvent, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { ApiError } from '../api/client';

/** Parity: legacy "請先登入" paywall screen, but with real register/login instead of WordPress's own login page. */
export function AuthGate({ children }: { children: ReactNode }) {
  const { token, login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (token) return <>{children}</>;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'login') await login(email, password);
      else await register(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '發生錯誤，請稍後再試');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="paywall-wrap">
      <h2>贊贊記帳</h2>
      <p>{mode === 'login' ? '請登入以使用記帳系統' : '建立一個新帳號'}</p>
      <form onSubmit={handleSubmit} className="auth-form">
        <input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input type="password" required placeholder="密碼" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button type="submit" disabled={submitting}>
          {mode === 'login' ? '登入' : '註冊'}
        </button>
      </form>
      {error && <div className="error-text">{error}</div>}
      <button type="button" className="link-btn" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
        {mode === 'login' ? '還沒有帳號？註冊一個' : '已經有帳號？登入'}
      </button>
    </div>
  );
}
