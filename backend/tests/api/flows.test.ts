import request from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/lib/prisma';

const app = createApp();
const api = request(app);

async function login(email: string, password = 'Password123') {
  const res = await api.post('/api/v1/auth/login').send({ email, password });
  expect(res.status).toBe(200);
  return { token: res.body.accessToken as string, refresh: res.body.refreshToken as string, user: res.body.user };
}
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

afterAll(() => prisma.$disconnect());

describe('M1 – authentication and RBAC', () => {
  const email = `new.user.${Date.now()}@example.com`;

  it('registers, verifies the e-mail OTP and logs in', async () => {
    const reg = await api.post('/api/v1/auth/register').send({ fullName: 'Test Tourist', email, password: 'Secret123', acceptTerms: true });
    expect(reg.status).toBe(201);
    expect(reg.body.devOtp).toMatch(/^\d{6}$/);

    const early = await api.post('/api/v1/auth/login').send({ email, password: 'Secret123' });
    expect(early.status).toBe(403);
    expect(early.body.error.code).toBe('EMAIL_NOT_VERIFIED');

    const wrong = await api.post('/api/v1/auth/verify-otp').send({ email, otp: '000000' });
    expect(wrong.status).toBe(422);

    const ok = await api.post('/api/v1/auth/verify-otp').send({ email, otp: early.body.devOtp });
    expect(ok.status).toBe(200);
    expect(ok.body.user.passwordHash).toBeUndefined();
    expect(ok.body.accessToken).toBeTruthy();
  });

  it('rejects weak passwords and duplicate e-mails', async () => {
    expect((await api.post('/api/v1/auth/register').send({ fullName: 'X Y', email: 'weak@example.com', password: 'short', acceptTerms: true })).status).toBe(400);
    expect((await api.post('/api/v1/auth/register').send({ fullName: 'X Y', email, password: 'Secret123', acceptTerms: true })).status).toBe(409);
  });

  it('rotates refresh tokens and blocks reuse of an old one', async () => {
    const { refresh } = await login('traveller@serendibgo.lk');
    const first = await api.post('/api/v1/auth/refresh').send({ refreshToken: refresh });
    expect(first.status).toBe(200);
    expect((await api.post('/api/v1/auth/refresh').send({ refreshToken: refresh })).status).toBe(401);
    // Reuse revokes the whole family, so the new token is also dead.
    expect((await api.post('/api/v1/auth/refresh').send({ refreshToken: first.body.refreshToken })).status).toBe(401);
  });

  it('enforces role-based access control', async () => {
    const { token } = await login('tourist@serendibgo.lk');
    expect((await api.get('/api/v1/admin/analytics').set(auth(token))).status).toBe(403);
    expect((await api.get('/api/v1/provider/packages').set(auth(token))).status).toBe(403);
    expect((await api.get('/api/v1/admin/analytics')).status).toBe(401);
  });

  it('keeps a pending provider from publishing listings', async () => {
    const { token } = await login('newguide@serendibgo.lk');
    const res = await api
      .post('/api/v1/provider/vehicles')
      .set(auth(token))
      .send({ vehicleType: 'car', makeModel: 'Test Car', seats: 4, withDriver: false, pricePerDay: 5000, pricePerKm: 0, baseLocation: 'Ella' });
    expect(res.status).toBe(403);
  });
});

describe('M2 – trip planner', () => {
  it('creates a trip, calculates distances and optimises the order', async () => {
    const { token } = await login('tourist@serendibgo.lk');
    const dests = (await api.get('/api/v1/destinations?limit=50')).body.items as { id: number; name: string }[];
    const id = (n: string) => dests.find((d) => d.name.startsWith(n))!.id;
    // A deliberately zig-zag order: Galle -> Anuradhapura -> Mirissa -> Sigiriya
    const created = await api
      .post('/api/v1/trips')
      .set(auth(token))
      .send({ title: 'Zig-zag', start: { lat: 6.9271, lng: 79.8612, label: 'Colombo' }, destinationIds: [id('Galle Fort'), id('Anuradhapura'), id('Mirissa'), id('Sigiriya')] });
    expect(created.status).toBe(201);
    expect(created.body.trip.stops).toHaveLength(4);
    expect(Number(created.body.trip.totalDistanceKm)).toBeGreaterThan(0);

    const opt = await api.post(`/api/v1/trips/${created.body.trip.id}/optimise`).set(auth(token));
    expect(opt.status).toBe(200);
    expect(opt.body.optimisation.changed).toBe(true);
    expect(opt.body.optimisation.afterKm).toBeLessThan(opt.body.optimisation.beforeKm);
    expect(Number(opt.body.trip.totalDistanceKm)).toBeCloseTo(opt.body.optimisation.afterKm, 0);
  });

  it('limits a trip to 10 stops', async () => {
    const { token } = await login('tourist@serendibgo.lk');
    const ids = ((await api.get('/api/v1/destinations?limit=20')).body.items as { id: number }[]).slice(0, 11).map((d) => d.id);
    expect((await api.post('/api/v1/trips').set(auth(token)).send({ title: 'Too long', destinationIds: ids })).status).toBe(400);
  });
});

