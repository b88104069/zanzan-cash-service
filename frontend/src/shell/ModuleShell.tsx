import type { ReactNode } from 'react';
import type { ModuleKey } from '../routing/useHashRoute.js';

/**
 * Shared shell used by every ERP module page (Cash today; Accounting as of
 * v0.1; Sales/Purchase in future gates can plug into MODULES without
 * touching this component). Each module renders as its own full page
 * behind its own hash route — this only supplies the top-level
 * cross-module switcher bar, not per-module navigation (each module keeps
 * its own internal nav, e.g. Cash Module's existing anchor-link nav).
 */
const MODULES: ReadonlyArray<{ key: ModuleKey; label: string }> = [
  { key: 'cash', label: '記帳模組' },
  { key: 'accounting', label: '會計模組' },
];

export function ModuleShell({ active, onNavigate, children }: { active: ModuleKey; onNavigate: (module: ModuleKey) => void; children: ReactNode }) {
  return (
    <div>
      <div className="module-switcher">
        {MODULES.map((m) => (
          <button
            key={m.key}
            type="button"
            className={m.key === active ? 'module-tab active' : 'module-tab'}
            onClick={() => onNavigate(m.key)}
          >
            {m.label}
          </button>
        ))}
      </div>
      {children}
    </div>
  );
}
