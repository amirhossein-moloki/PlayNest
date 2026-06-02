
import { SessionActorType, UserRole } from '@prisma/client';
import { Request } from 'express';
import { ApiMeta } from '../common/utils/response';

declare global {
  /* eslint-disable @typescript-eslint/no-namespace */
  namespace Express {
    export interface Request {
      actor?: {
        id: string;
        actorId?: string;
        role?: UserRole;
        gamingCenterId?: string;
        actorType: SessionActorType;
      };
      gamingCenterId?: string;
      id?: string;
      requestId?: string;
      rawBody?: Buffer;
      tenant?: {
        gamingCenterId: string;
        gamingCenterSlug?: string;
        gamingCenterSlug?: string
      };
      gamingCenterSlug?: string;
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
  actor: {
    id: string;
    actorId?: string;
    role?: UserRole;
    gamingCenterId?: string;
    actorType: SessionActorType;
  };
  tenant: {
    gamingCenterId: string;
    gamingCenterSlug?: string;
    gamingCenterSlug?: string;
  };
  gamingCenterId?: string;
  id?: string;
}
