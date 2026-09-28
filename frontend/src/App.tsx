import { AuthProvider, useAuth } from './auth/AuthContext';
import { AuthGate } from './auth/AuthGate';
import { TenantProvider } from './tenant/TenantContext';
import { Dashboard } from './features/Dashboard';
import './styles.css';

function LogoutButton() {
  const { logout, user } = useAuth();
  if (!user) return null;
  return (
    <div className="top-bar">
      <span>{user.email}</span>
      <button type="button" className="small-btn" onClick={logout}>
        登出
      </button>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <LogoutButton />
      <AuthGate>
        <TenantProvider>
          <Dashboard />
        </TenantProvider>
      </AuthGate>
    </AuthProvider>
  );
}
