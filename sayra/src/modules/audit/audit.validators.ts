
import { z } from 'zod';

export const listAuditLogsSchema = z.object({
  query: z.object({
    page: z.preprocess((val) => Number(val), z.number().int().min(1).default(1)),
    pageSize: z.preprocess((val) => Number(val), z.number().int().min(1).max(100).default(20)),
    action: z.string().optional(),
    entity: z.string().optional(),
    entityId: z.string().optional(),
    actorId: z.string().optional(),
  }),
});

export type ListAuditLogsQuery = z.infer<typeof listAuditLogsSchema>['query'];
