import { BalanceSheetService } from '../../../../backend/src/domain/accounting/services/BalanceSheetService.js';
import { ChartOfAccountService } from '../../../../backend/src/domain/accounting/services/ChartOfAccountService.js';
import { FiscalPeriodService } from '../../../../backend/src/domain/accounting/services/FiscalPeriodService.js';
import { GeneralVoucherService } from '../../../../backend/src/domain/accounting/services/GeneralVoucherService.js';
import { IncomeStatementService } from '../../../../backend/src/domain/accounting/services/IncomeStatementService.js';
import { JournalEntryService } from '../../../../backend/src/domain/accounting/services/JournalEntryService.js';
import { LedgerMappingService } from '../../../../backend/src/domain/accounting/services/LedgerMappingService.js';
import { TrialBalanceService } from '../../../../backend/src/domain/accounting/services/TrialBalanceService.js';
import { VoucherService } from '../../../../backend/src/domain/accounting/services/VoucherService.js';
import { AccountingUnitOfWork } from '../../../../backend/src/infra/memory/accounting/AccountingUnitOfWork.js';
import { InMemoryChartOfAccountRepository } from '../../../../backend/src/infra/memory/accounting/InMemoryChartOfAccountRepository.js';
import { InMemoryFiscalPeriodRepository } from '../../../../backend/src/infra/memory/accounting/InMemoryFiscalPeriodRepository.js';
import { InMemoryGeneralVoucherDraftRepository } from '../../../../backend/src/infra/memory/accounting/InMemoryGeneralVoucherDraftRepository.js';
import { InMemoryJournalEntryRepository } from '../../../../backend/src/infra/memory/accounting/InMemoryJournalEntryRepository.js';
import { InMemoryMappingRepository } from '../../../../backend/src/infra/memory/accounting/InMemoryMappingRepository.js';
import { InMemoryVoucherRepository } from '../../../../backend/src/infra/memory/accounting/InMemoryVoucherRepository.js';
import type { AccountingDatabase } from '../../../../backend/src/infra/memory/accounting/AccountingDatabase.js';
import type { LocalServices } from '../services.js';
import { loadAccountingDatabase, saveAccountingDatabase } from './accountingPersistence.js';

export interface AccountingServices {
  db: AccountingDatabase;
  tenantId: string;
  chartOfAccountService: ChartOfAccountService;
  mappingService: LedgerMappingService;
  voucherService: VoucherService;
  fiscalPeriodService: FiscalPeriodService;
  journalEntryService: JournalEntryService;
  trialBalanceService: TrialBalanceService;
  incomeStatementService: IncomeStatementService;
  balanceSheetService: BalanceSheetService;
  generalVoucherService: GeneralVoucherService;
  save: () => void;
}

/**
 * Builds the Accounting Module's service graph against its own persisted
 * AccountingDatabase. Takes the already-initialized Cash Module services
 * (LocalServices) purely to READ the current tenant's default account/
 * categories for the one-time demo mapping seed below — it never calls
 * anything that writes to the Cash Module.
 */
export async function initAccountingServices(cash: LocalServices): Promise<AccountingServices> {
  const db = loadAccountingDatabase();

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

  const save = () => saveAccountingDatabase(db);

  const existingCoa = await chartOfAccountService.listChartOfAccounts(cash.tenantId);
  if (existingCoa.length === 0) {
    await seedDemoChartOfAccounts(cash, chartOfAccountService);
    save();
  }

  return {
    db,
    tenantId: cash.tenantId,
    chartOfAccountService,
    mappingService,
    voucherService,
    fiscalPeriodService,
    journalEntryService,
    trialBalanceService,
    incomeStatementService,
    balanceSheetService,
    generalVoucherService,
    save,
  };
}

/**
 * v0.1 demo/default mapping — Accounting Module's own seed data, mapping
 * the Cash Module's Gate 2 default account (現金) and default categories
 * (餐費/交通/住宿/一般收入, guaranteed to exist for every tenant — see
 * backend/src/domain/types.ts DEFAULT_SEED_*) to a small demo GL chart.
 * This is config data, not logic: LedgerMappingService's lookup itself has
 * no knowledge of these specific names.
 */
async function seedDemoChartOfAccounts(cash: LocalServices, chartOfAccountService: ChartOfAccountService): Promise<void> {
  const tenantId = cash.tenantId;

  const cashGl = await chartOfAccountService.createChartOfAccount(tenantId, { code: '1101', name: '庫存現金', type: 'asset' });
  const bankGl = await chartOfAccountService.createChartOfAccount(tenantId, { code: '1102', name: '銀行存款', type: 'asset' });
  const revenueGl = await chartOfAccountService.createChartOfAccount(tenantId, { code: '4101', name: '一般收入科目', type: 'revenue' });
  const mealGl = await chartOfAccountService.createChartOfAccount(tenantId, { code: '5101', name: '餐費支出', type: 'expense' });
  const transitGl = await chartOfAccountService.createChartOfAccount(tenantId, { code: '5102', name: '交通費用', type: 'expense' });
  const lodgingGl = await chartOfAccountService.createChartOfAccount(tenantId, { code: '5103', name: '住宿費用', type: 'expense' });

  const cashAccounts = await cash.accountService.listForAdmin(tenantId);
  const defaultCash = cashAccounts.find((a) => a.accountName === '現金');
  const defaultBank = cashAccounts.find((a) => a.accountName === '銀行');
  if (defaultCash) await chartOfAccountService.setAccountMapping(tenantId, defaultCash.id, cashGl.id);
  if (defaultBank) await chartOfAccountService.setAccountMapping(tenantId, defaultBank.id, bankGl.id);

  await chartOfAccountService.setCategoryMapping(tenantId, '一般收入', revenueGl.id);
  await chartOfAccountService.setCategoryMapping(tenantId, '餐費', mealGl.id);
  await chartOfAccountService.setCategoryMapping(tenantId, '交通', transitGl.id);
  await chartOfAccountService.setCategoryMapping(tenantId, '住宿', lodgingGl.id);
}
