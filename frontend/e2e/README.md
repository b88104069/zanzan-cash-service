# End-to-end parity tests

`parity.spec.ts` verifies the Gate 5 (ACTIVE) prototype's PASS criteria
against the actual running app — no backend server, no MySQL, no login;
the app is fully client-side (browser `localStorage`).

Run: `npx playwright test` from `frontend/`. `playwright.config.ts` starts
the frontend dev server itself (`reuseExistingServer: true`) and uses the
environment's pre-installed Chromium — it does not download a browser.

Each `test.step` name maps directly to one item in
`docs/gates/kickoff-contract.md`'s Gate 5 (ACTIVE) PASS Criteria /
"Required test evidence" list, including reload-persistence and a
close-and-reopen-the-browser simulation (a fresh browser context loaded
with the same origin's `storageState`, since `localStorage` isn't shared
between isolated Playwright contexts by default the way a real second
browser window would share it).
