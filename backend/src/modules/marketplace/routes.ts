// M6 – Artisan marketplace
import { Router } from 'express';
import { z } from 'zod';
import { ItemStatus, Prisma } from '@prisma/client';
import { prisma, num } from '../../lib/prisma';
import { intParam, paged, paging, parse } from '../../lib/http';
import { badRequest, conflict, forbidden, notFound, unprocessable } from '../../lib/errors';
import { requireAuth, requireRole, userId } from '../../lib/auth';
import { round2 } from '../../algorithms/geo';
import { notify } from '../../services/notify';
import { myVendor } from '../owners';

export const marketplaceRouter = Router();

const productInclude = {
  category: { select: { id: true, name: true } },
  vendor: { select: { id: true, shopName: true, district: true, avgRating: true, reviewCount: true } },
} satisfies Prisma.ProductInclude;
const publicWhere: Prisma.ProductWhereInput = { isActive: true, vendor: { verificationStatus: 'approved' } };

marketplaceRouter.get('/categories', async (_req, res) => {
  const items = await prisma.productCategory.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { products: { where: publicWhere } } } } });
  res.json({ items });
});

marketplaceRouter.get('/products', async (req, res) => {
  const q = parse(
    z.object({
      q: z.string().trim().max(80).optional(),
      categoryId: z.coerce.number().int().optional(),
      vendorId: z.coerce.number().int().optional(),
      maxPrice: z.coerce.number().optional(),
      sort: z.enum(['rating', 'price_asc', 'price_desc', 'newest']).default('rating'),
    }),
    req.query,
  );
  const { skip, take, page, limit } = paging(req.query);
  const where: Prisma.ProductWhereInput = {
    ...publicWhere,
    ...(q.q ? { OR: [{ name: { contains: q.q } }, { description: { contains: q.q } }] } : {}),
    ...(q.categoryId ? { categoryId: q.categoryId } : {}),
    ...(q.vendorId ? { vendorId: q.vendorId } : {}),
    ...(q.maxPrice ? { price: { lte: q.maxPrice } } : {}),
  };
  const orderBy: Prisma.ProductOrderByWithRelationInput =
    q.sort === 'price_asc' ? { price: 'asc' } : q.sort === 'price_desc' ? { price: 'desc' } : q.sort === 'newest' ? { createdAt: 'desc' } : { avgRating: 'desc' };
  const [items, total] = await Promise.all([prisma.product.findMany({ where, include: productInclude, orderBy, skip, take }), prisma.product.count({ where })]);
  res.json(paged(items, total, page, limit));
});

marketplaceRouter.get('/products/:id', async (req, res) => {
  const p = await prisma.product.findFirst({ where: { ...publicWhere, id: intParam(req) }, include: productInclude });
  if (!p) throw notFound('Product');
  res.json({ product: p });
});

// ---- Orders (tourist) -------------------------------------------------------------------

const orderInclude = {
  items: { include: { product: { select: { id: true, name: true, imageUrls: true } }, vendor: { select: { id: true, shopName: true } }, review: { select: { id: true } } } },
  payments: { select: { id: true, status: true, amount: true, paidAt: true }, orderBy: { createdAt: 'desc' } },
} satisfies Prisma.OrderInclude;

const orderSchema = z
  .object({
    items: z.array(z.object({ productId: z.number().int().positive(), quantity: z.number().int().min(1).max(50) })).min(1).max(30),
    deliveryType: z.enum(['hotel', 'pickup']),
    hotelName: z.string().trim().max(150).optional(),
    deliveryAddress: z.string().trim().max(255).optional(),
  })
  .refine((o) => o.deliveryType === 'pickup' || (o.hotelName && o.deliveryAddress), { message: 'Hotel name and address are required for hotel delivery', path: ['hotelName'] });

