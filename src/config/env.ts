// src/config/env.ts
import 'dotenv/config';
import { z } from 'zod';

const toBool = (v: unknown) => {
  if (typeof v !== 'string') return v;
  const s = v.trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'on'].includes(s)) return true;
  if (['false', '0', 'no', 'n', 'off'].includes(s)) return false;
  return v;
};

const corsOriginTransform = (v: unknown) => {
  if (typeof v !== 'string') return v;
  const trimmed = v.trim();
  if (!trimmed) return [];
  // allow "*" OR comma-separated
  if (trimmed === '*') return '*';
  return trimmed.split(',').map((x) => x.trim()).filter(Boolean);
};

const EnvSchema = z.object({
  // App
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_NAME: z.string().default('playenest'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.string().default('info'),

  // JWT / Security
  JWT_ACCESS_SECRET: z.string().min(10, 'JWT_ACCESS_SECRET is too short'),
  JWT_REFRESH_SECRET: z.string().min(10, 'JWT_REFRESH_SECRET is too short'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  STATIC_API_KEY: z.string().min(10, 'STATIC_API_KEY must be at least 10 characters'),
  COOKIE_SECRET: z.string().min(10).optional(),

  // CORS
  CORS_ORIGIN: z
    .preprocess(corsOriginTransform, z.union([z.literal('*'), z.array(z.string().min(1))]))
    .default([]),
  CORS_CREDENTIALS: z.preprocess(toBool, z.boolean()).default(true),

  // Database
  DATABASE_URL: z.string().min(1),
  PRISMA_LOG_QUERIES: z.preprocess(toBool, z.boolean()).default(false),

  // Redis
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),

  // Rate Limiting
  RATE_LIMIT_ENABLED: z.preprocess(toBool, z.boolean()).default(true),
  RATE_LIMIT_POINTS: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_DURATION: z.coerce.number().int().positive().default(1), // seconds
  RATE_LIMIT_KEY_PREFIX: z.string().default('rl'),
  RATE_LIMIT_BLOCK_DURATION: z.coerce.number().int().nonnegative().default(60),
  RATE_LIMIT_STORE: z.enum(['redis', 'memory']).default('redis'),

  // Optional flags
  COMPRESSION_ENABLED: z.preprocess(toBool, z.boolean()).default(true),
  HELMET_ENABLED: z.preprocess(toBool, z.boolean()).default(true),

  // Proxy
  TRUST_PROXY: z.coerce.number().int().nonnegative().default(0),

  // Webhooks
  PAYMENT_PROVIDER_WEBHOOK_SECRET: z.string().min(1),

  // ZarinPal
  ZARINPAL_MERCHANT_ID: z.string().min(1).default('00000000-0000-0000-0000-000000000000'),
  ZARINPAL_CALLBACK_URL: z.string().min(1).default('http://localhost:3000/api/v1/payments/callback'),
  ZARINPAL_SANDBOX: z.preprocess(toBool, z.boolean()).default(true),

  // Media storage
  MEDIA_STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  MEDIA_PUBLIC_BASE_URL: z.string().min(1).default('http://localhost:3000'),
  MEDIA_LOCAL_ROOT: z.string().default('storage'),
  MEDIA_LOCAL_PUBLIC_PATH: z.string().default('/media'),
  MEDIA_S3_BUCKET: z.string().optional(),
  MEDIA_S3_REGION: z.string().optional(),
  MEDIA_S3_UPLOAD_URL_TEMPLATE: z.string().optional(),

  // Sentry
  SENTRY_DSN: z.string().optional(),
  SENTRY_ENABLED: z.preprocess(toBool, z.boolean()).default(false),
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(1.0),

  // SmsIr
  SMSIR_API_KEY: z.string().optional(),
  SMSIR_LINE_NUMBER: z.coerce.number().optional(),
  SMSIR_OTP_TEMPLATE_ID: z.coerce.number().optional(),
  SMSIR_RESERVATION_CONFIRMED_TEMPLATE_ID: z.coerce.number().optional(),
  SMSIR_RESERVATION_PENDING_TEMPLATE_ID: z.coerce.number().optional(),
  SMSIR_RESERVATION_CANCELED_TEMPLATE_ID: z.coerce.number().optional(),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  // خروجی خطاها برای دیباگ
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment variables');
}

if (parsed.success && parsed.data.MEDIA_STORAGE_DRIVER === 's3') {
  if (!parsed.data.MEDIA_S3_BUCKET || !parsed.data.MEDIA_S3_REGION) {
    throw new Error('MEDIA_S3_BUCKET and MEDIA_S3_REGION are required when MEDIA_STORAGE_DRIVER=s3');
  }
  if (!parsed.data.MEDIA_S3_UPLOAD_URL_TEMPLATE) {
    throw new Error('MEDIA_S3_UPLOAD_URL_TEMPLATE is required when MEDIA_STORAGE_DRIVER=s3');
  }
}

export const env = parsed.data;
export type Env = typeof env;
