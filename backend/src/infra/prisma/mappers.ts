import type { Prisma } from '@prisma/client';

/** `entryDate` is a plain YYYY-MM-DD string in the domain; @db.Date in Prisma. */
export function entryDateToDb(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

export function entryDateFromDb(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function decimalToNumber(value: Prisma.Decimal | number): number {
  return typeof value === 'number' ? value : value.toNumber();
}
