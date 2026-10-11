import { z } from 'zod';
import { DiscountTargetType, DiscountValueType } from '@prisma/client';

const CUID_MESSAGE = 'Invalid CUID';

export const createDiscountSchema = z.object({
  params: z.object({
    gamingCenterId: z.string().cuid(CUID_MESSAGE),
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
    gamingCenterId: z.string().cuid(CUID_MESSAGE),
    id: z.string().cuid(CUID_MESSAGE),
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
    gamingCenterId: z.string().cuid(CUID_MESSAGE),
    id: z.string().cuid(CUID_MESSAGE),
  }),
  body: z.object({
    isActive: z.boolean(),
  }),
});

export const listDiscountQuerySchema = z.object({
  params: z.object({
    gamingCenterId: z.string().cuid(CUID_MESSAGE),
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
    gamingCenterId: z.string().cuid(CUID_MESSAGE),
    id: z.string().cuid(CUID_MESSAGE),
  }),
});

export type CreateDiscountInput = z.infer<typeof createDiscountSchema>['body'];
export type UpdateDiscountInput = z.infer<typeof updateDiscountSchema>['body'];
export type UpdateDiscountStatusInput = z.infer<typeof updateDiscountStatusSchema>['body'];
export type ListDiscountQuery = z.infer<typeof listDiscountQuerySchema>['query'];
