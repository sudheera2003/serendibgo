// M7 – In-app notification centre and exchange rates
import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { intParam, paged, paging } from '../../lib/http';
import { notFound } from '../../lib/errors';
import { requireAuth, userId } from '../../lib/auth';

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

notificationsRouter.get('/', async (req, res) => {
  const { skip, take, page, limit } = paging(req.query);
  const where = { userId: userId(req) };
  const [items, total, unread] = await Promise.all([
    prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { ...where, isRead: false } }),
  ]);
  res.json({ ...paged(items, total, page, limit), unread });
});

notificationsRouter.get('/unread-count', async (req, res) => {
  res.json({ unread: await prisma.notification.count({ where: { userId: userId(req), isRead: false } }) });
});

notificationsRouter.patch('/:id/read', async (req, res) => {
  const r = await prisma.notification.updateMany({ where: { id: intParam(req), userId: userId(req) }, data: { isRead: true } });
  if (!r.count) throw notFound('Notification');
  res.status(204).end();
});

notificationsRouter.post('/read-all', async (req, res) => {
  await prisma.notification.updateMany({ where: { userId: userId(req), isRead: false }, data: { isRead: true } });
  res.status(204).end();
});

export const ratesRouter = Router();
ratesRouter.get('/', async (_req, res) => {
  res.json({ base: 'LKR', items: await prisma.exchangeRate.findMany({ orderBy: { currencyCode: 'asc' } }) });
});
