import type { ErrorRequestHandler, RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';

/** An error that is safe to show to the client. */
export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (message: string, details?: unknown) => new AppError(400, 'BAD_REQUEST', message, details);
export const unauthorized = (message = 'Please log in to continue') => new AppError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = 'You do not have permission to do this') => new AppError(403, 'FORBIDDEN', message);
export const notFound = (what = 'Resource') => new AppError(404, 'NOT_FOUND', `${what} not found`);
export const conflict = (message: string) => new AppError(409, 'CONFLICT', message);
export const unprocessable = (message: string, details?: unknown) => new AppError(422, 'UNPROCESSABLE', message, details);

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new AppError(404, 'NOT_FOUND', `Route ${req.method} ${req.path} not found`));
};

/** Consistent error format: { error: { code, message, details? } } */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Some fields are invalid', details: err.flatten().fieldErrors } });
    return;
  }
  if (err instanceof AppError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({ error: { code: 'CONFLICT', message: 'A record with these details already exists' } });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Record not found' } });
      return;
    }
  }
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'BAD_JSON', message: 'Request body is not valid JSON' } });
    return;
  }
  req.log?.error({ err }, 'Unhandled error');
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong. Please try again.' } });
};
