import { config } from 'dotenv';
import { join } from 'node:path';

// Integration tests run against the real MySQL test database
// (zanzan_cash_test), not the in-memory store — this is what proves Gate 3's
// "real transaction semantics" claim rather than just asserting it.
config({ path: join(import.meta.dirname, '..', '..', '.env.test') });
