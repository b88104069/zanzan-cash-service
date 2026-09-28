# Characterization Test Specification (Gate 1 spec → Gate 2 implementation)

This is the specification Gate 1 is required to produce. **Implementation
happens in Gate 2.** Each case below cites the invariant it locks down (see
`docs/architecture/domain-boundaries.md`) and the legacy source location it
was derived from, so a future reader can verify a test against the original
behavior rather than trusting this document blindly.

Format per case: **ID / Given / When / Then / Source**.

## Tenant

- **T1** / a user with no tenant / creates a tenant with a company name /
  tenant is created, seeded with one "現金" account (opening_balance 0) and
  four categories (餐費, 交通, 住宿 = expense; 一般收入 = income) /
  `zzscs_api_create_tenant`, `zzscs_install.php` schema.
- **T2** / a user who already owns a tenant named "X" / creates another
  tenant also named "X" / rejected (duplicate owner+name) /
  `zzscs_api_create_tenant` dup check.
- **T3** / a user belonging to tenant A and tenant B / switches current
  tenant to B / subsequent tenant-scoped reads return B's data, not A's /
  `zzscs_api_switch_tenant`.
- **T4** / a user not a member of tenant C / attempts to switch to tenant C /
  rejected (403) / `zzscs_api_switch_tenant` membership check.

## Account

- **A1** / a tenant / creates an account named "銀行" / succeeds, defaults
  `account_type` to `cash` if omitted / `zzscs_api_account_create`.
- **A2** / a tenant with an existing account "銀行" / creates another account
  named "銀行" / rejected (duplicate name) / `zzscs_api_account_create` dup
  check.
- **A3** / an active account with entries / account is disabled / it no
  longer appears in `/accounts` (dropdown) list, but existing entries
  referencing it remain readable and unaffected / `zzscs_api_account_disable`,
  `zzscs_api_get_accounts`.
- **A4** / a disabled account / attempt to create a new cash entry against it
  / rejected ("帳戶不存在或已停用") / `zzscs_api_add_cash_entry` account
  validation.
- **A5** / an account with opening_balance 100, entries totaling +50 income /
  -20 expense / account summary balance = 130 / `zzscs_api_account_summary`
  balance formula.

## Category

- **C1** / a tenant / creates category "餐費" as expense / succeeds /
  `zzscs_api_category_create`.
- **C2** / a tenant with expense category "其他" / creates income category
  also named "其他" / succeeds (different type = not a duplicate) /
  `zzscs_api_category_create` dup check is `(name, type)` scoped.
- **C3** / a tenant with expense category "其他" / creates another expense
  category "其他" / rejected (duplicate within same type) / same.
- **C4** / a disabled category / attempt to create an entry using it /
  rejected / `zzscs_api_add_cash_entry` category validation.

## Cash Entry

- **E1** / valid date/account/category / income=100, expense=0 / entry
  created / `zzscs_api_add_cash_entry`.
- **E2** / income=100, expense=50 (both > 0) / rejected
  ("收入與支出不可同時大於0") / same, mutual-exclusion check.
- **E3** / income=0, expense=0 / rejected ("請輸入大於0的金額") / same.
- **E4** / income=100 (an income amount) but selected category has
  `category_type = expense` / rejected (type mismatch) / same, category-type
  validation.
- **E5** / update an entry that has a non-empty `transfer_code` / rejected
  (409, "轉帳紀錄不可單獨修改") / `zzscs_api_update_cash_entry`.
- **E6** / delete a normal (non-transfer) entry / succeeds, single row
  removed / `zzscs_api_delete_cash_entry`.

## Summary / Aggregation

- **S1** / entries including some with a `transfer_code` set / lifetime
  income/expense totals exclude transfer-linked entries /
  `zzscs_api_cash_summary` WHERE clause.
- **S2** / entries dated inside vs. outside the current calendar month /
  month-to-date totals include only in-month, non-transfer entries / same.
- **S3** / `monthBalance` = `monthIncome − monthExpense`, computed from the
  already-filtered totals / same.

## Transfer

- **X1** / valid from/to accounts (different, both active), amount > 0 /
  transfer creates exactly 2 entries sharing one `transfer_code`: expense on
  source, income on destination, same date/amount/note /
  `zzscs_api_transfer_create`.
- **X2** / from_account == to_account / rejected / same.
- **X3** / amount <= 0 / rejected / same.
- **X4** / either account inactive or nonexistent / rejected (404) / same.
- **X5** / delete one entry of a valid transfer pair / both entries deleted
  atomically / `zzscs_api_delete_cash_entry` transfer branch.
- **X6** / a transfer_code that (due to corrupted state) has only 1 or 3
  rows instead of 2 / delete is refused entirely (409), no partial delete /
  same, integrity guard.

## CSV Export

- **CSV1** / same filters as a list query / export returns the same rows,
  in the same filtered/sorted order, minus transfer-identifying detail
  differences already excluded by the list query itself / `zzscs_api_cash_export`
  vs. `zzscs_api_cash_list` shared filter logic.

## Entitlement / Access (cross-cutting — deepened further in Gate 3)

- **P1** / platform admin, no bound tenant / can call tenant-list/create
  endpoints but not tenant-scoped endpoints / `zzscs_api_tenant_permission_check`
  vs. `zzscs_api_permission_check`.
- **P2** / non-admin user, active subscription, bound tenant / can call all
  endpoints / `zzscs_api_permission_check`.
- **P3** / non-admin user, no active subscription / tenant-scoped endpoints
  return 403 / `zzscs_check_subscription_access`.
- **P4** / entitlement backend unavailable / access denied (fail closed), not
  granted / same, 503 branch.

## Gate 2 execution notes

- These tests run against the standalone `TenantService`/`AccountService`/
  `CategoryService`/`CashEntryService`/`TransferService`/`ExportService`
  directly (no HTTP layer yet) — Gate 3 adds an equivalent HTTP-level test
  suite plus the additional cross-tenant security cases from the Kickoff's
  Gate 3 PASS criteria (User A can't read User B's tenant, etc.), which are
  intentionally not duplicated here since they require the API layer that
  doesn't exist until Gate 3.
- Every test must be traceable to a specific legacy source line/function, as
  above — a test that can't cite where its expected behavior came from is
  not a characterization test, it's a guess, and should not be added at
  Gate 2 without flagging it as a new invariant decision instead.
