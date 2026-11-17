import { z } from 'zod';
import { idSchema } from '../../common/validators/common.validators';

export const loginSchema = z.object({
  body: z.object({
    phone: z.string().min(10, 'Phone number must be at least 10 digits'),
    password: z.string(),
    gamingCenterId: z.string(),
  }),
});

export const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string(),
  }),
});

export const requestOtpSchema = z.object({
  body: z.object({
    phone: z.string().min(10, 'Phone number must be at least 10 digits'),
  }),
});

export const verifyOtpSchema = z.object({
  body: z.object({
    phone: z.string().min(10, 'Phone number must be at least 10 digits'),
    code: z.string().length(6, 'OTP code must be 6 digits'),
  }),
});

export const otpLoginSchema = z.object({
  body: z.object({
    phone: z.string().min(10, 'Phone number must be at least 10 digits'),
    otp: z.string().length(6, 'OTP code must be 6 digits'),
  }),
});

export const loginWithOtpSchema = z.object({
  body: z.object({
    phone: z.string().min(10, 'Phone number must be at least 10 digits'),
    gamingCenterId: idSchema('Invalid GamingCenter ID format'),
  }),
});

export const platformAdminLoginSchema = z.object({
  body: z.object({
    phone: z.string().min(10, 'Phone number must be at least 10 digits'),
    password: z.string().min(1, 'Password is required'),
  }),
});

export const updateProfileSchema = z.object({
  body: z.object({
    username: z
      .string()
      .trim()
      .min(3, 'Username must be at least 3 characters')
      .max(30, 'Username must not exceed 30 characters')
      .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens')
      .optional(),
    firstName: z.string().trim().min(1, 'First name cannot be empty').max(50, 'First name is too long').optional(),
    lastName: z.string().trim().min(1, 'Last name cannot be empty').max(50, 'Last name is too long').optional(),
    fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(100, 'Full name is too long').optional(),
    email: z.string().trim().email('Invalid email address').optional().nullable(),
    bio: z.string().max(500, 'Bio must not exceed 500 characters').optional().nullable(),
    publicName: z.string().max(50, 'Public name must not exceed 50 characters').optional().nullable(),
    avatarUrl: z.string().trim().url('Invalid avatar URL').optional().nullable(),
    isPublic: z.boolean().optional(),
  }),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>['body'];
