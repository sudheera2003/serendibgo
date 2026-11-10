import path from 'path';
import express, { Router } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { env, isTest, payhereEnabled } from './config/env';
import { errorHandler, notFoundHandler } from './lib/errors';
import { prisma } from './lib/prisma';
import { storageMode } from './services/storage';
import { authRouter } from './modules/auth/routes';
import { usersRouter, uploadsRouter } from './modules/users/routes';
import { destinationsRouter, tripsRouter } from './modules/trips/routes';
import { packagesRouter, providerPackagesRouter } from './modules/packages/routes';
import { vehiclesRouter, providerVehiclesRouter } from './modules/vehicles/routes';
import { bookingsRouter } from './modules/bookings/routes';
import { reviewsRouter } from './modules/reviews/routes';
import { marketplaceRouter, vendorRouter } from './modules/marketplace/routes';
import { paymentsRouter } from './modules/payments/routes';
import { notificationsRouter, ratesRouter } from './modules/notifications/routes';
import { adminRouter, complaintsRouter } from './modules/admin/routes';

/** Every router and where it is mounted; also used to build the OpenAPI document. */
export const mounts: [string, Router, string][] = [
  ['/auth', authRouter, 'M1 Authentication'],
  ['/users', usersRouter, 'M1 Profiles'],
  ['/uploads', uploadsRouter, 'M1 Uploads'],
  ['/destinations', destinationsRouter, 'M2 Destinations'],
  ['/trips', tripsRouter, 'M2 Trip planner'],
  ['/packages', packagesRouter, 'M3 Tour packages'],
  ['/provider/packages', providerPackagesRouter, 'M3 Provider packages'],
  ['/vehicles', vehiclesRouter, 'M4 Vehicles'],
  ['/provider/vehicles', providerVehiclesRouter, 'M4 Provider vehicles'],
  ['/bookings', bookingsRouter, 'M3/M4 Bookings'],
  ['/reviews', reviewsRouter, 'M5 Reviews'],
  ['/market', marketplaceRouter, 'M6 Marketplace'],
  ['/vendor', vendorRouter, 'M6 Vendor'],
  ['/payments', paymentsRouter, 'M7 Payments'],
  ['/notifications', notificationsRouter, 'M7 Notifications'],
  ['/exchange-rates', ratesRouter, 'M7 Exchange rates'],
  ['/complaints', complaintsRouter, 'M8 Complaints'],
  ['/admin', adminRouter, 'M8 Admin'],
];

function openApi() {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const [base, router, tag] of mounts) {
    for (const layer of (router as unknown as { stack: { route?: { path: string; methods: Record<string, boolean> } }[] }).stack) {
      if (!layer.route) continue;
      const p = `/api/v1${base}${layer.route.path === '/' ? '' : layer.route.path}`.replace(/:(\w+)/g, '{$1}');
      for (const method of Object.keys(layer.route.methods)) {
        paths[p] ??= {};
        const params = [...p.matchAll(/\{(\w+)\}/g)].map((m) => ({ name: m[1], in: 'path', required: true, schema: { type: 'string' } }));
        paths[p][method] = { tags: [tag], summary: `${method.toUpperCase()} ${p}`, parameters: params, responses: { 200: { description: 'OK' } }, security: [{ bearer: [] }] };
      }
    }
  }
  return {
    openapi: '3.0.3',
    info: { title: 'SerendibGO API', version: '1.0.0', description: 'REST API for the SerendibGO mobile app. Errors use { error: { code, message, details } }.' },
    servers: [{ url: env.PUBLIC_API_URL }],
    components: { securitySchemes: { bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } },
    paths,
  };
}

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  if (!isTest) app.use(pinoHttp({ autoLogging: { ignore: (req) => req.url === '/health' }, transport: { target: 'pino/file', options: { destination: 1 } } }));

  // The checkout page must post to PayHere and run a tiny auto-submit script.
  app.use(
    '/api/v1/payments',
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'unsafe-inline'"],
          styleSrc: ["'unsafe-inline'"],
          formAction: ["'self'", env.PUBLIC_API_URL, 'https://sandbox.payhere.lk', 'https://www.payhere.lk'],
        },
      },
    }),
  );
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: env.CORS_ORIGINS === '*' ? true : env.CORS_ORIGINS.split(',') }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', payments: payhereEnabled ? 'payhere' : 'simulator', maps: env.GOOGLE_MAPS_API_KEY ? 'google' : env.ORS_API_KEY ? 'ors' : 'openstreetmap', storage: storageMode });
  });
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads'), { maxAge: '7d' }));

  const doc = openApi();
  app.get('/api/v1/openapi.json', (_req, res) => res.json(doc));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(doc));

  for (const [base, router] of mounts) app.use(`/api/v1${base}`, router);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
