// Shape of a legacy WordPress export, matching the tables created by
// includes/install.php in docs/migration/zanzan-simple-cash-saas_1-8-33_合併原始碼.txt.
// Field names match the legacy SQL columns verbatim (snake_case, string
// decimals) since this is what an actual `mysqldump`/export would look like.

export interface LegacyWpUser {
  ID: number;
  user_email: string;
}

export interface LegacyTenant {
  id: number;
  company_name: string;
  owner_user_id: number;
  plan_code: string;
  status: 'active' | 'inactive';
  created_at: string;
}

export interface LegacyTenantUser {
  id: number;
  tenant_id: number;
  user_id: number;
  tenant_role: string;
  status: 'active' | 'inactive';
  created_at: string;
}

export interface LegacyAccount {
  id: number;
  tenant_id: number;
  account_name: string;
  account_type: string;
  opening_balance: string;
  status: 'active' | 'inactive';
  created_at: string;
}

export interface LegacyCategory {
  id: number;
  tenant_id: number;
  category_name: string;
  category_type: 'income' | 'expense';
  status: 'active' | 'inactive';
  created_at: string;
}

export interface LegacyCashEntry {
  id: number;
  tenant_id: number;
  entry_date: string;
  memo: string;
  category: string;
  account_id: number;
  income: string;
  expense: string;
  note: string;
  transfer_code: string;
  created_by: number;
  created_at: string;
}

export interface LegacyExport {
  wp_users: LegacyWpUser[];
  zz_tenants: LegacyTenant[];
  zz_tenant_users: LegacyTenantUser[];
  zz_cash_accounts: LegacyAccount[];
  zz_cash_categories: LegacyCategory[];
  zz_cash_entries: LegacyCashEntry[];
}
