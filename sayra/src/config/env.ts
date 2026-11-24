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
  COOKIE_SECRET: z.string().min(10).optional(),

  // Platform Admin Mandatory TOTP 2FA & Session Security
  PLATFORM_ADMIN_TOTP_ENCRYPTION_KEY: z.string().min(32, 'PLATFORM_ADMIN_TOTP_ENCRYPTION_KEY must be at least 32 characters').optional(),
  PLATFORM_ADMIN_TOTP_ISSUER: z.string().min(1).max(40).default('PlayNest'),
  PLATFORM_ADMIN_ACCESS_EXPIRES_IN: z.string().default('15m'),
  PLATFORM_ADMIN_REFRESH_EXPIRES_IN: z.string().default('12h'),
  PLATFORM_ADMIN_CHALLENGE_TTL_SECONDS: z.coerce.number().int().min(60).max(900).default(300),
  PLATFORM_ADMIN_SETUP_TTL_SECONDS: z.coerce.number().int().min(120).max(1800).default(600),

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

  // OTP / Auth Features (Development/Testing bypass only; strictly forbidden in production)
  SKIP_OTP: z.preprocess(toBool, z.boolean()).default(false),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  OTP_EXPIRATION_MINUTES: z.coerce.number().int().positive().default(2),
  OTP_REQUEST_RATE_LIMIT_PHONE: z.coerce.number().int().positive().default(3),
  OTP_REQUEST_RATE_LIMIT_IP: z.coerce.number().int().positive().default(10),
  OTP_HMAC_SECRET: z.string().min(16).optional(),

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

  // Background Workers & Lifecycle
  WORKERS_ENABLED: z.preprocess(toBool, z.boolean()).default(true),
  GRACEFUL_SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  WORKER_LOCK_TTL_MS: z.coerce.number().int().positive().default(60000),

  // Reservation Expiry Background Worker
  RESERVATION_EXPIRY_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(5000),
  RESERVATION_EXPIRY_BATCH_SIZE: z.coerce.number().int().positive().default(50),
  RESERVATION_EXPIRY_ENABLED: z.preprocess(toBool, z.boolean()).default(true),

  // Reservation Reminders Background Worker
  RESERVATION_REMINDER_LEAD_TIME_MINUTES: z.coerce.number().int().positive().default(60),
  RESERVATION_REMINDER_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(10000),
  RESERVATION_REMINDER_BATCH_SIZE: z.coerce.number().int().positive().default(50),
  RESERVATION_REMINDER_ENABLED: z.preprocess(toBool, z.boolean()).default(true),

  // Webhooks
  PAYMENT_PROVIDER_WEBHOOK_SECRET: z.string().min(1),

  // Payments
  DEFAULT_PAYMENT_PROVIDER: z.enum(['ZARINPAL', 'FAKE', 'STRIPE', 'ZIBAL']).default('ZIBAL'),

  // ZarinPal
  ZARINPAL_MERCHANT_ID: z.string().min(1).default('00000000-0000-0000-0000-000000000000'),
  ZARINPAL_CALLBACK_URL: z.string().min(1).default('http://localhost:3000/api/v1/payments/callback'),
  ZARINPAL_SANDBOX: z.preprocess(toBool, z.boolean()).default(true),

  // Zibal
  ZIBAL_MERCHANT: z.string().min(1).default('zibal'),
  ZIBAL_CALLBACK_URL: z.string().min(1).default('https://api.sayra-booking.ir/api/v1/payments/zibal/callback'),

  // Frontend / Payment Redirect URLs
  FRONTEND_URL: z.string().min(1).default('https://sayra-booking.ir'),
  PAYMENT_SUCCESS_URL: z.string().min(1).default('https://sayra-booking.ir/payment/success'),
  PAYMENT_FAILED_URL: z.string().min(1).default('https://sayra-booking.ir/payment/failed'),

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
  SMSIR_OWNER_RESERVATION_CREATED_TEMPLATE_ID: z.coerce.number().optional(),
  SMSIR_RESERVATION_REMINDER_TEMPLATE_ID: z.coerce.number().optional(),
  SMSIR_PAYMENT_SUCCESS_TEMPLATE_ID: z.coerce.number().optional(),
  SMSIR_PAYMENT_FAILED_TEMPLATE_ID: z.coerce.number().optional(),

  // Melipayamak
  MELIPAYAMAK_USERNAME: z.string().optional(),
  MELIPAYAMAK_PASSWORD: z.string().optional(),
  MELIPAYAMAK_FROM: z.string().optional(),
  MELIPAYAMAK_OTP_BODY_ID: z.coerce.number().optional(),
  MELIPAYAMAK_RESERVATION_BODY_ID: z.coerce.number().optional(),

  // Sayra SMTP / Email (Optional)
  SAYRA_SMTP_HOST: z.string().optional(),
  SAYRA_SMTP_PORT: z.coerce.number().int().positive().optional(),
  SAYRA_SMTP_USER: z.string().optional(),
  SAYRA_SMTP_PASSWORD: z.string().optional(),
  SAYRA_SMTP_SECURE: z.preprocess(toBool, z.boolean()).optional(),
  SAYRA_SMTP_FROM_EMAIL: z.string().email().optional(),
  SAYRA_SMTP_FROM_NAME: z.string().optional(),
  SAYRA_SMTP_REPLY_TO: z.string().email().optional(),

  // Service-to-Service, Ranking & Blog Integration
  INTERNAL_SSR_SECRET: z.string().optional(),
  INTERNAL_SERVICE_TOKEN: z.string().optional(),
  RANKING_BAYESIAN_M: z.coerce.number().positive().default(3),
  RANKING_MIN_REVIEWS_DEFAULT: z.coerce.number().int().nonnegative().default(3),
  BLOG_WEBHOOK_URL: z.string().url().optional().or(z.literal('')),
  BLOG_WEBHOOK_SECRET: z.string().optional(),
  INTEGRATION_OUTBOX_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(10000),
  INTEGRATION_OUTBOX_BATCH_SIZE: z.coerce.number().int().positive().default(25),
  INTEGRATION_OUTBOX_ENABLED: z.preprocess(toBool, z.boolean()).default(true),

  // URL Shortener & Link Analytics
  SHORT_LINK_BASE_URL: z.string().url().default('https://sayra-booking.ir/r'),
  SHORT_LINK_CODE_LENGTH: z.coerce.number().int().min(6).max(12).default(7),
  SHORT_LINK_EXTERNAL_POLICY: z.enum(['ALLOWLIST_ONLY', 'BLOCKLIST_ONLY']).default('ALLOWLIST_ONLY'),
  SHORT_LINK_ALLOWED_DOMAINS: z.string().default(''),
  SHORT_LINK_PRIVACY_SALT: z.string().optional(),
  SHORT_LINK_DEDUP_WINDOW_SECONDS: z.coerce.number().int().min(10).max(86400).default(300),
  SHORT_LINK_BURST_MAX_CLICKS_PER_MINUTE: z.coerce.number().int().min(5).max(1000).default(20),
  SHORT_LINK_MAX_PER_CENTER: z.coerce.number().int().min(10).max(50000).default(500),
  SHORT_LINK_REDIRECT_RATE_LIMIT_MAX: z.coerce.number().int().min(10).max(5000).default(120),
  SHORT_LINK_CREATE_RATE_LIMIT_MAX: z.coerce.number().int().min(5).max(1000).default(30),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  // خروجی خطاها برای دیباگ
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment variables');
}

