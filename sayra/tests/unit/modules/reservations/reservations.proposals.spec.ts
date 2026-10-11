import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { reservationStation } from '../../../../src/modules/reservation/reservation.station';
import { CustomerPanelStation } from '../../../../src/modules/customer-panel/customer-panel.station';
import { ReservationRepo } from '../../../../src/modules/reservation/reservation.repo';
import { CustomerPanelRepo } from '../../../../src/modules/customer-panel/customer-panel.repo';
import { ReservationStatus, ReservationProposalStatus, SessionActorType, UserRole } from '@prisma/client';
import AppError from '../../../../src/common/errors/AppError';
import { eventEmitter } from '../../../../src/common/events/event-emitter';
import { discountsStation } from '../../../../src/modules/discounts/discounts.station';

jest.mock('../../../../src/modules/reservation/reservation.repo');
jest.mock('../../../../src/modules/customer-panel/customer-panel.repo');
jest.mock('../../../../src/modules/auth/auth.repository');
jest.mock('../../../../src/modules/wallet/wallet.station');
jest.mock('../../../../src/modules/commissions/commissions.station');
jest.mock('../../../../src/modules/audit/audit.station');
jest.mock('../../../../src/common/events/event-emitter');
jest.mock('../../../../src/modules/discounts/discounts.station');

