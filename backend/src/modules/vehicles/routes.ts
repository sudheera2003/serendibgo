// M4 – Vehicle rental: listings, search and transparent quotes
import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma, num } from '../../lib/prisma';
import { dateOnly, intParam, paged, paging, parse } from '../../lib/http';
import { badRequest, notFound } from '../../lib/errors';
import { requireAuth, requireRole } from '../../lib/auth';
import { vehicleQuote } from '../../algorithms/pricing';
import { myProvider } from '../owners';

export const VEHICLE_TYPES = ['car', 'van', 'suv', 'tuk_tuk', 'motorbike', 'minibus', 'bus'] as const;

const include = { provider: { select: { id: true, businessName: true, avgRating: true, reviewCount: true } } } satisfies Prisma.VehicleInclude;
const publicWhere: Prisma.VehicleWhereInput = { isActive: true, provider: { verificationStatus: 'approved' } };
const HOLDING: Prisma.BookingWhereInput['status'] = { in: ['pending', 'accepted', 'confirmed'] };

/** Vehicles that already have a booking overlapping [from, to]. */
async function busyVehicleIds(from: Date, to: Date) {
  const rows = await prisma.booking.findMany({
    where: { bookingType: 'vehicle', status: HOLDING, startDate: { lte: to }, endDate: { gte: from } },
    select: { vehicleId: true },
  });
  return [...new Set(rows.map((r) => r.vehicleId!).filter(Boolean))];
}

export async function isVehicleFree(vehicleId: number, from: Date, to: Date, ignoreBookingId?: number) {
  const clash = await prisma.booking.count({
    where: { vehicleId, status: HOLDING, startDate: { lte: to }, endDate: { gte: from }, ...(ignoreBookingId ? { id: { not: ignoreBookingId } } : {}) },
  });
  return clash === 0;
}

export const toQuote = (v: { pricePerDay: Prisma.Decimal; pricePerKm: Prisma.Decimal; driverFeePerDay: Prisma.Decimal; withDriver: boolean }, from: Date, to: Date, km: number) =>
  vehicleQuote({ pricePerDay: num(v.pricePerDay), pricePerKm: num(v.pricePerKm), driverFeePerDay: num(v.driverFeePerDay), withDriver: v.withDriver }, from, to, km);

export const vehiclesRouter = Router();

const searchSchema = z.object({
  from: dateOnly.optional(),
  to: dateOnly.optional(),
  type: z.enum(VEHICLE_TYPES).optional(),
  withDriver: z.enum(['true', 'false']).optional(),
  location: z.string().trim().max(80).optional(),
  minSeats: z.coerce.number().int().optional(),
  km: z.coerce.number().min(0).max(5000).default(0),
});

vehiclesRouter.get('/', async (req, res) => {
  const q = parse(searchSchema, req.query);
  if (q.from && q.to && q.to < q.from) throw badRequest('Return date must be after pickup date');
  const { skip, take, page, limit } = paging(req.query);
  const busy = q.from && q.to ? await busyVehicleIds(q.from, q.to) : [];
  const where: Prisma.VehicleWhereInput = {
    ...publicWhere,
    ...(busy.length ? { id: { notIn: busy } } : {}),
    ...(q.type ? { vehicleType: q.type } : {}),
    ...(q.withDriver ? { withDriver: q.withDriver === 'true' } : {}),
    ...(q.location ? { baseLocation: { contains: q.location } } : {}),
    ...(q.minSeats ? { seats: { gte: q.minSeats } } : {}),
  };
  const [rows, total] = await Promise.all([prisma.vehicle.findMany({ where, include, orderBy: [{ avgRating: 'desc' }, { pricePerDay: 'asc' }], skip, take }), prisma.vehicle.count({ where })]);
  const items = rows.map((v) => ({ ...v, quote: q.from && q.to ? toQuote(v, q.from, q.to, q.km) : null }));
  res.json(paged(items, total, page, limit));
});

vehiclesRouter.get('/:id', async (req, res) => {
  const v = await prisma.vehicle.findFirst({ where: { ...publicWhere, id: intParam(req) }, include });
  if (!v) throw notFound('Vehicle');
  const upcoming = await prisma.booking.findMany({
    where: { vehicleId: v.id, status: HOLDING, endDate: { gte: new Date() } },
    select: { startDate: true, endDate: true },
    orderBy: { startDate: 'asc' },
    take: 20,
  });
  res.json({ vehicle: v, unavailable: upcoming });
});

/** FR11 – full price breakdown before booking. */
vehiclesRouter.get('/:id/quote', async (req, res) => {
  const q = parse(z.object({ from: dateOnly, to: dateOnly, km: z.coerce.number().min(0).max(5000).default(0) }), req.query);
  if (q.to < q.from) throw badRequest('Return date must be after pickup date');
  const v = await prisma.vehicle.findFirst({ where: { ...publicWhere, id: intParam(req) } });
  if (!v) throw notFound('Vehicle');
  res.json({ quote: toQuote(v, q.from, q.to, q.km), available: await isVehicleFree(v.id, q.from, q.to) });
});

// ---- Owner management ------------------------------------------------------------------

export const providerVehiclesRouter = Router();
providerVehiclesRouter.use(requireAuth, requireRole('provider'));

const vehicleBody = z.object({
  vehicleType: z.enum(VEHICLE_TYPES),
  makeModel: z.string().trim().min(2).max(80),
  seats: z.number().int().min(1).max(60),
  withDriver: z.boolean(),
  pricePerDay: z.number().positive().max(1_000_000),
  pricePerKm: z.number().min(0).max(10_000),
  driverFeePerDay: z.number().min(0).max(100_000).default(0),
  baseLocation: z.string().trim().min(2).max(80),
  imageUrl: z.string().url().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
});

providerVehiclesRouter.get('/', async (req, res) => {
  const provider = await myProvider(req, false);
  res.json({ items: await prisma.vehicle.findMany({ where: { providerId: provider.id }, include, orderBy: { updatedAt: 'desc' } }) });
});

providerVehiclesRouter.post('/', async (req, res) => {
  const provider = await myProvider(req);
  const data = parse(vehicleBody, req.body);
  res.status(201).json({ vehicle: await prisma.vehicle.create({ data: { ...data, providerId: provider.id }, include }) });
});

providerVehiclesRouter.put('/:id', async (req, res) => {
  const provider = await myProvider(req);
  const id = intParam(req);
  if (!(await prisma.vehicle.findFirst({ where: { id, providerId: provider.id } }))) throw notFound('Vehicle');
  res.json({ vehicle: await prisma.vehicle.update({ where: { id }, data: parse(vehicleBody, req.body), include }) });
});

providerVehiclesRouter.delete('/:id', async (req, res) => {
  const provider = await myProvider(req);
  const id = intParam(req);
  if (!(await prisma.vehicle.findFirst({ where: { id, providerId: provider.id } }))) throw notFound('Vehicle');
  if (await prisma.booking.count({ where: { vehicleId: id } })) await prisma.vehicle.update({ where: { id }, data: { isActive: false } });
  else await prisma.vehicle.delete({ where: { id } });
  res.status(204).end();
});
