/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'fs';
import path from 'path';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import redis from '../../config/redis';
import logger from '../../config/logger';
import { auditService } from '../audit/audit.station';
import { RequestActor } from '../../types/express';
import { UpdatePlatformSettingsInput } from './settings.validators';

const DEFAULT_SETTINGS_ID = 'default';
export const PLATFORM_SETTINGS_CACHE_KEY = 'platform:settings';
export const PLATFORM_SETTINGS_REDIS_TTL_SECONDS = 30;
export const PLATFORM_SETTINGS_L1_TTL_MS = 5000;
export const PLATFORM_SETTINGS_REDIS_TIMEOUT_MS = 150;
export const PLATFORM_SETTINGS_INVALIDATE_CHANNEL = 'cache:invalidate:platform:settings';

let l1SettingsCache: { value: any; expiresAt: number } | null = null;
let subscriberRedis: typeof redis | null = null;

function isPlatformSettingsCacheEnabled(): boolean {
  return process.env.NODE_ENV !== 'test' || process.env.ENABLE_SETTINGS_CACHE_IN_TEST === 'true';
}

function isRedisReady(): boolean {
  return redis?.status === 'ready' || (process.env.ENABLE_SETTINGS_CACHE_IN_TEST === 'true' && typeof redis?.get === 'function');
}

export function clearPlatformSettingsCache(): void {
  l1SettingsCache = null;
}

export function initPlatformSettingsCacheSync(): void {
  if (process.env.NODE_ENV === 'test' || subscriberRedis) {
    return;
  }
  if (!redis || typeof redis.duplicate !== 'function') {
    return;
  }

  try {
    const sub = redis.duplicate();
    subscriberRedis = sub;
    sub.on('error', (err) => {
      logger.warn({ err }, 'PlatformSettings cache subscriber error');
    });
    sub.on('message', (channel) => {
      if (channel === PLATFORM_SETTINGS_INVALIDATE_CHANNEL) {
        l1SettingsCache = null;
      }
    });
    void sub.subscribe(PLATFORM_SETTINGS_INVALIDATE_CHANNEL).catch((err) => {
      logger.warn({ err }, 'Failed to subscribe to PlatformSettings invalidation channel');
    });
  } catch (err) {
    logger.warn({ err }, 'Failed to initialize PlatformSettings cache subscriber');
  }
}

export async function stopPlatformSettingsCacheSync(): Promise<void> {
  if (!subscriberRedis) {
    return;
  }
  const sub = subscriberRedis;
  subscriberRedis = null;
  try {
    await sub.unsubscribe(PLATFORM_SETTINGS_INVALIDATE_CHANNEL).catch(() => undefined);
    await sub.quit().catch(() => undefined);
  } catch {
    // Ignore cleanup errors during shutdown
  }
}