const MockedReservationRepo = ReservationRepo as jest.Mocked<typeof ReservationRepo>;
const MockedCustomerPanelRepo = CustomerPanelRepo as jest.Mocked<typeof CustomerPanelRepo>;
const MockedEventEmitter = eventEmitter as jest.Mocked<typeof eventEmitter>;
const MockedDiscountsStation = discountsStation as jest.Mocked<typeof discountsStation>;

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('Reservation Proposals Workflow', () => {
  const gamingCenterId = 'gc-1';
  const reservationId = 'res-1';
  const proposalId = 'prop-1';
  const staffUserId = 'u-staff-1';
  const customerAccountId = 'cust-1';

  const futureStartOriginal = new Date(Date.now() + 86400000); // +1 day
  const futureEndOriginal = new Date(Date.now() + 90000000);
  const futureStartProposed = new Date(Date.now() + 172800000); // +2 days
  const futureEndProposed = new Date(Date.now() + 176400000);

  const mockReservation = {
    id: reservationId,
    gamingCenterId,
    customerAccountId,
    customerProfileId: 'cp-1',
    stationId: 'st-1',
    staffId: 'staff-1',
    startTime: futureStartOriginal,
    endTime: futureEndOriginal,
    totalHours: 1,
    totalPrice: 100,
    status: ReservationStatus.CONFIRMED,
    stationSnapshot: { hourlyPrice: 100, name: 'PC VIP' },
  };

  const mockProposal = {
    id: proposalId,
    reservationId,
    originalStartTime: futureStartOriginal,
    originalEndTime: futureEndOriginal,
    proposedStartTime: futureStartProposed,
    proposedEndTime: futureEndProposed,
    note: 'How about this time?',
    status: ReservationProposalStatus.PENDING,
    createdByUserId: staffUserId,
    createdAt: new Date(),
    updatedAt: new Date(),
    customerRespondedAt: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    MockedReservationRepo.transaction.mockImplementation(async (fn) => fn({} as any));
    MockedDiscountsStation.calculateApplicableDiscount.mockResolvedValue({ applicableDiscount: null, discountAmount: 0 });
  });

  describe('Owner/Staff proposeTime', () => {
    const proposeInput = {
      startTime: futureStartProposed.toISOString(),
      endTime: futureEndProposed.toISOString(),
      note: 'Change of time proposal',
    };
    const actor = { id: staffUserId, role: UserRole.MANAGER, actorType: SessionActorType.USER };

    it('should create valid time proposal and emit domain event', async () => {
      MockedReservationRepo.findReservationById.mockResolvedValue(mockReservation as any);
      MockedReservationRepo.cancelPendingProposals.mockResolvedValue({ count: 0 } as any);
      MockedReservationRepo.createTimeProposal.mockResolvedValue(mockProposal as any);

      const result = await reservationStation.proposeTime(
        reservationId,
        gamingCenterId,
        staffUserId,
        proposeInput,
        actor
      );

      expect(result).toEqual(mockProposal);
      expect(MockedReservationRepo.cancelPendingProposals).toHaveBeenCalledWith(reservationId, expect.anything());
      expect(MockedReservationRepo.createTimeProposal).toHaveBeenCalledWith(
        expect.objectContaining({
          reservationId,
          proposedStartTime: expect.any(Date),
          proposedEndTime: expect.any(Date),
          note: proposeInput.note,
          status: ReservationProposalStatus.PENDING,
          createdByUserId: staffUserId,
        }),
        expect.anything()
      );
      expect(MockedEventEmitter.emit).toHaveBeenCalledWith('reservation.time_proposed', {
        reservationId: mockReservation.id,
        customerId: mockReservation.customerAccountId,
        gamingCenterId: mockReservation.gamingCenterId,
        proposalId: mockProposal.id,
        proposal: mockProposal,
      });
    });

    it('should prevent proposal creation on terminal reservation status', async () => {
      const canceledReservation = { ...mockReservation, status: ReservationStatus.CANCELED };
      MockedReservationRepo.findReservationById.mockResolvedValue(canceledReservation as any);

      await expect(
        reservationStation.proposeTime(reservationId, gamingCenterId, staffUserId, proposeInput, actor)
      ).rejects.toThrow(AppError);
    });

    it('should prevent staff from proposing time for another staff member reservation', async () => {
      const otherStaffReservation = { ...mockReservation, staffId: 'other-staff-999' };
      MockedReservationRepo.findReservationById.mockResolvedValue(otherStaffReservation as any);

      const staffActor = { id: staffUserId, role: UserRole.STAFF, actorType: SessionActorType.USER };

      await expect(
        reservationStation.proposeTime(reservationId, gamingCenterId, staffUserId, proposeInput, staffActor)
      ).rejects.toThrow('Reservation not found.');
    });
  });

  describe('Customer acceptProposal', () => {
    it('should accept proposal, update reservation start/end times and recalculate price', async () => {
      MockedCustomerPanelRepo.findReservationById.mockResolvedValue(mockReservation as any);
      MockedReservationRepo.findProposalById.mockResolvedValue(mockProposal as any);
      MockedReservationRepo.findSettings.mockResolvedValue({ timeZone: 'UTC', preventOverlaps: true } as any);
      MockedReservationRepo.findStaffShift.mockResolvedValue({ id: 's1', startTime: '00:00', endTime: '23:59' } as any);
      MockedReservationRepo.findOverlappingReservation.mockResolvedValue(null);
      MockedReservationRepo.findStation.mockResolvedValue({ id: 'st-1', hourlyPrice: 100 } as any);

      const updatedReservation = {
        ...mockReservation,
        startTime: futureStartProposed,
        endTime: futureEndProposed,
      };
      const acceptedProposal = {
        ...mockProposal,
        status: ReservationProposalStatus.ACCEPTED,
        customerRespondedAt: new Date(),
      };

      MockedReservationRepo.updateReservation.mockResolvedValue(updatedReservation as any);
      MockedReservationRepo.updateProposalStatus.mockResolvedValue(acceptedProposal as any);

      const result = await CustomerPanelStation.acceptProposal(reservationId, proposalId, customerAccountId);

      expect(result.proposal.status).toBe(ReservationProposalStatus.ACCEPTED);
      expect(result.reservation).toEqual(updatedReservation);
      expect(MockedReservationRepo.updateReservation).toHaveBeenCalledWith(
        reservationId,
        gamingCenterId,
        expect.objectContaining({
          startTime: futureStartProposed,
          endTime: futureEndProposed,
        }),
        expect.anything()
      );
    });

    it('should fail to accept proposal if slot becomes occupied by overlapping reservation', async () => {
      MockedCustomerPanelRepo.findReservationById.mockResolvedValue(mockReservation as any);
      MockedReservationRepo.findProposalById.mockResolvedValue(mockProposal as any);
      MockedReservationRepo.findSettings.mockResolvedValue({ timeZone: 'UTC', preventOverlaps: true } as any);
      MockedReservationRepo.findStaffShift.mockResolvedValue({ id: 's1', startTime: '00:00', endTime: '23:59' } as any);
      MockedReservationRepo.findOverlappingReservation.mockResolvedValue({ id: 'other-res' } as any);

      await expect(
        CustomerPanelStation.acceptProposal(reservationId, proposalId, customerAccountId)
      ).rejects.toThrow('Reservation overlaps with another for the same staff member.');
    });

    it('should prevent acceptance if proposal is not pending', async () => {
      const rejectedProposal = { ...mockProposal, status: ReservationProposalStatus.REJECTED };
      MockedCustomerPanelRepo.findReservationById.mockResolvedValue(mockReservation as any);
      MockedReservationRepo.findProposalById.mockResolvedValue(rejectedProposal as any);

      await expect(
        CustomerPanelStation.acceptProposal(reservationId, proposalId, customerAccountId)
      ).rejects.toThrow('Proposal is no longer pending');
    });
  });

  describe('Customer rejectProposal', () => {
    it('should reject proposal and keep reservation unchanged', async () => {
      MockedCustomerPanelRepo.findReservationById.mockResolvedValue(mockReservation as any);
      MockedReservationRepo.findProposalById.mockResolvedValue(mockProposal as any);

      const rejectedProposal = {
        ...mockProposal,
        status: ReservationProposalStatus.REJECTED,
        customerRespondedAt: new Date(),
      };
      MockedReservationRepo.updateProposalStatus.mockResolvedValue(rejectedProposal as any);

      const result = await CustomerPanelStation.rejectProposal(reservationId, proposalId, customerAccountId);

      expect(result.status).toBe(ReservationProposalStatus.REJECTED);
      expect(MockedReservationRepo.updateReservation).not.toHaveBeenCalled();
    });
  });

  describe('Reservation Proposal History', () => {
    it('should list all time proposals for reservation in history order', async () => {
      const history = [
        mockProposal,
        { ...mockProposal, id: 'prop-2', status: ReservationProposalStatus.REJECTED },
      ];
      MockedReservationRepo.findReservationById.mockResolvedValue(mockReservation as any);
      MockedReservationRepo.listProposalsByReservationId.mockResolvedValue(history as any);

      const result = await reservationStation.getProposals(reservationId, gamingCenterId, {
        id: staffUserId,
        role: UserRole.MANAGER,
      });

      expect(result).toHaveLength(2);
      expect(result).toEqual(history);
    });
  });
});