if (parsed.success) {
  if (parsed.data.MEDIA_STORAGE_DRIVER === 's3') {
    if (!parsed.data.MEDIA_S3_BUCKET || !parsed.data.MEDIA_S3_REGION) {
      throw new Error('MEDIA_S3_BUCKET and MEDIA_S3_REGION are required when MEDIA_STORAGE_DRIVER=s3');
    }
    if (!parsed.data.MEDIA_S3_UPLOAD_URL_TEMPLATE) {
      throw new Error('MEDIA_S3_UPLOAD_URL_TEMPLATE is required when MEDIA_STORAGE_DRIVER=s3');
    }
  }

  if (parsed.data.NODE_ENV === 'production') {
    if (parsed.data.SKIP_OTP) {
      throw new Error(
        'FATAL: SKIP_OTP cannot be enabled in production (NODE_ENV=production). This bypass is for development and testing only.'
      );
    }
    if (parsed.data.JWT_ACCESS_SECRET === 'generate_at_least_32_chars_long_random_string') {
      throw new Error(
        'JWT_ACCESS_SECRET must be changed from the default placeholder value in production.'
      );
    }
    if (parsed.data.JWT_REFRESH_SECRET === 'generate_another_at_least_32_chars_long_random_string') {
      throw new Error(
        'JWT_REFRESH_SECRET must be changed from the default placeholder value in production.'
      );
    }
    if (
      parsed.data.PLATFORM_ADMIN_TOTP_ENCRYPTION_KEY &&
      parsed.data.PLATFORM_ADMIN_TOTP_ENCRYPTION_KEY.includes('<YOUR_TOTP_ENCRYPTION_KEY')
    ) {
      throw new Error(
        'PLATFORM_ADMIN_TOTP_ENCRYPTION_KEY must be changed from the placeholder value in production.'
      );
    }
  }
}

export const env = parsed.data;
export type Env = typeof env;
