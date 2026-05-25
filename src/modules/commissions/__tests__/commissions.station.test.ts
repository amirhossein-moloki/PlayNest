import { commissionsService } from '../commissions.station';
import { CommissionsRepo } from '../commissions.repo';
import { CommissionStatus, CommissionPaymentStatus, SessionActorType, ReservationPaymentState, PaymentProvider, CommissionType, ReservationSource } from '@prisma/client';

jest.mock('../commissions.repo');
jest.mock('../../audit/audit.station');

describe('Commissions GameStation', () => {
  describe('payCommission', () => {
    const gamingCenterId = 'gamingCenter-1';
    const earningId = 'comm-1';
    const actor = { id: 'user-1', actorType: SessionActorType.USER };
    const input = {
      amount: 1000,
      currency: 'USD',
      status: CommissionPaymentStatus.PAID,
      method: 'CARD' as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should successfully record a commission payment and update commission status to CHARGED when fully paid', async () => {
      const mockCommission = {
        id: earningId,
        gamingCenterId,
        commissionAmount: 1000,
        status: CommissionStatus.PENDING,
        currency: 'USD',
      };

      (CommissionsRepo.findCommissionById as jest.Mock).mockResolvedValue(mockCommission);
      (CommissionsRepo.createCommissionPayment as jest.Mock).mockResolvedValue({ id: 'pay-1', ...input });
      (CommissionsRepo.findCommissionPayments as jest.Mock).mockResolvedValue([{ amount: 1000 }]);
      (CommissionsRepo.transaction as jest.Mock).mockImplementation((cb) => cb({}));

      const result = await commissionsService.payCommission(earningId, gamingCenterId, input, actor);

      expect(CommissionsRepo.createCommissionPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          earningId,
          amount: input.amount,
          status: CommissionPaymentStatus.PAID,
        }),
        expect.anything()
      );

      expect(CommissionsRepo.updateBookingCommission).toHaveBeenCalledWith(
        earningId,
        expect.objectContaining({ status: CommissionStatus.CHARGED }),
        expect.anything()
      );

      expect(result.id).toBe('pay-1');
    });

    it('should throw error if commission is not found', async () => {
      (CommissionsRepo.findCommissionById as jest.Mock).mockResolvedValue(null);
      (CommissionsRepo.transaction as jest.Mock).mockImplementation((cb) => cb({}));

      await expect(commissionsService.payCommission(earningId, gamingCenterId, input, actor))
        .rejects.toThrow('Commission record not found.');
    });

    it('should throw error if currency does not match commission currency', async () => {
      const mockCommission = {
        id: earningId,
        gamingCenterId,
        commissionAmount: 1000,
        status: CommissionStatus.PENDING,
        currency: 'EUR',
      };

      (CommissionsRepo.findCommissionById as jest.Mock).mockResolvedValue(mockCommission);
      (CommissionsRepo.transaction as jest.Mock).mockImplementation((cb) => cb({}));

      await expect(commissionsService.payCommission(earningId, gamingCenterId, input, actor))
        .rejects.toThrow('Currency mismatch. Commission is in EUR, but payment is in USD.');
    });
  });

  describe('calculateCommission', () => {
    const reservationId = 'reservation-1';
    const gamingCenterId = 'gamingCenter-1';

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should calculate and create a PENDING commission for an unpaid reservation', async () => {
      const mockBooking = {
        id: reservationId,
        gamingCenterId,
        totalPrice: 10000,
        (stationSnapshot as any): 'IRR',
        source: ReservationSource.ONLINE,
        paymentState: ReservationPaymentState.UNPAID,
        payments: [],
      };

      const mockPolicy = {
        id: 'policy-1',
        type: CommissionType.PERCENT,
        percentBps: 500, // 5%
        isActive: true,
        applyToOnlineOnly: true,
      };

      (CommissionsRepo.findBookingForCommission as jest.Mock).mockResolvedValue(mockBooking);
      (CommissionsRepo.findPolicyBySalonId as jest.Mock).mockResolvedValue(mockPolicy);
      (CommissionsRepo.createBookingCommission as jest.Mock).mockResolvedValue({ id: 'comm-1', commissionAmount: 500 });
      (CommissionsRepo.transaction as jest.Mock).mockImplementation((cb) => cb({}));

      await commissionsService.calculateCommission(reservationId);

      expect(CommissionsRepo.createBookingCommission).toHaveBeenCalledWith(
        expect.objectContaining({
          status: CommissionStatus.PENDING,
          commissionAmount: 500,
        }),
        expect.anything()
      );
      expect(CommissionsRepo.createCommissionPayment).not.toHaveBeenCalled();
    });

    it('should calculate and create a CHARGED commission for a PAID online reservation', async () => {
      const mockBooking = {
        id: reservationId,
        gamingCenterId,
        totalPrice: 10000,
        (stationSnapshot as any): 'IRR',
        source: ReservationSource.ONLINE,
        paymentState: ReservationPaymentState.PAID,
        payments: [{ provider: PaymentProvider.ZARINPAL, status: 'PAID' }],
      };

      const mockPolicy = {
        id: 'policy-1',
        type: CommissionType.PERCENT,
        percentBps: 500, // 5%
        isActive: true,
        applyToOnlineOnly: true,
      };

      (CommissionsRepo.findBookingForCommission as jest.Mock).mockResolvedValue(mockBooking);
      (CommissionsRepo.findPolicyBySalonId as jest.Mock).mockResolvedValue(mockPolicy);
      (CommissionsRepo.createBookingCommission as jest.Mock).mockResolvedValue({ id: 'comm-1', commissionAmount: 500 });
      (CommissionsRepo.transaction as jest.Mock).mockImplementation((cb) => cb({}));

      await commissionsService.calculateCommission(reservationId);

      expect(CommissionsRepo.createBookingCommission).toHaveBeenCalledWith(
        expect.objectContaining({
          status: CommissionStatus.CHARGED,
          commissionAmount: 500,
        }),
        expect.anything()
      );

      expect(CommissionsRepo.createCommissionPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 500,
          status: CommissionPaymentStatus.PAID,
        }),
        expect.anything()
      );
    });

    it('should NOT calculate commission for WALK_IN reservations', async () => {
      const mockBooking = {
        id: reservationId,
        gamingCenterId,
        totalPrice: 10000,
        (stationSnapshot as any): 'IRR',
        source: ReservationSource.WALK_IN,
        paymentState: ReservationPaymentState.UNPAID,
        payments: [],
      };

      const mockPolicy = {
        id: 'policy-1',
        type: CommissionType.PERCENT,
        percentBps: 500,
        isActive: true,
        applyToOnlineOnly: true,
      };

      (CommissionsRepo.findBookingForCommission as jest.Mock).mockResolvedValue(mockBooking);
      (CommissionsRepo.findPolicyBySalonId as jest.Mock).mockResolvedValue(mockPolicy);
      (CommissionsRepo.transaction as jest.Mock).mockImplementation((cb) => cb({}));

      const result = await commissionsService.calculateCommission(reservationId);

      expect(result).toBeNull();
      expect(CommissionsRepo.createBookingCommission).not.toHaveBeenCalled();
    });
  });
});
