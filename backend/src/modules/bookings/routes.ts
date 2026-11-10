// M3/M4 – Booking workflow for packages and vehicles
import { Router } from 'express';
import { z } from 'zod';
import { BookingStatus, Prisma } from '@prisma/client';
import { prisma, num } from '../../lib/prisma';
import { dateOnly, intParam, paged, paging, parse } from '../../lib/http';
import { badRequest, conflict, forbidden, notFound, unprocessable } from '../../lib/errors';
import { requireAuth, requireRole, userId } from '../../lib/auth';
import { packageQuote } from '../../algorithms/pricing';
import { notify } from '../../services/notify';
import { toQuote } from '../vehicles/routes';
import { myProvider } from '../owners';

export const bookingsRouter = Router();
bookingsRouter.use(requireAuth);

export const bookingInclude = {
  package: { select: { id: true, title: true, imageUrl: true, durationDays: true, provider: { select: { id: true, userId: true, businessName: true } } } },
  vehicle: { select: { id: true, makeModel: true, vehicleType: true, imageUrl: true, withDriver: true, baseLocation: true, provider: { select: { id: true, userId: true, businessName: true } } } },
  tourist: { select: { id: true, fullName: true, email: true, phone: true } },
  payments: { select: { id: true, status: true, amount: true, paidAt: true }, orderBy: { createdAt: 'desc' } },
  review: { select: { id: true, rating: true } },
} satisfies Prisma.BookingInclude;

const DAY = 86_400_000;

const createSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('package'), packageId: z.number().int().positive(), startDate: dateOnly, numPersons: z.number().int().min(1).max(100), notes: z.string().max(500).optional() }),
  z.object({
    type: z.literal('vehicle'),
    vehicleId: z.number().int().positive(),
    startDate: dateOnly,
    endDate: dateOnly,
    estimatedKm: z.number().min(0).max(5000).default(0),
    notes: z.string().max(500).optional(),
  }),
]);

bookingsRouter.post('/', requireRole('tourist'), async (req, res) => {
  const body = parse(createSchema, req.body);
  const today = new Date(new Date().toISOString().slice(0, 10));
  if (body.startDate < today) throw badRequest('Choose a date from today onwards');
  const touristId = userId(req);

  const booking = await prisma.$transaction(async (tx) => {
    if (body.type === 'package') {
      // Lock the package row so two people cannot take the last seats at the same time.
      await tx.$queryRaw`SELECT package_id FROM tour_packages WHERE package_id = ${body.packageId} FOR UPDATE`;
      const pkg = await tx.tourPackage.findFirst({ where: { id: body.packageId, isActive: true, provider: { verificationStatus: 'approved' } } });
      if (!pkg) throw notFound('Package');
      const held = await tx.booking.aggregate({ where: { packageId: pkg.id, startDate: body.startDate, status: { in: ['pending', 'accepted', 'confirmed'] } }, _sum: { numPersons: true } });
      const left = pkg.maxGroupSize - (held._sum.numPersons ?? 0);
      if (body.numPersons > left) throw conflict(left > 0 ? `Only ${left} seat(s) left on this date` : 'This date is fully booked');
      const quote = packageQuote(num(pkg.pricePerPerson), body.numPersons);
      return tx.booking.create({
        data: {
          touristId,
          bookingType: 'package',
          packageId: pkg.id,
          startDate: body.startDate,
          endDate: new Date(body.startDate.getTime() + (pkg.durationDays - 1) * DAY),
          numPersons: body.numPersons,
          priceBreakdown: quote.lines as unknown as Prisma.InputJsonValue,
          totalAmount: quote.total,
          notes: body.notes,
        },
        include: bookingInclude,
      });
    }
    if (body.endDate < body.startDate) throw badRequest('Return date must be after pickup date');
    await tx.$queryRaw`SELECT vehicle_id FROM vehicles WHERE vehicle_id = ${body.vehicleId} FOR UPDATE`;
    const v = await tx.vehicle.findFirst({ where: { id: body.vehicleId, isActive: true, provider: { verificationStatus: 'approved' } } });
    if (!v) throw notFound('Vehicle');
    const clash = await tx.booking.count({
      where: { vehicleId: v.id, status: { in: ['pending', 'accepted', 'confirmed'] }, startDate: { lte: body.endDate }, endDate: { gte: body.startDate } },
    });
    if (clash) throw conflict('This vehicle is not available for the selected dates');
    const quote = toQuote(v, body.startDate, body.endDate, body.estimatedKm);
    return tx.booking.create({
      data: {
        touristId,
        bookingType: 'vehicle',
        vehicleId: v.id,
        startDate: body.startDate,
        endDate: body.endDate,
        estimatedKm: body.estimatedKm,
        priceBreakdown: quote.lines as unknown as Prisma.InputJsonValue,
        totalAmount: quote.total,
        notes: body.notes,
      },
      include: bookingInclude,
    });
  });

  const owner = booking.package?.provider ?? booking.vehicle?.provider;
  if (owner) {
    await notify(owner.userId, {
      title: 'New booking request',
      body: `${booking.tourist.fullName} requested ${booking.package?.title ?? booking.vehicle?.makeModel}`,
      type: 'booking',
      referenceType: 'booking',
      referenceId: booking.id,
    });
  }
  res.status(201).json({ booking });
});

