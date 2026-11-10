// M8 – Admin dashboard, verification, moderation, master data, complaints and analytics
import { Router } from 'express';
import { z } from 'zod';
import { ComplaintStatus, Prisma } from '@prisma/client';
import { prisma, num } from '../../lib/prisma';
import { intParam, paged, paging, parse } from '../../lib/http';
import { notFound, unprocessable } from '../../lib/errors';
import { requireAuth, requireRole, userId } from '../../lib/auth';
import { audit } from '../../services/audit';
import { notify } from '../../services/notify';
import { refreshRatings } from '../../services/ratings';
import { round2 } from '../../algorithms/geo';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole('admin'));

// ---- Verification queue --------------------------------------------------------------------

const statusQ = z.object({ status: z.enum(['pending', 'approved', 'rejected']).default('pending') });

adminRouter.get('/applications', async (req, res) => {
  const { status } = parse(statusQ, req.query);
  const userSel = { select: { id: true, fullName: true, email: true, phone: true, createdAt: true, documents: { orderBy: { uploadedAt: 'desc' as const } } } };
  const [providers, vendors] = await Promise.all([
    prisma.providerProfile.findMany({ where: { verificationStatus: status }, include: { user: userSel }, orderBy: { updatedAt: 'asc' } }),
    prisma.vendorProfile.findMany({ where: { verificationStatus: status }, include: { user: userSel }, orderBy: { updatedAt: 'asc' } }),
  ]);
  res.json({
    items: [
      ...providers.map((p) => ({ kind: 'provider' as const, id: p.id, name: p.businessName, subtitle: p.providerType.replace('_', ' '), licenceNo: p.licenceNo, description: p.description, status: p.verificationStatus, rejectionReason: p.rejectionReason, user: p.user, submittedAt: p.updatedAt })),
      ...vendors.map((v) => ({ kind: 'vendor' as const, id: v.id, name: v.shopName, subtitle: v.district ?? 'Artisan vendor', licenceNo: null, description: v.description, status: v.verificationStatus, rejectionReason: v.rejectionReason, user: v.user, submittedAt: v.updatedAt })),
    ].sort((a, b) => +a.submittedAt - +b.submittedAt),
  });
});

adminRouter.patch('/applications/:kind/:id', async (req, res) => {
  const kind = parse(z.enum(['provider', 'vendor']), req.params.kind);
  const id = intParam(req);
  const { decision, reason } = parse(
    z.object({ decision: z.enum(['approved', 'rejected']), reason: z.string().trim().max(255).optional() }).refine((b) => b.decision === 'approved' || (b.reason && b.reason.length >= 3), {
      message: 'Give a reason when rejecting',
      path: ['reason'],
    }),
    req.body,
  );
  const data = { verificationStatus: decision, rejectionReason: decision === 'rejected' ? reason : null, verifiedById: userId(req), verifiedAt: new Date() };
  const profile =
    kind === 'provider'
      ? await prisma.providerProfile.update({ where: { id }, data, select: { userId: true, businessName: true } }).then((p) => ({ userId: p.userId, name: p.businessName }))
      : await prisma.vendorProfile.update({ where: { id }, data, select: { userId: true, shopName: true } }).then((v) => ({ userId: v.userId, name: v.shopName }));
  await audit(userId(req), `application.${decision}`, kind, id, { reason: reason ?? null });
  await notify(profile.userId, {
    title: decision === 'approved' ? 'You are verified!' : 'Application not approved',
    body: decision === 'approved' ? `${profile.name} is approved. You can now publish listings.` : `Reason: ${reason}. Update your details and apply again.`,
    type: 'application',
  });
  res.json({ message: `Application ${decision}` });
});

// ---- Review moderation ---------------------------------------------------------------------

adminRouter.get('/reviews', async (req, res) => {
  const { status } = parse(z.object({ status: z.enum(['reported', 'hidden', 'visible']).default('reported') }), req.query);
  const items = await prisma.review.findMany({ where: { status }, include: { tourist: { select: { fullName: true, email: true } } }, orderBy: { updatedAt: 'desc' }, take: 100 });
  res.json({ items });
});

adminRouter.patch('/reviews/:id', async (req, res) => {
  const { status } = parse(z.object({ status: z.enum(['visible', 'hidden']) }), req.body);
  const r = await prisma.review.update({ where: { id: intParam(req) }, data: { status, ...(status === 'visible' ? { reportReason: null } : {}) } });
  await refreshRatings(r.targetType, r.targetId);
  await audit(userId(req), `review.${status}`, 'review', r.id);
  res.json({ review: r });
});

// ---- Master data -----------------------------------------------------------------------------

