// M3 – Tour packages and comparison
import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma, num } from '../../lib/prisma';
import { intParam, paged, paging, parse } from '../../lib/http';
import { badRequest, notFound } from '../../lib/errors';
import { requireAuth, requireRole } from '../../lib/auth';
import { myProvider } from '../owners';

export const packagesRouter = Router();

const listInclude = {
  provider: { select: { id: true, businessName: true, providerType: true, avgRating: true, reviewCount: true } },
  destinations: { orderBy: { dayNo: 'asc' }, include: { destination: { select: { id: true, name: true, district: true, latitude: true, longitude: true } } } },
} satisfies Prisma.TourPackageInclude;

const publicWhere: Prisma.TourPackageWhereInput = { isActive: true, provider: { verificationStatus: 'approved' } };

packagesRouter.get('/', async (req, res) => {
  const q = parse(
    z.object({
      q: z.string().trim().max(80).optional(),
      destinationId: z.coerce.number().int().optional(),
      minDays: z.coerce.number().int().optional(),
      maxDays: z.coerce.number().int().optional(),
      maxPrice: z.coerce.number().optional(),
      minRating: z.coerce.number().min(0).max(5).optional(),
      sort: z.enum(['rating', 'price_asc', 'price_desc', 'duration']).default('rating'),
    }),
    req.query,
  );
  const { skip, take, page, limit } = paging(req.query);
  const where: Prisma.TourPackageWhereInput = {
    ...publicWhere,
    ...(q.q ? { OR: [{ title: { contains: q.q } }, { description: { contains: q.q } }] } : {}),
    ...(q.destinationId ? { destinations: { some: { destinationId: q.destinationId } } } : {}),
    durationDays: { gte: q.minDays, lte: q.maxDays },
    ...(q.maxPrice ? { pricePerPerson: { lte: q.maxPrice } } : {}),
    ...(q.minRating ? { avgRating: { gte: q.minRating } } : {}),
  };
  const orderBy: Prisma.TourPackageOrderByWithRelationInput =
    q.sort === 'price_asc' ? { pricePerPerson: 'asc' } : q.sort === 'price_desc' ? { pricePerPerson: 'desc' } : q.sort === 'duration' ? { durationDays: 'asc' } : { avgRating: 'desc' };
  const [items, total] = await Promise.all([prisma.tourPackage.findMany({ where, include: listInclude, orderBy, skip, take }), prisma.tourPackage.count({ where })]);
  res.json(paged(items, total, page, limit));
});

/** FR08 – side-by-side comparison of up to three packages, rows aligned by inclusion. */
packagesRouter.get('/compare', async (req, res) => {
  const { ids } = parse(z.object({ ids: z.string().regex(/^\d+(,\d+){1,2}$/, 'Choose 2 or 3 packages') }), req.query);
  const idList = [...new Set(ids.split(',').map(Number))];
  const packages = await prisma.tourPackage.findMany({ where: { ...publicWhere, id: { in: idList } }, include: listInclude });
  if (packages.length !== idList.length) throw notFound('Package');
  const byId = new Map(packages.map((p) => [p.id, p]));
  const ordered = idList.map((id) => byId.get(id)!);
  const list = (j: Prisma.JsonValue) => (Array.isArray(j) ? (j as string[]) : []);
  const allInclusions = [...new Set(ordered.flatMap((p) => list(p.inclusions)))].sort();
  res.json({
    packages: ordered,
    rows: [
      { label: 'Price per person (LKR)', values: ordered.map((p) => num(p.pricePerPerson)) },
      { label: 'Duration (days)', values: ordered.map((p) => p.durationDays) },
      { label: 'Max group size', values: ordered.map((p) => p.maxGroupSize) },
      { label: 'Trust score', values: ordered.map((p) => num(p.avgRating)) },
      { label: 'Reviews', values: ordered.map((p) => p.reviewCount) },
      { label: 'Destinations', values: ordered.map((p) => p.destinations.length) },
      ...allInclusions.map((inc) => ({ label: inc, values: ordered.map((p) => list(p.inclusions).includes(inc)) })),
    ],
  });
});