export const PlatformSettingsRepo = {
  async getSettings() {
    if (isPlatformSettingsCacheEnabled()) {
      if (l1SettingsCache && Date.now() < l1SettingsCache.expiresAt) {
        return l1SettingsCache.value;
      }

      if (isRedisReady()) {
        let timeoutHandle: NodeJS.Timeout | undefined;
        try {
          const cached = await Promise.race([
            redis.get(PLATFORM_SETTINGS_CACHE_KEY),
            new Promise<null>((resolve) => {
              timeoutHandle = setTimeout(() => resolve(null), PLATFORM_SETTINGS_REDIS_TIMEOUT_MS);
            }),
          ]);
          if (typeof cached === 'string' && cached.length > 0) {
            const parsed = JSON.parse(cached);
            l1SettingsCache = {
              value: parsed,
              expiresAt: Date.now() + PLATFORM_SETTINGS_L1_TTL_MS,
            };
            return parsed;
          }
        } catch {
          // Fail-open to DB lookup
        } finally {
          if (timeoutHandle) {
            clearTimeout(timeoutHandle);
          }
        }
      }
    }

    let settings = await (prisma as any).platformSetting.findUnique({
      where: { id: DEFAULT_SETTINGS_ID },
    });

    if (!settings) {
      settings = await (prisma as any).platformSetting.create({
        data: {
          id: DEFAULT_SETTINGS_ID,
        },
      });
    }

    if (isPlatformSettingsCacheEnabled() && settings) {
      l1SettingsCache = {
        value: settings,
        expiresAt: Date.now() + PLATFORM_SETTINGS_L1_TTL_MS,
      };
      if (isRedisReady() && typeof redis.set === 'function') {
        void redis
          .set(PLATFORM_SETTINGS_CACHE_KEY, JSON.stringify(settings), 'EX', PLATFORM_SETTINGS_REDIS_TTL_SECONDS)
          .catch(() => undefined);
      }
    }

    return settings;
  },

  async updateSettings(data: UpdatePlatformSettingsInput) {
    const updated = await (prisma as any).platformSetting.upsert({
      where: { id: DEFAULT_SETTINGS_ID },
      create: {
        id: DEFAULT_SETTINGS_ID,
        ...data,
      },
      update: data,
    });

    l1SettingsCache = null;

    if (isPlatformSettingsCacheEnabled() && isRedisReady()) {
      if (typeof redis.del === 'function') {
        await redis.del(PLATFORM_SETTINGS_CACHE_KEY).catch(() => undefined);
      }
      if (typeof redis.publish === 'function') {
        await redis.publish(PLATFORM_SETTINGS_INVALIDATE_CHANNEL, 'invalidate').catch(() => undefined);
      }
    }

    return updated;
  },
};

