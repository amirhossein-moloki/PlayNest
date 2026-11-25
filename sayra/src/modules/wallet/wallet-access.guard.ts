import { SessionActorType } from '@prisma/client';
import httpStatus from 'http-status';
import AppError from '../../common/errors/AppError';
import { RequestActor } from '../../types/express';

/**
 * Ensures only the authenticated CUSTOMER owner may spend or preview a CustomerAccount wallet balance.
 * Rejects unauthenticated callers, tenant USER actors, PLATFORM_ADMIN actors, and cross-customer access.
 */
export function assertCustomerOwnsWallet(
  actor: RequestActor | { id?: string; actorType?: SessionActorType | string } | undefined | null,
  customerAccountId: string | null | undefined
): void {
  if (!actor || actor.actorType !== SessionActorType.CUSTOMER) {
    throw new AppError(
      'Customer authentication as the wallet owner is required to use wallet balance.',
      httpStatus.FORBIDDEN,
      { code: 'UNAUTHORIZED_WALLET_ACCESS' }
    );
  }

  if (!customerAccountId || actor.id !== customerAccountId) {
    throw new AppError('You can only use your own wallet balance.', httpStatus.FORBIDDEN, {
      code: 'UNAUTHORIZED_WALLET_ACCESS',
    });
  }
}

/**
 * Returns the spendable wallet balance excluding funds reserved for pending withdrawals.
 */
export function getAvailableWalletBalance(
  account: { walletBalance?: number | null; reservedBalance?: number | null } | null | undefined
): number {
  const total = account?.walletBalance ?? 0;
  const reserved = account?.reservedBalance ?? 0;
  return Math.max(0, total - reserved);
}
