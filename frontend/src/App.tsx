import { LocalDataProvider } from './localdb/LocalDataProvider';
import { Dashboard } from './features/Dashboard';
import { AccountingPage } from './features/accounting/AccountingPage';
import { ModuleShell } from './shell/ModuleShell';
import { useHashRoute } from './routing/useHashRoute';
import './styles.css';

/**
 * Gate 5 (ACTIVE) — Public Prototype Deployment: no login, no backend
 * server, no multi-tenant switching. The Gate 3/4 HTTP-based
 * AuthProvider/AuthGate/TenantProvider/TenantSwitcher components are kept
 * in the repo unmodified (not deleted) for a possible future real-backend
 * integration, but are not used in this build — see
 * reports/gate-5-delta-report.md DEVIATIONS.
 *
 * Accounting Module Prototype v0.1 adds a second ERP module page, routed
 * by a minimal hash router (#/cash, #/accounting — see
 * src/routing/useHashRoute.ts) rather than a full routing framework. Both
 * modules render inside the same LocalDataProvider (Cash Module data),
 * since Accounting Module reads Cash Module data read-only.
 */
export default function App() {
  const [module, navigate] = useHashRoute();

  return (
    <LocalDataProvider>
      <ModuleShell active={module} onNavigate={navigate}>
        {module === 'accounting' ? <AccountingPage /> : <Dashboard />}
      </ModuleShell>
    </LocalDataProvider>
  );
}
