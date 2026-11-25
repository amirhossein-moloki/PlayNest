import { z } from 'zod';
import { DiscountTargetType, DiscountValueType, DiscountFundingSource, DiscountCodeType } from '@prisma/client';
import { idSchema, CUID_MESSAGE } from '../../common/validators/common.validators';

export const createCampaignSchema = z.object({
  params: z.object({
    gamingCenterId: idSchema(CUID_MESSAGE).optional(),
  }),
  body: z
    .object({
      name: z.string().min(1, 'Name is required'),
      code: z.string().trim().min(2, 'Code must be at least 2 characters').optional().nullable(),
      codeType: z.nativeEnum(DiscountCodeType).optional().default(DiscountCodeType.PROMO_CODE),
      description: z.string().optional().nullable(),
      targetType: z.nativeEnum(DiscountTargetType).optional().default(DiscountTargetType.GAMING_CENTER),
      targetId: z.string().optional().nullable(),
      valueType: z.nativeEnum(DiscountValueType),
      value: z.number().positive('Discount value must be greater than 0'),
      maxDiscountAmount: z.number().positive().optional().nullable(),
      minReservationAmount: z.number().nonnegative().optional().nullable(),
      fundingSource: z.nativeEnum(DiscountFundingSource).optional(),
      totalBudget: z.number().positive().optional().nullable(),
      maxUsageCount: z.number().int().positive().optional().nullable(),
      maxUsagePerUser: z.number().int().positive().optional().default(1),
      startAt: z.string().datetime({ message: 'startAt must be a valid ISO date-time string' }),
      endAt: z.string().datetime({ message: 'endAt must be a valid ISO date-time string' }),
      isActive: z.boolean().optional().default(true),
    })
    .refine((data) => {
      if (data.valueType === DiscountValueType.PERCENTAGE) {
        return data.value <= 100;
      }
      return true;
    }, {
      message: 'Percentage discount cannot exceed 100%',
      path: ['value'],
    })
    .refine((data) => {
      const start = new Date(data.startAt);
      const end = new Date(data.endAt);
      return end.getTime() > start.getTime();
    }, {
      message: 'endAt must be strictly after startAt',
      path: ['endAt'],
    }),
});

export const updateCampaignSchema = z.object({
  params: z.object({
    id: idSchema(CUID_MESSAGE),
  }),
  body: z
    .object({
      name: z.string().min(1).optional(),
      code: z.string().trim().min(2).optional().nullable(),
      codeType: z.nativeEnum(DiscountCodeType).optional(),
      description: z.string().optional().nullable(),
      targetType: z.nativeEnum(DiscountTargetType).optional(),
      targetId: z.string().optional().nullable(),
      valueType: z.nativeEnum(DiscountValueType).optional(),
      value: z.number().positive().optional(),
      maxDiscountAmount: z.number().positive().optional().nullable(),
      minReservationAmount: z.number().nonnegative().optional().nullable(),
      fundingSource: z.nativeEnum(DiscountFundingSource).optional(),
      totalBudget: z.number().positive().optional().nullable(),
      maxUsageCount: z.number().int().positive().optional().nullable(),
      maxUsagePerUser: z.number().int().positive().optional(),
      startAt: z.string().datetime().optional(),
      endAt: z.string().datetime().optional(),
      isActive: z.boolean().optional(),
    })
    .refine((data) => {
      if (data.valueType === DiscountValueType.PERCENTAGE && data.value !== undefined) {
        return data.value <= 100;
      }
      return true;
    }, {
      message: 'Percentage discount cannot exceed 100%',
      path: ['value'],
    })
    .refine((data) => {
      if (data.startAt && data.endAt) {
        const start = new Date(data.startAt);
        const end = new Date(data.endAt);
        return end.getTime() > start.getTime();
      }
      return true;
    }, {
      message: 'endAt must be strictly after startAt',
      path: ['endAt'],
    }),
});

export const validatePromoCodeSchema = z.object({
  params: z.object({
    gamingCenterId: idSchema(CUID_MESSAGE),
  }),
  body: z.object({
    code: z.string().trim().min(1, 'Code is required'),
    stationId: z.string().min(1, 'stationId is required'),
    basePrice: z.number().nonnegative('basePrice must be non-negative'),
    customerAccountId: z.string().optional(),
    startTime: z.string().datetime().optional(),
  }),
});

export const getAvailableDiscountsSchema = z.object({
  params: z.object({
    gamingCenterId: idSchema(CUID_MESSAGE),
  }),
  body: z.object({
    stationId: z.string().min(1, 'stationId is required'),
    startTime: z.string().datetime().optional(),
    durationHours: z.number().positive().optional(),
    durationMinutes: z.number().int().positive().optional(),
    basePrice: z.number().nonnegative().optional(),
    customerAccountId: z.string().optional(),
    manualCode: z.string().trim().optional().nullable(),
  }),
});

export const calculateDiscountSelectionSchema = z.object({
  params: z.object({
    gamingCenterId: idSchema(CUID_MESSAGE),
  }),
  body: z.object({
    stationId: z.string().min(1, 'stationId is required'),
    basePrice: z.number().nonnegative('basePrice must be non-negative'),
    startTime: z.string().datetime().optional(),
    customerAccountId: z.string().optional(),
    selectedDiscountId: z.string().optional().nullable(),
    selectedType: z.enum(['CAMPAIGN', 'DIRECT_DISCOUNT', 'NONE']).optional(),
    code: z.string().trim().optional().nullable(),
  }),
});