const destinationBody = z.object({
  name: z.string().trim().min(2).max(120),
  category: z.string().trim().min(2).max(40),
  province: z.string().trim().min(2).max(40),
  district: z.string().trim().min(2).max(40),
  latitude: z.number().min(5.5).max(10),
  longitude: z.number().min(79.4).max(82),
  description: z.string().max(5000).optional(),
  imageUrl: z.string().url().max(500).nullable().optional(),
  entryFee: z.number().min(0).max(100_000).default(0),
  isActive: z.boolean().optional(),
});

adminRouter.get('/destinations', async (_req, res) => {
  res.json({ items: await prisma.destination.findMany({ orderBy: { name: 'asc' } }) });
});
adminRouter.post('/destinations', async (req, res) => {
  const d = await prisma.destination.create({ data: parse(destinationBody, req.body) });
  await audit(userId(req), 'destination.create', 'destination', d.id);
  res.status(201).json({ destination: d });
});
adminRouter.put('/destinations/:id', async (req, res) => {
  const d = await prisma.destination.update({ where: { id: intParam(req) }, data: parse(destinationBody, req.body) });
  await audit(userId(req), 'destination.update', 'destination', d.id);
  res.json({ destination: d });
});

const categoryBody = z.object({ name: z.string().trim().min(2).max(60), description: z.string().max(255).optional() });
adminRouter.post('/categories', async (req, res) => {
  const c = await prisma.productCategory.create({ data: parse(categoryBody, req.body) });
  await audit(userId(req), 'category.create', 'category', c.id);
  res.status(201).json({ category: c });
});
adminRouter.put('/categories/:id', async (req, res) => {
  const c = await prisma.productCategory.update({ where: { id: intParam(req) }, data: parse(categoryBody, req.body) });
  await audit(userId(req), 'category.update', 'category', c.id);
  res.json({ category: c });
});

// ---- Users ------------------------------------------------------------------------------------

adminRouter.get('/users', async (req, res) => {
  const q = parse(z.object({ q: z.string().max(80).optional(), role: z.enum(['tourist', 'provider', 'vendor', 'admin']).optional() }), req.query);
  const { skip, take, page, limit } = paging(req.query);
  const where: Prisma.UserWhereInput = {
    status: { not: 'deleted' },
    ...(q.role ? { role: q.role } : {}),
    ...(q.q ? { OR: [{ fullName: { contains: q.q } }, { email: { contains: q.q } }] } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.user.findMany({ where, select: { id: true, fullName: true, email: true, role: true, status: true, createdAt: true }, orderBy: { createdAt: 'desc' }, skip, take }),
    prisma.user.count({ where }),
  ]);
  res.json(paged(items, total, page, limit));
});

adminRouter.patch('/users/:id/status', async (req, res) => {
  const { status } = parse(z.object({ status: z.enum(['active', 'suspended']) }), req.body);
  const id = intParam(req);
  if (id === userId(req)) throw unprocessable('You cannot suspend your own account');
  await prisma.user.update({ where: { id }, data: { status } });
  if (status === 'suspended') await prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
  await audit(userId(req), `user.${status}`, 'user', id);
  res.json({ message: `User ${status}` });
});

// ---- Monitoring --------------------------------------------------------------------------------