packagesRouter.get('/:id', async (req, res) => {
  const pkg = await prisma.tourPackage.findFirst({ where: { ...publicWhere, id: intParam(req) }, include: listInclude });
  if (!pkg) throw notFound('Package');
  res.json({ package: pkg });
});

/** Seats still free on a date (pending, accepted and confirmed bookings hold seats). */
packagesRouter.get('/:id/availability', async (req, res) => {
  const { date } = parse(z.object({ date: z.coerce.date() }), req.query);
  const pkg = await prisma.tourPackage.findFirst({ where: { ...publicWhere, id: intParam(req) } });
  if (!pkg) throw notFound('Package');
  const held = await prisma.booking.aggregate({ where: { packageId: pkg.id, startDate: date, status: { in: ['pending', 'accepted', 'confirmed'] } }, _sum: { numPersons: true } });
  res.json({ date, seatsLeft: Math.max(0, pkg.maxGroupSize - (held._sum.numPersons ?? 0)) });
});

// ---- Provider management ---------------------------------------------------------------

export const providerPackagesRouter = Router();
providerPackagesRouter.use(requireAuth, requireRole('provider'));

const packageBody = z.object({
  title: z.string().trim().min(3).max(150),
  description: z.string().trim().min(10).max(5000),
  durationDays: z.number().int().min(1).max(30),
  pricePerPerson: z.number().positive().max(10_000_000),
  maxGroupSize: z.number().int().min(1).max(100),
  inclusions: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
  exclusions: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
  imageUrl: z.string().url().max(500).nullable().optional(),
  cancellationPolicy: z.string().max(255).optional(),
  isActive: z.boolean().optional(),
  itinerary: z.array(z.object({ destinationId: z.number().int().positive(), dayNo: z.number().int().min(1) })).min(1, 'Add at least one destination').max(30),
});

async function checkItinerary(itinerary: { destinationId: number; dayNo: number }[], durationDays: number) {
  const ids = itinerary.map((i) => i.destinationId);
  if (new Set(ids).size !== ids.length) throw badRequest('Each destination can only appear once');
  if (itinerary.some((i) => i.dayNo > durationDays)) throw badRequest('Day numbers cannot exceed the package duration');
  if ((await prisma.destination.count({ where: { id: { in: ids } } })) !== ids.length) throw badRequest('Some destinations do not exist');
}

providerPackagesRouter.get('/', async (req, res) => {
  const provider = await myProvider(req, false);
  const items = await prisma.tourPackage.findMany({ where: { providerId: provider.id }, include: listInclude, orderBy: { updatedAt: 'desc' } });
  res.json({ items });
});

providerPackagesRouter.post('/', async (req, res) => {
  const provider = await myProvider(req);
  const { itinerary, ...data } = parse(packageBody, req.body);
  await checkItinerary(itinerary, data.durationDays);
  const pkg = await prisma.tourPackage.create({
    data: { ...data, providerId: provider.id, destinations: { create: itinerary } },
    include: listInclude,
  });
  res.status(201).json({ package: pkg });
});

providerPackagesRouter.put('/:id', async (req, res) => {
  const provider = await myProvider(req);
  const id = intParam(req);
  const existing = await prisma.tourPackage.findFirst({ where: { id, providerId: provider.id } });
  if (!existing) throw notFound('Package');
  const { itinerary, ...data } = parse(packageBody, req.body);
  await checkItinerary(itinerary, data.durationDays);
  const pkg = await prisma.$transaction(async (tx) => {
    await tx.packageDestination.deleteMany({ where: { packageId: id } });
    return tx.tourPackage.update({ where: { id }, data: { ...data, destinations: { create: itinerary } }, include: listInclude });
  });
  res.json({ package: pkg });
});

/** Packages with bookings are deactivated rather than deleted, to keep history. */
providerPackagesRouter.delete('/:id', async (req, res) => {
  const provider = await myProvider(req);
  const id = intParam(req);
  const existing = await prisma.tourPackage.findFirst({ where: { id, providerId: provider.id } });
  if (!existing) throw notFound('Package');
  const used = await prisma.booking.count({ where: { packageId: id } });
  if (used) await prisma.tourPackage.update({ where: { id }, data: { isActive: false } });
  else await prisma.tourPackage.delete({ where: { id } });
  res.status(204).end();
});
