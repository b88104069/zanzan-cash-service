// Mirrors backend/src/domain/types.ts response shapes. Kept as a small,
// hand-written mirror rather than a generated client — the API surface is
// small and stable (see backend/openapi.yaml), and Gate 4's job is parity
// UI, not API-client tooling.

export interface User {
  id: string;
  email: string;
  role: 'member' | 'platform_admin';
}

export interface Tenant {
  id: string;
  companyName: string;
  ownerUserId: string;
  planCode: string;
  status: 'active' | 'inactive';
  createdAt: string;
}

export interface Account {
  id: string;
  tenantId: string;
  accountName: string;
  accountType: string;
  openingBalance: number;
  status: 'active' | 'inactive';
  createdAt: string;
}

export interface AccountSummary {
  id: string;
  accountName: string;
  totalIncome: number;
  totalExpense: number;
  balance: number;
}

export type CategoryType = 'income' | 'expense';

export interface Category {
  id: string;
  tenantId: string;
  categoryName: string;
  categoryType: CategoryType;
  status: 'active' | 'inactive';
}

export interface CashEntry {
  id: string;
  tenantId: string;
  entryDate: string;
  memo: string;
  category: string;
  accountId: string;
  accountName: string;
  income: number;
  expense: number;
  note: string;
  transferCode: string | null;
}

export interface Summary {
  incomeTotal: number;
  expenseTotal: number;
  balance: number;
  monthIncome: number;
  monthExpense: number;
  monthBalance: number;
}

export interface EntryFilter {
  start_date?: string;
  end_date?: string;
  keyword?: string;
  order?: 'asc' | 'desc';
  limit?: number;
}
