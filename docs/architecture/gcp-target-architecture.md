# Google Cloud Target Architecture (Gate 5)

This is the architecture Gate 5 deploys to. Nothing here is provisioned
before Gate 5; Gates 1–4 only need this documented so the backend/frontend
are built in a way that's deployable to it without rework.

```
                         ┌───────────────────────┐
   Browser  ───HTTPS───▶ │  Cloud Run: frontend   │
                         │  (static build, or     │
                         │   served via same      │
                         │   Cloud Run service)   │
                         └──────────┬────────────┘
                                    │ HTTPS (API calls)
                                    ▼
                         ┌───────────────────────┐
                         │  Cloud Run: backend    │
                         │  (Fastify API)         │
                         └──────────┬────────────┘
                                    │ Cloud SQL Auth Proxy / private IP
                                    ▼
                         ┌───────────────────────┐
                         │  Cloud SQL for MySQL   │
                         │  (staging instance)    │
                         └───────────────────────┘

  Secret Manager  ──▶ injected as env vars into the backend Cloud Run service
  Cloud Logging   ◀── both Cloud Run services (stdout/stderr, structured JSON)
```

## Component decisions

- **Compute**: Cloud Run for both frontend and backend. Serverless,
  scales to zero (keeps a non-production staging environment cheap, which
  matters since Gate 5 explicitly must not incur unnecessary spend), and
  matches the Node.js/container-based stack chosen in `tech-stack.md`
  without needing to manage VMs/clusters for a five-table domain.
- **Database**: Cloud SQL for MySQL, **staging tier** (smallest instance
  class that supports the workload) — not the production tier, and never
  connected to the real production WordPress database.
- **Secrets**: Secret Manager for DB credentials, JWT signing key, and any
  entitlement-adapter config — never committed to Git (Gate 5 PASS
  criteria).
- **Networking**: backend Cloud Run service connects to Cloud SQL via the
  Cloud SQL Auth Proxy sidecar (Cloud Run's built-in Cloud SQL connection
  support), not a public IP with an open firewall rule.
- **HTTPS**: Cloud Run provides this by default for both services; no
  custom domain is required for Gate 5 (no DNS/routing changes are in
  scope — see Kickoff §排除範圍).
- **Logging**: Cloud Logging via stdout/stderr from both Cloud Run
  services — sufficient for Gate 5's E2E verification and rollback
  documentation; no separate observability stack needed for a staging
  environment.

## Isolation from production WordPress

- Separate GCP project (or clearly separated resource group within an
  existing non-production project) from anything touching the live
  WordPress/WooCommerce site.
- No network path from this architecture to the production WordPress
  database or hosting.
- No DNS record under the production domain points at these Cloud Run
  services.

## Deployment/rollback

- Deploy via a checked-in deployment config (Cloud Build config or a
  documented `gcloud run deploy` script) — not manual console clicks — so
  Gate 5's "deployment/rollback procedure documented" PASS criterion is
  satisfiable from the repo alone.
- Cloud Run's built-in revision history is the rollback mechanism (route
  traffic back to the previous revision); this is documented explicitly in
  Gate 5's deliverable, not assumed.

## What Gate 5 does not provision

Per the Kickoff's explicit Gate 5 exclusions: no production Cloud Run
service pointed at real traffic, no migration of real WooCommerce/member
data into Cloud SQL, no custom production domain/DNS change. This
architecture exists solely to prove the standalone service *can* run on
Google Cloud end-to-end, not to replace the live site.
