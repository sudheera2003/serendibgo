// M1 – User authentication
import crypto from 'crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { parse } from '../../lib/http';
import { badRequest, conflict, unauthorized, unprocessable } from '../../lib/errors';
import { issueTokens, requireAuth, sha256, userId } from '../../lib/auth';
import { sendMail } from '../../services/mailer';
import { isDev, isTest } from '../../config/env';
import { publicUser } from '../users/present';
import type { OtpPurpose } from '@prisma/client';

export const authRouter = Router();

// Brute-force protection on authentication endpoints (NFR04).
const authLimiter = rateLimit({ windowMs: 15 * 60_000, limit: isTest ? 10_000 : 30, standardHeaders: 'draft-8', legacyHeaders: false });
authRouter.use(authLimiter);

const password = z
  .string()
  .min(8, 'Use at least 8 characters')
  .regex(/[A-Za-z]/, 'Include a letter')
  .regex(/[0-9]/, 'Include a number');

const registerSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().max(30).optional(),
  password,
  role: z.enum(['tourist', 'provider', 'vendor']).default('tourist'),
  preferredCurrency: z.string().length(3).optional(),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: 'You must accept the privacy policy' }) }),
});

const OTP_TTL_MIN = 10;

async function createOtp(userIdValue: number, purpose: OtpPurpose) {
  const code = String(crypto.randomInt(100000, 1000000));
  await prisma.emailOtp.updateMany({ where: { userId: userIdValue, purpose, usedAt: null }, data: { usedAt: new Date() } });
  await prisma.emailOtp.create({ data: { userId: userIdValue, purpose, codeHash: sha256(code), expiresAt: new Date(Date.now() + OTP_TTL_MIN * 60_000) } });
  return code;
}

async function consumeOtp(userIdValue: number, purpose: OtpPurpose, code: string) {
  const otp = await prisma.emailOtp.findFirst({ where: { userId: userIdValue, purpose, usedAt: null }, orderBy: { createdAt: 'desc' } });
  if (!otp || otp.expiresAt < new Date()) throw unprocessable('The code has expired. Request a new one.');
  if (otp.attempts >= 5) throw unprocessable('Too many attempts. Request a new code.');
  if (otp.codeHash !== sha256(code)) {
    await prisma.emailOtp.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    throw unprocessable('Incorrect code');
  }
  await prisma.emailOtp.update({ where: { id: otp.id }, data: { usedAt: new Date() } });
}

/** In development the OTP is also returned so the app can be tested without e-mail. */
const devOtp = (code: string) => (isDev || isTest ? { devOtp: code } : {});

authRouter.post('/register', async (req, res) => {
  const body = parse(registerSchema, req.body);
  const exists = await prisma.user.findUnique({ where: { email: body.email } });
  if (exists) throw conflict('An account with this e-mail already exists');
  const user = await prisma.user.create({
    data: {
      fullName: body.fullName,
      email: body.email,
      phone: body.phone,
      role: body.role,
      preferredCurrency: body.preferredCurrency ?? 'LKR',
      passwordHash: await bcrypt.hash(body.password, 12),
    },
  });
  const code = await createOtp(user.id, 'verify_email');
  await sendMail(user.email, 'Your SerendibGO verification code', `Your verification code is ${code}. It expires in ${OTP_TTL_MIN} minutes.`);
  res.status(201).json({ message: 'Account created. Enter the code sent to your e-mail.', email: user.email, ...devOtp(code) });
});

authRouter.post('/resend-otp', async (req, res) => {
  const { email } = parse(z.object({ email: z.string().trim().toLowerCase().email() }), req.body);
  const user = await prisma.user.findUnique({ where: { email } });
  if (user && !user.isEmailVerified) {
    const code = await createOtp(user.id, 'verify_email');
    await sendMail(user.email, 'Your SerendibGO verification code', `Your verification code is ${code}.`);
    res.json({ message: 'A new code has been sent', ...devOtp(code) });
    return;
  }
  res.json({ message: 'If the account exists, a new code has been sent' });
});

