import { z } from 'zod';

export const MAX_TEMPORARY_CLOSURE_HOURS = 168;
export const MAX_TEMPORARY_CLOSURE_MINUTES = MAX_TEMPORARY_CLOSURE_HOURS * 60;

const parseBoolean = (val: unknown) => {
  if (typeof val === 'string') {
    if (val.toLowerCase() === 'true') return true;
    if (val.toLowerCase() === 'false') return false;
  }
  return val;
};

export interface ClosureDurationFields {
  hours?: number;
  durationHours?: number;
  minutes?: number;
  durationMinutes?: number;
}

export const resolveClosureDurationMinutes = (data: ClosureDurationFields): number | null => {
  const resolvedHours = data.hours ?? data.durationHours;
  const resolvedMinutes = data.minutes ?? data.durationMinutes;

  if (resolvedHours === undefined && resolvedMinutes === undefined) {
    return null;
  }

  return Math.round((resolvedHours ?? 0) * 60) + (resolvedMinutes ?? 0);
};

const validateDurationFields = (data: ClosureDurationFields, ctx: z.RefinementCtx): void => {
  if (data.hours !== undefined && data.durationHours !== undefined && data.hours !== data.durationHours) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'hours and durationHours cannot have different values',
      path: ['durationHours'],
    });
  }

  if (data.minutes !== undefined && data.durationMinutes !== undefined && data.minutes !== data.durationMinutes) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'minutes and durationMinutes cannot have different values',
      path: ['durationMinutes'],
    });
  }

  const totalMinutes = resolveClosureDurationMinutes(data);
  if (totalMinutes === null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Duration must be provided using hours, durationHours, minutes, or durationMinutes.',
      path: ['hours'],
    });
    return;
  }

  if (!Number.isFinite(totalMinutes) || totalMinutes < 1 || totalMinutes > MAX_TEMPORARY_CLOSURE_MINUTES) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Temporary closure duration must be between 1 minute and ${MAX_TEMPORARY_CLOSURE_HOURS} hours (${MAX_TEMPORARY_CLOSURE_MINUTES} minutes).`,
      path: ['hours'],
    });
  }
};

const durationFieldsShape = {
  hours: z.number().finite().positive().max(MAX_TEMPORARY_CLOSURE_HOURS).optional(),
  durationHours: z.number().finite().positive().max(MAX_TEMPORARY_CLOSURE_HOURS).optional(),
  minutes: z.number().int().min(1).max(MAX_TEMPORARY_CLOSURE_MINUTES).optional(),
  durationMinutes: z.number().int().min(1).max(MAX_TEMPORARY_CLOSURE_MINUTES).optional(),
};

export const closeForNextHoursSchema = z.object({
  body: z.object({
    ...durationFieldsShape,
    title: z.string().max(200).optional(),
    reason: z.string().max(500).optional(),
    replaceActive: z.boolean().optional().default(false),
  }).superRefine((data, ctx) => {
    validateDurationFields(data, ctx);
  }),
  params: z.object({
    gamingCenterId: z.string().min(1, 'gamingCenterId is required'),
  }),
});

export const createClosureSchema = z.object({
  body: z.object({
    title: z.string().max(200).optional(),
    reason: z.string().max(500).optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    ...durationFieldsShape,
    replaceActive: z.boolean().optional().default(false),
  }).superRefine((data, ctx) => {
    const hasDuration =
      data.hours !== undefined ||
      data.durationHours !== undefined ||
      data.minutes !== undefined ||
      data.durationMinutes !== undefined;

    if (data.endDate !== undefined && hasDuration) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide either endDate or a duration (hours/durationHours/durationMinutes), not both.',
        path: ['endDate'],
      });
      return;
    }

    if (data.endDate !== undefined) {
      if (!data.startDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'startDate is required when endDate is provided.',
          path: ['startDate'],
        });
        return;
      }

      if (!(new Date(data.startDate) < new Date(data.endDate))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'startDate must be strictly before endDate',
          path: ['endDate'],
        });
      }
      return;
    }

    if (hasDuration) {
      validateDurationFields(data, ctx);
      return;
    }

    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Either startDate and endDate, or a duration (hours/durationHours/durationMinutes) must be provided.',
      path: ['endDate'],
    });
  }),
  params: z.object({
    gamingCenterId: z.string().min(1, 'gamingCenterId is required'),
  }),
});

const closureListQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  activeOnly: z.preprocess(parseBoolean, z.boolean().optional()),
  upcomingOnly: z.preprocess(parseBoolean, z.boolean().optional()),
}).optional();

export const getClosuresSchema = z.object({
  params: z.object({
    gamingCenterId: z.string().min(1, 'gamingCenterId is required'),
  }),
  query: closureListQuerySchema,
});

export const getPublicClosuresSchema = z.object({
  params: z.object({
    gamingCenterSlug: z.string().min(1, 'gamingCenterSlug is required'),
  }),
  query: closureListQuerySchema,
});

export const gamingCenterIdParamSchema = z.object({
  params: z.object({
    gamingCenterId: z.string().min(1, 'gamingCenterId is required'),
  }),
});

export const publicGamingCenterSlugParamSchema = z.object({
  params: z.object({
    gamingCenterSlug: z.string().min(1, 'gamingCenterSlug is required'),
  }),
});

export const deleteClosureSchema = z.object({
  params: z.object({
    gamingCenterId: z.string().min(1, 'gamingCenterId is required'),
    closureId: z.string().min(1, 'closureId is required'),
  }),
});

export type CreateClosureInput = z.input<typeof createClosureSchema>['body'];
export type CloseForNextHoursInput = z.input<typeof closeForNextHoursSchema>['body'];
export type GetClosuresQuery = z.infer<typeof getClosuresSchema>['query'];

export interface ClosureWindowCandidate {
  id: string;
  title?: string | null;
  reason?: string | null;
  startDate: Date | string;
  endDate: Date | string;
}

export interface ActiveClosureSummary {
  id: string;
  title: string | null;
  reason: string | null;
  startDate: string;
  endDate: string;
}

export interface TemporaryClosureStatusMeta {
  isBookingTemporarilyClosed: boolean;
  bookingClosedUntil: string | null;
  activeClosure: ActiveClosureSummary | null;
}

/**
 * Resolves the furthest-ending currently active temporary closure and metadata flags.
 */
export const resolveActiveClosureSummary = (
  closures?: ClosureWindowCandidate[] | null,
  now: Date = new Date()
): TemporaryClosureStatusMeta => {
  const closureList = Array.isArray(closures) ? closures : [];
  const activeClosures = closureList
    .filter((c) => new Date(c.startDate) <= now && new Date(c.endDate) > now)
    .sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime());
  const primary = activeClosures[0] || null;
  const activeClosure = primary
    ? {
      id: primary.id,
      title: primary.title ?? null,
      reason: primary.reason ?? null,
      startDate: new Date(primary.startDate).toISOString(),
      endDate: new Date(primary.endDate).toISOString(),
    }
    : null;

  return {
    isBookingTemporarilyClosed: Boolean(activeClosure),
    bookingClosedUntil: activeClosure ? activeClosure.endDate : null,
    activeClosure,
  };
};
