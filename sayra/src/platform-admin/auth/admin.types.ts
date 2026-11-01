export interface PlatformAdminUserContext {
  id: string;
  email: string | null;
  phone: string;
  fullName: string;
  isSuperuser: boolean;
  avatarUrl?: string;
  title?: string;
}

declare module 'express-session' {
  interface SessionData {
    adminUser?: PlatformAdminUserContext;
  }
}
