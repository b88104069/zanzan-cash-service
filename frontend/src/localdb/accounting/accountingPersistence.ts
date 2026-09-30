import { AccountingDatabase, generateAccountingId } from '../../../../backend/src/infra/memory/accounting/AccountingDatabase.js';
import type { AccountMapping, CategoryMapping, ChartOfAccount, FiscalPeriod, GeneralVoucherDraft, JournalEntry, JournalLine, Voucher } from '../../../../backend/src/domain/accounting/types.js';
import { migrateJournalEntryProvenance } from './journalProvenanceMigration.js';

// Mirrors frontend/src/localdb/persistence.ts's approach for the Cash
// Module: reuse the Accounting Module's own backend classes as-is, add a
// thin browser-storage wrapper. A SEPARATE localStorage key from the Cash
// Module's `zzcs_prototype_db_v1` — the two never share storage, per the
// Accounting Module v0.1 plan approved in Slack #ai-gate-test.

const STORAGE_KEY = 'zzcs_accounting_db_v1';

interface SerializedAccountingDb {
  chartOfAccounts: ChartOfAccount[];
  accountMappings: AccountMapping[];
  categoryMappings: CategoryMapping[];
  journalEntries: JournalEntry[];
  journalLines: JournalLine[];
  vouchers: Voucher[];
  fiscalPeriods: FiscalPeriod[];
  generalVoucherDrafts: GeneralVoucherDraft[];
}

function reviveDates<T extends { createdAt: Date | string }>(row: T): T {
  return { ...row, createdAt: new Date(row.createdAt) };
}

function reviveFiscalPeriod(row: FiscalPeriod): FiscalPeriod {
  return { ...row, createdAt: new Date(row.createdAt), closedAt: row.closedAt ? new Date(row.closedAt) : undefined };
}

function reviveGeneralVoucherDraft(row: GeneralVoucherDraft): GeneralVoucherDraft {
  return {
    ...row,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
    postedAt: row.postedAt ? new Date(row.postedAt) : undefined,
  };
}

function loadFromStorage(): SerializedAccountingDb | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SerializedAccountingDb;
  } catch {
    return null;
  }
}

/** Same id-counter warm-up technique as the Cash Module's persistence.ts, applied to this module's own independent counter. */
function warmUpIdCounter(db: AccountingDatabase): void {
  let max = 0;
  const allIds = [
    ...db.chartOfAccounts.keys(),
    ...db.accountMappings.keys(),
    ...db.categoryMappings.keys(),
    ...db.journalEntries.keys(),
    ...db.journalLines.keys(),
    ...db.vouchers.keys(),
    ...db.fiscalPeriods.keys(),
    ...db.generalVoucherDrafts.keys(),
  ];
  for (const id of allIds) {
    const match = /_(\d+)$/.exec(id);
    if (match) max = Math.max(max, Number(match[1]));
  }
  for (let i = 0; i < max; i++) generateAccountingId('_warmup');
}

export function loadAccountingDatabase(): AccountingDatabase {
  const db = new AccountingDatabase();
  const saved = loadFromStorage();

  if (saved) {
    for (const row of saved.chartOfAccounts) db.chartOfAccounts.set(row.id, reviveDates(row));
    for (const row of saved.accountMappings) db.accountMappings.set(row.id, reviveDates(row));
    for (const row of saved.categoryMappings) db.categoryMappings.set(row.id, reviveDates(row));
    // v0.4: migrate provenance BEFORE any service code runs on this data —
    // a throw here propagates before anything is written back, so a
    // corrupt/unrecognized row never gets silently replaced.
    for (const row of saved.journalEntries) {
      const migrated = migrateJournalEntryProvenance(reviveDates(row));
      db.journalEntries.set(migrated.id, migrated);
    }
    for (const row of saved.journalLines) db.journalLines.set(row.id, row);
    for (const row of saved.vouchers) db.vouchers.set(row.id, reviveDates(row));
    for (const row of saved.fiscalPeriods ?? []) db.fiscalPeriods.set(row.id, reviveFiscalPeriod(row));
    for (const row of saved.generalVoucherDrafts ?? []) db.generalVoucherDrafts.set(row.id, reviveGeneralVoucherDraft(row));
  }

  warmUpIdCounter(db);
  return db;
}

export function saveAccountingDatabase(db: AccountingDatabase): void {
  const payload: SerializedAccountingDb = {
    chartOfAccounts: [...db.chartOfAccounts.values()],
    accountMappings: [...db.accountMappings.values()],
    categoryMappings: [...db.categoryMappings.values()],
    journalEntries: [...db.journalEntries.values()],
    journalLines: [...db.journalLines.values()],
    vouchers: [...db.vouchers.values()],
    fiscalPeriods: [...db.fiscalPeriods.values()],
    generalVoucherDrafts: [...db.generalVoucherDrafts.values()],
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.error('Failed to persist accounting data to localStorage', err);
  }
}

export { STORAGE_KEY };
