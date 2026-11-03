import { z } from 'zod';

export const submitVerificationSchema = z.object({
  nationalCardUrl: z.string().url('A valid URL for national card/shenasnameh photo is required'),
  idWithSelfieUrl: z.string().url('A valid URL for selfie holding ID is required'),
  businessLicenseUrl: z.string().url('A valid URL for business license/permit photo is required'),
});

export const rejectVerificationSchema = z.object({
  rejectionReason: z.string().min(3, 'Rejection reason must be at least 3 characters'),
});

export const listVerificationsQuerySchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'NOT_SUBMITTED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
