import type { JournalEntry, JournalLine } from '../types.js';

export interface CreateJournalEntryInput {
  entry: Omit<JournalEntry, 'id' | 'createdAt'> & { createdAt: Date };
  lines: Array<Omit<JournalLine, 'id' | 'journalEntryId'>>;
}

export interface JournalEntryWithLines extends JournalEntry {
  lines: JournalLine[];
}

export interface JournalEntryRepository {
  create(input: CreateJournalEntryInput): Promise<JournalEntryWithLines>;
  findBySourceCashEntryId(tenantId: string, sourceCashEntryId: string): Promise<JournalEntryWithLines | null>;
  listByTenant(tenantId: string): Promise<JournalEntryWithLines[]>;
}