authRouter.post('/verify-otp', async (req, res) => {
  const { email, otp } = parse(z.object({ email: z.string().trim().toLowerCase().email(), otp: z.string().length(6) }), req.body);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw unprocessable('Incorrect code');
  await consumeOtp(user.id, 'verify_email', otp);
  const verified = await prisma.user.update({ where: { id: user.id }, data: { isEmailVerified: true }, include: { providerProfile: true, vendorProfile: true } });
  res.json({ user: publicUser(verified), ...(await issueTokens(verified)) });
});

authRouter.post('/login', async (req, res) => {
  const { email, password: pw } = parse(z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) }), req.body);
  const user = await prisma.user.findUnique({ where: { email }, include: { providerProfile: true, vendorProfile: true } });
  if (!user || user.status === 'deleted' || !(await bcrypt.compare(pw, user.passwordHash))) throw unauthorized('Incorrect e-mail or password');
  if (user.status === 'suspended') throw unauthorized('This account has been suspended. Contact support.');
  if (!user.isEmailVerified) {
    const code = await createOtp(user.id, 'verify_email');
    await sendMail(user.email, 'Your SerendibGO verification code', `Your verification code is ${code}.`);
    res.status(403).json({ error: { code: 'EMAIL_NOT_VERIFIED', message: 'Verify your e-mail first. We sent you a new code.' }, email: user.email, ...devOtp(code) });
    return;
  }
  res.json({ user: publicUser(user), ...(await issueTokens(user)) });
});

/** Refresh-token rotation: each refresh token works once. */
authRouter.post('/refresh', async (req, res) => {
  const { refreshToken } = parse(z.object({ refreshToken: z.string().min(20) }), req.body);
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: sha256(refreshToken) }, include: { user: true } });
  if (!stored || stored.expiresAt < new Date() || stored.user.status !== 'active') throw unauthorized('Session expired. Please log in again.');
  if (stored.revokedAt) {
    // A reused token means it may have been stolen: revoke every session of this user.
    await prisma.refreshToken.updateMany({ where: { userId: stored.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    throw unauthorized('Session expired. Please log in again.');
  }
  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
  res.json(await issueTokens(stored.user));
});

authRouter.post('/logout', async (req, res) => {
  const { refreshToken, allDevices } = parse(z.object({ refreshToken: z.string().optional(), allDevices: z.boolean().optional() }), req.body ?? {});
  if (refreshToken) {
    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: sha256(refreshToken) } });
    if (stored) {
      await prisma.refreshToken.updateMany({ where: allDevices ? { userId: stored.userId, revokedAt: null } : { id: stored.id }, data: { revokedAt: new Date() } });
    }
  }
  res.json({ message: 'Logged out' });
});

authRouter.post('/forgot-password', async (req, res) => {
  const { email } = parse(z.object({ email: z.string().trim().toLowerCase().email() }), req.body);
  const user = await prisma.user.findUnique({ where: { email } });
  let extra = {};
  if (user && user.status === 'active') {
    const code = await createOtp(user.id, 'reset_password');
    await sendMail(user.email, 'Reset your SerendibGO password', `Your password reset code is ${code}. It expires in ${OTP_TTL_MIN} minutes.`);
    extra = devOtp(code);
  }
  // Same answer whether or not the account exists, so e-mails cannot be enumerated.
  res.json({ message: 'If the account exists, a reset code has been sent', ...extra });
});

authRouter.post('/reset-password', async (req, res) => {
  const body = parse(z.object({ email: z.string().trim().toLowerCase().email(), otp: z.string().length(6), newPassword: password }), req.body);
  const user = await prisma.user.findUnique({ where: { email: body.email } });
  if (!user) throw badRequest('Incorrect code');
  await consumeOtp(user.id, 'reset_password', body.otp);
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(body.newPassword, 12) } }),
    prisma.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
  res.json({ message: 'Password updated. Please log in.' });
});

authRouter.post('/change-password', requireAuth, async (req, res) => {
  const body = parse(z.object({ currentPassword: z.string(), newPassword: password }), req.body);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId(req) } });
  if (!(await bcrypt.compare(body.currentPassword, user.passwordHash))) throw unprocessable('Current password is incorrect');
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(body.newPassword, 12) } });
  res.json({ message: 'Password changed' });
});
