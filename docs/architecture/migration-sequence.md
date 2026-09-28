# Migration Sequence

The order of work across Gates 1–5, and why this order — so a future reader
(or a future Gate) can see why, say, characterization tests come before any
new code, or why the API is built before the frontend.

```
Gate 1                Gate 2                    Gate 3                 Gate 4                      Gate 5
Contract & ─────────▶ Characterization ───────▶ Standalone API ──────▶ Standalone ───────────────▶ GCP Staging
Architecture           Tests + Standalone         + Identity/            Frontend +                  + E2E Freeze
Freeze                 Core Domain                Entitlement            Migration Tooling
                                                   Boundary
```

## Why this order

1. **Contract before code** (Gate 1). Every later Gate's PASS criteria
   reference this Gate's documents (`domain-boundaries.md`'s `[INV]` list,
   `api-contract-principles.md`, etc.). Writing code before the contract is
   fixed risks re-litigating architecture mid-implementation.

2. **Tests before rewrite, core before API** (Gate 2). The legacy system has
   zero automated tests. Writing characterization tests *first*, against
   documented legacy behavior, means the standalone core domain is built
   against a known-correct specification instead of "whatever the new code
   happens to do." Building the core domain with zero WordPress dependency
   before touching HTTP/auth also means Gate 2's tests can run without a
   web server, a database server, or any cloud resource — fastest possible
   feedback loop, and a hard proof point that the domain really is
   decoupled (Gate 2 PASS criterion: core code never calls `$wpdb`/WP
   functions).

3. **API before frontend** (Gate 3 before Gate 4). The frontend's parity
   checklist (Gate 4) needs a stable API contract to build against; building
   frontend and backend simultaneously would recreate the legacy problem of
   the JS (`cashbook.js`) being tightly coupled to specific backend response
   shapes that then can't change independently.

4. **Frontend and migration tooling together, but data migration stays
   dry-run only, before any real deployment** (Gate 4). Parity is a
   user-facing concept — it isn't truly proven until there's a real UI to
   click through the checklist with. Migration tooling is built in the same
   Gate because both need the same schema-mapping understanding, but real
   customer data never moves in this Gate (see Kickoff Gate 4 exclusions).

5. **Deployment last** (Gate 5). Only once the full stack has been proven
   functionally correct locally does it move to real cloud infrastructure —
   this avoids debugging both "does the logic work" and "does the cloud
   config work" at the same time, and keeps Gate 5 focused purely on
   infrastructure/deployment verification against already-correct code.

## Explicit non-sequencing rules

- No Gate may pull forward a later Gate's deliverable (e.g., no real GCP
  resource creation during Gate 2; no WooCommerce production integration
  during Gate 3 — mock/contract only).
- No Gate may leave a previous Gate's PASS criteria to be finished later
  "opportunistically" — each Gate's Delta Report must show its own PASS
  criteria met before requesting review, not partial progress carried as
  debt into the next Gate.
- Gate 5 marks the terminal state (`v1.0 MIGRATION BASELINE FROZEN`); a
  future Production Cutover Project is explicitly a separate, later
  initiative, not Gate 6 of this one.
