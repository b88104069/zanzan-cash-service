// Structured domain errors. See docs/architecture/api-contract-principles.md
// principle 6: every legacy invariant violation gets a stable machine-
// readable code here, instead of only a localized message string.

export type DomainErrorCode =
  | 'VALIDATION_REQUIRED_FIELD'
  | 'INCOME_EXPENSE_MUTUAL_EXCLUSION'
  | 'ACCOUNT_NOT_FOUND_OR_INACTIVE'
  | 'CATEGORY_NOT_FOUND_OR_INACTIVE'
  | 'CATEGORY_TYPE_MISMATCH'
  | 'ENTRY_NOT_FOUND'
  | 'ENTRY_TRANSFER_IMMUTABLE'
  | 'DUPLICATE_TENANT_NAME'
  | 'DUPLICATE_ACCOUNT_NAME'
  | 'DUPLICATE_CATEGORY_NAME'
  | 'TENANT_NOT_FOUND'
  | 'TENANT_MEMBERSHIP_REQUIRED'
  | 'ACCOUNT_NOT_FOUND'
  | 'CATEGORY_NOT_FOUND'
  | 'TRANSFER_SAME_ACCOUNT'
  | 'TRANSFER_INVALID_AMOUNT'
  | 'TRANSFER_ACCOUNT_UNAVAILABLE'
  | 'TRANSFER_INTEGRITY_VIOLATION';

export class DomainError extends Error {
  readonly code: DomainErrorCode;

  constructor(code: DomainErrorCode, message: string) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
  }
}
