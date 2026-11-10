import { Prisma, PrismaClient } from '@prisma/client';

// Send DECIMAL columns to the app as plain numbers instead of strings.
(Prisma.Decimal.prototype as unknown as { toJSON: () => number }).toJSON = function toJSON(this: Prisma.Decimal) {
  return this.toNumber();
};

export const prisma = new PrismaClient();

export const num = (v: Prisma.Decimal | number | null | undefined): number =>
  v == null ? 0 : typeof v === 'number' ? v : v.toNumber();
