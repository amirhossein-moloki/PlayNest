import { z } from 'zod';
import {
  DiscountValueType,
  DiscountCodeType,
  DiscountTargetType,
  CampaignScopeType,
  CampaignTargetAudience,
  CampaignStatus,
} from '@prisma/client';
import { zodGameStationType } from '../../common/utils/station-type';

const timeStringSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be in HH:mm format (e.g., 10:00)');

export const listPlatformCampaignsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  search: z.string().optional(),
  status: z.nativeEnum(CampaignStatus).optional(),
  discountType: z.nativeEnum(DiscountValueType).optional(),
  scopeType: z.nativeEnum(CampaignScopeType).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  sortBy: z.enum(['createdAt', 'startDate', 'usedCount']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const createPlatformCampaignSchema = z.object({
  body: z
    .object({
      title: z.string().min(1, 'Title is required'),
      codeType: z.nativeEnum(DiscountCodeType).optional().default(DiscountCodeType.PROMO_CODE),
      code: z.string().trim().min(2, 'Code must be at least 2 characters').optional().nullable(),
      description: z.string().optional().nullable(),
      discountType: z.nativeEnum(DiscountValueType),
      discountValue: z.number().positive('Discount value must be greater than 0'),
      maxDiscountAmount: z.number().positive().optional().nullable(),
      minOrderAmount: z.number().nonnegative().optional().nullable().default(0),

      scopeType: z.nativeEnum(CampaignScopeType).optional().default(CampaignScopeType.GLOBAL),
      targetType: z.nativeEnum(DiscountTargetType).optional().default(DiscountTargetType.GAMING_CENTER),
      targetId: z.string().optional().nullable(),
      applicableGamecenterIds: z.array(z.string()).optional().default([]),
      applicableDeviceTypes: z.array(zodGameStationType()).optional().default([]),
      applicableStationIds: z.array(z.string()).optional().default([]),

      targetAudience: z.nativeEnum(CampaignTargetAudience).optional().default(CampaignTargetAudience.ALL_USERS),
      specificUserIds: z.array(z.string()).optional().default([]),
      minCompletedReservations: z.number().int().min(1).optional().default(1),

      applicableDaysOfWeek: z.array(z.number().int().min(0).max(6)).max(7).optional().default([]),
      dailyStartTime: timeStringSchema.optional().nullable(),
      dailyEndTime: timeStringSchema.optional().nullable(),

      totalUsageLimit: z.number().int().positive().optional().nullable(),
      perUserUsageLimit: z.number().int().positive().optional().nullable().default(1),

      startDate: z.string().datetime({ message: 'startDate must be a valid ISO datetime' }),
      endDate: z.string().datetime({ message: 'endDate must be a valid ISO datetime' }),
      status: z.nativeEnum(CampaignStatus).optional().default(CampaignStatus.ACTIVE),
    })
    .refine((data) => {
      if (data.codeType === DiscountCodeType.PROMO_CODE) {
        return typeof data.code === 'string' && data.code.trim().length >= 2;
      }
      return true;
    }, {
      message: 'Code is required for PROMO_CODE campaigns',
      path: ['code'],
    })
    .refine((data) => {
      const hasStart = typeof data.dailyStartTime === 'string' && data.dailyStartTime.length > 0;
      const hasEnd = typeof data.dailyEndTime === 'string' && data.dailyEndTime.length > 0;
      return hasStart === hasEnd;
    }, {
      message: 'Both dailyStartTime and dailyEndTime must be provided together',
      path: ['dailyEndTime'],
    })
    .refine((data) => {
      if (data.discountType === DiscountValueType.PERCENTAGE) {
        return data.discountValue > 0 && data.discountValue <= 100;
      }
      return data.discountValue > 0;
    }, {
      message: 'Percentage discount must be > 0 and <= 100, and fixed amount must be > 0',
      path: ['discountValue'],
    })
    .refine((data) => {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      return end.getTime() > start.getTime();
    }, {
      message: 'endDate must be strictly after startDate',
      path: ['endDate'],
    }),
});

export const updatePlatformCampaignSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z
    .object({
      title: z.string().min(1).optional(),
      codeType: z.nativeEnum(DiscountCodeType).optional(),
      code: z.string().trim().min(2).optional().nullable(),
      description: z.string().optional().nullable(),
      discountType: z.nativeEnum(DiscountValueType).optional(),
      discountValue: z.number().positive().optional(),
      maxDiscountAmount: z.number().positive().optional().nullable(),
      minOrderAmount: z.number().nonnegative().optional().nullable(),

      scopeType: z.nativeEnum(CampaignScopeType).optional(),
      targetType: z.nativeEnum(DiscountTargetType).optional(),
      targetId: z.string().optional().nullable(),
      applicableGamecenterIds: z.array(z.string()).optional(),
      applicableDeviceTypes: z.array(zodGameStationType()).optional(),
      applicableStationIds: z.array(z.string()).optional(),

      targetAudience: z.nativeEnum(CampaignTargetAudience).optional(),
      specificUserIds: z.array(z.string()).optional(),
      minCompletedReservations: z.number().int().min(1).optional(),

      applicableDaysOfWeek: z.array(z.number().int().min(0).max(6)).max(7).optional(),
      dailyStartTime: timeStringSchema.optional().nullable(),
      dailyEndTime: timeStringSchema.optional().nullable(),

      totalUsageLimit: z.number().int().positive().optional().nullable(),
      perUserUsageLimit: z.number().int().positive().optional().nullable(),

      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
      status: z.nativeEnum(CampaignStatus).optional(),
    })
    .refine((data) => {
      if (data.discountType === DiscountValueType.PERCENTAGE && data.discountValue !== undefined) {
        return data.discountValue > 0 && data.discountValue <= 100;
      }
      return true;
    }, {
      message: 'Percentage discount must be > 0 and <= 100',
      path: ['discountValue'],
    })
    .refine((data) => {
      if (data.startDate && data.endDate) {
        const start = new Date(data.startDate);
        const end = new Date(data.endDate);
        return end.getTime() > start.getTime();
      }
      return true;
    }, {
      message: 'endDate must be strictly after startDate',
      path: ['endDate'],
    }),
});

export type ListPlatformCampaignsQuery = z.infer<typeof listPlatformCampaignsQuerySchema>;
export type CreatePlatformCampaignInput = z.infer<typeof createPlatformCampaignSchema>['body'];
export type UpdatePlatformCampaignInput = z.infer<typeof updatePlatformCampaignSchema>['body'];
