import cron from 'node-cron';
import { prisma } from '../lib/prisma';
import { notify } from '../services/notify';

/** Vehicle bookings whose return date has passed become "completed", which unlocks reviews. */
export async function completeFinishedRentals() {
  const yesterday = new Date(Date.now() - 86_400_000);
  const due = await prisma.booking.findMany({ where: { bookingType: 'vehicle', status: 'confirmed', endDate: { lt: yesterday } }, include: { vehicle: true } });
  for (const b of due) {
    await prisma.booking.update({ where: { id: b.id }, data: { status: 'completed' } });
    await notify(b.touristId, { title: 'How was your ride?', body: `Rate ${b.vehicle?.makeModel ?? 'your rental'} with a verified review.`, type: 'review', referenceType: 'booking', referenceId: b.id });
  }
  return due.length;
}

/** Package bookings complete automatically after the last day of the tour. */
export async function completeFinishedTours() {
  const yesterday = new Date(Date.now() - 86_400_000);
  const due = await prisma.booking.findMany({ where: { bookingType: 'package', status: 'confirmed', endDate: { lt: yesterday } }, include: { package: true } });
  for (const b of due) {
    await prisma.booking.update({ where: { id: b.id }, data: { status: 'completed' } });
    await notify(b.touristId, { title: 'Tour completed', body: `Share your experience of ${b.package?.title ?? 'your tour'}.`, type: 'review', referenceType: 'booking', referenceId: b.id });
  }
  return due.length;
}

/** Unpaid marketplace orders older than 24 hours release their stock. */
export async function expireUnpaidOrders() {
  const cutoff = new Date(Date.now() - 24 * 3_600_000);
  const stale = await prisma.order.findMany({ where: { status: 'pending_payment', createdAt: { lt: cutoff } }, include: { items: true } });
  for (const o of stale) {
    await prisma.$transaction([
      ...o.items.map((i) => prisma.product.update({ where: { id: i.productId }, data: { stockQty: { increment: i.quantity } } })),
      prisma.orderItem.updateMany({ where: { orderId: o.id }, data: { itemStatus: 'cancelled' } }),
      prisma.order.update({ where: { id: o.id }, data: { status: 'cancelled' } }),
    ]);
  }
  return stale.length;
}

/** Daily exchange rates for multi-currency display (prices are always settled in LKR). */
export async function updateExchangeRates() {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/LKR', { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return 0;
    const data = (await res.json()) as { result: string; rates: Record<string, number> };
    if (data.result !== 'success') return 0;
    const wanted = ['USD', 'EUR', 'GBP', 'INR', 'AUD', 'CNY', 'JPY', 'RUB', 'CAD'];
    let n = 0;
    for (const code of wanted) {
      const perLkr = data.rates[code];
      if (!perLkr) continue;
      await prisma.exchangeRate.upsert({ where: { currencyCode: code }, create: { currencyCode: code, rateToLkr: 1 / perLkr }, update: { rateToLkr: 1 / perLkr } });
      n++;
    }
    return n;
  } catch {
    return 0; // keep the last known rates
  }
}

export function startJobs() {
  cron.schedule('15 * * * *', () => void completeFinishedRentals().catch(console.error));
  cron.schedule('20 * * * *', () => void completeFinishedTours().catch(console.error));
  cron.schedule('*/30 * * * *', () => void expireUnpaidOrders().catch(console.error));
  cron.schedule('0 3 * * *', () => void updateExchangeRates());
  void updateExchangeRates();
}
