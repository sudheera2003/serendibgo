import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import type { RequestHandler } from 'express';
import type { Role } from '@prisma/client';
import { env } from '../config/env';
import { prisma } from './prisma';
import { forbidden, unauthorized } from './errors';

export interface AuthUser {
  id: number;
  role: Role;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

export function signAccessToken(user: AuthUser) {
  return jwt.sign({ sub: String(user.id), role: user.role }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL as jwt.SignOptions['expiresIn'],
  });
}

/** Creates a random refresh token; only its hash is stored. */
export async function issueTokens(user: AuthUser) {
  const refreshToken = crypto.randomBytes(48).toString('hex');
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: sha256(refreshToken),
      expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_DAYS * 86400_000),
    },
  });
  return { accessToken: signAccessToken(user), refreshToken };
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next(unauthorized());
  try {
    const payload = jwt.verify(header.slice(7), env.JWT_ACCESS_SECRET) as jwt.JwtPayload;
    req.user = { id: Number(payload.sub), role: payload.role as Role };
    next();
  } catch {
    next(unauthorized('Your session has expired. Please log in again.'));
  }
};

/** Role-based access control: requireRole('admin'), requireRole('provider', 'admin') ... */
export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) return next(forbidden());
    next();
  };

export const userId = (req: { user?: AuthUser }) => {
  if (!req.user) throw unauthorized();
  return req.user.id;
};
