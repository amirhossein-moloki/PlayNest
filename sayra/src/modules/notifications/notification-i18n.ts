export type NotificationLanguage = 'fa' | 'en';
export type NotificationDirection = 'rtl' | 'ltr';

export const DEFAULT_NOTIFICATION_LANGUAGE: NotificationLanguage = 'fa';

export type NotificationTemplateKey =
  | 'RESERVATION_CREATED_STAFF'
  | 'RESERVATION_CONFIRMED_STAFF'
  | 'RESERVATION_CANCELLED_STAFF'
  | 'RESERVATION_TIME_PROPOSED_STAFF'
  | 'RESERVATION_STATUS_CONFIRMED_CUSTOMER'
  | 'RESERVATION_STATUS_CANCELED_CUSTOMER'
  | 'RESERVATION_STATUS_PENDING_CUSTOMER'
  | 'RESERVATION_REMINDER_CUSTOMER'
  | 'RESERVATION_REMINDER_STAFF'
  | 'PAYMENT_SUCCESS_CUSTOMER'
  | 'PAYMENT_FAILED_CUSTOMER'
  | 'WAITLIST_OFFER_CREATED'
  | 'WALLET_CHARGED'
  | 'WITHDRAWAL_SUBMITTED'
  | 'WITHDRAWAL_APPROVED'
  | 'WITHDRAWAL_REJECTED'
  | 'WITHDRAWAL_PROCESSING'
  | 'WITHDRAWAL_PAID'
  | 'WITHDRAWAL_FAILED'
  // Customer Ticket Events
  | 'TICKET_CREATED'
  | 'TICKET_REPLIED'
  | 'TICKET_CLOSED'
  // GameCenter Events
  | 'GAME_CENTER_BOOKING_REQUESTED'
  | 'GAME_CENTER_BOOKING_REMINDER_24H'
  | 'GAME_CENTER_BOOKING_REMINDER_2H'
  | 'GAME_CENTER_BOOKING_REMINDER_15M'
  | 'GAME_CENTER_BOOKING_CONFIRMED'
  | 'GAME_CENTER_BOOKING_CANCELLED'
  | 'GAME_CENTER_BOOKING_UPDATED'
  | 'GAME_CENTER_REVIEW_RECEIVED'
  // Manager Events
  | 'NEW_GAME_CENTER_REGISTRATION'
  | 'NEW_TICKET_CREATED'
  | 'NEW_USER_REPORT'
  | 'PAYMENT_FAILED'
  | 'REFUND_REQUESTED'
  | 'SYSTEM_ERROR'
  | 'DAILY_BOOKING_SUMMARY';

export interface LocalizedNotificationContent {
  language: NotificationLanguage;
  direction: NotificationDirection;
  title: string;
  message: string;
  description?: string;
  actionLabel?: string;
}

interface NotificationTemplateEntry {
  title: string;
  message: string;
  description?: string;
  actionLabel?: string;
}

type TemplateParams = Record<string, string | number | undefined | null>;

/**
 * Resolves a preferred language value to a supported notification language ('fa' | 'en').
 * Always defaults to Persian ('fa') when no preference is provided or unsupported.
 */
export function resolveNotificationLanguage(preferredLanguage?: string | null): NotificationLanguage {
  if (!preferredLanguage || typeof preferredLanguage !== 'string') {
    return DEFAULT_NOTIFICATION_LANGUAGE;
  }
  const normalized = preferredLanguage.trim().toLowerCase();
  if (normalized === 'en' || normalized.startsWith('en-') || normalized.startsWith('en_')) {
    return 'en';
  }
  if (normalized === 'fa' || normalized.startsWith('fa-') || normalized.startsWith('fa_')) {
    return 'fa';
  }
  return DEFAULT_NOTIFICATION_LANGUAGE;
}

/**
 * Extracts preferred language from a recipient object if any language/locale field is present.
 */
export function getRecipientPreferredLanguage(recipient?: unknown): NotificationLanguage {
  if (!recipient || typeof recipient !== 'object') {
    return DEFAULT_NOTIFICATION_LANGUAGE;
  }
  const rec = recipient as Record<string, unknown>;
  const raw =
    (typeof rec.preferredLanguage === 'string' && rec.preferredLanguage) ||
    (typeof rec.language === 'string' && rec.language) ||
    (typeof rec.locale === 'string' && rec.locale) ||
    null;
  return resolveNotificationLanguage(raw);
}