/** Tourist: my bookings. */
bookingsRouter.get('/', requireRole('tourist'), async (req, res) => {
  const { status } = parse(z.object({ status: z.nativeEnum(BookingStatus).optional() }), req.query);
  const { skip, take, page, limit } = paging(req.query);
  const where = { touristId: userId(req), ...(status ? { status } : {}) };
  const [items, total] = await Promise.all([prisma.booking.findMany({ where, include: bookingInclude, orderBy: { createdAt: 'desc' }, skip, take }), prisma.booking.count({ where })]);
  res.json(paged(items, total, page, limit));
});

/** Provider: requests for my packages and vehicles. */
bookingsRouter.get('/incoming', requireRole('provider'), async (req, res) => {
  const provider = await myProvider(req, false);
  const { status } = parse(z.object({ status: z.nativeEnum(BookingStatus).optional() }), req.query);
  const { skip, take, page, limit } = paging(req.query);
  const where: Prisma.BookingWhereInput = {
    OR: [{ package: { providerId: provider.id } }, { vehicle: { providerId: provider.id } }],
    ...(status ? { status } : {}),
  };
  const [items, total] = await Promise.all([prisma.booking.findMany({ where, include: bookingInclude, orderBy: { createdAt: 'desc' }, skip, take }), prisma.booking.count({ where })]);
  res.json(paged(items, total, page, limit));
});

async function loadBooking(id: number) {
  const b = await prisma.booking.findUnique({ where: { id }, include: bookingInclude });
  if (!b) throw notFound('Booking');
  return b;
}

const ownerUserId = (b: Awaited<ReturnType<typeof loadBooking>>) => b.package?.provider.userId ?? b.vehicle?.provider.userId;

bookingsRouter.get('/:id', async (req, res) => {
  const b = await loadBooking(intParam(req));
  const me = req.user!;
  if (me.role !== 'admin' && b.touristId !== me.id && ownerUserId(b) !== me.id) throw forbidden();
  res.json({ booking: b });
});

/**
 * Status workflow:
 *   tourist  : pending|accepted|confirmed -> cancelled
 *   provider : pending -> accepted | declined ; confirmed -> completed (after the start date)
 *   payment  : accepted -> confirmed (see payments module)
 */
bookingsRouter.patch('/:id/status', async (req, res) => {
  const { status, reason } = parse(z.object({ status: z.enum(['accepted', 'declined', 'cancelled', 'completed']), reason: z.string().max(255).optional() }), req.body);
  const b = await loadBooking(intParam(req));
  const me = req.user!;
  const isTourist = b.touristId === me.id;
  const isOwner = ownerUserId(b) === me.id;
  const allowed: Record<string, { who: boolean; from: BookingStatus[] }> = {
    cancelled: { who: isTourist, from: ['pending', 'accepted', 'confirmed'] },
    accepted: { who: isOwner, from: ['pending'] },
    declined: { who: isOwner, from: ['pending'] },
    completed: { who: isOwner, from: ['confirmed'] },
  };
  const rule = allowed[status];
  if (!rule.who) throw forbidden();
  if (!rule.from.includes(b.status)) throw unprocessable(`A ${b.status} booking cannot be ${status}`);
  if (status === 'completed' && b.startDate > new Date()) throw unprocessable('A booking can be completed only after it has started');

  const updated = await prisma.$transaction(async (tx) => {
    if (status === 'cancelled' && b.status === 'confirmed') {
      // Sandbox refund: the paid amount is marked as refunded.
      await tx.payment.updateMany({ where: { bookingId: b.id, status: 'success' }, data: { status: 'refunded' } });
    }
    return tx.booking.update({ where: { id: b.id }, data: { status }, include: bookingInclude });
  });

  const name = b.package?.title ?? b.vehicle?.makeModel ?? 'booking';
  const messages: Record<string, [number | undefined, string, string]> = {
    accepted: [b.touristId, 'Booking accepted', `Your booking for ${name} was accepted. Complete the payment to confirm it.`],
    declined: [b.touristId, 'Booking declined', `Your booking for ${name} was declined${reason ? `: ${reason}` : ''}.`],
    completed: [b.touristId, 'Trip completed', `How was ${name}? You can now write a verified review.`],
    cancelled: [ownerUserId(b), 'Booking cancelled', `${b.tourist.fullName} cancelled the booking for ${name}.`],
  };
  const [to, title, body] = messages[status];
  if (to) await notify(to, { title, body, type: 'booking', referenceType: 'booking', referenceId: b.id });
  res.json({ booking: updated });
});
