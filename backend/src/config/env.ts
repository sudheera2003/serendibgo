import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  PUBLIC_API_URL: z.string().default('http://localhost:4000'),
  CORS_ORIGINS: z.string().default('*'),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_DAYS: z.coerce.number().default(30),
  GOOGLE_MAPS_API_KEY: z.string().optional().default(''),
  ORS_API_KEY: z.string().optional().default(''),
  PAYHERE_MERCHANT_ID: z.string().optional().default(''),
  PAYHERE_MERCHANT_SECRET: z.string().optional().default(''),
  PAYHERE_SANDBOX: z
    .string()
    .optional()
    .default('true')
    .transform((v) => v !== 'false'),
  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  MAIL_FROM: z.string().default('SerendibGO <no-reply@serendibgo.lk>'),
  TRANSPORT_RATE_PER_KM: z.coerce.number().default(120),
  // cloudinary://<api_key>:<api_secret>@<cloud_name>  (optional; without it uploads are stored on this server)
  CLOUDINARY_URL: z
    .string()
    .optional()
    .default('')
    .refine((v) => !v || /^cloudinary:\/\/[^:]+:[^@]+@.+$/.test(v), 'Use the format cloudinary://API_KEY:API_SECRET@CLOUD_NAME'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // Fail fast with a readable message instead of crashing later.
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment configuration. Copy .env.example to .env and fill it in.');
}

export const env = parsed.data;
export const isDev = env.NODE_ENV === 'development';
export const isTest = env.NODE_ENV === 'test';
export const payhereEnabled = Boolean(env.PAYHERE_MERCHANT_ID && env.PAYHERE_MERCHANT_SECRET);
