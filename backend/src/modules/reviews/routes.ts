// M5 – Verified reviews, GPS check-ins and trust scores
import { Router } from 'express';
import { z } from 'zod';
import { Prisma, ReviewTarget } from '@prisma/client';
import { prisma, num } from '../../lib/prisma';
import { intParam, paged, paging, parse } from '../../lib/http';
import { conflict, forbidden, notFound, unprocessable } from '../../lib/errors';
import { requireAuth, requireRole, userId } from '../../lib/auth';
import { CHECKIN_RADIUS_M, haversineMeters } from '../../algorithms/geo';
import { refreshRatings } from '../../services/ratings';
import { notify, notifyAdmins } from '../../services/notify';

export const reviewsRouter = Router();

/** Public: visible reviews of an item. */
reviewsRouter.get('/', async (req, res) => {
  const q = parse(z.object({ targetType: z.nativeEnum(ReviewTarget), targetId: z.coerce.number().int().positive() }), req.query);
  const { skip, take, page, limit } = paging(req.query);
  const where = { targetType: q.targetType, targetId: q.targetId, status: { not: 'hidden' as const } };
  const [items, total, dist] = await Promise.all([
    prisma.review.findMany({ where, include: { tourist: { select: { fullName: true } } }, orderBy: { createdAt: 'desc' }, skip, take }),
    prisma.review.count({ where }),
    prisma.review.groupBy({ by: ['rating'], where, _count: true }),
  ]);
  const distribution = [5, 4, 3, 2, 1].map((r) => ({ rating: r, count: dist.find((d) => d.rating === r)?._count ?? 0 }));
  res.json({ ...paged(items.map((r) => ({ ...r, verified: true })), total, page, limit), distribution });
});

reviewsRouter.use(requireAuth);

/** GPS check-in: the tourist must be within 500 m of the destination. */
reviewsRouter.post('/checkins', requireRole('tourist'), async (req, res) => {
  const body = parse(z.object({ destinationId: z.number().int().positive(), lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }), req.body);
  const dest = await prisma.destination.findFirst({ where: { id: body.destinationId, isActive: true } });
  if (!dest) throw notFound('Destination');
  const distance = Math.round(haversineMeters({ lat: body.lat, lng: body.lng }, { lat: num(dest.latitude), lng: num(dest.longitude) }));
  if (distance > CHECKIN_RADIUS_M) {
    throw unprocessable(`You are ${(distance / 1000).toFixed(1)} km away. Check in when you are within ${CHECKIN_RADIUS_M} m of ${dest.name}.`, { distanceM: distance });
  }
  const checkin = await prisma.destinationCheckin.create({
    data: { touristId: userId(req), destinationId: dest.id, latitude: body.lat, longitude: body.lng, distanceM: distance },
  });
  res.status(201).json({ checkin, message: `Checked in at ${dest.name}. You can now review it.` });
});

/** Everything the current tourist is allowed to review right now (Algorithm 3). */
reviewsRouter.get('/eligibility', requireRole('tourist'), async (req, res) => {
  const touristId = userId(req);
  const [bookings, items, checkins] = await Promise.all([
    prisma.booking.findMany({
      where: { touristId, status: 'completed', review: null },
      include: { package: { select: { id: true, title: true, imageUrl: true } }, vehicle: { select: { id: true, makeModel: true, imageUrl: true } } },
    }),
    prisma.orderItem.findMany({
      where: { order: { touristId }, itemStatus: 'delivered', review: null },
      include: { product: { select: { id: true, name: true, imageUrls: true } } },
    }),
    prisma.destinationCheckin.findMany({ where: { touristId, review: null }, include: { destination: { select: { id: true, name: true, imageUrl: true } } } }),
  ]);
  res.json({
    items: [
      ...bookings.map((b) => ({ source: { type: 'booking', id: b.id }, targetType: b.bookingType, targetId: (b.packageId ?? b.vehicleId)!, title: b.package?.title ?? b.vehicle?.makeModel, imageUrl: b.package?.imageUrl ?? b.vehicle?.imageUrl, date: b.endDate })),
      ...items.map((i) => ({ source: { type: 'order_item', id: i.id }, targetType: 'product', targetId: i.productId, title: i.product.name, imageUrl: (i.product.imageUrls as string[])[0] ?? null, date: i.updatedAt })),
      ...checkins.map((c) => ({ source: { type: 'checkin', id: c.id }, targetType: 'destination', targetId: c.destinationId, title: c.destination.name, imageUrl: c.destination.imageUrl, date: c.checkedInAt })),
    ],
  });
});

const createSchema = z.object({
  source: z.object({ type: z.enum(['booking', 'order_item', 'checkin']), id: z.number().int().positive() }),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).optional(),
  photoUrls: z.array(z.string().url().max(500)).max(4).optional(),
});

