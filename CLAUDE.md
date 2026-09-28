# Zanzan Cash Service Migration v1.0

This repository is executing a Gate-driven migration: WordPress plugin
`zanzan-simple-cash-saas` (v1.8.33) → standalone, Google-Cloud-deployable
Cash Service. The full contract — Gate roadmap, PASS criteria, authorization
scope, and stop conditions — lives in `docs/gates/kickoff-contract.md`. That
file is the source of truth for what may be built and in what order. Read it
before making any structural decision.

## Project posture

- **Parity migration, not a redesign.** The legacy plugin's domain rules
  (tenant isolation, income/expense mutual exclusion, transfer double-entry,
  category/account soft-delete) are the spec. Do not "improve" behavior
  without recording it as a deviation in the relevant Gate's Delta Report.
- **No new product features** in this project (no OCR, no AI bookkeeping, no
  mobile app, no new report lines). See `docs/gates/kickoff-contract.md` →
  排除範圍.
- **No production cutover.** This project ends at a Google Cloud
  *staging/non-production* deployment. The live WordPress site, WooCommerce,
  and real customer/member data are never touched.

## Reference materials

- `docs/migration/zanzan-simple-cash-saas_1-8-33_合併原始碼.txt` — the legacy
  plugin's full source snapshot. Treat as read-only historical reference,
  never edit it.
- `docs/architecture/` — the Gate 1 architecture contract (legacy map,
  WordPress dependency inventory, domain/service boundaries, DB strategy,
  API contract principles, auth/entitlement abstraction, GCP target
  architecture, migration sequence, tech stack rationale).
- `docs/gates/` — the Kickoff contract and per-gate specs (characterization
  test spec, etc.).
- `reports/` — Delta Reports produced at the end of each Gate.

## Branching

- `main` — stable baseline; only Gate 5's final PASS merges back into it.
- `migration/v1` — the Gate-driven execution branch for this whole project.
  All Gate work happens here; commit at meaningful checkpoints.

## Gate workflow (summary — full detail in kickoff-contract.md)

1. Work the current Gate's scope only. Do not pull forward the next Gate's
   deliverables (e.g. no production credentials or real customer data ever;
   no frontend work during Gate 1-2; no WooCommerce production integration
   before Gate 5 explicitly allows it).
2. Produce a Delta Report in `reports/` at Gate completion.
3. A Gate is not "PASS" until a Gate Review says so. See kickoff-contract.md
   §Gate Review Channel for how review is currently being carried out in
   this project (this may differ from the original Kickoff's ChatGPT-review
   assumption depending on what tooling is actually available in a given
   session — check the latest Gate's Delta Report for the resolved process).
4. Core domain code (Gate 2+) must never import `$wpdb`, WordPress hook
   functions, or WooCommerce APIs directly — those belong only in adapters.

## Known constraints worth re-reading before assuming otherwise

- Legacy plugin has **zero automated tests** — Gate 2's characterization
  tests are the first tests this system will ever have. Be conservative:
  they encode current behavior, including its quirks (e.g. transfer entries
  cannot be edited individually, only deleted as a pair).
- Legacy multi-tenancy is single-active-tenant-per-session, stored in WP
  user meta (`zz_default_tenant_id`) — this is a stateful design that the
  standalone service is expected to replace with explicit per-request tenant
  context (see `docs/architecture/domain-boundaries.md`).
