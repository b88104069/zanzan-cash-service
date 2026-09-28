import { generateId, InMemoryDatabase } from '../../../backend/src/infra/memory/InMemoryDatabase.js';
import type { Account, CashEntry, Category, Tenant, TenantMembership, User } from '../../../backend/src/domain/types.js';

// Reuses backend's InMemoryDatabase + InMemory*Repository classes AS-IS
// (already characterization-tested in Gate 2/3) instead of writing a new
// persistence layer with its own logic — see docs/gates/kickoff-contract.md
// Gate 5 (ACTIVE) "migration/refactor principle": a prototype-only browser
// adapter, not a reimplementation of the domain rules.

const STORAGE_KEY = 'zzcs_prototype_db_v1';

interface SerializedDb {
  tenants: Tenant[];
  memberships: TenantMembership[];
  accounts: Account[];
  categories: Category[];
  entries: CashEntry[];
  users: User[];
}

function reviveDates<T extends { createdAt: Date | string }>(row: T): T {
  return { ...row, createdAt: new Date(row.createdAt) };
}

function loadFromStorage(): SerializedDb | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SerializedDb;
  } catch {
    return null;
  }
}

/**
 * `generateId()`'s counter is a module-level variable that always starts
 * at 1 on page load — fine for Gate 2/3/4's process-lifetime tests, but a
 * real correctness bug for a store that persists across page reloads: a
 * freshly created record could reuse an id already used by a
 * previously-persisted record and silently overwrite it (`Map.set` on an
 * existing key). Rather than touch the already-reviewed backend file to
 * expose a counter setter, this "warms up" the existing exported
 * `generateId()` the same number of times the persisted data already used
 * it, so the next real call is guaranteed to mint an unused id. Zero
 * modification to Gate 2/3/4 code; see reports/gate-5-delta-report.md for
 * why this exists.
 */
function warmUpIdCounter(db: InMemoryDatabase): void {
  let max = 0;
  const allIds = [...db.tenants.keys(), ...db.accounts.keys(), ...db.categories.keys(), ...db.entries.keys(), ...db.users.keys()];
  for (const id of allIds) {
    const match = /_(\d+)$/.exec(id);
    if (match) max = Math.max(max, Number(match[1]));
  }
  for (let i = 0; i < max; i++) generateId('_warmup');
}

export function loadDatabase(): InMemoryDatabase {
  const db = new InMemoryDatabase();
  const saved = loadFromStorage();

  if (saved) {
    for (const tenant of saved.tenants) db.tenants.set(tenant.id, reviveDates(tenant));
    db.memberships.push(...saved.memberships.map(reviveDates));
    for (const account of saved.accounts) db.accounts.set(account.id, reviveDates(account));
    for (const category of saved.categories) db.categories.set(category.id, reviveDates(category));
    for (const entry of saved.entries) db.entries.set(entry.id, reviveDates(entry));
    for (const user of saved.users) db.users.set(user.id, reviveDates(user));
  }

  warmUpIdCounter(db);
  return db;
}

export function saveDatabase(db: InMemoryDatabase): void {
  const payload: SerializedDb = {
    tenants: [...db.tenants.values()],
    memberships: [...db.memberships],
    accounts: [...db.accounts.values()],
    categories: [...db.categories.values()],
    entries: [...db.entries.values()],
    users: [...db.users.values()],
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.error('Failed to persist prototype data to localStorage', err);
  }
}

/** Exposed for the Prototype Data/Debug panel — reads the raw stored JSON without touching the live in-memory db. */
export function readRawStorageForDebug(): SerializedDb | null {
  return loadFromStorage();
}

export function clearStorage(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export { STORAGE_KEY };
