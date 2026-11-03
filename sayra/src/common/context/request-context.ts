import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  requestId?: string;
  correlationId?: string;
  actorId?: string;
  gamingCenterId?: string;
  /**
   * Explicit flag indicating authorized system-level background execution.
   * Can only be set internally by trusted background workers/cron routines.
   * HTTP request middleware must never populate this flag from user input.
   */
  isSystemContext?: boolean;
  /**
   * Descriptive job or worker name running under system privileges.
   */
  systemJobName?: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext {
  return requestContext.getStore() || {};
}

/**
 * Runs an asynchronous operation within an authorized internal system context.
 * Useful for global periodic cleanup workers (e.g. reservation holds expiry, waitlist expiry)
 * which legitimately operate across all tenants with audit logging.
 */
export function runWithSystemContext<T>(jobName: string, fn: () => Promise<T>): Promise<T> {
  const correlationId = `sys-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  return requestContext.run(
    {
      isSystemContext: true,
      systemJobName: jobName,
      correlationId,
      requestId: correlationId,
    },
    fn
  );
}
