import { randomInt } from 'crypto';
import { Prisma, PrismaClient, ReservationStatus } from '@prisma/client';

const ACTIVE_CHECKIN_STATUSES: ReservationStatus[] = [
  ReservationStatus.PENDING,
  ReservationStatus.CONFIRMED,
  ReservationStatus.IN_PROGRESS,
];

/**
 * Generates a unique 5-digit numeric check-in code for a reservation within a gaming center.
 */
export async function generateUniqueCheckInCode(
  gamingCenterId: string,
  client: Prisma.TransactionClient | PrismaClient,
  maxAttempts = 10
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = randomInt(10000, 100000).toString();
    const existing = await client.reservation.findFirst({
      where: {
        gamingCenterId,
        checkInCode: code,
        status: { in: ACTIVE_CHECKIN_STATUSES },
      },
      select: { id: true },
    });

    if (!existing) {
      return code;
    }
  }

  // Fallback to a fresh 5-digit code if all attempts collided
  return randomInt(10000, 100000).toString();
}