reviewsRouter.post('/', requireRole('tourist'), async (req, res) => {
  const body = parse(createSchema, req.body);
  const touristId = userId(req);
  let target: { targetType: ReviewTarget; targetId: number };
  let link: Pick<Prisma.ReviewUncheckedCreateInput, 'bookingId' | 'orderItemId' | 'checkinId'>;

  if (body.source.type === 'booking') {
    const b = await prisma.booking.findUnique({ where: { id: body.source.id }, include: { review: true } });
    if (!b || b.touristId !== touristId) throw forbidden('You can only review your own bookings');
    if (b.status !== 'completed') throw unprocessable('You can review this after the booking is completed');
    if (b.review) throw conflict('You have already reviewed this booking');
    target = { targetType: b.bookingType, targetId: (b.packageId ?? b.vehicleId)! };
    link = { bookingId: b.id };
  } else if (body.source.type === 'order_item') {
    const i = await prisma.orderItem.findUnique({ where: { id: body.source.id }, include: { order: true, review: true } });
    if (!i || i.order.touristId !== touristId) throw forbidden('You can only review products you bought');
    if (i.itemStatus !== 'delivered') throw unprocessable('You can review this product after it is delivered');
    if (i.review) throw conflict('You have already reviewed this purchase');
    target = { targetType: 'product', targetId: i.productId };
    link = { orderItemId: i.id };
  } else {
    const c = await prisma.destinationCheckin.findUnique({ where: { id: body.source.id }, include: { review: true } });
    if (!c || c.touristId !== touristId) throw forbidden('Check in at the destination first');
    if (c.distanceM > CHECKIN_RADIUS_M) throw unprocessable('This check-in is too far from the destination');
    if (c.review) throw conflict('You have already reviewed this visit');
    target = { targetType: 'destination', targetId: c.destinationId };
    link = { checkinId: c.id };
  }

  const review = await prisma.review.create({ data: { touristId, ...target, ...link, rating: body.rating, comment: body.comment, photoUrls: body.photoUrls } });
  await refreshRatings(review.targetType, review.targetId);
  const ownerId = await itemOwnerUserId(review.targetType, review.targetId);
  if (ownerId) await notify(ownerId, { title: 'New review', body: `You received a ${review.rating}-star review`, type: 'review', referenceType: 'review', referenceId: review.id });
  res.status(201).json({ review });
});

async function itemOwnerUserId(t: ReviewTarget, id: number): Promise<number | null> {
  if (t === 'package') return (await prisma.tourPackage.findUnique({ where: { id }, select: { provider: { select: { userId: true } } } }))?.provider.userId ?? null;
  if (t === 'vehicle') return (await prisma.vehicle.findUnique({ where: { id }, select: { provider: { select: { userId: true } } } }))?.provider.userId ?? null;
  if (t === 'product') return (await prisma.product.findUnique({ where: { id }, select: { vendor: { select: { userId: true } } } }))?.vendor.userId ?? null;
  return null;
}

reviewsRouter.get('/mine', requireRole('tourist'), async (req, res) => {
  res.json({ items: await prisma.review.findMany({ where: { touristId: userId(req) }, orderBy: { createdAt: 'desc' } }) });
});

/** Reviews of the provider's / vendor's own items. */
reviewsRouter.get('/received', requireRole('provider', 'vendor'), async (req, res) => {
  const me = userId(req);
  const [pk, vh, pr] = await Promise.all([
    prisma.tourPackage.findMany({ where: { provider: { userId: me } }, select: { id: true } }),
    prisma.vehicle.findMany({ where: { provider: { userId: me } }, select: { id: true } }),
    prisma.product.findMany({ where: { vendor: { userId: me } }, select: { id: true } }),
  ]);
  const items = await prisma.review.findMany({
    where: {
      status: { not: 'hidden' },
      OR: [
        { targetType: 'package', targetId: { in: pk.map((x) => x.id) } },
        { targetType: 'vehicle', targetId: { in: vh.map((x) => x.id) } },
        { targetType: 'product', targetId: { in: pr.map((x) => x.id) } },
      ],
    },
    include: { tourist: { select: { fullName: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json({ items });
});

reviewsRouter.post('/:id/report', async (req, res) => {
  const { reason } = parse(z.object({ reason: z.string().trim().min(3).max(255) }), req.body);
  const r = await prisma.review.findUnique({ where: { id: intParam(req) } });
  if (!r || r.status === 'hidden') throw notFound('Review');
  await prisma.review.update({ where: { id: r.id }, data: { status: 'reported', reportReason: reason } });
  await notifyAdmins({ title: 'Review reported', body: reason, type: 'moderation', referenceType: 'review', referenceId: r.id });
  res.json({ message: 'Thanks. An administrator will check this review.' });
});

/** The owner of the reviewed item can reply once. */
reviewsRouter.post('/:id/reply', requireRole('provider', 'vendor'), async (req, res) => {
  const { reply } = parse(z.object({ reply: z.string().trim().min(2).max(1000) }), req.body);
  const r = await prisma.review.findUnique({ where: { id: intParam(req) } });
  if (!r) throw notFound('Review');
  if ((await itemOwnerUserId(r.targetType, r.targetId)) !== userId(req)) throw forbidden('You can only reply to reviews of your own listings');
  if (r.providerReply) throw conflict('You have already replied to this review');
  res.json({ review: await prisma.review.update({ where: { id: r.id }, data: { providerReply: reply } }) });
});
