import { ChartOfAccountService } from '../../src/domain/accounting/services/ChartOfAccountService.js';
import { JournalEntryService } from '../../src/domain/accounting/services/JournalEntryService.js';
import { LedgerMappingService } from '../../src/domain/accounting/services/LedgerMappingService.js';
import { VoucherService } from '../../src/domain/accounting/services/VoucherService.js';
import { AccountingDatabase } from '../../src/infra/memory/accounting/AccountingDatabase.js';
import { InMemoryChartOfAccountRepository } from '../../src/infra/memory/accounting/InMemoryChartOfAccountRepository.js';
import { InMemoryJournalEntryRepository } from '../../src/infra/memory/accounting/InMemoryJournalEntryRepository.js';
import { InMemoryMappingRepository } from '../../src/infra/memory/accounting/InMemoryMappingRepository.js';
import { InMemoryVoucherRepository } from '../../src/infra/memory/accounting/InMemoryVoucherRepository.js';
import { createHarness } from '../testHarness.js';

/** Wires a fresh Cash Module harness (untouched, reused as-is) alongside a fresh, fully separate Accounting Module harness. */
export function createAccountingHarness() {
  const cash = createHarness();

  const db = new AccountingDatabase();
  const chartOfAccountRepo = new InMemoryChartOfAccountRepository(db);
  const mappingRepo = new InMemoryMappingRepository(db);
  const journalEntryRepo = new InMemoryJournalEntryRepository(db);
  const voucherRepo = new InMemoryVoucherRepository(db);

  const chartOfAccountService = new ChartOfAccountService(chartOfAccountRepo, mappingRepo);
  const mappingService = new LedgerMappingService(mappingRepo);
  const voucherService = new VoucherService(voucherRepo);
  const journalEntryService = new JournalEntryService(journalEntryRepo, voucherService, mappingService);

  return { ...cash, accountingDb: db, chartOfAccountService, mappingService, voucherService, journalEntryService };
}
