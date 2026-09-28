import { AccountingError } from '../errors.js';
import type { ChartOfAccountRepository } from '../repositories/ChartOfAccountRepository.js';
import type { MappingRepository } from '../repositories/MappingRepository.js';
import type { AccountMapping, CategoryMapping, ChartOfAccount, ChartOfAccountType } from '../types.js';

/** Manages the Accounting Module's own GL chart and its mappings to Cash Module accounts/categories. Never touches the Cash Module. */
export class ChartOfAccountService {
  constructor(
    private readonly chartOfAccounts: ChartOfAccountRepository,
    private readonly mappings: MappingRepository,
  ) {}

  async createChartOfAccount(tenantId: string, input: { code: string; name: string; type: ChartOfAccountType }): Promise<ChartOfAccount> {
    return this.chartOfAccounts.create({
      tenantId,
      code: input.code.trim(),
      name: input.name.trim(),
      type: input.type,
      status: 'active',
      createdAt: new Date(),
    });
  }

  async listChartOfAccounts(tenantId: string): Promise<ChartOfAccount[]> {
    return this.chartOfAccounts.listByTenant(tenantId);
  }

  async setAccountMapping(tenantId: string, cashAccountId: string, chartOfAccountId: string): Promise<AccountMapping> {
    const target = await this.chartOfAccounts.findById(tenantId, chartOfAccountId);
    if (!target) throw new AccountingError('CHART_OF_ACCOUNT_NOT_FOUND', '找不到這個會計科目。');

    return this.mappings.createAccountMapping({ tenantId, cashAccountId, chartOfAccountId, createdAt: new Date() });
  }

  async setCategoryMapping(tenantId: string, cashCategoryName: string, chartOfAccountId: string): Promise<CategoryMapping> {
    const target = await this.chartOfAccounts.findById(tenantId, chartOfAccountId);
    if (!target) throw new AccountingError('CHART_OF_ACCOUNT_NOT_FOUND', '找不到這個會計科目。');

    return this.mappings.createCategoryMapping({ tenantId, cashCategoryName: cashCategoryName.trim(), chartOfAccountId, createdAt: new Date() });
  }

  async listAccountMappings(tenantId: string): Promise<AccountMapping[]> {
    return this.mappings.listAccountMappings(tenantId);
  }

  async listCategoryMappings(tenantId: string): Promise<CategoryMapping[]> {
    return this.mappings.listCategoryMappings(tenantId);
  }
}
