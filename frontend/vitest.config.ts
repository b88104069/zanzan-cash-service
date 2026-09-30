import { defineConfig } from 'vitest/config';

// Accounting Module v0.4 Gate Review MUST FIX 2: minimal vitest setup, added
// only to run the persistence-boundary integration test for
// journalProvenanceMigration (accountingPersistence.test.ts). Scoped to
// exactly that — no broader frontend test infrastructure. jsdom gives us a
// real `localStorage`, matching what loadAccountingDatabase/
// saveAccountingDatabase actually read/write in the browser.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'jsdom',
  },
});
