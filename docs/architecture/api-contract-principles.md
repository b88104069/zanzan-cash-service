# API Contract Principles

Principles the Gate 3 API must follow. Full endpoint-by-endpoint contract
(request/response schemas) is a Gate 3 deliverable (OpenAPI spec); this
document fixes the ground rules so that work isn't ad hoc.

## 1. Behavior parity, not shape parity

The legacy REST routes (`legacy-architecture-map.md`) define the
**behavior** contract — what inputs are valid, what validation errors occur
and when, what side effects happen. The standalone API does **not** need to
reuse the legacy route names, request shapes, or Chinese error-message
strings verbatim. It must reproduce the same validation rules and the same
success/failure conditions listed in `domain-boundaries.md`.

## 2. Explicit tenant context, always

Every request that touches tenant-scoped data must carry an explicit tenant
identifier (JWT claim or header) that the Tenant-context middleware
validates against the authenticated user's memberships before any handler
runs. No endpoint may infer "current tenant" from stored server-side session
state — this is the deliberate fix for the legacy user-meta-based tenant
tracking (`domain-boundaries.md` → Tenant → Standalone change).

## 3. One shared query builder for list vs. export

`cash-list` and `cash-export` in the legacy code duplicate filter-building
SQL. The standalone API's list and export endpoints must call the same
underlying `CashEntryService` filter method — divergence here is exactly the
kind of copy-paste drift Gate 3 exists to remove.

## 4. Uniform authorization envelope

Every protected endpoint goes through the same three checks, in this order,
regardless of which domain it belongs to:
1. Authenticated? → 401 if not.
2. Entitled (`EntitlementService`)? → 403 if not.
3. Valid tenant context for this user? → 403/400 if not.

No endpoint may special-case its own auth logic inline (this is the direct
fix for the legacy pattern of embedding subscription/tenant checks inside
each `permission_callback`).

## 5. Uniform CSRF/auth posture across endpoints

The legacy inconsistency — only the CSV export endpoint checks a nonce,
every other endpoint relies solely on session-cookie-equivalent auth — is
not carried forward. All state-changing (`POST`/`PUT`/`DELETE`) endpoints
use the same CSRF/auth-token mechanism; there is no endpoint-specific
exception.

## 6. Errors are structured, not just localized strings

Legacy responses are `{status: 'error', message: '<Chinese string>'}` with
no machine-readable error code. The standalone API returns a stable error
`code` (e.g. `ACCOUNT_NOT_FOUND`, `INCOME_EXPENSE_MUTUAL_EXCLUSION`) plus a
human-readable `message`, so the frontend and future integrations don't have
to string-match. The set of error codes is derived directly from the
`[INV]` list in `domain-boundaries.md` — every invariant violation gets a
named code.

## 7. Versioned, documented contract

The API is versioned from day one (e.g. `/api/v1/...`), and Gate 3's PASS
criteria require a published OpenAPI (or equivalent) document committed to
the repo — not just working code. This is what Gate 4's frontend and Gate
4's parity checklist are validated against.

## 8. No business logic in controllers

Controllers/route handlers only: parse+validate the transport-level request,
call exactly one domain service method, map the result/error to an HTTP
response. Any conditional business rule living in a controller is a defect
to fix, mirroring the #1 structural problem identified in the legacy
codebase (`legacy-architecture-map.md`).
