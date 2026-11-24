export const PLATFORM_ADMIN_AUDIT_ACTIONS = {
  ADMIN_LOGIN_SUCCESS: 'ADMIN_LOGIN_SUCCESS',
  ADMIN_LOGIN_FAILED: 'ADMIN_LOGIN_FAILED',
  TOTP_SETUP_STARTED: 'TOTP_SETUP_STARTED',
  TOTP_SETUP_COMPLETED: 'TOTP_SETUP_COMPLETED',
  TOTP_VERIFICATION_FAILED: 'TOTP_VERIFICATION_FAILED',
  RECOVERY_CODE_USED: 'RECOVERY_CODE_USED',
  RECOVERY_CODES_REGENERATED: 'RECOVERY_CODES_REGENERATED',
  AUTHENTICATOR_REPLACED: 'AUTHENTICATOR_REPLACED',
  AUTHENTICATOR_REMOVED: 'AUTHENTICATOR_REMOVED',
  TOTP_DISABLED: 'TOTP_DISABLED',
  ADMIN_SESSION_REVOKED: 'ADMIN_SESSION_REVOKED',
  ADMIN_2FA_EMERGENCY_RESET: 'ADMIN_2FA_EMERGENCY_RESET',
} as const;

export const PLATFORM_ADMIN_REFRESH_COOKIE_NAME = 'playnest_admin_refresh';

export const MAX_FAILED_LOGIN_ATTEMPTS = 5;
export const MAX_FAILED_TOTP_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
export const PENDING_DEVICE_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const DEFAULT_ADMIN_REFRESH_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

export interface SafePlatformAdminDto {
  id: string;
  username: string | null;
  fullName: string;
  phone: string | null;
  email: string | null;
  isActive: boolean;
  isSuperuser: boolean;
  totpEnabled: boolean;
  totpSetupCompleted: boolean;
  totpEnabledAt: Date | null;
  totpLastUsedAt: Date | null;
  lastLogin: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SafeAuthenticatorDeviceDto {
  id: string;
  label: string;
  issuer: string;
  status: string;
  isPrimary: boolean;
  verifiedAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
}

export function sanitizePlatformAdmin(admin: Record<string, unknown>): SafePlatformAdminDto {
  return {
    id: String(admin.id),
    username: typeof admin.username === 'string' ? admin.username : null,
    fullName: String(admin.fullName || ''),
    phone: typeof admin.phone === 'string' ? admin.phone : null,
    email: typeof admin.email === 'string' ? admin.email : null,
    isActive: Boolean(admin.isActive),
    isSuperuser: Boolean(admin.isSuperuser),
    totpEnabled: Boolean(admin.totpEnabled),
    totpSetupCompleted: Boolean(admin.totpSetupCompleted),
    totpEnabledAt: (admin.totpEnabledAt as Date | null | undefined) ?? null,
    totpLastUsedAt: (admin.totpLastUsedAt as Date | null | undefined) ?? null,
    lastLogin: (admin.lastLogin as Date | null | undefined) ?? null,
    createdAt: admin.createdAt as Date,
    updatedAt: admin.updatedAt as Date,
  };
}

export function sanitizeAuthenticatorDevice(
  device: Record<string, unknown>
): SafeAuthenticatorDeviceDto {
  return {
    id: String(device.id),
    label: String(device.label || 'Authenticator App'),
    issuer: String(device.issuer || 'PlayNest'),
    status: String(device.status || 'PENDING'),
    isPrimary: Boolean(device.isPrimary),
    verifiedAt: (device.verifiedAt as Date | null | undefined) ?? null,
    lastUsedAt: (device.lastUsedAt as Date | null | undefined) ?? null,
    createdAt: device.createdAt as Date,
  };
}