export const PlatformSettingsStation = {
  async getSettingsWithInfrastructure() {
    const settings = await PlatformSettingsRepo.getSettings();

    // Check Infrastructure Status dynamically
    const infrastructure = await this.getInfrastructureStatus();

    return {
      settings: {
        siteTitle: settings.siteTitle,
        supportPhone: settings.supportPhone,
        supportEmail: settings.supportEmail,
        centralAddress: settings.centralAddress,
        maintenanceMode: settings.maintenanceMode,
        maintenanceMessage: settings.maintenanceMessage,

        platformCommissionPercent: settings.platformCommissionPercent,
        maxAdvanceBookingDays: settings.maxAdvanceBookingDays,
        onlinePaymentTimeoutMinutes: settings.onlinePaymentTimeoutMinutes,
        cancellationPenaltyPercent: settings.cancellationPenaltyPercent,
        freeCancellationHours: settings.freeCancellationHours,

        autoSendBookingSms: settings.autoSendBookingSms,
        autoSendReminderSms: settings.autoSendReminderSms,
        welcomeSmsTemplate: settings.welcomeSmsTemplate,
        bookingConfirmationSmsTemplate: settings.bookingConfirmationSmsTemplate,
        bookingReminderSmsTemplate: settings.bookingReminderSmsTemplate,

        reviewApprovalPolicy: settings.reviewApprovalPolicy,
        createdAt: settings.createdAt,
        updatedAt: settings.updatedAt,
      },
      infrastructure,
    };
  },

  async getInfrastructureStatus() {
    // 1. SMS Gateway Status & Provider
    let smsGatewayStatus = 'UNKNOWN';
    const smsProvider = (env.MELIPAYAMAK_USERNAME && env.MELIPAYAMAK_PASSWORD)
      ? 'Melipayamak'
      : env.SMSIR_API_KEY
        ? 'SmsIr'
        : 'NONE';

    if (env.MELIPAYAMAK_USERNAME && env.MELIPAYAMAK_PASSWORD && env.MELIPAYAMAK_FROM) {
      smsGatewayStatus = 'HEALTHY';
    } else if (env.MELIPAYAMAK_USERNAME && env.MELIPAYAMAK_PASSWORD) {
      smsGatewayStatus = 'DEGRADED';
    } else if (env.SMSIR_API_KEY && env.SMSIR_LINE_NUMBER) {
      smsGatewayStatus = 'HEALTHY';
    } else if (env.SMSIR_API_KEY) {
      smsGatewayStatus = 'DEGRADED';
    } else {
      smsGatewayStatus = 'UNKNOWN';
    }

    // 2. Payment Gateway Status & Provider
    const paymentProvider = env.DEFAULT_PAYMENT_PROVIDER || 'ZARINPAL';
    let paymentGatewayStatus = 'UNKNOWN';
    if (paymentProvider === 'ZARINPAL') {
      if (env.ZARINPAL_MERCHANT_ID && env.ZARINPAL_MERCHANT_ID !== '00000000-0000-0000-0000-000000000000') {
        paymentGatewayStatus = 'HEALTHY';
      } else {
        paymentGatewayStatus = env.ZARINPAL_SANDBOX ? 'HEALTHY' : 'UNKNOWN';
      }
    } else if (paymentProvider === 'FAKE') {
      paymentGatewayStatus = 'HEALTHY';
    }

    // 3. SSL Status
    const sslStatus = process.env.SSL_STATUS || (env.NODE_ENV === 'production' ? 'ACTIVE' : 'UNKNOWN');

    // 4. API Version
    let apiVersion = '1.0.0';
    try {
      const packageJsonPath = path.resolve(__dirname, '../../../package.json');
      if (fs.existsSync(packageJsonPath)) {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        apiVersion = pkg.version || '1.0.0';
      }
    } catch {
      apiVersion = '1.0.0';
    }

    // 5. Last Successful Backup Timestamp
    let lastSuccessfulBackupAt: string | null = null;
    try {
      const snapshotsDir = path.resolve(process.cwd(), 'backups/snapshots');
      if (fs.existsSync(snapshotsDir)) {
        const files = fs.readdirSync(snapshotsDir);
        if (files.length > 0) {
          let latestTime = 0;
          for (const file of files) {
            const filePath = path.join(snapshotsDir, file);
            const stat = fs.statSync(filePath);
            if (stat.mtimeMs > latestTime) {
              latestTime = stat.mtimeMs;
            }
          }
          if (latestTime > 0) {
            lastSuccessfulBackupAt = new Date(latestTime).toISOString();
          }
        }
      }
    } catch {
      lastSuccessfulBackupAt = null;
    }

    return {
      smsGatewayStatus,
      smsProvider,
      paymentGatewayStatus,
      paymentProvider,
      sslStatus,
      apiVersion,
      lastSuccessfulBackupAt,
    };
  },

  async updateSettings(
    input: UpdatePlatformSettingsInput,
    actor?: RequestActor,
    context?: { ip?: string; userAgent?: string }
  ) {
    const existing = await PlatformSettingsRepo.getSettings();
    const updated = await PlatformSettingsRepo.updateSettings(input);

    if (actor) {
      await auditService.recordLog({
        platformAdminId: actor.id || (actor as any).actorId,
        action: 'PLATFORM_SETTINGS_UPDATE',
        entity: 'PlatformSetting',
        entityId: DEFAULT_SETTINGS_ID,
        oldData: existing,
        newData: input,
        ipAddress: context?.ip,
        userAgent: context?.userAgent,
      });
    }

    return {
      siteTitle: updated.siteTitle,
      supportPhone: updated.supportPhone,
      supportEmail: updated.supportEmail,
      centralAddress: updated.centralAddress,
      maintenanceMode: updated.maintenanceMode,
      maintenanceMessage: updated.maintenanceMessage,

      platformCommissionPercent: updated.platformCommissionPercent,
      maxAdvanceBookingDays: updated.maxAdvanceBookingDays,
      onlinePaymentTimeoutMinutes: updated.onlinePaymentTimeoutMinutes,
      cancellationPenaltyPercent: updated.cancellationPenaltyPercent,
      freeCancellationHours: updated.freeCancellationHours,

      autoSendBookingSms: updated.autoSendBookingSms,
      autoSendReminderSms: updated.autoSendReminderSms,
      welcomeSmsTemplate: updated.welcomeSmsTemplate,
      bookingConfirmationSmsTemplate: updated.bookingConfirmationSmsTemplate,
      bookingReminderSmsTemplate: updated.bookingReminderSmsTemplate,

      reviewApprovalPolicy: updated.reviewApprovalPolicy,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  },
};
