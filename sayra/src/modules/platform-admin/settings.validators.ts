import { z } from 'zod';
import { ReviewApprovalPolicy } from '@prisma/client';

export const updatePlatformSettingsSchema = z.object({
  body: z.object({
    // General Settings
    siteTitle: z.string().min(1, 'siteTitle cannot be empty').optional(),
    supportPhone: z.string().min(3, 'supportPhone is invalid').optional(),
    supportEmail: z.string().email('Invalid email address').optional(),
    centralAddress: z.string().optional(),
    maintenanceMode: z.boolean().optional(),
    maintenanceMessage: z.string().optional(),

    // Reservation Rules
    platformCommissionPercent: z
      .number()
      .min(0, 'Commission percent cannot be less than 0')
      .max(100, 'Commission percent cannot exceed 100')
      .optional(),
    maxAdvanceBookingDays: z
      .number()
      .int()
      .positive('maxAdvanceBookingDays must be a positive integer')
      .optional(),
    onlinePaymentTimeoutMinutes: z
      .number()
      .int()
      .positive('onlinePaymentTimeoutMinutes must be positive')
      .optional(),
    cancellationPenaltyPercent: z
      .number()
      .min(0, 'cancellationPenaltyPercent cannot be less than 0')
      .max(100, 'cancellationPenaltyPercent cannot exceed 100')
      .optional(),
    freeCancellationHours: z
      .number()
      .int()
      .nonnegative('freeCancellationHours cannot be negative')
      .optional(),

    // Notification Settings
    autoSendBookingSms: z.boolean().optional(),
    autoSendReminderSms: z.boolean().optional(),
    welcomeSmsTemplate: z.string().optional(),
    bookingConfirmationSmsTemplate: z.string().optional(),
    bookingReminderSmsTemplate: z.string().optional(),

    // Review Moderation Settings
    reviewApprovalPolicy: z.nativeEnum(ReviewApprovalPolicy).optional(),
  }),
});

export type UpdatePlatformSettingsInput = z.infer<typeof updatePlatformSettingsSchema>['body'];
