import { PrismaClient } from '@prisma/client';

// Single shared client per process — the standard Prisma pattern. Real
// transactions (tenant+seed creation, transfer create/delete) use
// prisma.$transaction, replacing Gate 2's build-before-mutate simplification
// (see reports/gate-2-delta-report.md DEVIATIONS — this was tracked as a
// Gate 3+ carry-over, now delivered here).
export const prisma = new PrismaClient();
