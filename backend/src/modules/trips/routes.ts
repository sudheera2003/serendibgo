// M2 – Destinations, trip planner and distance calculator
import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma, num } from '../../lib/prisma';
import { dateOnly, intParam, paged, paging, parse } from '../../lib/http';
import { badRequest, notFound } from '../../lib/errors';
import { requireAuth, requireRole, userId } from '../../lib/auth';
import { distanceMatrix } from '../../services/distance';
import { roadRoute } from '../../services/routing';
import { optimiseRoute, routeLength } from '../../algorithms/routeOptimizer';
import { LatLng, round2 } from '../../algorithms/geo';
import { env } from '../../config/env';

export const destinationsRouter = Router();

destinationsRouter.get('/', async (req, res) => {
  const q = parse(z.object({ q: z.string().trim().max(80).optional(), category: z.string().max(40).optional(), district: z.string().max(40).optional() }), req.query);
  const { skip, take, page, limit } = paging(req.query);
  const where: Prisma.DestinationWhereInput = {
    isActive: true,
    ...(q.q ? { OR: [{ name: { contains: q.q } }, { district: { contains: q.q } }, { province: { contains: q.q } }] } : {}),
    ...(q.category ? { category: q.category } : {}),
    ...(q.district ? { district: q.district } : {}),
  };
  const [items, total] = await Promise.all([prisma.destination.findMany({ where, orderBy: [{ avgRating: 'desc' }, { name: 'asc' }], skip, take }), prisma.destination.count({ where })]);
  res.json(paged(items, total, page, limit));
});

destinationsRouter.get('/categories', async (_req, res) => {
  const rows = await prisma.destination.groupBy({ by: ['category'], where: { isActive: true }, _count: true, orderBy: { category: 'asc' } });
  res.json({ items: rows.map((r) => ({ category: r.category, count: r._count })) });
});

destinationsRouter.get('/:id', async (req, res) => {
  const d = await prisma.destination.findUnique({ where: { id: intParam(req) } });
  if (!d || !d.isActive) throw notFound('Destination');
  res.json({ destination: d });
});

// ---------------------------------------------------------------------------------------

export const tripsRouter = Router();
tripsRouter.use(requireAuth, requireRole('tourist'));

const tripInclude = { stops: { orderBy: { stopOrder: 'asc' }, include: { destination: true } } } satisfies Prisma.TripInclude;

async function ownTrip(id: number, touristId: number) {
  const trip = await prisma.trip.findFirst({ where: { id, touristId }, include: tripInclude });
  if (!trip) throw notFound('Trip');
  return trip;
}

type TripWithStops = Awaited<ReturnType<typeof ownTrip>>;

function points(trip: { startLat: Prisma.Decimal | null; startLng: Prisma.Decimal | null }, destinations: { latitude: Prisma.Decimal; longitude: Prisma.Decimal }[]): LatLng[] {
  const pts = destinations.map((d) => ({ lat: num(d.latitude), lng: num(d.longitude) }));
  // When no start point is given, the first stop is the start.
  return trip.startLat != null && trip.startLng != null ? [{ lat: num(trip.startLat), lng: num(trip.startLng) }, ...pts] : pts;
}

/** Recalculates leg distances, totals and the cost estimate for the current stop order. */
async function recalculate(trip: TripWithStops) {
  const hasStart = trip.startLat != null && trip.startLng != null;
  const pts = points(trip, trip.stops.map((s) => s.destination));
  let totalKm = 0;
  let totalMin = 0;
  let source = 'estimate';
  const legs: { id: number; km: number; min: number }[] = [];
  let geometry: [number, number][] | null = null;
  // Prefer a real road route (respecting the expressway preference); fall back to the matrix estimate.
  const road = pts.length >= 2 ? await roadRoute(pts, trip.avoidHighways) : null;
  if (road) {
    source = road.source;
    geometry = road.geometry;
    trip.stops.forEach((s, i) => {
      const legIdx = hasStart ? i : i - 1;
      const leg = legIdx >= 0 ? road.legs[legIdx] : { km: 0, min: 0 };
      legs.push({ id: s.id, km: leg.km, min: leg.min });
      totalKm += leg.km;
      totalMin += leg.min;
    });
  } else if (pts.length >= 2) {
    const m = await distanceMatrix(pts);
    source = m.source;
    trip.stops.forEach((s, i) => {
      const to = hasStart ? i + 1 : i;
      const from = to - 1;
      const km = from >= 0 ? m.km[from][to] : 0;
      const min = from >= 0 ? m.min[from][to] : 0;
      legs.push({ id: s.id, km, min });
      totalKm += km;
      totalMin += min;
    });
  } else {
    trip.stops.forEach((s) => legs.push({ id: s.id, km: 0, min: 0 }));
  }
  const entryFees = trip.stops.reduce((sum, s) => sum + num(s.destination.entryFee), 0);
  const transport = round2(totalKm * env.TRANSPORT_RATE_PER_KM);
  await prisma.$transaction([
    ...legs.map((l) => prisma.tripStop.update({ where: { id: l.id }, data: { legDistanceKm: l.km, legDurationMin: l.min } })),
    prisma.trip.update({
      where: { id: trip.id },
      data: {
        totalDistanceKm: round2(totalKm),
        totalDurationMin: totalMin,
        estimatedCost: round2(transport + entryFees),
        distanceSource: source,
        routeGeometry: geometry ?? Prisma.DbNull,
      },
    }),
  ]);
  return { transport, entryFees };
}

