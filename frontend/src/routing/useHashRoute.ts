import { useEffect, useState } from 'react';

/**
 * Minimal hash-based router — deliberately not React Router. Each ERP
 * module gets a real, directly-openable/bookmarkable/shareable URL
 * (`#/cash`, `#/accounting`, and any future `#/sales`, `#/purchase`, ...)
 * without adding a routing framework dependency, per the Accounting Module
 * v0.1 Gate Review (Slack #ai-gate-test).
 *
 * Unrecognized or empty hashes default to `cash` so the app's root URL
 * (no hash at all) keeps working exactly as it did before this module
 * existed — this is what keeps the Gate 5 E2E suite's `goto('./')` passing
 * unmodified.
 */
export const DEFAULT_MODULE = 'cash';
const KNOWN_MODULES = ['cash', 'accounting'] as const;
export type ModuleKey = (typeof KNOWN_MODULES)[number];

function parseHash(hash: string): ModuleKey {
  const key = hash.replace(/^#\/?/, '').trim();
  return (KNOWN_MODULES as readonly string[]).includes(key) ? (key as ModuleKey) : DEFAULT_MODULE;
}

export function useHashRoute(): [ModuleKey, (module: ModuleKey) => void] {
  const [module, setModuleState] = useState<ModuleKey>(() => parseHash(window.location.hash));

  useEffect(() => {
    const onHashChange = () => setModuleState(parseHash(window.location.hash));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = (next: ModuleKey) => {
    window.location.hash = `/${next}`;
  };

  return [module, navigate];
}
