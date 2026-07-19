export interface UpdateSettingsInput {
  timeZone?: string;
  workStartTime?: string;
  workEndTime?: string;
  allowOnlineBooking?: boolean;
  onlineBookingAutoConfirm?: boolean;
  requireOtpForPublicBooking?: boolean;
  preventOverlaps?: boolean;
}