async function present(id: number, touristId: number) {
  const trip = await ownTrip(id, touristId);
  const entryFees = trip.stops.reduce((sum, s) => sum + num(s.destination.entryFee), 0);
  return {
    trip,
    costBreakdown: [
      { label: `Transport estimate: ${num(trip.totalDistanceKm)} km × LKR ${env.TRANSPORT_RATE_PER_KM}`, amount: round2(num(trip.totalDistanceKm) * env.TRANSPORT_RATE_PER_KM) },
      { label: 'Entrance fees', amount: round2(entryFees) },
    ],
  };
}

const tripBody = z.object({
  title: z.string().trim().min(2).max(120),
  startDate: dateOnly.optional(),
  endDate: dateOnly.optional(),
  start: z.object({ lat: z.number().min(5).max(10.5), lng: z.number().min(79).max(82.5), label: z.string().max(120).optional() }).nullable().optional(),
  destinationIds: z.array(z.number().int().positive()).max(10, 'A trip can have up to 10 stops').default([]),
  avoidHighways: z.boolean().optional(),
});

async function setStops(tripId: number, destinationIds: number[]) {
  if (new Set(destinationIds).size !== destinationIds.length) throw badRequest('Each destination can only appear once in a trip');
  const found = await prisma.destination.count({ where: { id: { in: destinationIds }, isActive: true } });
  if (found !== destinationIds.length) throw badRequest('Some destinations do not exist');
  await prisma.$transaction([
    prisma.tripStop.deleteMany({ where: { tripId } }),
    prisma.tripStop.createMany({ data: destinationIds.map((destinationId, i) => ({ tripId, destinationId, stopOrder: i + 1 })) }),
  ]);
}

tripsRouter.get('/', async (req, res) => {
  const items = await prisma.trip.findMany({ where: { touristId: userId(req) }, include: tripInclude, orderBy: { updatedAt: 'desc' } });
  res.json({ items });
});

tripsRouter.post('/', async (req, res) => {
  const body = parse(tripBody, req.body);
  if (body.startDate && body.endDate && body.endDate < body.startDate) throw badRequest('End date must be after start date');
  const trip = await prisma.trip.create({
    data: {
      touristId: userId(req),
      title: body.title,
      startDate: body.startDate,
      endDate: body.endDate,
      startLat: body.start?.lat,
      startLng: body.start?.lng,
      startLabel: body.start?.label,
      avoidHighways: body.avoidHighways ?? false,
    },
  });
  await setStops(trip.id, body.destinationIds);
  await recalculate(await ownTrip(trip.id, userId(req)));
  res.status(201).json(await present(trip.id, userId(req)));
});

tripsRouter.get('/:id', async (req, res) => {
  res.json(await present(intParam(req), userId(req)));
});

tripsRouter.patch('/:id', async (req, res) => {
  const id = intParam(req);
  await ownTrip(id, userId(req));
  const body = parse(tripBody.partial(), req.body);
  await prisma.trip.update({
    where: { id },
    data: {
      title: body.title,
      startDate: body.startDate,
      endDate: body.endDate,
      avoidHighways: body.avoidHighways,
      ...(body.start !== undefined ? { startLat: body.start?.lat ?? null, startLng: body.start?.lng ?? null, startLabel: body.start?.label ?? null } : {}),
    },
  });
  if (body.destinationIds) await setStops(id, body.destinationIds);
  await recalculate(await ownTrip(id, userId(req)));
  res.json(await present(id, userId(req)));
});

tripsRouter.delete('/:id', async (req, res) => {
  const id = intParam(req);
  await ownTrip(id, userId(req));
  await prisma.trip.delete({ where: { id } });
  res.status(204).end();
});

/** FR06 – suggest an efficient visiting order (nearest neighbour + 2-opt). */
tripsRouter.post('/:id/optimise', async (req, res) => {
  const id = intParam(req);
  const trip = await ownTrip(id, userId(req));
  if (trip.stops.length < 3) {
    res.json({ ...(await present(id, userId(req))), optimisation: { changed: false, savedKm: 0, message: 'Add at least 3 stops to optimise' } });
    return;
  }
  const hasStart = trip.startLat != null && trip.startLng != null;
  const pts = points(trip, trip.stops.map((s) => s.destination));
  const m = await distanceMatrix(pts);
  let newOrder: number[]; // indexes into trip.stops
  let before: number;
  let after: number;
  if (hasStart) {
    const current = trip.stops.map((_, i) => i + 1);
    before = routeLength(current, m.km);
    const r = optimiseRoute(m.km);
    after = r.length;
    newOrder = r.order.map((x) => x - 1);
  } else {
    // Without a start point, keep the first stop as the start and optimise the rest.
    const current = trip.stops.slice(1).map((_, i) => i + 1);
    before = routeLength(current, m.km);
    const r = optimiseRoute(m.km);
    after = r.length;
    newOrder = [0, ...r.order];
  }
  const changed = after + 0.01 < before;
  if (changed) {
    await setStops(id, newOrder.map((i) => trip.stops[i].destinationId));
    await recalculate(await ownTrip(id, userId(req)));
  }
  res.json({ ...(await present(id, userId(req))), optimisation: { changed, beforeKm: round2(before), afterKm: round2(changed ? after : before), savedKm: changed ? round2(before - after) : 0 } });
});

/** Packages that visit at least one of the trip's destinations. */
tripsRouter.get('/:id/suggestions', async (req, res) => {
  const trip = await ownTrip(intParam(req), userId(req));
  const ids = trip.stops.map((s) => s.destinationId);
  const packages = await prisma.tourPackage.findMany({
    where: { isActive: true, provider: { verificationStatus: 'approved' }, destinations: { some: { destinationId: { in: ids } } } },
    include: { provider: { select: { businessName: true, avgRating: true } }, destinations: { include: { destination: { select: { id: true, name: true } } } } },
    take: 10,
    orderBy: { avgRating: 'desc' },
  });
  res.json({ packages });
});
