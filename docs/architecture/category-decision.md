# Decision: `cash_entries.category` stays a string, not a foreign key

Status: **DECIDED at Gate 4** (per Gate 3 review's explicit requirement to
finalize this — Gate 1 flagged it, Gate 2/3 preserved it without deciding).

## The question

The legacy schema (and the Gate 2/3 port of it) stores `category` on each
cash entry as free text (`VARCHAR(100)`), not a foreign key to the
`categories` table. Gate 1's `domain-boundaries.md` flagged this as an open
decision: normalize it to a real foreign key (fixing the legacy design), or
preserve it as-is (matching legacy behavior exactly, including its
downside).

## Decision: **Preserve as a string.**

## Why

1. **This project's stated goal is parity migration, not a redesign**
   (`CLAUDE.md`, `docs/gates/kickoff-contract.md` → Goal). Normalizing
   `category` to a foreign key is a data-model improvement, not something
   needed to reach functional parity with v1.8.33 — no legacy screen or
   endpoint requires it, and the Kickoff's Gate 4 parity checklist doesn't
   ask for it either.
2. **It changes real historical-data semantics.** With a string column,
   renaming a category leaves old entries showing the old name (legacy
   behavior, already true today). With a foreign key, renaming a category
   would retroactively change how every historical entry displays. That's
   a behavior change disguised as a schema cleanup — exactly the kind of
   silent "improvement" `CLAUDE.md`'s project posture says not to make
   without recording it as a deviation. Nobody has asked for the retroactive
   behavior, so it doesn't get introduced as a side effect of tidying the
   schema.
3. **It's not free, and the cost isn't justified by anything in scope.**
   Normalizing would require: migrating existing string values to
   category IDs (with a strategy for values that don't match any current
   category — legacy allows entering free-text categories that were later
   renamed or disabled), reworking `CashEntryService`'s category validation
   in `addEntry`/`updateEntry`, and reworking the migration tooling this
   same Gate is building. None of that buys anything on the "Independent +
   Parity + Tested + Deployable" scorecard this project is measured against
   (`kickoff-contract.md` → Scope).
4. **Migration tooling gets simpler, not harder, by preserving it.** Gate
   4's schema-mapping script (see `scripts/migration/`) can copy the
   `category` column verbatim from the legacy `wp_zz_cash_entries` table —
   no join, no lookup, no "what if the string doesn't match any category
   row" edge case to design around during a data migration that already
   has enough moving parts.

## What this means going forward

- `backend/prisma/schema.prisma`'s `CashEntry.category` stays `String`,
  unchanged from Gate 2/3.
- The standalone frontend's entry form still free-types or
  autocompletes against the active category list, matching legacy
  (`<input list="zz-category-list">` in the legacy shortcode) — see
  `frontend/src/features/cashbook/`.
- Gate 4's migration tooling copies `category` as a plain string column,
  with no reconciliation step against the categories table (see
  `scripts/migration/README.md`).
- This is explicitly **not** revisited for v1.0. A future v1.1 (out of
  this project's scope per `kickoff-contract.md` → 排除範圍) could
  reconsider normalization as a deliberate, user-facing feature change
  (e.g., "renaming a category updates its history") — not as a Gate 4
  side effect.