describe('M3 / M4 / M7 – booking, approval and payment', () => {
  it('runs the full package flow: book -> accept -> pay -> confirmed', async () => {
    const tourist = await login('traveller@serendibgo.lk');
    const operator = await login('tours@serendibgo.lk');
    const pkgs = (await api.get('/api/v1/packages?q=Yala')).body.items;
    const book = await api.post('/api/v1/bookings').set(auth(tourist.token)).send({ type: 'package', packageId: pkgs[0].id, startDate: inDays(30), numPersons: 2 });
    expect(book.status).toBe(201);
    expect(book.body.booking.totalAmount).toBe(44000);

    // Paying before the provider accepts is not allowed.
    expect((await api.post('/api/v1/payments/init').set(auth(tourist.token)).send({ bookingId: book.body.booking.id })).status).toBe(422);
    // Only the owner can accept.
    expect((await api.patch(`/api/v1/bookings/${book.body.booking.id}/status`).set(auth(tourist.token)).send({ status: 'accepted' })).status).toBe(403);
    expect((await api.patch(`/api/v1/bookings/${book.body.booking.id}/status`).set(auth(operator.token)).send({ status: 'accepted' })).status).toBe(200);

    const init = await api.post('/api/v1/payments/init').set(auth(tourist.token)).send({ bookingId: book.body.booking.id });
    expect(init.status).toBe(201);
    expect(init.body.mode).toBe('simulator');
    const ref = init.body.payment.gatewayRef;
    expect((await api.get(`/api/v1/payments/checkout/${ref}`)).text).toContain('TEST MODE');
    expect((await api.post(`/api/v1/payments/simulate/${ref}`).type('form').send({ outcome: 'success' })).status).toBe(200);

    const after = await api.get(`/api/v1/bookings/${book.body.booking.id}`).set(auth(tourist.token));
    expect(after.body.booking.status).toBe('confirmed');
    expect(after.body.booking.payments[0].status).toBe('success');
  });

  it('refuses more people than seats left', async () => {
    const { token } = await login('traveller@serendibgo.lk');
    const pkgs = (await api.get('/api/v1/packages?q=Yala')).body.items; // max 6 per date
    const res = await api.post('/api/v1/bookings').set(auth(token)).send({ type: 'package', packageId: pkgs[0].id, startDate: inDays(30), numPersons: 5 });
    expect(res.status).toBe(409);
  });

  it('prevents double booking of a vehicle and shows a transparent quote', async () => {
    const t1 = await login('tourist@serendibgo.lk');
    const t2 = await login('traveller@serendibgo.lk');
    const vehicles = (await api.get('/api/v1/vehicles?type=van')).body.items;
    const vid = vehicles[0].id;
    const quote = await api.get(`/api/v1/vehicles/${vid}/quote?from=${inDays(40)}&to=${inDays(42)}&km=100`);
    expect(quote.body.quote.lines).toHaveLength(3);
    expect(quote.body.quote.total).toBe(3 * 14000 + 100 * 60 + 3 * 4000);

    expect((await api.post('/api/v1/bookings').set(auth(t1.token)).send({ type: 'vehicle', vehicleId: vid, startDate: inDays(40), endDate: inDays(42), estimatedKm: 100 })).status).toBe(201);
    expect((await api.post('/api/v1/bookings').set(auth(t2.token)).send({ type: 'vehicle', vehicleId: vid, startDate: inDays(42), endDate: inDays(44) })).status).toBe(409);
    // Search hides the busy vehicle for those dates.
    const search = await api.get(`/api/v1/vehicles?type=van&from=${inDays(41)}&to=${inDays(41)}`);
    expect(search.body.items.find((v: { id: number }) => v.id === vid)).toBeUndefined();
  });
});

