
import { SessionActorType, UserRole } from '@prisma/client';
import { Request } from 'express';
import { ApiMeta } from '../common/utils/response';

export interface RequestActor {
  id: string;
  actorId?: string;
  role?: UserRole;
  gamingCenterId?: string;
  actorType: SessionActorType;
  sessionId?: string;
}

export interface RequestTenant {
  gamingCenterId: string;
  gamingCenterSlug?: string;
}

declare global {
  /* eslint-disable @typescript-eslint/no-namespace */
  namespace Express {
    export interface Request {
      actor?: RequestActor;
      gamingCenterId?: string;
      id?: string;
      requestId?: string;
      rawBody?: Buffer;
      tenant?: RequestTenant;
      gamingCenterSlug?: string;
    }

    export interface Response {
      ok<T>(data: T, meta?: Omit<ApiMeta, 'requestId'>): Response;
      created<T>(data: T, meta?: Omit<ApiMeta, 'requestId'>): Response;
      noContent(): Response;
      fail(
        code: string,
        message: string,
        status?: number,
        details?: unknown,
        meta?: Omit<ApiMeta, 'requestId'>
      ): Response;
    }
  }
}

export interface AppRequest extends Request {
  actor: RequestActor;
  tenant: RequestTenant;
  gamingCenterId?: string;
  id?: string;
}