export function getLanguageDirection(language: NotificationLanguage): NotificationDirection {
  return language === 'en' ? 'ltr' : 'rtl';
}

export function formatCurrencyAmount(
  amount: number,
  currency = 'IRR',
  language: NotificationLanguage = DEFAULT_NOTIFICATION_LANGUAGE
): string {
  if (language === 'en') {
    return `${amount.toLocaleString('en-US')} ${currency}`;
  }
  const faCurrency = currency === 'IRR' ? 'ریال' : currency;
  return `${amount.toLocaleString('fa-IR')} ${faCurrency}`;
}

function interpolate(template: string, params: TemplateParams = {}): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const val = params[key];
    return val !== undefined && val !== null ? String(val) : '';
  });
}

const NOTIFICATION_TRANSLATIONS: Record<
  NotificationTemplateKey,
  Record<NotificationLanguage, NotificationTemplateEntry>
> = {
  RESERVATION_CREATED_STAFF: {
    fa: {
      title: 'رزرو جدید ثبت شد',
      message: 'یک درخواست رزرو جدید برای مرکز بازی شما ثبت شد ({{stationName}} در تاریخ {{dateStr}} ساعت {{timeStr}}).',
      description: 'لطفاً درخواست رزرو را بررسی و تأیید نمایید.',
      actionLabel: 'مشاهده رزرو',
    },
    en: {
      title: 'New Reservation Created',
      message: 'A new reservation request has been created for your gaming center ({{stationName}} on {{dateStr}} at {{timeStr}}).',
      description: 'Please review and confirm the reservation request.',
      actionLabel: 'View Reservation',
    },
  },
  RESERVATION_CONFIRMED_STAFF: {
    fa: {
      title: 'رزرو تأیید شد',
      message: 'رزرو {{reservationId}} تأیید شد.',
      actionLabel: 'مشاهده رزرو',
    },
    en: {
      title: 'Reservation Confirmed',
      message: 'Reservation {{reservationId}} has been confirmed.',
      actionLabel: 'View Reservation',
    },
  },
  RESERVATION_CANCELLED_STAFF: {
    fa: {
      title: 'رزرو لغو شد',
      message: 'رزرو {{reservationId}} لغو شد.',
      actionLabel: 'مشاهده رزرو',
    },
    en: {
      title: 'Reservation Cancelled',
      message: 'Reservation {{reservationId}} was cancelled.',
      actionLabel: 'View Reservation',
    },
  },
  RESERVATION_TIME_PROPOSED_STAFF: {
    fa: {
      title: 'پیشنهاد زمان جدید رزرو',
      message: 'یک پیشنهاد زمان جدید برای رزرو {{reservationId}} ثبت شد.',
      actionLabel: 'بررسی پیشنهاد',
    },
    en: {
      title: 'Reservation Reschedule Proposed',
      message: 'A new time proposal was made for reservation {{reservationId}}.',
      actionLabel: 'Review Proposal',
    },
  },
  RESERVATION_STATUS_CONFIRMED_CUSTOMER: {
    fa: {
      title: 'تأیید رزرو',
      message: 'رزرو {{reservationId}} با موفقیت تأیید شد.',
      actionLabel: 'مشاهده رزرو',
    },
    en: {
      title: 'Reservation Confirmed',
      message: 'Reservation {{reservationId}} has been confirmed.',
      actionLabel: 'View Reservation',
    },
  },
  RESERVATION_STATUS_CANCELED_CUSTOMER: {
    fa: {
      title: 'لغو رزرو',
      message: 'رزرو {{reservationId}} لغو شد.',
      actionLabel: 'مشاهده جزئیات',
    },
    en: {
      title: 'Reservation Cancelled',
      message: 'Reservation {{reservationId}} has been cancelled.',
      actionLabel: 'View Details',
    },
  },
  RESERVATION_STATUS_PENDING_CUSTOMER: {
    fa: {
      title: 'ثبت رزرو',
      message: 'رزرو {{reservationId}} ثبت شد و در انتظار تأیید است.',
      actionLabel: 'پیگیری رزرو',
    },
    en: {
      title: 'Reservation Pending',
      message: 'Reservation {{reservationId}} has been created and is pending confirmation.',
      actionLabel: 'Track Reservation',
    },
  },
  RESERVATION_REMINDER_CUSTOMER: {
    fa: {
      title: 'یادآوری رزرو پیش رو',
      message: 'یادآوری: رزرو شما برای {{stationName}} در {{gamingCenterName}} در تاریخ {{dateStr}} ساعت {{timeStr}} است.',
      description: 'لطفاً به موقع در مرکز بازی حضور داشته باشید.',
      actionLabel: 'مشاهده رزرو',
    },
    en: {
      title: 'Upcoming Reservation Reminder',
      message: 'Reminder: Your reservation for {{stationName}} at {{gamingCenterName}} is on {{dateStr}} at {{timeStr}}.',
      description: 'Please arrive on time at the gaming center.',
      actionLabel: 'View Reservation',
    },
  },
  RESERVATION_REMINDER_STAFF: {
    fa: {
      title: 'یادآوری رزرو پیش رو',
      message: 'رزرو {{reservationId}} ({{stationName}}) در ساعت {{timeStr}} آغاز می‌شود.',
      actionLabel: 'مشاهده رزرو',
    },
    en: {
      title: 'Upcoming Reservation Reminder',
      message: 'Upcoming reservation {{reservationId}} ({{stationName}}) starts at {{timeStr}}.',
      actionLabel: 'View Reservation',
    },
  },
  PAYMENT_SUCCESS_CUSTOMER: {
    fa: {
      title: 'پرداخت موفق',
      message: 'پرداخت به مبلغ {{formattedAmount}} با موفقیت انجام شد. کد پیگیری: {{refCode}}',
      actionLabel: 'مشاهده رسید',
    },
    en: {
      title: 'Payment Successful',
      message: 'Payment of {{formattedAmount}} succeeded. Ref: {{refCode}}',
      actionLabel: 'View Receipt',
    },
  },
  PAYMENT_FAILED_CUSTOMER: {
    fa: {
      title: 'پرداخت ناموفق',
      message: 'پرداخت به مبلغ {{formattedAmount}} ناموفق بود. دلیل: {{reason}}',
      actionLabel: 'تلاش مجدد',
    },
    en: {
      title: 'Payment Failed',
      message: 'Payment of {{formattedAmount}} failed. Reason: {{reason}}',
      actionLabel: 'Retry Payment',
    },
  },
  WAITLIST_OFFER_CREATED: {
    fa: {
      title: 'ظرفیت لیست انتظار آزاد شد!',
      message: 'یک جایگاه در {{stationName}} برای زمان درخواستی شما آزاد شده است. پیش از انقضا، پیشنهاد خود را بپذیرید!',
      actionLabel: 'پذیرش پیشنهاد',
    },
    en: {
      title: 'Waitlist Opportunity Available!',
      message: 'A slot on {{stationName}} is now available for your requested time. Accept your offer before it expires!',
      actionLabel: 'Accept Offer',
    },
  },
  WALLET_CHARGED: {
    fa: {
      title: 'کیف پول شارژ شد',
      message: 'کیف پول شما به مبلغ {{formattedAmount}} با موفقیت شارژ شد.',
      actionLabel: 'مشاهده کیف پول',
    },
    en: {
      title: 'Wallet Charged',
      message: 'Your wallet has been successfully credited with {{formattedAmount}}.',
      actionLabel: 'View Wallet',
    },
  },
  WITHDRAWAL_SUBMITTED: {
    fa: {
      title: 'درخواست برداشت ثبت شد',
      message: 'درخواست برداشت وجه به مبلغ {{formattedAmount}} با موفقیت ثبت شد و در انتظار بررسی مدیر است.',
      actionLabel: 'پیگیری درخواست',
    },
    en: {
      title: 'Withdrawal Request Submitted',
      message: 'Your withdrawal request for {{formattedAmount}} has been submitted and is pending review.',
      actionLabel: 'Track Request',
    },
  },
  WITHDRAWAL_APPROVED: {
    fa: {
      title: 'تأیید درخواست برداشت',
      message: 'درخواست برداشت وجه به مبلغ {{formattedAmount}} توسط مدیر تأیید شد و وارد مرحله پرداخت گردید.',
      actionLabel: 'مشاهده جزئیات',
    },
    en: {
      title: 'Withdrawal Request Approved',
      message: 'Your withdrawal request for {{formattedAmount}} has been approved and queued for payout.',
      actionLabel: 'View Details',
    },
  },
  WITHDRAWAL_REJECTED: {
    fa: {
      title: 'رد درخواست برداشت',
      message: 'درخواست برداشت وجه شما رد شد و مبلغ {{formattedAmount}} به موجودی قابل برداشت شما بازگردانده شد. دلیل: {{reason}}',
      actionLabel: 'مشاهده جزئیات',
    },
    en: {
      title: 'Withdrawal Request Rejected',
      message: 'Your withdrawal request was rejected and {{formattedAmount}} has been returned to your available balance. Reason: {{reason}}',
      actionLabel: 'View Details',
    },
  },
  WITHDRAWAL_PROCESSING: {
    fa: {
      title: 'پرداخت در حال انجام است',
      message: 'فرایند واریز مبلغ {{formattedAmount}} در حال انجام است.',
      actionLabel: 'مشاهده جزئیات',
    },
    en: {
      title: 'Withdrawal Processing',
      message: 'Payout of {{formattedAmount}} is currently being processed.',
      actionLabel: 'View Details',
    },
  },
  WITHDRAWAL_PAID: {
    fa: {
      title: 'پرداخت با موفقیت انجام شد',
      message: 'مبلغ {{formattedAmount}} با موفقیت به حساب شما واریز گردید. شناسه پیگیری: {{paymentReference}}',
      actionLabel: 'مشاهده رسید',
    },
    en: {
      title: 'Withdrawal Paid',
      message: '{{formattedAmount}} has been transferred to your account. Reference: {{paymentReference}}',
      actionLabel: 'View Receipt',
    },
  },
  WITHDRAWAL_FAILED: {
    fa: {
      title: 'پرداخت ناموفق بود',
      message: 'پرداخت مبلغ {{formattedAmount}} ناموفق بود و مبلغ به موجودی قابل برداشت شما بازگردانده شد.',
      actionLabel: 'مشاهده جزئیات',
    },
    en: {
      title: 'Withdrawal Failed',
      message: 'Payout of {{formattedAmount}} failed and the amount has been returned to your available balance.',
      actionLabel: 'View Details',
    },
  },
  TICKET_CREATED: {
    fa: {
      title: 'تیکت پشتیبانی ایجاد شد',
      message: 'تیکت شماره {{ticketCode}} با موضوع «{{subject}}» با موفقیت ایجاد شد.',
    },
    en: {
      title: 'Ticket Created',
      message: 'Ticket #{{ticketCode}} with subject "{{subject}}" has been created.',
    },
  },
  TICKET_REPLIED: {
    fa: {
      title: 'پاسخ جدید به تیکت',
      message: 'پاسخ جدیدی برای تیکت شماره {{ticketCode}} ثبت گردید.',
    },
    en: {
      title: 'Ticket Replied',
      message: 'A new reply has been submitted for ticket #{{ticketCode}}.',
    },
  },
  TICKET_CLOSED: {
    fa: {
      title: 'بسته شدن تیکت',
      message: 'تیکت شماره {{ticketCode}} بسته شد.',
    },
    en: {
      title: 'Ticket Closed',
      message: 'Ticket #{{ticketCode}} has been closed.',
    },
  },
  GAME_CENTER_BOOKING_REQUESTED: {
    fa: {
      title: 'درخواست رزرو جدید',
      message: 'درخواست رزرو جدید برای {{stationName}} در تاریخ {{dateStr}} ساعت {{timeStr}} توسط {{customerName}} ثبت شد.',
      actionLabel: 'بررسی رزرو',
    },
    en: {
      title: 'New Booking Requested',
      message: 'A new booking has been requested for {{stationName}} on {{dateStr}} at {{timeStr}} by {{customerName}}.',
      actionLabel: 'Review Booking',
    },
  },
  GAME_CENTER_BOOKING_REMINDER_24H: {
    fa: {
      title: 'یادآوری رزرو (۲۴ ساعت مانده)',
      message: 'رزرو {{bookingId}} ({{stationName}}) ۲۴ ساعت دیگر در تاریخ {{dateStr}} ساعت {{timeStr}} آغاز می‌شود.',
      actionLabel: 'مشاهده رزرو',
    },
    en: {
      title: 'Booking Reminder (24h prior)',
      message: 'Booking {{bookingId}} ({{stationName}}) starts in 24 hours on {{dateStr}} at {{timeStr}}.',
      actionLabel: 'View Booking',
    },
  },
  GAME_CENTER_BOOKING_REMINDER_2H: {
    fa: {
      title: 'یادآوری رزرو (۲ ساعت مانده)',
      message: 'رزرو {{bookingId}} ({{stationName}}) ۲ ساعت دیگر در ساعت {{timeStr}} آغاز خواهد شد.',
      actionLabel: 'مشاهده رزرو',
    },
    en: {
      title: 'Booking Reminder (2h prior)',
      message: 'Booking {{bookingId}} ({{stationName}}) starts in 2 hours at {{timeStr}}.',
      actionLabel: 'View Booking',
    },
  },
  GAME_CENTER_BOOKING_REMINDER_15M: {
    fa: {
      title: 'یادآوری رزرو (۱۵ دقیقه مانده)',
      message: 'رزرو {{bookingId}} ({{stationName}}) تا ۱۵ دقیقه دیگر (ساعت {{timeStr}}) آغاز خواهد شد. لطفاً آماده‌سازی لازم را انجام دهید.',
      actionLabel: 'مشاهده رزرو',
    },
    en: {
      title: 'Booking Reminder (15m prior)',
      message: 'Booking {{bookingId}} ({{stationName}}) starts in 15 minutes at {{timeStr}}. Please prepare the station.',
      actionLabel: 'View Booking',
    },
  },
  GAME_CENTER_BOOKING_CONFIRMED: {
    fa: {
      title: 'رزرو مرکز بازی تأیید شد',
      message: 'رزرو {{bookingId}} برای {{stationName}} با موفقیت تأیید شد.',
      actionLabel: 'مشاهده رزرو',
    },
    en: {
      title: 'Booking Confirmed',
      message: 'Booking {{bookingId}} for {{stationName}} has been confirmed.',
      actionLabel: 'View Booking',
    },
  },
  GAME_CENTER_BOOKING_CANCELLED: {
    fa: {
      title: 'رزرو مرکز بازی لغو شد',
      message: 'رزرو {{bookingId}} برای {{stationName}} لغو شد. دلیل: {{reason}}',
      actionLabel: 'مشاهده جزئیات',
    },
    en: {
      title: 'Booking Cancelled',
      message: 'Booking {{bookingId}} for {{stationName}} was cancelled. Reason: {{reason}}',
      actionLabel: 'View Details',
    },
  },
  GAME_CENTER_BOOKING_UPDATED: {
    fa: {
      title: 'به‌روزرسانی رزرو مرکز بازی',
      message: 'اطلاعات رزرو {{bookingId}} برای {{stationName}} به‌روزرسانی شد.',
      actionLabel: 'مشاهده جزئیات',
    },
    en: {
      title: 'Booking Updated',
      message: 'Booking {{bookingId}} for {{stationName}} has been updated.',
      actionLabel: 'View Details',
    },
  },
  GAME_CENTER_REVIEW_RECEIVED: {
    fa: {
      title: 'دیدگاه جدید ثبت شد',
      message: 'دیدگاه و امتیاز جدیدی ({{rating}} ستاره) برای مرکز بازی {{gameCenterName}} توسط {{customerName}} ثبت شد.',
      actionLabel: 'مشاهده دیدگاه',
    },
    en: {
      title: 'New Review Received',
      message: 'A new review ({{rating}} stars) was submitted for {{gameCenterName}} by {{customerName}}.',
      actionLabel: 'View Review',
    },
  },
  NEW_GAME_CENTER_REGISTRATION: {
    fa: {
      title: 'ثبت‌نام مرکز بازی جدید',
      message: 'مرکز بازی جدیدی با نام «{{gameCenterName}}» توسط «{{ownerName}}» ثبت شد و نیازمند بررسی است.',
      actionLabel: 'بررسی مرکز بازی',
    },
    en: {
      title: 'New GameCenter Registration',
      message: 'A new game center "{{gameCenterName}}" was registered by {{ownerName}} and is awaiting review.',
      actionLabel: 'Review GameCenter',
    },
  },
  NEW_TICKET_CREATED: {
    fa: {
      title: 'تیکت پشتیبانی جدید',
      message: 'یک تیکت پشتیبانی جدید ({{ticketCode}}) با موضوع «{{subject}}» ثبت شد.',
      actionLabel: 'مشاهده تیکت',
    },
    en: {
      title: 'New Ticket Created',
      message: 'A new support ticket ({{ticketCode}}) with subject "{{subject}}" was created.',
      actionLabel: 'View Ticket',
    },
  },
  NEW_USER_REPORT: {
    fa: {
      title: 'گزارش تخلف جدید',
      message: 'گزارش جدیدی در مورد «{{targetName}}» با دلیل «{{reason}}» ثبت شده است.',
      actionLabel: 'بررسی گزارش',
    },
    en: {
      title: 'New User Report',
      message: 'A new report was submitted regarding "{{targetName}}" with reason: {{reason}}.',
      actionLabel: 'Review Report',
    },
  },
  PAYMENT_FAILED: {
    fa: {
      title: 'خطا در پرداخت',
      message: 'تراکنش پرداخت به شناسه {{paymentId}} به مبلغ {{formattedAmount}} ناموفق بود. خطا: {{errorMessage}}',
      actionLabel: 'مشاهده تراکنش',
    },
    en: {
      title: 'Payment Failed',
      message: 'Payment transaction {{paymentId}} of {{formattedAmount}} failed. Error: {{errorMessage}}',
      actionLabel: 'View Transaction',
    },
  },
  REFUND_REQUESTED: {
    fa: {
      title: 'درخواست استرداد وجه',
      message: 'درخواست استرداد وجه برای پرداخت {{paymentId}} به مبلغ {{formattedAmount}} ثبت شد. علت: {{reason}}',
      actionLabel: 'بررسی استرداد',
    },
    en: {
      title: 'Refund Requested',
      message: 'Refund requested for payment {{paymentId}} of {{formattedAmount}}. Reason: {{reason}}',
      actionLabel: 'Review Refund',
    },
  },
  SYSTEM_ERROR: {
    fa: {
      title: 'خطای سیستمی',
      message: 'خطای سیستمی در بخش {{component}} رخ داده است: {{errorMessage}}',
      actionLabel: 'بررسی خطا',
    },
    en: {
      title: 'System Error',
      message: 'A system error occurred in component {{component}}: {{errorMessage}}',
      actionLabel: 'Inspect Error',
    },
  },
  DAILY_BOOKING_SUMMARY: {
    fa: {
      title: 'گزارش روزانه رزروها',
      message: 'خلاصه وضعیت رزروهای امروز: {{totalBookings}} رزرو به مبلغ کل {{formattedAmount}} ثبت شده است.',
      actionLabel: 'مشاهده گزارش',
    },
    en: {
      title: 'Daily Booking Summary',
      message: "Today's booking summary: {{totalBookings}} bookings totaling {{formattedAmount}} were recorded.",
      actionLabel: 'View Report',
    },
  },
};

/**
 * Renders localized notification content (title, message, optional description, actionLabel, direction)
 * for a given template key and recipient language preference (defaulting to Persian 'fa').
 */
export function renderLocalizedNotification(
  key: NotificationTemplateKey,
  params: TemplateParams = {},
  preferredLanguage?: string | null
): LocalizedNotificationContent {
  const language = resolveNotificationLanguage(preferredLanguage);
  const direction = getLanguageDirection(language);
  const entry = NOTIFICATION_TRANSLATIONS[key][language];

  return {
    language,
    direction,
    title: interpolate(entry.title, params),
    message: interpolate(entry.message, params),
    ...(entry.description ? { description: interpolate(entry.description, params) } : {}),
    ...(entry.actionLabel ? { actionLabel: interpolate(entry.actionLabel, params) } : {}),
  };
}
