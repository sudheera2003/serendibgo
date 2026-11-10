// M7 – Payments (PayHere sandbox, or a local simulator when PayHere is not configured)
import crypto from 'crypto';
import express, { Router } from 'express';
import { z } from 'zod';
import { Payment } from '@prisma/client';
import { prisma, num } from '../../lib/prisma';
import { intParam, parse } from '../../lib/http';
import { forbidden, notFound, unprocessable } from '../../lib/errors';
import { requireAuth, requireRole, userId } from '../../lib/auth';
import { env, isDev, isTest, payhereEnabled } from '../../config/env';
import { notify } from '../../services/notify';
import { esc, page } from './html';

export const paymentsRouter = Router();

const md5 = (s: string) => crypto.createHash('md5').update(s).digest('hex').toUpperCase();
const amount2 = (n: number) => n.toFixed(2);

/** PayHere checkout hash: md5(merchant_id + order_id + amount + currency + md5(secret)). */
export function payhereHash(orderId: string, amount: number, currency: string, merchantId = env.PAYHERE_MERCHANT_ID, secret = env.PAYHERE_MERCHANT_SECRET) {
  return md5(merchantId + orderId + amount2(amount) + currency + md5(secret));
}

/** PayHere server notification signature. */
export function payhereNotifySig(p: { merchant_id: string; order_id: string; payhere_amount: string; payhere_currency: string; status_code: string }, secret = env.PAYHERE_MERCHANT_SECRET) {
  return md5(p.merchant_id + p.order_id + p.payhere_amount + p.payhere_currency + p.status_code + md5(secret));
}

const useSimulator = () => !payhereEnabled;

paymentsRouter.post('/init', requireAuth, requireRole('tourist'), async (req, res) => {
  const body = parse(z.union([z.object({ bookingId: z.number().int().positive() }), z.object({ orderId: z.number().int().positive() })]), req.body);
  const touristId = userId(req);
  let total: number;
  if ('bookingId' in body) {
    const b = await prisma.booking.findUnique({ where: { id: body.bookingId } });
    if (!b || b.touristId !== touristId) throw notFound('Booking');
    if (b.status !== 'accepted') throw unprocessable(b.status === 'pending' ? 'Wait until the provider accepts your booking' : `This booking is ${b.status}`);
    total = num(b.totalAmount);
  } else {
    const o = await prisma.order.findUnique({ where: { id: body.orderId } });
    if (!o || o.touristId !== touristId) throw notFound('Order');
    if (o.status !== 'pending_payment') throw unprocessable('This order is already paid or cancelled');
    total = num(o.totalAmount);
  }
  const gatewayRef = `SG${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
  const payment = await prisma.payment.create({ data: { ...body, amount: total, currency: 'LKR', gatewayRef } });
  res.status(201).json({
    payment,
    mode: useSimulator() ? 'simulator' : 'payhere',
    checkoutUrl: `${env.PUBLIC_API_URL}/api/v1/payments/checkout/${gatewayRef}`,
  });
});

async function byRef(ref: string) {
  const p = await prisma.payment.findUnique({
    where: { gatewayRef: ref },
    include: {
      booking: { include: { tourist: true, package: { select: { title: true } }, vehicle: { select: { makeModel: true } } } },
      order: { include: { tourist: true } },
    },
  });
  if (!p) throw notFound('Payment');
  return p;
}

/** Opened in the in-app browser: posts to PayHere, or shows the simulator. */
paymentsRouter.get('/checkout/:ref', async (req, res) => {
  const p = await byRef(req.params.ref);
  const tourist = p.booking?.tourist ?? p.order?.tourist;
  const itemName = p.booking ? (p.booking.package?.title ?? p.booking.vehicle?.makeModel ?? 'Booking') : `Marketplace order #${p.orderId}`;
  if (p.status !== 'pending') {
    res.type('html').send(page('Payment', `<h1>Payment ${esc(p.status)}</h1><p>You can close this window and return to the app.</p>`));
    return;
  }
  if (useSimulator()) {
    res.type('html').send(
      page(
        'Payment simulator',
        `<div class="badge">TEST MODE – no real money</div>
        <h1>LKR ${amount2(num(p.amount))}</h1><p>${esc(itemName)}</p><p class="muted">Reference ${esc(p.gatewayRef)}</p>
        <form method="post" action="${env.PUBLIC_API_URL}/api/v1/payments/simulate/${esc(p.gatewayRef)}">
          <button name="outcome" value="success">Pay now (test card)</button>
          <button name="outcome" value="failed" class="secondary">Simulate a failed payment</button>
        </form>`,
      ),
    );
    return;
  }
  const [first, ...rest] = (tourist?.fullName ?? 'Guest').split(' ');
  const fields: Record<string, string> = {
    merchant_id: env.PAYHERE_MERCHANT_ID,
    return_url: `${env.PUBLIC_API_URL}/api/v1/payments/return`,
    cancel_url: `${env.PUBLIC_API_URL}/api/v1/payments/return?cancelled=1`,
    notify_url: `${env.PUBLIC_API_URL}/api/v1/payments/notify`,
    order_id: p.gatewayRef,
    items: itemName.slice(0, 100),
    currency: p.currency,
    amount: amount2(num(p.amount)),
    first_name: first,
    last_name: rest.join(' ') || first,
    email: tourist?.email ?? '',
    phone: tourist?.phone ?? '0770000000',
    address: p.order?.deliveryAddress ?? 'N/A',
    city: 'Colombo',
    country: 'Sri Lanka',
    hash: payhereHash(p.gatewayRef, num(p.amount), p.currency),
  };
  const action = env.PAYHERE_SANDBOX ? 'https://sandbox.payhere.lk/pay/checkout' : 'https://www.payhere.lk/pay/checkout';
  const inputs = Object.entries(fields).map(([k, v]) => `<input type="hidden" name="${k}" value="${esc(v)}">`).join('');
  res.type('html').send(page('Redirecting to PayHere', `<p>Redirecting to PayHere…</p><form id="f" method="post" action="${action}">${inputs}<button>Continue</button></form><script>document.getElementById('f').submit()</script>`));
});

