import { LocalDataProvider } from './localdb/LocalDataProvider';
import { Dashboard } from './features/Dashboard';
import './styles.css';

/**
 * Gate 5 (ACTIVE) — Public Prototype Deployment: no login, no backend
 * server, no multi-tenant switching. The Gate 3/4 HTTP-based
 * AuthProvider/AuthGate/TenantProvider/TenantSwitcher components are kept
 * in the repo unmodified (not deleted) for a possible future real-backend
 * integration, but are not used in this build — see
 * reports/gate-5-delta-report.md DEVIATIONS.
 */
export default function App() {
  return (
    <LocalDataProvider>
      <Dashboard />
    </LocalDataProvider>
  );
}