export const reserveDiscountSchema = z.object({
  params: z.object({
    gamingCenterId: idSchema(CUID_MESSAGE),
  }),
  body: z.object({
    stationId: z.string().min(1, 'stationId is required'),
    basePrice: z.number().nonnegative('basePrice must be non-negative'),
    startTime: z.string().datetime().optional(),
    customerAccountId: z.string().min(1, 'customerAccountId is required').optional(),
    selectedDiscountId: z.string().optional().nullable(),
    selectedType: z.enum(['CAMPAIGN', 'DIRECT_DISCOUNT', 'NONE']).optional(),
    code: z.string().trim().optional().nullable(),
    bookingHoldId: z.string().optional().nullable(),
    reservationId: z.string().optional().nullable(),
    idempotencyKey: z.string().trim().optional().nullable(),
    ttlMinutes: z.number().int().min(1).max(30).optional().default(15),
  }),
});

export const releaseDiscountSchema = z.object({
  params: z.object({
    gamingCenterId: idSchema(CUID_MESSAGE),
  }),
  body: z.object({
    usageId: z.string().optional().nullable(),
    reservationId: z.string().optional().nullable(),
    bookingHoldId: z.string().optional().nullable(),
    reason: z.string().optional().nullable(),
  }),
});

export const redeemDiscountSchema = z.object({
  params: z.object({
    gamingCenterId: idSchema(CUID_MESSAGE),
  }),
  body: z.object({
    usageId: z.string().optional().nullable(),
    reservationId: z.string().min(1, 'reservationId is required'),
    bookingHoldId: z.string().optional().nullable(),
  }),
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>['body'];
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>['body'];
export type ValidatePromoCodeInput = z.infer<typeof validatePromoCodeSchema>['body'];
export type GetAvailableDiscountsInput = z.infer<typeof getAvailableDiscountsSchema>['body'];
export type CalculateDiscountSelectionInput = z.infer<typeof calculateDiscountSelectionSchema>['body'];
export type ReserveDiscountInput = z.infer<typeof reserveDiscountSchema>['body'];
export type ReleaseDiscountInput = z.infer<typeof releaseDiscountSchema>['body'];
export type RedeemDiscountInput = z.infer<typeof redeemDiscountSchema>['body'];

export const createDiscountSchema = z.object({
  params: z.object({
    gamingCenterId: idSchema(CUID_MESSAGE),
  }),
  body: z
    .object({
      targetType: z.nativeEnum(DiscountTargetType),
      targetId: z.string().min(1, 'targetId is required'),
      valueType: z.nativeEnum(DiscountValueType),
      value: z.number().positive('Discount value must be greater than 0'),
      startAt: z.string().datetime({ message: 'startAt must be a valid ISO date-time string' }),
      endAt: z.string().datetime({ message: 'endAt must be a valid ISO date-time string' }),
      isActive: z.boolean().optional().default(true),
    })
    .refine((data) => {
      if (data.valueType === DiscountValueType.PERCENTAGE) {
        return data.value <= 100;
      }
      return true;
    }, {
      message: 'Percentage discount cannot exceed 100%',
      path: ['value'],
    })
    .refine((data) => {
      const start = new Date(data.startAt);
      const end = new Date(data.endAt);
      return end.getTime() > start.getTime();
    }, {
      message: 'endAt must be strictly after startAt',
      path: ['endAt'],
    }),
});

export const updateDiscountSchema = z.object({
  params: z.object({
    gamingCenterId: idSchema(CUID_MESSAGE),
    id: idSchema(CUID_MESSAGE),
  }),
  body: z
    .object({
      targetType: z.nativeEnum(DiscountTargetType).optional(),
      targetId: z.string().min(1).optional(),
      valueType: z.nativeEnum(DiscountValueType).optional(),
      value: z.number().positive('Discount value must be greater than 0').optional(),
      startAt: z.string().datetime().optional(),
      endAt: z.string().datetime().optional(),
      isActive: z.boolean().optional(),
    })
    .refine((data) => {
      if (data.valueType === DiscountValueType.PERCENTAGE && data.value !== undefined) {
        return data.value <= 100;
      }
      return true;
    }, {
      message: 'Percentage discount cannot exceed 100%',
      path: ['value'],
    })
    .refine((data) => {
      if (data.startAt && data.endAt) {
        const start = new Date(data.startAt);
        const end = new Date(data.endAt);
        return end.getTime() > start.getTime();
      }
      return true;
    }, {
      message: 'endAt must be strictly after startAt',
      path: ['endAt'],
    }),
});

export const updateDiscountStatusSchema = z.object({
  params: z.object({
    gamingCenterId: idSchema(CUID_MESSAGE),
    id: idSchema(CUID_MESSAGE),
  }),
  body: z.object({
    isActive: z.boolean(),
  }),
});

export const listDiscountQuerySchema = z.object({
  params: z.object({
    gamingCenterId: idSchema(CUID_MESSAGE),
  }),
  query: z.object({
    page: z.preprocess((val) => Number(val), z.number().int().min(1)).optional(),
    pageSize: z.preprocess((val) => Number(val), z.number().int().min(1).max(100)).optional(),
    targetType: z.nativeEnum(DiscountTargetType).optional(),
    targetId: z.string().optional(),
    isActive: z.preprocess((val) => (val === 'true' ? true : val === 'false' ? false : val), z.boolean().optional()),
  }),
});

export const discountParamSchema = z.object({
  params: z.object({
    gamingCenterId: idSchema(CUID_MESSAGE),
    id: idSchema(CUID_MESSAGE),
  }),
});

export type CreateDiscountInput = z.infer<typeof createDiscountSchema>['body'];
export type UpdateDiscountInput = z.infer<typeof updateDiscountSchema>['body'];
export type UpdateDiscountStatusInput = z.infer<typeof updateDiscountStatusSchema>['body'];
export type ListDiscountQuery = z.infer<typeof listDiscountQuerySchema>['query'];
