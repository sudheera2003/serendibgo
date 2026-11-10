import type { Request } from 'express';
import { z, ZodTypeAny } from 'zod';
import { badRequest } from './errors';

/** Validates input with a Zod schema; invalid input becomes a 400 response. */
export const parse = <T extends ZodTypeAny>(schema: T, data: unknown): z.infer<T> => schema.parse(data);

export function intParam(req: Request, name = 'id'): number {
  const v = Number(req.params[name]);
  if (!Number.isInteger(v) || v <= 0) throw badRequest(`Invalid ${name}`);
  return v;
}

const pageSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

/** Page-based pagination helper: ?page=1&limit=20 */
export function paging(query: unknown) {
  const { page, limit } = pageSchema.parse(query);
  return { skip: (page - 1) * limit, take: limit, page, limit };
}

export const paged = <T>(items: T[], total: number, page: number, limit: number) => ({
  items,
  page,
  limit,
  total,
  hasMore: page * limit < total,
});

export const dateOnly = z.coerce.date().transform((d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())));
