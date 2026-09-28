# Domain Boundaries

Six domains, carried over from the Gate 0.2 audit's business-logic
inventory. This is the authoritative invariant list — Gate 2's
characterization tests must cover every invariant marked **[INV]**.

## Tenant

A tenant is a company/ledger. A WordPress user may belong to multiple
tenants (`zz_tenant_users`), but the legacy system tracks only one "current
tenant" per user at a time.

- **[INV]** Creating a tenant always seeds: one account named "現金"
  (cash, opening_balance 0) and four categories (餐費/交通/住宿 as expense,
  一般收入 as income).
- **[INV]** Self-service tenant creation (`tenant-create`) rejects a
  duplicate `(owner_user_id, company_name)` pair; the purchase-triggered
  auto-provisioning path does not perform this duplicate check — it instead
  checks "does this user already have any tenant" first and skips creation
  entirely if so.
- **Standalone change**: "current tenant" must become an explicit per-request
  value (JWT claim or header), not server-stored session state — see
  `auth-entitlement-abstraction.md`. This is a deliberate improvement, not a
  parity requirement, and must be called out as a documented deviation, not
  silently introduced.

## Account

A financial account (cash, bank, other) belonging to one tenant.

- **[INV]** Account name unique per tenant.
- **[INV]** Soft-delete only (`status` active/inactive) — never hard-deleted.
- **[INV]** Disabled accounts are excluded from create/update entry
  validation and from dropdown listings, but historical entries referencing
  them remain intact and readable.
- **[INV]** Balance = `opening_balance + Σincome − Σexpense` across all
  entries for that account, transfers included (transfers redistribute
  balance between accounts but don't change the tenant's total).

## Category

An income/expense classification belonging to one tenant.

- **[INV]** `(tenant_id, category_name, category_type)` unique — the same
  name may exist once as income and once as expense.
- **[INV]** Soft-delete only, same semantics as Account.
- **[INV]** Category is stored as a **string** on the entry, not a foreign
  key — renaming a category does not retroactively update historical
  entries. This is a known limitation to explicitly decide on (fix vs.
  preserve) in Gate 2, not silently resolve either way.

## Cash Entry

A single income or expense record, belonging to one tenant, one account,
optionally linked to a `transfer_code`.

- **[INV]** `income` and `expense` are mutually exclusive: exactly one must
  be `> 0`, the other must be `0`/absent — never both, never neither.
- **[INV]** Referenced account must exist, belong to the same tenant, and be
  `active` at write time.
- **[INV]** Referenced category must exist for the same tenant, with
  `category_type` matching the entry's income/expense direction, and be
  `active` at write time.
- **[INV]** An entry with a non-empty `transfer_code` cannot be updated
  individually — only deleted (as a pair, see Transfer below).
- **[INV]** Summary/aggregate queries (lifetime total, month-to-date) must
  **exclude** entries with a non-empty `transfer_code`.

## Transfer

A movement of funds between two accounts within the same tenant, modeled as
two linked Cash Entries.

- **[INV]** A transfer creates exactly two entries sharing one
  `transfer_code`: one `expense` on the source account, one `income` on the
  destination account, same date/amount/note, in a single atomic write.
- **[INV]** Source and destination accounts must differ, both must exist,
  belong to the tenant, and be `active`.
- **[INV]** Amount must be `> 0`.
- **[INV]** Deleting a transfer entry deletes **both** paired entries
  atomically; before deleting, the system must verify exactly 2 rows share
  that `transfer_code` for that tenant — if not exactly 2, refuse the
  delete entirely (data-integrity guard against a corrupted/partial
  transfer).

## Entitlement

Whether a user is currently allowed to use the system at all — independent
of tenant membership.

- **[INV]** A platform admin (`manage_options` in legacy terms) always has
  access, bypassing subscription checks, **but still requires a bound
  tenant** to use tenant-scoped endpoints (tenant-list/tenant-create
  endpoints don't require a tenant).
- **[INV]** A non-admin user must have an active-or-pending-cancel
  subscription to the configured product to access any tenant-scoped
  endpoint.
- **[INV]** If the entitlement backend itself is unavailable (legacy: the
  Subscriptions plugin not installed), access is denied by default (fail
  closed), not granted.
- **Standalone change**: this whole domain becomes `EntitlementService`, an
  interface with swappable adapters — see `auth-entitlement-abstraction.md`.
  This is the one domain where the *implementation* is expected to change
  significantly; the *invariants* above are what must survive.

## Cross-domain invariant

- **[INV] Tenant isolation**: every query in every domain must be scoped by
  `tenant_id`, and no operation may read or write another tenant's rows even
  if given a valid-looking ID for that row (must be validated as belonging
  to the current tenant, not just "exists"). This is the single most
  important invariant in the whole system and is explicitly re-tested at
  Gate 3 (API-level cross-tenant access tests).
