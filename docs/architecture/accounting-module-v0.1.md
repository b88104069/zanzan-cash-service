# Accounting Module Prototype v0.1

This document records the design of the first ERP extension module built
on top of the frozen v1.0 Cash Module baseline (`main@f874583`). It is a
new development contract, distinct from the completed migration project —
see the Slack `#ai-gate-test` thread starting at the "[Accounting Module
Prototype v0.1 — Pre-Implementation Plan]" message for the full Kickoff,
the plan revision, and the Gate Review PASS that approved coding.

## Goal

Validate three things before any real ERP investment:
1. Is a modular architecture (`Cash Module` + `Accounting Module` +
   future `Sales`/`Purchase` modules) actually workable in this codebase?
2. Can bookkeeping data (`CashEntry`) be turned into accounting data
   (`JournalEntry`) without rewriting either module's core logic?
3. Is there room to grow this into ledger/voucher/financial-statement
   modules later?

## Architecture: Accounting Module is a consumer, never a mutator

```
Cash Module (frozen v1.0 baseline — unmodified)
  backend/src/domain/**            (Account, Category, CashEntry, services)
  backend/src/infra/memory/InMemoryDatabase.ts
        │
        │  read-only (CashEntryService.listEntries, AccountService.listForAdmin, ...)
        ▼
Accounting Module (this document)
  backend/src/domain/accounting/**
  backend/src/infra/memory/accounting/**
        │
        │  its own separate store
        ▼
AccountingDatabase → localStorage key `zzcs_accounting_db_v1`
(Cash Module's own store stays at `zzcs_prototype_db_v1` — never shared)
```

The Accounting Module never imports from, writes to, or adds fields onto
anything in `backend/src/domain/` outside its own `accounting/`
subdirectory, nor onto `InMemoryDatabase.ts`. It has its own error type
(`AccountingError`, not Cash Module's `DomainError`), its own id
generator (`generateAccountingId`, independent counter from Cash Module's
`generateId`), and its own frontend persistence file
(`frontend/src/localdb/accounting/accountingPersistence.ts`, mirroring but
never sharing code with `frontend/src/localdb/persistence.ts`).

## Domain model

- **ChartOfAccount** — the Accounting Module's own GL chart (`code`,
  `name`, `type`: asset/liability/equity/revenue/expense).
- **AccountMapping** — `cashAccountId → chartOfAccountId`. Keyed by the
  Cash Module Account's stable id, so it survives reloads correctly.
- **CategoryMapping** — `cashCategoryName → chartOfAccountId`. Keyed by
  category *name* because `CashEntry.category` is itself free text, not a
  foreign key (see `docs/architecture/category-decision.md`). **Known
  limitation**: if a Cash Module category is ever renamed, this mapping
  silently orphans. Acceptable for a single-tenant prototype; a real
  version should key by a stable category id once the Cash Module
  supports one.
- **MappingStatus**: `mapped | unmapped | excluded`. Computed live by
  `LedgerMappingService.classify()` from the two mapping tables above and
  never persisted as its own row — so it can never go stale:
  - `transferCode` present → `excluded` (v0.1 does not auto-journal
    transfers; deferred to a future decision, but always visibly counted
    on the dashboard, never silently dropped)
  - both an account mapping and a category mapping exist → `mapped`
  - either is missing → `unmapped`, and **no JournalEntry is created** —
    the Accounting Module never guesses a GL account.
- **JournalEntry** + **JournalLine** — one JournalEntry always has at
  least a balanced debit line and credit line (Σdebit = Σcredit = amount).
  `sourceCashEntryId` links back to the originating CashEntry for
  traceability, but is never written back to it.
- **Voucher** — v0.1 rule: **1 JournalEntry = 1 Voucher**, created
  together. `journalEntryIds` is an array so a later, explicitly-decided
  version can combine multiple entries into one voucher without a schema
  change — v0.1 deliberately does not auto-group by date or any other
  inferred rule (this was an explicit Gate Review correction: grouping is
  a product decision, not a natural accounting rule).

### Mapping rule (config-driven, not hardcoded)

For a mapped entry:
- `income` → **debit** = the entry's account's mapped GL account,
  **credit** = the entry's category's mapped GL account
- `expense` → **debit** = the entry's category's mapped GL account,
  **credit** = the entry's account's mapped GL account

This logic (`LedgerMappingService`) has no knowledge of specific account
or category names — "現金 → 庫存現金" etc. is seed *data*
(`frontend/src/localdb/accounting/accountingServices.ts`'s
`seedDemoChartOfAccounts`), not logic. A production version would let
users configure their own chart and mappings entirely through the UI
(`ChartOfAccountsManage.tsx` already supports adding new GL accounts and
changing mappings, on top of the demo seed).

## Frontend module structure

```
frontend/src/routing/useHashRoute.ts   minimal hash router — #/cash, #/accounting
frontend/src/shell/ModuleShell.tsx     shared top-level module switcher (extensible to future modules)
frontend/src/localdb/accounting/       Accounting Module's own persistence + service wiring
frontend/src/features/accounting/      AccountingPage, AccountingDashboard, ChartOfAccountsManage,
                                        JournalEntryList, VoucherView
```

No routing framework (React Router) was added — Gate Review explicitly
asked for the smallest solution that still gives each module a real,
directly-openable, bookmarkable, shareable URL
(`https://b88104069.github.io/zanzan-cash-service/#/cash` and `#/accounting`),
and a plain `window.location.hash` listener satisfies that without a new
dependency. The root URL with no hash still defaults to the Cash Module,
so the existing Gate 5 E2E (`e2e/parity.spec.ts`, `goto('./')`) needed no
change for this.

## Out of scope for v0.1 (per the Kickoff)

No auth/login, no WooCommerce, no real DB/GCP, no tax rules, no full
financial statements, no complete double-entry validation beyond the
single mapping rule above, no multi-user, no multi-entry voucher
combination UI.

## Test evidence

- `backend/test/accounting/ledgerMapping.test.ts` — 9 unit tests: mapped
  income/expense produce correct debit/credit GL accounts; balanced
  debit/credit lines; missing account mapping → unmapped/no journal;
  missing category mapping → unmapped/no journal; transfer →
  excluded/no journal but counted; `processPending` idempotency;
  JournalEntry↔Voucher 1:1 traceability; the whole flow never mutates
  Cash Module data (`db.entries`/`db.accounts` snapshot comparison).
- `frontend/e2e/accounting.spec.ts` — real-browser E2E: `#/cash` and
  `#/accounting` independently open/reload/bookmark correctly; demo
  mapping seed visible; income entry → correct journal entry → voucher
  with correct traceable debit/credit; unmapped category is flagged, not
  guessed, and does not create a journal entry; a transfer is excluded
  but visibly counted; accounting data survives a page reload; Cash
  Module's own dashboard summary and transfer-pair display are unaffected
  by the whole accounting flow.
- `frontend/e2e/parity.spec.ts` (the existing Gate 5 suite) — reruns
  unmodified and still passes, confirming no Cash Module regression.
