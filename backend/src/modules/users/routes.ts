// M1 – Profiles, preferences, provider/vendor applications, uploads
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { parse } from '../../lib/http';
import { badRequest, conflict, forbidden } from '../../lib/errors';
import { requireAuth, requireRole, userId } from '../../lib/auth';
import { notifyAdmins } from '../../services/notify';
import { storeFile } from '../../services/storage';
import { publicUser } from './present';

export const usersRouter = Router();
usersRouter.use(requireAuth);

const include = { providerProfile: true, vendorProfile: true } as const;

usersRouter.get('/me', async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId(req) }, include });
  res.json({ user: publicUser(user) });
});

usersRouter.patch('/me', async (req, res) => {
  const body = parse(
    z.object({
      fullName: z.string().trim().min(2).max(120).optional(),
      phone: z.string().trim().max(30).nullable().optional(),
      preferredCurrency: z.string().length(3).toUpperCase().optional(),
      preferredLanguage: z.enum(['en', 'si', 'ta']).optional(),
    }),
    req.body,
  );
  const user = await prisma.user.update({ where: { id: userId(req) }, data: body, include });
  res.json({ user: publicUser(user) });
});

/** Right to erasure (PDPA): personal data is anonymised; financial records are kept. */
usersRouter.delete('/me', async (req, res) => {
  const id = userId(req);
  await prisma.$transaction([
    prisma.user.update({
      where: { id },
      data: { status: 'deleted', fullName: 'Deleted user', email: `deleted-${id}-${Date.now()}@deleted.local`, phone: null, passwordHash: '!' },
    }),
    prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } }),
    prisma.deviceToken.deleteMany({ where: { userId: id } }),
  ]);
  res.json({ message: 'Your account has been deleted' });
});

usersRouter.post('/me/device-tokens', async (req, res) => {
  const { token, platform } = parse(z.object({ token: z.string().min(10).max(200), platform: z.enum(['ios', 'android', 'web']) }), req.body);
  await prisma.deviceToken.upsert({ where: { expoPushToken: token }, create: { userId: userId(req), expoPushToken: token, platform }, update: { userId: userId(req), platform } });
  res.status(204).end();
});

usersRouter.delete('/me/device-tokens', async (req, res) => {
  const { token } = parse(z.object({ token: z.string() }), req.body);
  await prisma.deviceToken.deleteMany({ where: { expoPushToken: token, userId: userId(req) } });
  res.status(204).end();
});

// ---- Provider / vendor applications -------------------------------------------------

const documents = z.array(z.object({ docType: z.string().min(2).max(60), fileUrl: z.string().url().max(500) })).max(5).default([]);

usersRouter.post('/me/provider-application', requireRole('provider'), async (req, res) => {
  const body = parse(
    z.object({
      providerType: z.enum(['guide', 'tour_operator', 'vehicle_owner']),
      businessName: z.string().trim().min(2).max(150),
      licenceNo: z.string().trim().max(60).optional(),
      description: z.string().max(2000).optional(),
      documents,
    }),
    req.body,
  );
  const id = userId(req);
  const existing = await prisma.providerProfile.findUnique({ where: { userId: id } });
  if (existing?.verificationStatus === 'approved') throw conflict('Your provider profile is already approved');
  const { documents: docs, ...profile } = body;
  const saved = await prisma.$transaction(async (tx) => {
    if (docs.length) await tx.verificationDocument.createMany({ data: docs.map((d) => ({ ...d, userId: id })) });
    return tx.providerProfile.upsert({
      where: { userId: id },
      create: { ...profile, userId: id },
      update: { ...profile, verificationStatus: 'pending', rejectionReason: null },
    });
  });
  await notifyAdmins({ title: 'New provider application', body: `${saved.businessName} is waiting for verification`, type: 'application', referenceType: 'provider', referenceId: saved.id });
  res.status(201).json({ providerProfile: saved });
});

usersRouter.post('/me/vendor-application', requireRole('vendor'), async (req, res) => {
  const body = parse(
    z.object({
      shopName: z.string().trim().min(2).max(150),
      description: z.string().max(2000).optional(),
      address: z.string().max(255).optional(),
      district: z.string().max(60).optional(),
      documents,
    }),
    req.body,
  );
  const id = userId(req);
  const existing = await prisma.vendorProfile.findUnique({ where: { userId: id } });
  if (existing?.verificationStatus === 'approved') throw conflict('Your shop is already approved');
  const { documents: docs, ...profile } = body;
  const saved = await prisma.$transaction(async (tx) => {
    if (docs.length) await tx.verificationDocument.createMany({ data: docs.map((d) => ({ ...d, userId: id })) });
    return tx.vendorProfile.upsert({ where: { userId: id }, create: { ...profile, userId: id }, update: { ...profile, verificationStatus: 'pending', rejectionReason: null } });
  });
  await notifyAdmins({ title: 'New vendor application', body: `${saved.shopName} is waiting for verification`, type: 'application', referenceType: 'vendor', referenceId: saved.id });
  res.status(201).json({ vendorProfile: saved });
});

usersRouter.get('/me/documents', async (req, res) => {
  res.json({ items: await prisma.verificationDocument.findMany({ where: { userId: userId(req) }, orderBy: { uploadedAt: 'desc' } }) });
});

// ---- Uploads (images and PDF documents) -----------------------------------------------

const allowed: Record<string, string> = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'application/pdf': '.pdf' };

// Files are held in memory briefly, then stored in Cloudinary (or ./uploads without a Cloudinary key).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => (allowed[file.mimetype] ? cb(null, true) : cb(badRequest('Only JPG, PNG, WEBP or PDF files up to 5 MB'))),
});

export const uploadsRouter = Router();
uploadsRouter.post('/', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) throw badRequest('Attach a file in the "file" field');
  res.status(201).json({ url: await storeFile(req.file, allowed[req.file.mimetype] ?? '') });
});

export const assertOwner = (ownerId: number, req: { user?: { id: number; role: string } }) => {
  if (req.user?.role !== 'admin' && ownerId !== req.user?.id) throw forbidden();
};
