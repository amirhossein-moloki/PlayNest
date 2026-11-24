export interface PlatformAdminUserContext {
  id: string;
  username?: string | null;
  email: string | null;
  phone: string | null;
  fullName: string;
  isSuperuser: boolean;
  mfaVerified: boolean;
  sessionId?: string;
  avatarUrl?: string;
  title?: string;
}

declare module 'express-session' {
  interface SessionData {
    adminUser?: PlatformAdminUserContext;
  }
}
