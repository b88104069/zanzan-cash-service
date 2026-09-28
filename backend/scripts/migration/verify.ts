import type { LegacyExport } from './legacyTypes.js';

export interface CheckResult {
  name: string;
  passed: boolean;
  detail?: string;
}

export interface DestinationSnapshot {
  userCount: number;
  tenantCount: number;
  membershipCount: number;
  accountCount: number;
  categoryCount: number;
  entryCount: number;
  /** accountId (standalone) -> balance = openingBalance + income - expense (transfers included) */
  accountBalances: Map<string, number>;
  /** tenantId (standalone) -> { income, expense } excluding transfer-linked entries */
  tenantTotals: Map<string, { income: number; expense: number }>;
  /** transferCode -> count of entries sharing it */
  transferCodeCounts: Map<string, number>;
  /** legacy account id -> standalone account id, needed to compare balances against the source */
  accountIdMap: Map<number, string>;
  /** legacy tenant id -> standalone tenant id */
  tenantIdMap: Map<number, string>;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Compares the legacy fixture's own arithmetic against what actually landed
 * in the destination database — this is the "row counts, amount totals,
 * balances, transfer pair integrity" verification the Kickoff's Gate 4 PASS
 * criteria requires. Every check is independently computed from both sides;
 * none of this trusts the migration script's own bookkeeping.
 */
export function verifyMigration(source: LegacyExport, dest: DestinationSnapshot): CheckResult[] {
  const checks: CheckResult[] = [];

  checks.push({
    name: 'row counts match (users, tenants, memberships, accounts, categories, entries)',
    passed:
      dest.userCount === source.wp_users.length &&
      dest.tenantCount === source.zz_tenants.length &&
      dest.membershipCount === source.zz_tenant_users.length &&
      dest.accountCount === source.zz_cash_accounts.length &&
      dest.categoryCount === source.zz_cash_categories.length &&
      dest.entryCount === source.zz_cash_entries.length,
    detail: `users ${dest.userCount}/${source.wp_users.length}, tenants ${dest.tenantCount}/${source.zz_tenants.length}, memberships ${dest.membershipCount}/${source.zz_tenant_users.length}, accounts ${dest.accountCount}/${source.zz_cash_accounts.length}, categories ${dest.categoryCount}/${source.zz_cash_categories.length}, entries ${dest.entryCount}/${source.zz_cash_entries.length}`,
  });

  // Per-account balance: opening_balance + Σincome − Σexpense (transfers included), per domain-boundaries.md.
  for (const legacyAccount of source.zz_cash_accounts) {
    const opening = Number(legacyAccount.opening_balance);
    const entries = source.zz_cash_entries.filter((e) => e.account_id === legacyAccount.id);
    const sourceBalance = round2(
      opening + entries.reduce((sum, e) => sum + Number(e.income), 0) - entries.reduce((sum, e) => sum + Number(e.expense), 0),
    );

    const standaloneId = dest.accountIdMap.get(legacyAccount.id);
    const destBalance = standaloneId !== undefined ? dest.accountBalances.get(standaloneId) : undefined;

    checks.push({
      name: `account balance matches: legacy account #${legacyAccount.id} (${legacyAccount.account_name})`,
      passed: standaloneId !== undefined && destBalance !== undefined && round2(destBalance) === sourceBalance,
      detail: `source=${sourceBalance}, dest=${destBalance !== undefined ? round2(destBalance) : 'MISSING'}`,
    });
  }

  // Per-tenant lifetime income/expense totals, EXCLUDING transfer-linked entries (parity with cash_summary).
  for (const legacyTenant of source.zz_tenants) {
    const entries = source.zz_cash_entries.filter((e) => e.tenant_id === legacyTenant.id && !e.transfer_code);
    const sourceIncome = round2(entries.reduce((sum, e) => sum + Number(e.income), 0));
    const sourceExpense = round2(entries.reduce((sum, e) => sum + Number(e.expense), 0));

    const standaloneId = dest.tenantIdMap.get(legacyTenant.id);
    const destTotals = standaloneId !== undefined ? dest.tenantTotals.get(standaloneId) : undefined;

    checks.push({
      name: `tenant totals match (transfers excluded): legacy tenant #${legacyTenant.id} (${legacyTenant.company_name})`,
      passed:
        standaloneId !== undefined &&
        destTotals !== undefined &&
        round2(destTotals.income) === sourceIncome &&
        round2(destTotals.expense) === sourceExpense,
      detail: `source income=${sourceIncome}/expense=${sourceExpense}, dest income=${destTotals ? round2(destTotals.income) : 'MISSING'}/expense=${destTotals ? round2(destTotals.expense) : 'MISSING'}`,
    });
  }

  // Transfer pair integrity: every transfer_code must have exactly 2 legs, in both source and destination.
  const sourceTransferCodes = new Map<string, number>();
  for (const entry of source.zz_cash_entries) {
    if (!entry.transfer_code) continue;
    sourceTransferCodes.set(entry.transfer_code, (sourceTransferCodes.get(entry.transfer_code) ?? 0) + 1);
  }

  for (const [code, sourceCount] of sourceTransferCodes) {
    checks.push({
      name: `transfer pair intact: ${code}`,
      passed: sourceCount === 2 && dest.transferCodeCounts.get(code) === 2,
      detail: `source legs=${sourceCount}, dest legs=${dest.transferCodeCounts.get(code) ?? 0}`,
    });
  }

  return checks;
}

export function summarize(checks: CheckResult[]): { allPassed: boolean; passedCount: number; total: number } {
  const passedCount = checks.filter((c) => c.passed).length;
  return { allPassed: passedCount === checks.length, passedCount, total: checks.length };
}
