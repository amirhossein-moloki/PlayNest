import { z } from 'zod';

export const startOnboardingSchema = z.object({
  gameCenterName: z.string().min(2, 'Name must be at least 2 characters'),
  managerFullName: z.string().min(2, 'Manager full name is required'),
  managerPhone: z.string().regex(/^(\+98|0)?9\d{9}$/, 'Invalid Iranian phone number'),
});

export const verifyOnboardingOtpSchema = z.object({
  onboardingId: z.string().min(1, 'Onboarding ID is required'),
  code: z.string().length(6, 'OTP must be 6 digits'),
});

export const updateLocationSchema = z.object({
  provinceId: z.string().min(1, 'Province ID is required'),
  cityId: z.string().min(1, 'City ID is required'),
  address: z.string().min(3, 'Address is required'),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
});

export const updateWorkingHoursSchema = z.object({
  openingTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid opening time format (HH:mm)'),
  closingTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid closing time format (HH:mm)'),
  closedDays: z.array(z.number().int().min(0).max(6)).default([]),
  timezone: z.string().default('Asia/Tehran'),
});

export const updateMediaSchema = z.object({
  logoMediaId: z.string().optional().nullable(),
  galleryMediaIds: z.array(z.string()).default([]),
});

export const completeOnboardingSchema = z.object({
  confirmation: z.boolean().refine((val) => val === true, {
    message: 'Confirmation must be true',
  }),
});