/** Marks a payment as successful and confirms the booking or order (idempotent). */
export async function applyPaymentResult(p: Payment, outcome: 'success' | 'failed', method = 'card') {
  if (p.status === 'success') return;
  if (outcome === 'failed') {
    await prisma.payment.update({ where: { id: p.id }, data: { status: 'failed', method } });
    return;
  }
  const result = await prisma.$transaction(async (tx) => {
    await tx.payment.update({ where: { id: p.id }, data: { status: 'success', paidAt: new Date(), method } });
    if (p.bookingId) {
      const b = await tx.booking.findUniqueOrThrow({ where: { id: p.bookingId }, include: { package: { include: { provider: true } }, vehicle: { include: { provider: true } } } });
      if (b.status === 'accepted') await tx.booking.update({ where: { id: b.id }, data: { status: 'confirmed' } });
      return { touristId: b.touristId, ownerIds: [b.package?.provider.userId ?? b.vehicle?.provider.userId].filter(Boolean) as number[], label: b.package?.title ?? b.vehicle?.makeModel ?? 'booking', refType: 'booking', refId: b.id };
    }
    const o = await tx.order.findUniqueOrThrow({ where: { id: p.orderId! }, include: { items: { include: { vendor: true } } } });
    if (o.status === 'pending_payment') await tx.order.update({ where: { id: o.id }, data: { status: 'processing' } });
    return { touristId: o.touristId, ownerIds: [...new Set(o.items.map((i) => i.vendor.userId))], label: `order #${o.id}`, refType: 'order', refId: o.id };
  });
  await notify(result.touristId, { title: 'Payment received', body: `LKR ${amount2(num(p.amount))} paid for ${result.label}. Your receipt is in the app.`, type: 'payment', referenceType: result.refType, referenceId: result.refId });
  for (const ownerId of result.ownerIds) {
    await notify(ownerId, { title: result.refType === 'order' ? 'New paid order' : 'Booking confirmed', body: `Payment received for ${result.label}`, type: result.refType, referenceType: result.refType, referenceId: result.refId });
  }
}

const formParser = express.urlencoded({ extended: false });

paymentsRouter.post('/simulate/:ref', formParser, async (req, res) => {
  if (!useSimulator() && !(isDev || isTest)) throw forbidden('The simulator is disabled');
  const outcome = req.body?.outcome === 'failed' ? 'failed' : 'success';
  const p = await byRef(req.params.ref);
  await applyPaymentResult(p, outcome, 'simulator');
  res
    .type('html')
    .send(
      page(
        outcome === 'success' ? 'Payment successful' : 'Payment failed',
        outcome === 'success'
          ? `<div class="ok">✓</div><h1>Payment successful</h1><p>LKR ${amount2(num(p.amount))}</p><p>Close this window to return to SerendibGO.</p>`
          : `<h1>Payment failed</h1><p>No money was taken. Close this window and try again.</p>`,
      ),
    );
});

/** PayHere server-to-server notification (notify_url). */
paymentsRouter.post('/notify', formParser, async (req, res) => {
  const b = req.body as Record<string, string>;
  const expected = payhereNotifySig({ merchant_id: b.merchant_id, order_id: b.order_id, payhere_amount: b.payhere_amount, payhere_currency: b.payhere_currency, status_code: b.status_code });
  if (!b.md5sig || b.md5sig.toUpperCase() !== expected || b.merchant_id !== env.PAYHERE_MERCHANT_ID) {
    req.log?.warn({ order: b.order_id }, 'Rejected PayHere notification with a bad signature');
    res.status(400).send('invalid signature');
    return;
  }
  const p = await prisma.payment.findUnique({ where: { gatewayRef: b.order_id } });
  if (!p || amount2(num(p.amount)) !== Number(b.payhere_amount).toFixed(2)) {
    res.status(400).send('unknown payment');
    return;
  }
  if (b.status_code === '2') await applyPaymentResult(p, 'success', b.method ?? 'card');
  else if (['-1', '-2', '-3'].includes(b.status_code)) await applyPaymentResult(p, 'failed', b.method ?? 'card');
  res.send('OK');
});

paymentsRouter.get('/return', (req, res) => {
  const cancelled = req.query.cancelled === '1';
  res.type('html').send(page('SerendibGO', `<h1>${cancelled ? 'Payment cancelled' : 'Thank you'}</h1><p>Close this window to return to the app.</p>`));
});

paymentsRouter.get('/mine', requireAuth, requireRole('tourist'), async (req, res) => {
  const me = userId(req);
  const items = await prisma.payment.findMany({
    where: { OR: [{ booking: { touristId: me } }, { order: { touristId: me } }] },
    include: { booking: { select: { id: true, package: { select: { title: true } }, vehicle: { select: { makeModel: true } } } }, order: { select: { id: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ items });
});

paymentsRouter.get('/:id', requireAuth, async (req, res) => {
  const p = await prisma.payment.findUnique({ where: { id: intParam(req) }, include: { booking: true, order: true } });
  if (!p) throw notFound('Payment');
  const ownerId = p.booking?.touristId ?? p.order?.touristId;
  if (req.user!.role !== 'admin' && ownerId !== req.user!.id) throw forbidden();
  res.json({ payment: p });
});
