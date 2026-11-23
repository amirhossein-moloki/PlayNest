/**
 * Detects PostgreSQL exclusion constraint violations (SQLSTATE 23P01) on
 * Reservation_no_overlap_active, including when wrapped inside Prisma's
 * PrismaClientUnknownRequestError (where err.code is undefined and the SQLSTATE
 * and constraint name appear in err.message or err.meta?.code).
 */
export function isReservationOverlapDbError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const record = err as {
    code?: unknown;
    message?: unknown;
    meta?: { code?: unknown; message?: unknown };
  };
  const message = typeof record.message === 'string' ? record.message : '';
  const metaCode = record.meta?.code;
  const metaMessage = typeof record.meta?.message === 'string' ? record.meta.message : '';

  const hasOverlapConstraint =
    message.includes('Reservation_no_overlap_active') ||
    metaMessage.includes('Reservation_no_overlap_active');

  if (record.code === '23P01' || metaCode === '23P01') {
    return true;
  }

  if (hasOverlapConstraint) {
    return true;
  }

  return message.includes('23P01') && message.toLowerCase().includes('exclusion');
}