/** FR16 – one checkout split into per-vendor order items; stock is reserved in the same transaction. */
marketplaceRouter.post('/orders', requireAuth, requireRole('tourist'), async (req, res) => {
  const body = parse(orderSchema, req.body);
  const merged = new Map<number, number>();
  for (const i of body.items) merged.set(i.productId, (merged.get(i.productId) ?? 0) + i.quantity);

  const order = await prisma.$transaction(async (tx) => {
    const products = await tx.product.findMany({ where: { ...publicWhere, id: { in: [...merged.keys()] } } });
    if (products.length !== merged.size) throw badRequest('Some products are no longer available');
    for (const p of products) {
      const qty = merged.get(p.id)!;
      // Atomic conditional decrement prevents overselling.
      const updated = await tx.product.updateMany({ where: { id: p.id, stockQty: { gte: qty } }, data: { stockQty: { decrement: qty } } });
      if (updated.count === 0) throw conflict(`Only ${p.stockQty} left of "${p.name}"`);
    }
    const total = round2(products.reduce((s, p) => s + num(p.price) * merged.get(p.id)!, 0));
    return tx.order.create({
      data: {
        touristId: userId(req),
        totalAmount: total,
        deliveryType: body.deliveryType,
        hotelName: body.deliveryType === 'hotel' ? body.hotelName : null,
        deliveryAddress: body.deliveryType === 'hotel' ? body.deliveryAddress : null,
        items: { create: products.map((p) => ({ productId: p.id, vendorId: p.vendorId, quantity: merged.get(p.id)!, unitPrice: p.price })) },
      },
      include: orderInclude,
    });
  });
  res.status(201).json({ order });
});

marketplaceRouter.get('/orders', requireAuth, requireRole('tourist'), async (req, res) => {
  const { skip, take, page, limit } = paging(req.query);
  const where = { touristId: userId(req) };
  const [items, total] = await Promise.all([prisma.order.findMany({ where, include: orderInclude, orderBy: { createdAt: 'desc' }, skip, take }), prisma.order.count({ where })]);
  res.json(paged(items, total, page, limit));
});

marketplaceRouter.get('/orders/:id', requireAuth, async (req, res) => {
  const o = await prisma.order.findUnique({ where: { id: intParam(req) }, include: orderInclude });
  if (!o) throw notFound('Order');
  if (req.user!.role !== 'admin' && o.touristId !== req.user!.id) throw forbidden();
  res.json({ order: o });
});

/** Unpaid orders can be cancelled; reserved stock goes back on sale. */
marketplaceRouter.post('/orders/:id/cancel', requireAuth, requireRole('tourist'), async (req, res) => {
  const o = await prisma.order.findUnique({ where: { id: intParam(req) }, include: { items: true } });
  if (!o || o.touristId !== userId(req)) throw notFound('Order');
  if (o.status !== 'pending_payment') throw unprocessable('Only unpaid orders can be cancelled here. Submit a complaint for paid orders.');
  await prisma.$transaction([
    ...o.items.map((i) => prisma.product.update({ where: { id: i.productId }, data: { stockQty: { increment: i.quantity } } })),
    prisma.orderItem.updateMany({ where: { orderId: o.id }, data: { itemStatus: 'cancelled' } }),
    prisma.order.update({ where: { id: o.id }, data: { status: 'cancelled' } }),
  ]);
  res.json({ order: await prisma.order.findUnique({ where: { id: o.id }, include: orderInclude }) });
});

// ---- Vendor ------------------------------------------------------------------------------

export const vendorRouter = Router();
vendorRouter.use(requireAuth, requireRole('vendor'));

const productBody = z.object({
  categoryId: z.number().int().positive(),
  name: z.string().trim().min(2).max(150),
  description: z.string().trim().min(10).max(5000),
  price: z.number().positive().max(10_000_000),
  stockQty: z.number().int().min(0).max(100_000),
  imageUrls: z.array(z.string().url().max(500)).max(6).default([]),
  isActive: z.boolean().optional(),
});

vendorRouter.get('/products', async (req, res) => {
  const v = await myVendor(req, false);
  res.json({ items: await prisma.product.findMany({ where: { vendorId: v.id }, include: productInclude, orderBy: { updatedAt: 'desc' } }) });
});

vendorRouter.post('/products', async (req, res) => {
  const v = await myVendor(req);
  const data = parse(productBody, req.body);
  if (!(await prisma.productCategory.findUnique({ where: { id: data.categoryId } }))) throw badRequest('Unknown category');
  res.status(201).json({ product: await prisma.product.create({ data: { ...data, vendorId: v.id }, include: productInclude }) });
});

vendorRouter.put('/products/:id', async (req, res) => {
  const v = await myVendor(req);
  const id = intParam(req);
  if (!(await prisma.product.findFirst({ where: { id, vendorId: v.id } }))) throw notFound('Product');
  res.json({ product: await prisma.product.update({ where: { id }, data: parse(productBody, req.body), include: productInclude }) });
});

