import { z } from 'zod';
import { NotificationCategory, NotificationType } from '@prisma/client';

export const listNotificationsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    pageSize: z.coerce.number().int().positive().max(100).optional(),
    isRead: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
    category: z.nativeEnum(NotificationCategory).optional(),
    type: z.nativeEnum(NotificationType).optional(),
  }),
});

export const notificationIdParamSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Notification ID is required'),
  }),
});

export const listNotificationLogsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    pageSize: z.coerce.number().int().positive().max(100).optional(),
    status: z.string().optional(),
    category: z.nativeEnum(NotificationCategory).optional(),
    type: z.nativeEnum(NotificationType).optional(),
    channel: z.string().optional(),
    entityType: z.string().optional(),
    entityId: z.string().optional(),
    gamingCenterId: z.string().optional(),
  }),
});

export const notificationLogIdParamSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Log ID is required'),
  }),
});
