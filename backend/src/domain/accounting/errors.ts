// Accounting Module's own error type — deliberately NOT sharing Cash
// Module's DomainError/DomainErrorCode (backend/src/domain/errors.ts),
// which is frozen v1.0 baseline. Keeping error types separate mirrors the
// rest of the module's isolation (own types, own storage, own services).

export type AccountingErrorCode =
  | 'CHART_OF_ACCOUNT_NOT_FOUND'
  | 'MAPPING_NOT_FOUND'
  | 'DUPLICATE_ACCOUNT_MAPPING'
  | 'DUPLICATE_CATEGORY_MAPPING'
  | 'CASH_ENTRY_NOT_MAPPED'
  | 'CASH_ENTRY_EXCLUDED'
  | 'CASH_ENTRY_ALREADY_JOURNALED'
  | 'JOURNAL_ENTRY_NOT_BALANCED'
  | 'FISCAL_PERIOD_INVALID_RANGE'
  | 'FISCAL_PERIOD_OVERLAPS'
  | 'FISCAL_PERIOD_NOT_FOUND'
  | 'FISCAL_PERIOD_ALREADY_CLOSED'
  | 'JOURNAL_ENTRY_PERIOD_CLOSED'
  | 'GENERAL_VOUCHER_DRAFT_NOT_FOUND'
  | 'GENERAL_VOUCHER_ALREADY_POSTED'
  | 'GENERAL_VOUCHER_MIN_LINES'
  | 'GENERAL_VOUCHER_INVALID_LINE'
  | 'GENERAL_VOUCHER_UNBALANCED'
  | 'CHART_OF_ACCOUNT_INACTIVE';

export class AccountingError extends Error {
  readonly code: AccountingErrorCode;

  constructor(code: AccountingErrorCode, message: string) {
    super(message);
    this.name = 'AccountingError';
    this.code = code;
  }
}