adminRouter.get('/bookings', async (req, res) => {
  const { skip, take, page, limit } = paging(req.query);
  const [items, total] = await Promise.all([
    prisma.booking.findMany({
      include: { tourist: { select: { fullName: true } }, package: { select: { title: true } }, vehicle: { select: { makeModel: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.booking.count(),
  ]);
  res.json(paged(items, total, page, limit));
});

adminRouter.get('/orders', async (req, res) => {
  const { skip, take, page, limit } = paging(req.query);
  const [items, total] = await Promise.all([
    prisma.order.findMany({ include: { tourist: { select: { fullName: true } }, _count: { select: { items: true } } }, orderBy: { createdAt: 'desc' }, skip, take }),
    prisma.order.count(),
  ]);
  res.json(paged(items, total, page, limit));
});

adminRouter.get('/audit-logs', async (req, res) => {
  const { skip, take, page, limit } = paging(req.query);
  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({ include: { actor: { select: { fullName: true } } }, orderBy: { createdAt: 'desc' }, skip, take }),
    prisma.auditLog.count(),
  ]);
  res.json(paged(items, total, page, limit));
});

/** FR22 – analytics dashboard. */
adminRouter.get('/analytics', async (_req, res) => {
  const since = new Date();
  since.setUTCMonth(since.getUTCMonth() - 5, 1);
  since.setUTCHours(0, 0, 0, 0);
  const [users, pendingApps, reported, openComplaints, bookingsByStatus, paidPayments, topProviders, topProducts] = await Promise.all([
    prisma.user.groupBy({ by: ['role'], where: { status: 'active' }, _count: true }),
    Promise.all([prisma.providerProfile.count({ where: { verificationStatus: 'pending' } }), prisma.vendorProfile.count({ where: { verificationStatus: 'pending' } })]),
    prisma.review.count({ where: { status: 'reported' } }),
    prisma.complaint.count({ where: { status: { in: ['open', 'in_progress'] } } }),
    prisma.booking.groupBy({ by: ['status'], _count: true }),
    prisma.payment.findMany({ where: { status: 'success', paidAt: { gte: since } }, select: { amount: true, paidAt: true, bookingId: true } }),
    prisma.providerProfile.findMany({ where: { verificationStatus: 'approved', reviewCount: { gt: 0 } }, orderBy: { avgRating: 'desc' }, take: 5, select: { id: true, businessName: true, avgRating: true, reviewCount: true } }),
    prisma.product.findMany({ where: { reviewCount: { gt: 0 } }, orderBy: { avgRating: 'desc' }, take: 5, select: { id: true, name: true, avgRating: true, reviewCount: true } }),
  ]);
  const months: { month: string; bookings: number; marketplace: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(since);
    d.setUTCMonth(since.getUTCMonth() + i);
    months.push({ month: d.toISOString().slice(0, 7), bookings: 0, marketplace: 0 });
  }
  for (const p of paidPayments) {
    const m = months.find((x) => x.month === p.paidAt!.toISOString().slice(0, 7));
    if (!m) continue;
    if (p.bookingId) m.bookings = round2(m.bookings + num(p.amount));
    else m.marketplace = round2(m.marketplace + num(p.amount));
  }
  res.json({
    users: Object.fromEntries(users.map((u) => [u.role, u._count])),
    pendingApplications: pendingApps[0] + pendingApps[1],
    reportedReviews: reported,
    openComplaints,
    bookingsByStatus: Object.fromEntries(bookingsByStatus.map((b) => [b.status, b._count])),
    revenueByMonth: months,
    totalRevenue: round2(paidPayments.reduce((s, p) => s + num(p.amount), 0)),
    topProviders,
    topProducts,
  });
});

// ---- Complaints (admin side) -------------------------------------------------------------------

adminRouter.get('/complaints', async (req, res) => {
  const { status } = parse(z.object({ status: z.nativeEnum(ComplaintStatus).optional() }), req.query);
  const items = await prisma.complaint.findMany({
    where: status ? { status } : {},
    include: { tourist: { select: { fullName: true, email: true } }, resolvedBy: { select: { fullName: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json({ items });
});

adminRouter.patch('/complaints/:id', async (req, res) => {
  const body = parse(z.object({ status: z.enum(['in_progress', 'resolved', 'rejected']), resolutionNote: z.string().trim().max(2000).optional() }), req.body);
  if (body.status !== 'in_progress' && !body.resolutionNote) throw unprocessable('Add a resolution note');
  const c = await prisma.complaint.update({ where: { id: intParam(req) }, data: { ...body, resolvedById: body.status === 'in_progress' ? null : userId(req) } });
  await audit(userId(req), `complaint.${body.status}`, 'complaint', c.id);
  await notify(c.touristId, { title: 'Complaint update', body: `Your complaint "${c.subject}" is now ${body.status.replace('_', ' ')}.`, type: 'complaint', referenceType: 'complaint', referenceId: c.id });
  res.json({ complaint: c });
});

// ---- Complaints (tourist side) -------------------------------------------------------------------

export const complaintsRouter = Router();
complaintsRouter.use(requireAuth, requireRole('tourist'));

complaintsRouter.post('/', async (req, res) => {
  const body = parse(
    z.object({
      targetType: z.enum(['booking', 'order', 'provider', 'vendor', 'other']),
      targetId: z.number().int().positive().optional(),
      subject: z.string().trim().min(3).max(150),
      description: z.string().trim().min(10).max(3000),
    }),
    req.body,
  );
  const c = await prisma.complaint.create({ data: { ...body, touristId: userId(req) } });
  const admins = await prisma.user.findMany({ where: { role: 'admin', status: 'active' }, select: { id: true } });
  await Promise.all(admins.map((a) => notify(a.id, { title: 'New complaint', body: c.subject, type: 'complaint', referenceType: 'complaint', referenceId: c.id })));
  res.status(201).json({ complaint: c });
});

complaintsRouter.get('/', async (req, res) => {
  res.json({ items: await prisma.complaint.findMany({ where: { touristId: userId(req) }, orderBy: { createdAt: 'desc' } }) });
});

complaintsRouter.get('/:id', async (req, res) => {
  const c = await prisma.complaint.findFirst({ where: { id: intParam(req), touristId: userId(req) } });
  if (!c) throw notFound('Complaint');
  res.json({ complaint: c });
});
