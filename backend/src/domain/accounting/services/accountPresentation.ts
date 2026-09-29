import type { ChartOfAccountType, NormalBalanceSide } from '../types.js';

/**
 * Shared by TrialBalanceService/IncomeStatementService/BalanceSheetService
 * so all three statements present the same account in the same sign
 * convention — Gate Review's explicit concern ("liability/equity/revenue
 * 出現反向數字但 UI 語意不清").
 */
export function normalBalanceOf(type: ChartOfAccountType): NormalBalanceSide {
  return type === 'asset' || type === 'expense' ? 'debit' : 'credit';
}

/**
 * Converts a raw (debit - credit) net into the account's normal-balance
 * presentation: positive means the account is in its normal direction,
 * negative means reversed. Never clamped to zero or forced positive — an
 * abnormal balance (e.g. a liability with a debit balance) must stay
 * visible as a negative number here, per Gate Review's implementation
 * guardrail.
 */
export function normalize(rawDebitMinusCredit: number, type: ChartOfAccountType): number {
  return normalBalanceOf(type) === 'debit' ? rawDebitMinusCredit : -rawDebitMinusCredit;
}