vendorRouter.delete('/products/:id', async (req, res) => {
  const v = await myVendor(req);
  const id = intParam(req);
  if (!(await prisma.product.findFirst({ where: { id, vendorId: v.id } }))) throw notFound('Product');
  if (await prisma.orderItem.count({ where: { productId: id } })) await prisma.product.update({ where: { id }, data: { isActive: false } });
  else await prisma.product.delete({ where: { id } });
  res.status(204).end();
});

/** Order items that belong to this vendor (only paid orders need fulfilment). */
vendorRouter.get('/order-items', async (req, res) => {
  const v = await myVendor(req, false);
  const { status } = parse(z.object({ status: z.nativeEnum(ItemStatus).optional() }), req.query);
  const items = await prisma.orderItem.findMany({
    where: { vendorId: v.id, order: { status: { in: ['processing', 'delivered'] } }, ...(status ? { itemStatus: status } : {}) },
    include: {
      product: { select: { id: true, name: true, imageUrls: true } },
      order: { select: { id: true, deliveryType: true, hotelName: true, deliveryAddress: true, createdAt: true, tourist: { select: { fullName: true, phone: true } } } },
    },
    orderBy: { id: 'desc' },
    take: 100,
  });
  res.json({ items });
});

const NEXT: Record<ItemStatus, ItemStatus[]> = {
  pending: ['packed', 'cancelled'],
  packed: ['dispatched', 'cancelled'],
  dispatched: ['delivered'],
  delivered: [],
  cancelled: [],
};

vendorRouter.patch('/order-items/:id/status', async (req, res) => {
  const v = await myVendor(req, false);
  const { status } = parse(z.object({ status: z.nativeEnum(ItemStatus) }), req.body);
  const item = await prisma.orderItem.findFirst({ where: { id: intParam(req), vendorId: v.id }, include: { order: true, product: true } });
  if (!item) throw notFound('Order item');
  if (item.order.status === 'pending_payment') throw unprocessable('This order has not been paid yet');
  if (!NEXT[item.itemStatus].includes(status)) throw unprocessable(`Cannot change from ${item.itemStatus} to ${status}`);

  await prisma.$transaction(async (tx) => {
    await tx.orderItem.update({ where: { id: item.id }, data: { itemStatus: status } });
    if (status === 'cancelled') await tx.product.update({ where: { id: item.productId }, data: { stockQty: { increment: item.quantity } } });
    const siblings = await tx.orderItem.findMany({ where: { orderId: item.orderId } });
    const open = siblings.filter((s) => s.itemStatus !== 'cancelled');
    if (open.length && open.every((s) => s.itemStatus === 'delivered')) await tx.order.update({ where: { id: item.orderId }, data: { status: 'delivered' } });
  });
  const label: Record<string, string> = { packed: 'is packed', dispatched: 'is on the way', delivered: 'was delivered', cancelled: 'was cancelled by the vendor' };
  await notify(item.order.touristId, {
    title: 'Order update',
    body: `${item.product.name} ${label[status] ?? status}`,
    type: 'order',
    referenceType: 'order',
    referenceId: item.orderId,
  });
  res.json({ message: 'Status updated' });
});

vendorRouter.get('/sales', async (req, res) => {
  const v = await myVendor(req, false);
  const items = await prisma.orderItem.findMany({
    where: { vendorId: v.id, itemStatus: { not: 'cancelled' }, order: { status: { in: ['processing', 'delivered'] } } },
    include: { product: { select: { name: true } }, order: { select: { createdAt: true } } },
  });
  const revenue = round2(items.reduce((s, i) => s + num(i.unitPrice) * i.quantity, 0));
  const byProduct = new Map<string, { name: string; quantity: number; revenue: number }>();
  for (const i of items) {
    const row = byProduct.get(i.product.name) ?? { name: i.product.name, quantity: 0, revenue: 0 };
    row.quantity += i.quantity;
    row.revenue = round2(row.revenue + num(i.unitPrice) * i.quantity);
    byProduct.set(i.product.name, row);
  }
  res.json({
    revenue,
    itemsSold: items.reduce((s, i) => s + i.quantity, 0),
    pendingFulfilment: items.filter((i) => i.itemStatus !== 'delivered').length,
    topProducts: [...byProduct.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5),
  });
});
