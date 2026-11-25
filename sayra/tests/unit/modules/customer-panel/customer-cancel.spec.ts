import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ReservationStatus } from '@prisma/client';
import { CustomerPanelStation } from '../../../../src/modules/customer-panel/customer-panel.station';
import { CustomerPanelRepo } from '../../../../src/modules/customer-panel/customer-panel.repo';
import { ReservationRepo } from '../../../../src/modules/reservation/reservation.repo';
import { discountsStation } from '../../../../src/modules/discounts/discounts.station';
import { walletService } from '../../../../src/modules/wallet/wallet.station';
import { commissionsStation } from '../../../../src/modules/commissions/commissions.station';
import * as publicCache from '../../../../src/common/utils/publicCache';

jest.mock('../../../../src/modules/customer-panel/customer-panel.repo');
jest.mock('../../../../src/modules/reservation/reservation.repo');
jest.mock('../../../../src/modules/discounts/discounts.station');
jest.mock('../../../../src/modules/wallet/wallet.station');
jest.mock('../../../../src/modules/commissions/commissions.station');
jest.mock('../../../../src/modules/audit/audit.station');
jest.mock('../../../../src/modules/analytics/analytics.repo', () => ({
  AnalyticsRepo: {
    syncAllStatsForReservation: jest.fn().mockResolvedValue(undefined as never),
  },
}));

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('CustomerPanelStation.cancelReservation', () => {
  const mockedRepo = CustomerPanelRepo as jest.Mocked<typeof CustomerPanelRepo>;
  const mockedResRepo = ReservationRepo as jest.Mocked<typeof ReservationRepo>;
  const mockedDiscounts = discountsStation as jest.Mocked<typeof discountsStation>;
  const mockedWallet = walletService as jest.Mocked<typeof walletService>;
  const mockedCommissions = commissionsStation as jest.Mocked<typeof commissionsStation>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedRepo.transaction.mockImplementation(async (cb: any) => cb({}));
    mockedResRepo.createHistory.mockResolvedValue({} as any);
    mockedResRepo.cancelPendingProposals.mockResolvedValue({ count: 0 } as any);
    mockedDiscounts.releaseDiscountForReservation.mockResolvedValue(undefined as any);
    mockedWallet.refundReservationToWallet.mockResolvedValue(undefined as any);
    mockedCommissions.reverseCommissionForReservation.mockResolvedValue(undefined as any);
  });

  it('releases campaign/discount, cancels pending proposals, and invalidates availability cache', async () => {
    const cacheSpy = jest.spyOn(publicCache, 'invalidatePublicCacheByPrefix').mockResolvedValue(undefined);
    const futureStart = new Date(Date.now() + 2 * 60 * 60 * 1000);

    mockedRepo.findReservationById.mockResolvedValue({
      id: 'res-1',
      gamingCenterId: 'gc-1',
      customerAccountId: 'cust-1',
      status: ReservationStatus.CONFIRMED,
      startTime: futureStart,
      campaignId: 'camp-1',
      discountId: null,
      gamingCenter: { id: 'gc-1', settings: { cancellationWindowMinutes: 15 } },
      customerAccount: { id: 'cust-1' },
    } as any);

    mockedRepo.updateReservation.mockResolvedValue({
      id: 'res-1',
      status: ReservationStatus.CANCELED,
    } as any);

    const result = await CustomerPanelStation.cancelReservation('res-1', 'cust-1', 'Changed my mind');

    expect(result.status).toBe(ReservationStatus.CANCELED);
    expect(mockedResRepo.cancelPendingProposals).toHaveBeenCalledWith('res-1', expect.anything());
    expect(mockedDiscounts.releaseDiscountForReservation).toHaveBeenCalledWith(
      'res-1',
      'Changed my mind',
      expect.anything()
    );
    expect(mockedWallet.refundReservationToWallet).toHaveBeenCalledWith('res-1', expect.anything());
    expect(mockedCommissions.reverseCommissionForReservation).toHaveBeenCalled();
    expect(cacheSpy).toHaveBeenCalledWith('public:avail:gc-1:');
    cacheSpy.mockRestore();
  });

  it('blocks customer from canceling an IN_PROGRESS reservation', async () => {
    const futureStart = new Date(Date.now() + 60 * 60 * 1000);
    mockedRepo.findReservationById.mockResolvedValue({
      id: 'res-2',
      gamingCenterId: 'gc-1',
      customerAccountId: 'cust-1',
      status: ReservationStatus.IN_PROGRESS,
      startTime: futureStart,
      gamingCenter: { id: 'gc-1', settings: { cancellationWindowMinutes: 0 } },
    } as any);

    await expect(
      CustomerPanelStation.cancelReservation('res-2', 'cust-1', 'Want to cancel')
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('rejects cancellation past the cancellation deadline', async () => {
    const soonStart = new Date(Date.now() + 5 * 60 * 1000); // 5 mins from now
    mockedRepo.findReservationById.mockResolvedValue({
      id: 'res-3',
      gamingCenterId: 'gc-1',
      customerAccountId: 'cust-1',
      status: ReservationStatus.CONFIRMED,
      startTime: soonStart,
      gamingCenter: { id: 'gc-1', settings: { cancellationWindowMinutes: 30 } },
    } as any);

    await expect(
      CustomerPanelStation.cancelReservation('res-3', 'cust-1')
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});
