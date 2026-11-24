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
  body: z
    .object({
      username: z.string().trim().min(1).max(100).optional(),
      phone: z.string().trim().min(1).max(30).optional(),
      password: z.string().min(1, 'Password is required'),
    })
    .refine(
      (data) => Boolean((data.username && data.username.length > 0) || (data.phone && data.phone.length > 0)),
      { message: 'Username is required' }
    ),
});

export const platformAdminVerify2faSchema = z.object({
  body: z
    .object({
      challengeToken: z.string().min(10, 'Challenge token is required'),
      code: z.string().trim().regex(/^\d{6}$/, 'TOTP code must be 6 digits').optional(),
      recoveryCode: z.string().trim().min(6, 'Invalid recovery code format').max(32).optional(),
    })
    .refine((data) => Boolean(data.code || data.recoveryCode), {
      message: 'Either a 6-digit TOTP code or a recovery code is required',
    }),
});

export const platformAdminSetup2faSchema = z.object({
  body: z
    .object({
      setupToken: z.string().min(10).optional(),
      currentPassword: z.string().min(1).optional(),
      currentTotpCode: z.string().trim().regex(/^\d{6}$/, 'TOTP code must be 6 digits').optional(),
      label: z.string().trim().min(1).max(60).optional(),
      mode: z.enum(['INITIAL', 'ADD', 'REPLACE']).optional(),
    })
    .default({}),
});

export const platformAdminConfirm2faSchema = z.object({
  body: z.object({
    setupToken: z.string().min(10).optional(),
    deviceId: z.string().trim().min(1).optional(),
    code: z.string().trim().regex(/^\d{6}$/, 'TOTP code must be 6 digits'),
    mode: z.enum(['INITIAL', 'ADD', 'REPLACE']).optional(),
  }),
});

export const platformAdminReauth2faSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    code: z.string().trim().regex(/^\d{6}$/, 'TOTP code must be 6 digits'),
  }),
});

export const platformAdminDeleteDeviceSchema = z.object({
  params: z.object({
    deviceId: z.string().trim().min(1, 'Device ID is required'),
  }),
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    code: z.string().trim().regex(/^\d{6}$/, 'TOTP code must be 6 digits'),
  }),
});

export const platformAdminDisable2faSchema = z.object({
  body: z
    .object({
      currentPassword: z.string().min(1, 'Current password is required'),
      code: z.string().trim().regex(/^\d{6}$/, 'TOTP code must be 6 digits').optional(),
      recoveryCode: z.string().trim().min(6).max(32).optional(),
    })
    .refine((data) => Boolean(data.code || data.recoveryCode), {
      message: 'A 6-digit TOTP code or recovery code is required',
    }),
});

export const platformAdminRefreshSchema = z.object({
  body: z
    .object({
      refreshToken: z.string().min(16).optional(),
    })
    .default({}),
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
