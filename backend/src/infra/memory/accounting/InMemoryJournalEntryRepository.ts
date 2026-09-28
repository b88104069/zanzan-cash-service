import type {
  CreateJournalEntryInput,
  JournalEntryRepository,
  JournalEntryWithLines,
} from '../../../domain/accounting/repositories/JournalEntryRepository.js';
import { AccountingDatabase, generateAccountingId } from './AccountingDatabase.js';

export class InMemoryJournalEntryRepository implements JournalEntryRepository {
  constructor(private readonly db: AccountingDatabase) {}

  async create(input: CreateJournalEntryInput): Promise<JournalEntryWithLines> {
    const id = generateAccountingId('je');
    const entry = { ...input.entry, id };
    this.db.journalEntries.set(id, entry);

    const lines = input.lines.map((line) => {
      const lineId = generateAccountingId('jl');
      const record = { ...line, id: lineId, journalEntryId: id };
      this.db.journalLines.set(lineId, record);
      return record;
    });

    return { ...entry, lines };
  }

  async findBySourceCashEntryId(tenantId: string, sourceCashEntryId: string): Promise<JournalEntryWithLines | null> {
    const entry = [...this.db.journalEntries.values()].find(
      (e) => e.tenantId === tenantId && e.sourceCashEntryId === sourceCashEntryId,
    );
    if (!entry) return null;
    return { ...entry, lines: this.linesFor(entry.id) };
  }

  async listByTenant(tenantId: string): Promise<JournalEntryWithLines[]> {
    return [...this.db.journalEntries.values()]
      .filter((e) => e.tenantId === tenantId)
      .map((entry) => ({ ...entry, lines: this.linesFor(entry.id) }));
  }

  private linesFor(journalEntryId: string) {
    return [...this.db.journalLines.values()].filter((l) => l.journalEntryId === journalEntryId);
  }
}
