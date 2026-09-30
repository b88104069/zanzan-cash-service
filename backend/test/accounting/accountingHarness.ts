import { BalanceSheetService } from '../../src/domain/accounting/services/BalanceSheetService.js';
import { ChartOfAccountService } from '../../src/domain/accounting/services/ChartOfAccountService.js';
import { FiscalPeriodService } from '../../src/domain/accounting/services/FiscalPeriodService.js';
import { GeneralVoucherService } from '../../src/domain/accounting/services/GeneralVoucherService.js';
import { IncomeStatementService } from '../../src/domain/accounting/services/IncomeStatementService.js';
import { JournalEntryService } from '../../src/domain/accounting/services/JournalEntryService.js';
import { LedgerMappingService } from '../../src/domain/accounting/services/LedgerMappingService.js';
import { TrialBalanceService } from '../../src/domain/accounting/services/TrialBalanceService.js';
import { VoucherService } from '../../src/domain/accounting/services/VoucherService.js';
import { AccountingDatabase } from '../../src/infra/memory/accounting/AccountingDatabase.js';
import { AccountingUnitOfWork } from '../../src/infra/memory/accounting/AccountingUnitOfWork.js';
import { InMemoryChartOfAccountRepository } from '../../src/infra/memory/accounting/InMemoryChartOfAccountRepository.js';
import { InMemoryFiscalPeriodRepository } from '../../src/infra/memory/accounting/InMemoryFiscalPeriodRepository.js';
import { InMemoryGeneralVoucherDraftRepository } from '../../src/infra/memory/accounting/InMemoryGeneralVoucherDraftRepository.js';
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
  const fiscalPeriodRepo = new InMemoryFiscalPeriodRepository(db);
  const generalVoucherDraftRepo = new InMemoryGeneralVoucherDraftRepository(db);

  const chartOfAccountService = new ChartOfAccountService(chartOfAccountRepo, mappingRepo);
  const mappingService = new LedgerMappingService(mappingRepo);
  const voucherService = new VoucherService(voucherRepo);
  const fiscalPeriodService = new FiscalPeriodService(fiscalPeriodRepo);
  const journalEntryService = new JournalEntryService(journalEntryRepo, voucherService, mappingService, fiscalPeriodService, chartOfAccountService);
  const trialBalanceService = new TrialBalanceService(journalEntryService, chartOfAccountService, fiscalPeriodService);
  const incomeStatementService = new IncomeStatementService(journalEntryService, chartOfAccountService, fiscalPeriodService);
  const balanceSheetService = new BalanceSheetService(journalEntryService, chartOfAccountService, incomeStatementService, fiscalPeriodService);
  const unitOfWork = new AccountingUnitOfWork(db);
  const generalVoucherService = new GeneralVoucherService(
    generalVoucherDraftRepo,
    journalEntryRepo,
    voucherService,
    chartOfAccountService,
    fiscalPeriodService,
    unitOfWork,
  );

  return {
    ...cash,
    accountingDb: db,
    chartOfAccountService,
    mappingService,
    voucherService,
    fiscalPeriodService,
    journalEntryService,
    trialBalanceService,
    incomeStatementService,
    balanceSheetService,
    unitOfWork,
    generalVoucherService,
    // Exposed for tests that need to construct a JournalEntry directly
    // (e.g. an abnormal-balance scenario the normal Cash-mapping flow
    // can't produce) — never used by product code, which only ever
    // journalizes through JournalEntryService's mapping path.
    journalEntryRepo,
  };
}
