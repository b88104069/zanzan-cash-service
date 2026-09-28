import type { Prisma, PrismaClient } from '@prisma/client';

/** Accepts either the top-level client or a `$transaction` callback's tx client. */
export type Db = PrismaClient | Prisma.TransactionClient;
