import type { ReviewTarget } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { bayesianScore, DEFAULT_PRIOR_MEAN } from '../algorithms/trustScore';

async function priorMean(targetType: ReviewTarget) {
  const agg = await prisma.review.aggregate({ where: { targetType, status: { not: 'hidden' } }, _avg: { rating: true } });
  return agg._avg.rating ?? DEFAULT_PRIOR_MEAN;
}

async function ratingsFor(targetType: ReviewTarget, ids: number[]) {
  const rows = await prisma.review.findMany({ where: { targetType, targetId: { in: ids }, status: { not: 'hidden' } }, select: { rating: true } });
  return rows.map((r) => r.rating);
}

/** Recomputes the trust score of an item and of its owner (provider or vendor). */
export async function refreshRatings(targetType: ReviewTarget, targetId: number) {
  const m = await priorMean(targetType);
  const ratings = await ratingsFor(targetType, [targetId]);
  const data = { avgRating: bayesianScore(ratings, m), reviewCount: ratings.length };

  if (targetType === 'package') {
    const p = await prisma.tourPackage.update({ where: { id: targetId }, data });
    await refreshProvider(p.providerId);
  } else if (targetType === 'vehicle') {
    const v = await prisma.vehicle.update({ where: { id: targetId }, data });
    await refreshProvider(v.providerId);
  } else if (targetType === 'product') {
    const p = await prisma.product.update({ where: { id: targetId }, data });
    const ids = (await prisma.product.findMany({ where: { vendorId: p.vendorId }, select: { id: true } })).map((x) => x.id);
    const all = await ratingsFor('product', ids);
    await prisma.vendorProfile.update({ where: { id: p.vendorId }, data: { avgRating: bayesianScore(all, m), reviewCount: all.length } });
  } else {
    await prisma.destination.update({ where: { id: targetId }, data });
  }
}

async function refreshProvider(providerId: number) {
  const [pk, vh] = await Promise.all([
    prisma.tourPackage.findMany({ where: { providerId }, select: { id: true } }),
    prisma.vehicle.findMany({ where: { providerId }, select: { id: true } }),
  ]);
  const all = [...(await ratingsFor('package', pk.map((x) => x.id))), ...(await ratingsFor('vehicle', vh.map((x) => x.id)))];
  const m = await priorMean('package');
  await prisma.providerProfile.update({ where: { id: providerId }, data: { avgRating: bayesianScore(all, m), reviewCount: all.length } });
}
