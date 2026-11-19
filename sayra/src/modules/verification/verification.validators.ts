import { z } from 'zod';

export const submitVerificationSchema = z
  .object({
    ownerFullName: z.string().trim().min(2, 'نام و نام خانوادگی باید حداقل ۲ کاراکتر باشد').optional(),
    fullName: z.string().trim().min(2, 'نام و نام خانوادگی باید حداقل ۲ کاراکتر باشد').optional(),
    phoneNumber: z
      .string()
      .trim()
      .regex(/^(\+98|0)?9\d{9}$/, 'شماره تماس وارد شده معتبر نیست')
      .optional(),
    phone: z
      .string()
      .trim()
      .regex(/^(\+98|0)?9\d{9}$/, 'شماره تماس وارد شده معتبر نیست')
      .optional(),
    gamingCenterName: z.string().trim().min(2, 'نام گیم‌نت باید حداقل ۲ کاراکتر باشد').optional(),
    gameCenterName: z.string().trim().min(2, 'نام گیم‌نت باید حداقل ۲ کاراکتر باشد').optional(),
    businessLicenseUrl: z.string().trim().min(1, 'آدرس یا فایل پروانه کسب الزامی است').optional(),
    nationalCardUrl: z.string().trim().optional().nullable(),
    idWithSelfieUrl: z.string().trim().optional().nullable(),
  })
  .transform((data) => {
    const ownerFullName = data.ownerFullName || data.fullName;
    const phoneNumber = data.phoneNumber || data.phone;
    const gamingCenterName = data.gamingCenterName || data.gameCenterName;
    return {
      ...data,
      ownerFullName: ownerFullName || undefined,
      phoneNumber: phoneNumber || undefined,
      gamingCenterName: gamingCenterName || undefined,
    };
  });

export const rejectVerificationSchema = z.object({
  rejectionReason: z.string().trim().min(3, 'دلیل رد درخواست باید حداقل ۳ کاراکتر باشد'),
});

export const listVerificationsQuerySchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'NOT_SUBMITTED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