describe('M5 – verified reviews', () => {
  it('lets a tourist review only eligible sources, once', async () => {
    const { token } = await login('tourist@serendibgo.lk');
    const elig = await api.get('/api/v1/reviews/eligibility').set(auth(token));
    expect(elig.status).toBe(200);
    const checkin = elig.body.items.find((i: { source: { type: string } }) => i.source.type === 'checkin');
    const item = elig.body.items.find((i: { source: { type: string } }) => i.source.type === 'order_item');
    expect(checkin).toBeTruthy();
    expect(item).toBeTruthy();

    expect((await api.post('/api/v1/reviews').set(auth(token)).send({ source: checkin.source, rating: 5, comment: 'Beautiful walls at sunset' })).status).toBe(201);
    expect((await api.post('/api/v1/reviews').set(auth(token)).send({ source: checkin.source, rating: 4 })).status).toBe(409);

    // Someone else's booking cannot be reviewed.
    const other = await prisma.booking.findFirst({ where: { tourist: { email: 'traveller@serendibgo.lk' } } });
    expect((await api.post('/api/v1/reviews').set(auth(token)).send({ source: { type: 'booking', id: other!.id }, rating: 1 })).status).toBe(403);

    const dest = await prisma.destination.findUnique({ where: { id: checkin.targetId } });
    expect(Number(dest!.avgRating)).toBeGreaterThan(0);
  });

  it('rejects a GPS check-in far from the destination', async () => {
    const { token } = await login('tourist@serendibgo.lk');
    const sigiriya = await prisma.destination.findFirst({ where: { name: { startsWith: 'Sigiriya' } } });
    const far = await api.post('/api/v1/reviews/checkins').set(auth(token)).send({ destinationId: sigiriya!.id, lat: 6.9271, lng: 79.8612 });
    expect(far.status).toBe(422);
    const near = await api.post('/api/v1/reviews/checkins').set(auth(token)).send({ destinationId: sigiriya!.id, lat: 7.9572, lng: 80.7605 });
    expect(near.status).toBe(201);
  });
});

describe('M6 – marketplace', () => {
  it('splits one checkout across vendors and reserves stock', async () => {
    const { token } = await login('traveller@serendibgo.lk');
    const products = (await api.get('/api/v1/market/products?limit=50')).body.items;
    const tea = products.find((p: { name: string }) => p.name.includes('BOPF'));
    const mat = products.find((p: { name: string }) => p.name.includes('Dumbara'));
    const res = await api
      .post('/api/v1/market/orders')
      .set(auth(token))
      .send({ items: [{ productId: tea.id, quantity: 2 }, { productId: mat.id, quantity: 1 }], deliveryType: 'hotel', hotelName: 'Jetwing Lighthouse', deliveryAddress: 'Dadella, Galle' });
    expect(res.status).toBe(201);
    expect(new Set(res.body.order.items.map((i: { vendorId: number }) => i.vendorId)).size).toBe(2);
    expect(res.body.order.totalAmount).toBe(2 * 2800 + 4200);
    const teaAfter = await prisma.product.findUnique({ where: { id: tea.id } });
    expect(teaAfter!.stockQty).toBe(tea.stockQty - 2);
  });

  it('requires a hotel name for hotel delivery and blocks overselling', async () => {
    const { token } = await login('traveller@serendibgo.lk');
    const products = (await api.get('/api/v1/market/products?q=Elephant')).body.items;
    expect((await api.post('/api/v1/market/orders').set(auth(token)).send({ items: [{ productId: products[0].id, quantity: 1 }], deliveryType: 'hotel' })).status).toBe(400);
    expect((await api.post('/api/v1/market/orders').set(auth(token)).send({ items: [{ productId: products[0].id, quantity: 50 }], deliveryType: 'pickup' })).status).toBe(409);
  });
});

describe('M8 – admin', () => {
  it('approves a pending provider and records an audit log', async () => {
    const { token } = await login('admin@serendibgo.lk');
    const apps = await api.get('/api/v1/admin/applications').set(auth(token));
    const pending = apps.body.items.find((a: { kind: string }) => a.kind === 'provider');
    expect((await api.patch(`/api/v1/admin/applications/provider/${pending.id}`).set(auth(token)).send({ decision: 'rejected' })).status).toBe(400);
    expect((await api.patch(`/api/v1/admin/applications/provider/${pending.id}`).set(auth(token)).send({ decision: 'approved' })).status).toBe(200);
    expect(await prisma.auditLog.count({ where: { entityType: 'provider', entityId: pending.id } })).toBe(1);
  });

  it('returns analytics', async () => {
    const { token } = await login('admin@serendibgo.lk');
    const res = await api.get('/api/v1/admin/analytics').set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.revenueByMonth).toHaveLength(6);
    expect(res.body.totalRevenue).toBeGreaterThan(0);
  });
});
