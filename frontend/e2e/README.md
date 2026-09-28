# End-to-end parity tests

`parity.spec.ts` verifies the Gate 4 parity checklist against a **real
running backend**, not mocks. Before running:

1. Start the backend (from `backend/`): `npm run dev` (or `node
   --env-file=.env node_modules/.bin/tsx src/http/server.ts`), pointed at a
   real MySQL database per `backend/.env.example`.
2. From `frontend/`, run: `npx playwright test`.

`playwright.config.ts` starts the frontend dev server itself
(`reuseExistingServer: true`, so it also works if one is already running)
and uses the environment's pre-installed Chromium — it does not download a
browser.

Each test.step name maps directly to one item in the Kickoff's Gate 4
checklist (`docs/gates/kickoff-contract.md`), so a failing step names
exactly which parity requirement broke.
