import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { WaitlistStatus, WaitlistOfferStatus, SessionActorType, NotificationType } from '@prisma/client';
import { waitlistStation } from '../../../../src/modules/waitlist/waitlist.station';
import { WaitlistRepo } from '../../../../src/modules/waitlist/waitlist.repo';
import { ReservationRepo } from '../../../../src/modules/reservation/reservation.repo';
import { discountsStation } from '../../../../src/modules/discounts/discounts.station';
import { NotificationStation } from '../../../../src/modules/notifications/notifications.station';
import AppError from '../../../../src/common/errors/AppError';

jest.mock('../../../../src/modules/waitlist/waitlist.repo');
jest.mock('../../../../src/modules/reservation/reservation.repo');
jest.mock('../../../../src/modules/discounts/discounts.station');
jest.mock('../../../../src/modules/notifications/notifications.station');
jest.mock('../../../../src/modules/audit/audit.station');

const MockedWaitlistRepo = WaitlistRepo as jest.Mocked<typeof WaitlistRepo>;
const MockedReservationRepo = ReservationRepo as jest.Mocked<typeof ReservationRepo>;
const MockedDiscountsStation = discountsStation as jest.Mocked<typeof discountsStation>;

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('Waitlist Unit Tests', () => {
  const gamingCenterId = 'gc-100';
  const stationId = 'st-200';
  const customerAccountId = 'cust-acc-1';
  const customerProfileId = 'cust-prof-1';
  const now = new Date('2026-12-10T10:00:00.000Z');
  const startTime = new Date('2026-12-10T14:00:00.000Z');
  const endTime = new Date('2026-12-10T15:00:00.000Z');

  beforeEach(() => {
    jest.clearAllMocks();
    MockedWaitlistRepo.transaction.mockImplementation(async (fn: any) => fn({}));
  });

  describe('createEntry', () => {
    it('should throw NOT_FOUND if station does not exist or is inactive', async () => {
      MockedReservationRepo.findStation.mockResolvedValue(null);

      await expect(
        waitlistStation.createEntry(gamingCenterId, {
          stationId,
          startTime,
          endTime,
          customer: { fullName: 'John', phone: '09123456789' },
        })
      ).rejects.toThrow(AppError);
    });

    it('should throw BAD_REQUEST if slot is currently available (waitlist is only for unavailable slots)', async () => {
      MockedReservationRepo.findStation.mockResolvedValue({ id: stationId, name: 'Station 1' } as any);
      MockedReservationRepo.findGamingCenterWithSettings.mockResolvedValue({
        id: gamingCenterId,
        settings: { minAdvanceBookingMinutes: 30 },
      } as any);
      MockedReservationRepo.findOverlappingMaintenance.mockResolvedValue([]);
      MockedReservationRepo.findOverlappingReservation.mockResolvedValue(null); // Available!

      await expect(
        waitlistStation.createEntry(gamingCenterId, {
          stationId,
          startTime,
          endTime,
          customer: { fullName: 'John', phone: '09123456789' },
        })
      ).rejects.toThrow('The requested time slot is currently available for direct booking.');
    });

    it('should throw CONFLICT if customer already has an active waitlist entry for the slot', async () => {
      MockedReservationRepo.findStation.mockResolvedValue({ id: stationId, name: 'Station 1' } as any);
      MockedReservationRepo.findGamingCenterWithSettings.mockResolvedValue({
        id: gamingCenterId,
        settings: { minAdvanceBookingMinutes: 30 },
      } as any);
      MockedReservationRepo.findOverlappingMaintenance.mockResolvedValue([]);
      MockedReservationRepo.findOverlappingReservation.mockResolvedValue({ id: 'res-overlap' } as any); // Slot unavailable
      MockedReservationRepo.findCustomerAccountByPhone.mockResolvedValue({ id: customerAccountId } as any);
      MockedReservationRepo.findCustomerProfile.mockResolvedValue({ id: customerProfileId } as any);
      MockedWaitlistRepo.findActiveWaitlistEntryForCustomer.mockResolvedValue({ id: 'existing-entry' } as any);

      await expect(
        waitlistStation.createEntry(gamingCenterId, {
          stationId,
          startTime,
          endTime,
          customer: { fullName: 'John', phone: '09123456789' },
        })
      ).rejects.toThrow('You already have an active waitlist entry for this station and time slot.');
    });

    it('should successfully create an active waitlist entry when slot is unavailable', async () => {
      MockedReservationRepo.findStation.mockResolvedValue({ id: stationId, name: 'Station 1' } as any);
      MockedReservationRepo.findGamingCenterWithSettings.mockResolvedValue({
        id: gamingCenterId,
        settings: { minAdvanceBookingMinutes: 30 },
      } as any);
      MockedReservationRepo.findOverlappingMaintenance.mockResolvedValue([]);
      MockedReservationRepo.findOverlappingReservation.mockResolvedValue({ id: 'res-overlap' } as any);
      MockedReservationRepo.findCustomerAccountByPhone.mockResolvedValue({ id: customerAccountId } as any);
      MockedReservationRepo.findCustomerProfile.mockResolvedValue({ id: customerProfileId } as any);
      MockedWaitlistRepo.findActiveWaitlistEntryForCustomer.mockResolvedValue(null);

      const createdEntry = {
        id: 'entry-101',
        gamingCenterId,
        customerAccountId,
        customerProfileId,
        stationId,
        startTime,
        endTime,
        status: WaitlistStatus.ACTIVE,
      };

      MockedWaitlistRepo.createWaitlistEntry.mockResolvedValue(createdEntry as any);

      const result = await waitlistStation.createEntry(gamingCenterId, {
        stationId,
        startTime,
        endTime,
        customer: { fullName: 'John', phone: '09123456789' },
      });

      expect(result).toEqual(createdEntry);
      expect(MockedWaitlistRepo.createWaitlistEntry).toHaveBeenCalled();
    });
  });

  describe('processAvailableSlot & Matching', () => {
    it('should create a WaitlistOffer for the oldest candidate (FIFO) and notify them', async () => {
      const candidate1 = {
        id: 'entry-1',
        customerAccountId,
        customerProfileId,
        stationId,
        startTime,
        endTime,
        status: WaitlistStatus.ACTIVE,
        createdAt: new Date('2026-12-10T08:00:00.000Z'),
      };

      MockedWaitlistRepo.findActiveWaitlistEntriesForMatching.mockResolvedValue([candidate1 as any]);
      MockedReservationRepo.findStation.mockResolvedValue({ id: stationId, name: 'PC Station 1' } as any);
      MockedWaitlistRepo.lockWaitlistEntryForUpdate.mockResolvedValue({ id: 'entry-1' });
      MockedWaitlistRepo.findPendingOfferForEntry.mockResolvedValue(null);
      MockedReservationRepo.findOverlappingReservation.mockResolvedValue(null); // Available now!
      MockedReservationRepo.findOverlappingMaintenance.mockResolvedValue([]);

      const createdOffer = {
        id: 'offer-1',
        waitlistEntryId: 'entry-1',
        gamingCenterId,
        stationId,
        offeredStartTime: startTime,
        offeredEndTime: endTime,
        status: WaitlistOfferStatus.PENDING,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      };

      MockedWaitlistRepo.createWaitlistOffer.mockResolvedValue(createdOffer as any);
      MockedReservationRepo.findCustomerAccountById.mockResolvedValue({ id: customerAccountId, phone: '09123456789' } as any);

      const offer = await waitlistStation.processAvailableSlot(gamingCenterId, stationId, startTime, endTime);

      expect(offer).toEqual(createdOffer);
      expect(MockedWaitlistRepo.updateWaitlistEntry).toHaveBeenCalledWith('entry-1', { status: WaitlistStatus.OFFERED }, expect.anything());
      expect(NotificationStation.notifyUser).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: customerAccountId,
          type: NotificationType.WAITLIST_OFFER_CREATED,
        })
      );
    });
  });

  describe('acceptOffer', () => {
    it('should throw BAD_REQUEST if offer is expired synchronous check', async () => {
      const expiredOffer = {
        id: 'offer-exp',
        waitlistEntryId: 'entry-1',
        gamingCenterId,
        stationId,
        offeredStartTime: new Date(Date.now() + 3600000),
        offeredEndTime: new Date(Date.now() + 7200000),
        status: WaitlistOfferStatus.PENDING,
        expiresAt: new Date(Date.now() - 10000), // Past relative to Date.now()
        waitlistEntry: {
          customerAccountId,
          customerProfileId,
          startTime: new Date(Date.now() + 3600000),
        },
      };

      MockedWaitlistRepo.lockWaitlistOfferForUpdate.mockResolvedValue({ id: 'offer-exp' });
      MockedWaitlistRepo.findWaitlistOfferById.mockResolvedValue(expiredOffer as any);

      await expect(
        waitlistStation.acceptOffer('offer-exp', gamingCenterId, {
          id: customerAccountId,
          actorType: SessionActorType.CUSTOMER,
          customerAccountId,
        })
      ).rejects.toThrow('Waitlist offer has expired.');

      expect(MockedWaitlistRepo.updateWaitlistOffer).toHaveBeenCalledWith('offer-exp', { status: WaitlistOfferStatus.EXPIRED }, expect.anything());
    });

    it('should convert valid offer to confirmed reservation with dynamic discount', async () => {
      const validOffer = {
        id: 'offer-valid',
        waitlistEntryId: 'entry-1',
        gamingCenterId,
        stationId,
        offeredStartTime: startTime,
        offeredEndTime: endTime,
        status: WaitlistOfferStatus.PENDING,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // Future
        waitlistEntry: {
          customerAccountId,
          customerProfileId,
          startTime,
        },
      };

      MockedWaitlistRepo.lockWaitlistOfferForUpdate.mockResolvedValue({ id: 'offer-valid' });
      MockedWaitlistRepo.findWaitlistOfferById.mockResolvedValue(validOffer as any);
      MockedReservationRepo.findStation.mockResolvedValue({ id: stationId, name: 'Station 1', hourlyPrice: 100000, stationType: 'PC' } as any);
      MockedReservationRepo.findOverlappingReservation.mockResolvedValue(null);
      MockedReservationRepo.assertActiveReservationLimitNotExceeded.mockResolvedValue();

      MockedDiscountsStation.calculateApplicableDiscount.mockResolvedValue({
        applicableDiscount: { id: 'disc-1' } as any,
        discountAmount: 10000,
      });

      const createdReservation = {
        id: 'res-converted-1',
        gamingCenterId,
        stationId,
        status: 'CONFIRMED',
        totalPrice: 90000,
        discountAmount: 10000,
      };

      MockedReservationRepo.createReservation.mockResolvedValue(createdReservation as any);

      const res = await waitlistStation.acceptOffer('offer-valid', gamingCenterId, {
        id: customerAccountId,
        actorType: SessionActorType.CUSTOMER,
        customerAccountId,
      });

      expect(res).toEqual(createdReservation);
      expect(MockedWaitlistRepo.updateWaitlistOffer).toHaveBeenCalledWith(
        'offer-valid',
        { status: WaitlistOfferStatus.ACCEPTED, reservationId: 'res-converted-1' },
        expect.anything()
      );
      expect(MockedWaitlistRepo.updateWaitlistEntry).toHaveBeenCalledWith(
        'entry-1',
        { status: WaitlistStatus.CONVERTED, convertedReservationId: 'res-converted-1' },
        expect.anything()
      );
    });
  });

  describe('rejectOffer & cancelEntry', () => {
    it('should reject offer, close entry, and re-trigger matching', async () => {
      const offer = {
        id: 'offer-rej',
        waitlistEntryId: 'entry-rej',
        gamingCenterId,
        stationId,
        offeredStartTime: startTime,
        offeredEndTime: endTime,
        status: WaitlistOfferStatus.PENDING,
        waitlistEntry: { customerAccountId },
      };

      MockedWaitlistRepo.lockWaitlistOfferForUpdate.mockResolvedValue({ id: 'offer-rej' });
      MockedWaitlistRepo.findWaitlistOfferById.mockResolvedValue(offer as any);
      MockedWaitlistRepo.updateWaitlistOffer.mockResolvedValue({ ...offer, status: WaitlistOfferStatus.REJECTED } as any);

      const result = await waitlistStation.rejectOffer('offer-rej', gamingCenterId, {
        id: customerAccountId,
        actorType: SessionActorType.CUSTOMER,
        customerAccountId,
      });

      expect(result.status).toBe(WaitlistOfferStatus.REJECTED);
      expect(MockedWaitlistRepo.updateWaitlistEntry).toHaveBeenCalledWith('entry-rej', { status: WaitlistStatus.CLOSED }, expect.anything());
    });

    it('should cancel entry, cancel pending offer if present, and re-trigger matching', async () => {
      const entry = {
        id: 'entry-cancel',
        customerAccountId,
        stationId,
        startTime,
        endTime,
        status: WaitlistStatus.OFFERED,
      };

      MockedWaitlistRepo.lockWaitlistEntryForUpdate.mockResolvedValue({ id: 'entry-cancel' });
      MockedWaitlistRepo.findWaitlistEntryById.mockResolvedValue(entry as any);
      MockedWaitlistRepo.findPendingOfferForEntry.mockResolvedValue({ id: 'offer-pending' } as any);
      MockedWaitlistRepo.updateWaitlistEntry.mockResolvedValue({ ...entry, status: WaitlistStatus.CANCELLED } as any);

      const result = await waitlistStation.cancelEntry('entry-cancel', gamingCenterId, {
        id: customerAccountId,
        actorType: SessionActorType.CUSTOMER,
        customerAccountId,
      });

      expect(result.status).toBe(WaitlistStatus.CANCELLED);
      expect(MockedWaitlistRepo.updateWaitlistOffer).toHaveBeenCalledWith('offer-pending', { status: WaitlistOfferStatus.CANCELLED }, expect.anything());
    });
  });

  describe('processExpiryBatch', () => {
    it('should process expired offers and entries gracefully', async () => {
      const expiredOffer = {
        id: 'off-exp-1',
        waitlistEntryId: 'entry-1',
        gamingCenterId,
        stationId,
        offeredStartTime: startTime,
        offeredEndTime: endTime,
        expiresAt: new Date('2026-12-10T09:00:00.000Z'),
      };

      MockedWaitlistRepo.findExpiredOffers.mockResolvedValue([expiredOffer as any]);
      MockedWaitlistRepo.findExpiredWaitlistEntries.mockResolvedValue([]);
      MockedWaitlistRepo.lockWaitlistOfferForUpdate.mockResolvedValue({ id: 'off-exp-1' });
      MockedWaitlistRepo.findWaitlistEntryById.mockResolvedValue({
        id: 'entry-1',
        startTime: new Date('2026-12-10T14:00:00.000Z'), // Future relative to expiry
      } as any);

      const result = await waitlistStation.processExpiryBatch({ now });

      expect(result.expiredOffersCount).toBe(1);
      expect(MockedWaitlistRepo.updateWaitlistOffer).toHaveBeenCalledWith('off-exp-1', { status: WaitlistOfferStatus.EXPIRED }, expect.anything());
      expect(MockedWaitlistRepo.updateWaitlistEntry).toHaveBeenCalledWith('entry-1', { status: WaitlistStatus.ACTIVE }, expect.anything());
    });
  });
});
