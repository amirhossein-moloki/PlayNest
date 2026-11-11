export interface UpdateSettingsInput {
  timeZone?: string;
  timezone?: string;
  workStartTime?: string;
  workEndTime?: string;
  openingTime?: string;
  closingTime?: string;
  allowOnlineBooking?: boolean;
  onlineBookingAutoConfirm?: boolean;
  requireOtpForPublicBooking?: boolean;
  preventOverlaps?: boolean;
  maxAdvanceBookingDays?: number;
  minAdvanceBookingMinutes?: number;
  cancellationHours?: number;
  cancellationWindowMinutes?: number;
  depositRequirementPercentage?: number;
  noShowPenaltyAmount?: number;
  autoReleaseUnpaidMinutes?: number;
  reservationConfirmationTimeoutMinutes?: number;
}
