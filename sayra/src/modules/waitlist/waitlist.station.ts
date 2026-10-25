import { addMinutes, differenceInMinutes } from 'date-fns';
import { WaitlistStatus, WaitlistOfferStatus, SessionActorType, UserRole, NotificationType, Prisma } from '@prisma/client';
import { WaitlistRepo } from './waitlist.repo';
import { ReservationRepo } from '../reservation/reservation.repo';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import { normalizePhone } from '../../common/utils/phone';
import { validateLeadTime, validateOperatingHours, validateStationAvailability } from '../reservation/reservation.validation';
import { discountsStation } from '../discounts/discounts.station';
import { auditService } from '../audit/audit.station';
import { NotificationStation } from '../notifications/notifications.station';
import { CreateWaitlistEntryInput, ListWaitlistQuery, ListWaitlistOffersQuery } from './waitlist.dto';

const DEFAULT_OFFER_EXPIRATION_MINUTES = 15;

const findOrCreateCustomerProfile = async (
  tx: Prisma.TransactionClient,
  gamingCenterId: string,
  customer: { fullName: string; phone: string; email?: string }
) => {
  const normalizedPhone = normalizePhone(customer.phone);
  let customerAccount = await ReservationRepo.findCustomerAccountByPhone(normalizedPhone, tx);

  if (!customerAccount) {
    customerAccount = await ReservationRepo.createCustomerAccount(
      { phone: normalizedPhone, fullName: customer.fullName },
      tx
    );
  }

  let customerProfile = await ReservationRepo.findCustomerProfile(gamingCenterId, customerAccount.id, tx);

  if (!customerProfile) {
    customerProfile = await ReservationRepo.createCustomerProfile(
      {
        gamingCenterId,
        customerAccountId: customerAccount.id,
        displayName: customer.fullName,
      },
      tx
    );
  }

  return { customerAccount, customerProfile };
};

export const waitlistStation = {
  async createEntry(
    gamingCenterId: string,
    input: CreateWaitlistEntryInput,
    actor?: { id: string; actorType: SessionActorType; customerAccountId?: string }
  ) {
    return WaitlistRepo.transaction(async (tx) => {
      const { stationId, startTime: startAtInput, endTime: endAtInput, note, customer } = input;
      const startTime = new Date(startAtInput);
      const endTime = new Date(endAtInput);

      if (startTime >= endTime) {
        throw new AppError('Start time must be before end time.', httpStatus.BAD_REQUEST);
      }

      // 1. Validate station
      const station = await ReservationRepo.findStation(stationId, gamingCenterId, true, tx);
      if (!station) {
        throw new AppError('GameStation not found or is not active.', httpStatus.NOT_FOUND);
      }

      // 2. Validate operational constraints
      const gamingCenter = await ReservationRepo.findGamingCenterWithSettings(gamingCenterId, tx);
      if (!gamingCenter) {
        throw new AppError('GamingCenter not found.', httpStatus.NOT_FOUND);
      }

      validateLeadTime(startTime, gamingCenter.settings?.minAdvanceBookingMinutes ?? 30);

      validateOperatingHours(
        startTime,
        endTime,
        gamingCenter.settings?.workStartTime || gamingCenter.openingTime,
        gamingCenter.settings?.workEndTime || gamingCenter.closingTime,
        gamingCenter.settings?.timeZone
      );

      // Check maintenance
      const maintenances = await ReservationRepo.findOverlappingMaintenance(stationId, startTime, endTime, tx);
      validateStationAvailability(station, maintenances);

      // 3. Verify that the slot is NOT available (waitlist is only for unavailable slots)
      const overlappingReservation = await ReservationRepo.findOverlappingReservation(
        gamingCenterId,
        undefined,
        startTime,
        endTime,
        undefined,
        tx,
        stationId
      );

      if (!overlappingReservation) {
        throw new AppError(
          'The requested time slot is currently available for direct booking.',
          httpStatus.BAD_REQUEST,
          { code: 'SLOT_AVAILABLE' }
        );
      }

      // 4. Determine customer
      let customerAccountId: string;
      let customerProfileId: string;

      if (actor && actor.actorType === SessionActorType.CUSTOMER && actor.customerAccountId) {
        customerAccountId = actor.customerAccountId;
        let profile = await ReservationRepo.findCustomerProfile(gamingCenterId, customerAccountId, tx);
        if (!profile) {
          const custAccount = await ReservationRepo.findCustomerAccountById(customerAccountId, tx);
          profile = await ReservationRepo.createCustomerProfile(
            {
              gamingCenterId,
              customerAccountId,
              displayName: custAccount?.fullName || 'Customer',
            },
            tx
          );
        }
        customerProfileId = profile.id;
      } else if (customer) {
        const res = await findOrCreateCustomerProfile(tx, gamingCenterId, customer);
        customerAccountId = res.customerAccount.id;
        customerProfileId = res.customerProfile.id;
      } else {
        throw new AppError('Customer details are required.', httpStatus.BAD_REQUEST);
      }

      // 5. Enforce duplicate active entry policy
      const existingActive = await WaitlistRepo.findActiveWaitlistEntryForCustomer(
        customerAccountId,
        stationId,
        startTime,
        endTime,
        tx
      );

      if (existingActive) {
        throw new AppError(
          'You already have an active waitlist entry for this station and time slot.',
          httpStatus.CONFLICT,
          { code: 'DUPLICATE_WAITLIST_ENTRY' }
        );
      }

      // 6. Create waitlist entry
      const entry = await WaitlistRepo.createWaitlistEntry(
        {
          gamingCenterId,
          customerAccountId,
          customerProfileId,
          stationId,
          startTime,
          endTime,
          note,
          status: WaitlistStatus.ACTIVE,
          expiresAt: startTime, // Entry naturally expires when slot start time arrives
        },
        tx
      );

      if (actor) {
        await auditService.log(
          gamingCenterId,
          actor,
          'WAITLIST_ENTRY_CREATE',
          { name: 'WaitlistEntry', id: entry.id },
          { new: entry }
        );
      }

      return entry;
    });
  },

  async processAvailableSlot(
    gamingCenterId: string,
    stationId: string,
    slotStart: Date,
    slotEnd: Date
  ) {
    return WaitlistRepo.transaction(async (tx) => {
      // Find active waitlist entries for this station matching the slot window
      const candidates = await WaitlistRepo.findActiveWaitlistEntriesForMatching(
        gamingCenterId,
        stationId,
        slotStart,
        slotEnd,
        tx
      );

      if (candidates.length === 0) {
        return null; // No matching candidates
      }

      const station = await ReservationRepo.findStation(stationId, gamingCenterId, true, tx);
      if (!station) return null;

      for (const candidate of candidates) {
        // Lock candidate entry for update
        await WaitlistRepo.lockWaitlistEntryForUpdate(candidate.id, tx);

        // Check if candidate already has a pending offer
        const existingPendingOffer = await WaitlistRepo.findPendingOfferForEntry(candidate.id, tx);
        if (existingPendingOffer) {
          continue; // Entry already has an active offer
        }

        // Revalidate availability for candidate's requested slot
        const overlapping = await ReservationRepo.findOverlappingReservation(
          gamingCenterId,
          undefined,
          candidate.startTime,
          candidate.endTime,
          undefined,
          tx,
          stationId
        );

        if (overlapping) {
          continue; // Candidate slot is partially or fully booked
        }

        // Check maintenance
        const maintenances = await ReservationRepo.findOverlappingMaintenance(stationId, candidate.startTime, candidate.endTime, tx);
        if (maintenances.length > 0) {
          continue;
        }

        // Candidate matches! Create offer
        const now = new Date();
        const expiresAt = addMinutes(now, DEFAULT_OFFER_EXPIRATION_MINUTES);

        const offer = await WaitlistRepo.createWaitlistOffer(
          {
            waitlistEntryId: candidate.id,
            gamingCenterId,
            stationId,
            offeredStartTime: candidate.startTime,
            offeredEndTime: candidate.endTime,
            status: WaitlistOfferStatus.PENDING,
            expiresAt,
          },
          tx
        );

        // Update entry status to OFFERED
        await WaitlistRepo.updateWaitlistEntry(
          candidate.id,
          { status: WaitlistStatus.OFFERED },
          tx
        );

        // Send notification to customer
        const custAccount = await ReservationRepo.findCustomerAccountById(candidate.customerAccountId, tx);
        if (custAccount) {
          try {
            await NotificationStation.notifyUser({
              userId: custAccount.id,
              type: NotificationType.WAITLIST_OFFER_CREATED,
              title: 'Waitlist Opportunity Available!',
              message: `A slot on ${station.name} is now available for your requested time. Accept your offer before it expires!`,
              metadata: { offerId: offer.id, entryId: candidate.id, expiresAt },
              sendSms: true,
              mobile: custAccount.phone,
            });
          } catch (err) {
            console.error('Failed to notify customer of waitlist offer:', err);
          }
        }

        return offer;
      }

      return null;
    });
  },

  async acceptOffer(
    offerId: string,
    gamingCenterId: string,
    actor: { id: string; customerAccountId?: string; role?: UserRole; actorType: SessionActorType }
  ) {
    return WaitlistRepo.transaction(async (tx) => {
      // 1. Lock offer
      await WaitlistRepo.lockWaitlistOfferForUpdate(offerId, tx);

      const offer = await WaitlistRepo.findWaitlistOfferById(offerId, gamingCenterId, tx);
      if (!offer) {
        throw new AppError('Waitlist offer not found.', httpStatus.NOT_FOUND);
      }

      // Check ownership if customer
      if (actor.actorType === SessionActorType.CUSTOMER && actor.customerAccountId) {
        if (offer.waitlistEntry.customerAccountId !== actor.customerAccountId) {
          throw new AppError('Access denied.', httpStatus.FORBIDDEN);
        }
      }

      if (offer.status !== WaitlistOfferStatus.PENDING) {
        throw new AppError(
          `Offer cannot be accepted because it is in '${offer.status}' state.`,
          httpStatus.CONFLICT,
          { code: 'INVALID_OFFER_STATE' }
        );
      }

      const now = new Date();
      if (offer.expiresAt <= now) {
        // Synchronously expire the offer
        await WaitlistRepo.updateWaitlistOffer(offerId, { status: WaitlistOfferStatus.EXPIRED }, tx);
        const newEntryStatus = offer.waitlistEntry.startTime > now ? WaitlistStatus.ACTIVE : WaitlistStatus.EXPIRED;
        await WaitlistRepo.updateWaitlistEntry(offer.waitlistEntryId, { status: newEntryStatus }, tx);

        throw new AppError('Waitlist offer has expired.', httpStatus.BAD_REQUEST, {
          code: 'OFFER_EXPIRED',
        });
      }

      // 2. Lock station for update
      await ReservationRepo.lockStationForUpdate(offer.stationId, tx);

      const station = await ReservationRepo.findStation(offer.stationId, gamingCenterId, true, tx);
      if (!station) {
        throw new AppError('GameStation not found or inactive.', httpStatus.NOT_FOUND);
      }

      // Revalidate slot availability
      const overlapping = await ReservationRepo.findOverlappingReservation(
        gamingCenterId,
        undefined,
        offer.offeredStartTime,
        offer.offeredEndTime,
        undefined,
        tx,
        offer.stationId
      );

      if (overlapping) {
        await WaitlistRepo.updateWaitlistOffer(offerId, { status: WaitlistOfferStatus.CANCELLED }, tx);
        throw new AppError('This time slot is no longer available.', httpStatus.CONFLICT, {
          code: 'SLOT_NOT_AVAILABLE',
        });
      }

      // Check customer active reservation limit
      await ReservationRepo.assertActiveReservationLimitNotExceeded(offer.waitlistEntry.customerAccountId, tx);

      // 3. Calculate price and discounts
      const durationHours = differenceInMinutes(offer.offeredEndTime, offer.offeredStartTime) / 60;
      const basePrice = durationHours * station.hourlyPrice;

      const { applicableDiscount, discountAmount } = await discountsStation.calculateApplicableDiscount(
        gamingCenterId,
        station.id,
        basePrice,
        offer.offeredStartTime,
        tx
      );

      const finalPrice = Math.max(0, basePrice - discountAmount);

      // 4. Create reservation
      const reservation = await ReservationRepo.createReservation(
        {
          gamingCenterId,
          stationId: station.id,
          customerProfileId: offer.waitlistEntry.customerProfileId,
          customerAccountId: offer.waitlistEntry.customerAccountId,
          createdByUserId: actor.id,
          startTime: offer.offeredStartTime,
          endTime: offer.offeredEndTime,
          status: 'CONFIRMED',
          stationSnapshot: {
            name: station.name,
            hourlyPrice: station.hourlyPrice,
            stationType: station.stationType,
          },
          totalHours: durationHours,
          totalPrice: finalPrice,
          discountAmount,
          discountId: applicableDiscount?.id,
        },
        tx
      );

      await ReservationRepo.createHistory(
        {
          reservationId: reservation.id,
          fromStatus: 'CONFIRMED',
          toStatus: 'CONFIRMED',
          action: 'CONVERT_FROM_WAITLIST',
          actorId: actor.id,
          actorType: actor.actorType,
          metadata: { waitlistOfferId: offerId, waitlistEntryId: offer.waitlistEntryId },
        },
        tx
      );

      // 5. Update offer and entry statuses
      await WaitlistRepo.updateWaitlistOffer(
        offerId,
        {
          status: WaitlistOfferStatus.ACCEPTED,
          reservationId: reservation.id,
        },
        tx
      );

      await WaitlistRepo.updateWaitlistEntry(
        offer.waitlistEntryId,
        {
          status: WaitlistStatus.CONVERTED,
          convertedReservationId: reservation.id,
        },
        tx
      );

      await auditService.log(
        gamingCenterId,
        actor,
        'WAITLIST_OFFER_ACCEPT',
        { name: 'WaitlistOffer', id: offerId },
        { new: { reservationId: reservation.id } }
      );

      return reservation;
    });
  },

  async rejectOffer(
    offerId: string,
    gamingCenterId: string,
    actor: { id: string; customerAccountId?: string; role?: UserRole; actorType: SessionActorType }
  ) {
    const result = await WaitlistRepo.transaction(async (tx) => {
      await WaitlistRepo.lockWaitlistOfferForUpdate(offerId, tx);

      const offer = await WaitlistRepo.findWaitlistOfferById(offerId, gamingCenterId, tx);
      if (!offer) {
        throw new AppError('Waitlist offer not found.', httpStatus.NOT_FOUND);
      }

      if (actor.actorType === SessionActorType.CUSTOMER && actor.customerAccountId) {
        if (offer.waitlistEntry.customerAccountId !== actor.customerAccountId) {
          throw new AppError('Access denied.', httpStatus.FORBIDDEN);
        }
      }

      if (offer.status !== WaitlistOfferStatus.PENDING) {
        return offer;
      }

      const updatedOffer = await WaitlistRepo.updateWaitlistOffer(
        offerId,
        { status: WaitlistOfferStatus.REJECTED },
        tx
      );

      await WaitlistRepo.updateWaitlistEntry(
        offer.waitlistEntryId,
        { status: WaitlistStatus.CLOSED },
        tx
      );

      await auditService.log(
        gamingCenterId,
        actor,
        'WAITLIST_OFFER_REJECT',
        { name: 'WaitlistOffer', id: offerId },
        { new: { offerId } }
      );

      return updatedOffer;
    });

    // Re-trigger matching for the slot so next waitlist entry can be offered
    await this.processAvailableSlot(
      gamingCenterId,
      result.stationId,
      result.offeredStartTime,
      result.offeredEndTime
    ).catch(console.error);

    return result;
  },

  async cancelEntry(
    entryId: string,
    gamingCenterId: string,
    actor: { id: string; customerAccountId?: string; role?: UserRole; actorType: SessionActorType },
    reason?: string
  ) {
    const result = await WaitlistRepo.transaction(async (tx) => {
      await WaitlistRepo.lockWaitlistEntryForUpdate(entryId, tx);

      const entry = await WaitlistRepo.findWaitlistEntryById(entryId, gamingCenterId, tx);
      if (!entry) {
        throw new AppError('Waitlist entry not found.', httpStatus.NOT_FOUND);
      }

      if (actor.actorType === SessionActorType.CUSTOMER && actor.customerAccountId) {
        if (entry.customerAccountId !== actor.customerAccountId) {
          throw new AppError('Access denied.', httpStatus.FORBIDDEN);
        }
      }

      if (entry.status === WaitlistStatus.CANCELLED || entry.status === WaitlistStatus.CONVERTED || entry.status === WaitlistStatus.CLOSED) {
        return entry;
      }

      // Cancel any pending offer
      const pendingOffer = await WaitlistRepo.findPendingOfferForEntry(entryId, tx);
      if (pendingOffer) {
        await WaitlistRepo.updateWaitlistOffer(
          pendingOffer.id,
          { status: WaitlistOfferStatus.CANCELLED },
          tx
        );
      }

      const updatedEntry = await WaitlistRepo.updateWaitlistEntry(
        entryId,
        { status: WaitlistStatus.CANCELLED, note: reason ? `Cancelled: ${reason}` : entry.note },
        tx
      );

      await auditService.log(
        gamingCenterId,
        actor,
        'WAITLIST_ENTRY_CANCEL',
        { name: 'WaitlistEntry', id: entryId },
        { new: { reason } }
      );

      return updatedEntry;
    });

    // Re-trigger matching for the freed slot
    await this.processAvailableSlot(
      gamingCenterId,
      result.stationId,
      result.startTime,
      result.endTime
    ).catch(console.error);

    return result;
  },

  async getWaitlistEntries(gamingCenterId: string, query: ListWaitlistQuery) {
    const { page = 1, pageSize = 20, status, stationId, dateFrom, dateTo } = query;
    const where: Prisma.WaitlistEntryWhereInput = {
      gamingCenterId,
      status,
      stationId,
      startTime: {
        gte: dateFrom ? new Date(dateFrom) : undefined,
        lt: dateTo ? new Date(dateTo) : undefined,
      },
    };

    const [data, totalItems] = await WaitlistRepo.transaction(async (tx) => {
      const list = await WaitlistRepo.findManyWaitlistEntries(
        where,
        (page - 1) * pageSize,
        pageSize,
        { createdAt: 'desc' },
        tx
      );
      const count = await WaitlistRepo.countWaitlistEntries(where, tx);
      return [list, count] as const;
    });

    return {
      data,
      meta: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) },
    };
  },

  async getCustomerWaitlistEntries(customerAccountId: string, query: ListWaitlistQuery) {
    const { page = 1, pageSize = 20, status } = query;
    const where: Prisma.WaitlistEntryWhereInput = {
      customerAccountId,
      status,
    };

    const [data, totalItems] = await WaitlistRepo.transaction(async (tx) => {
      const list = await WaitlistRepo.findManyWaitlistEntries(
        where,
        (page - 1) * pageSize,
        pageSize,
        { createdAt: 'desc' },
        tx
      );
      const count = await WaitlistRepo.countWaitlistEntries(where, tx);
      return [list, count] as const;
    });

    return {
      data,
      meta: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) },
    };
  },

  async getWaitlistOffers(gamingCenterId: string, query: ListWaitlistOffersQuery) {
    const { page = 1, pageSize = 20, status, stationId } = query;
    const where: Prisma.WaitlistOfferWhereInput = {
      gamingCenterId,
      status,
      stationId,
    };

    const [data, totalItems] = await WaitlistRepo.transaction(async (tx) => {
      const list = await WaitlistRepo.findManyWaitlistOffers(
        where,
        (page - 1) * pageSize,
        pageSize,
        { createdAt: 'desc' },
        tx
      );
      const count = await WaitlistRepo.countWaitlistOffers(where, tx);
      return [list, count] as const;
    });

    return {
      data,
      meta: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) },
    };
  },

  async getCustomerOffers(customerAccountId: string, query: ListWaitlistOffersQuery) {
    const { page = 1, pageSize = 20, status } = query;
    const where: Prisma.WaitlistOfferWhereInput = {
      waitlistEntry: { customerAccountId },
      status,
    };

    const [data, totalItems] = await WaitlistRepo.transaction(async (tx) => {
      const list = await WaitlistRepo.findManyWaitlistOffers(
        where,
        (page - 1) * pageSize,
        pageSize,
        { createdAt: 'desc' },
        tx
      );
      const count = await WaitlistRepo.countWaitlistOffers(where, tx);
      return [list, count] as const;
    });

    return {
      data,
      meta: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) },
    };
  },

  async processExpiryBatch(options?: { batchSize?: number; now?: Date }) {
    const batchSize = options?.batchSize ?? 50;
    const now = options?.now ?? new Date();

    const expiredOffers = await WaitlistRepo.findExpiredOffers(now, batchSize);
    const expiredEntries = await WaitlistRepo.findExpiredWaitlistEntries(now, batchSize);

    const result = {
      expiredOffersCount: 0,
      expiredEntriesCount: 0,
    };

    for (const offer of expiredOffers) {
      try {
        await WaitlistRepo.transaction(async (tx) => {
          await WaitlistRepo.lockWaitlistOfferForUpdate(offer.id, tx);
          await WaitlistRepo.updateWaitlistOffer(offer.id, { status: WaitlistOfferStatus.EXPIRED }, tx);

          const entry = await WaitlistRepo.findWaitlistEntryById(offer.waitlistEntryId, undefined, tx);
          if (entry) {
            const newStatus = entry.startTime > now ? WaitlistStatus.ACTIVE : WaitlistStatus.EXPIRED;
            await WaitlistRepo.updateWaitlistEntry(entry.id, { status: newStatus }, tx);
          }
        });

        result.expiredOffersCount++;

        // Re-trigger matching for the slot
        await this.processAvailableSlot(
          offer.gamingCenterId,
          offer.stationId,
          offer.offeredStartTime,
          offer.offeredEndTime
        ).catch(console.error);
      } catch (error) {
        console.error(`Failed to process expired waitlist offer ${offer.id}:`, error);
      }
    }

    for (const entry of expiredEntries) {
      try {
        await WaitlistRepo.transaction(async (tx) => {
          await WaitlistRepo.lockWaitlistEntryForUpdate(entry.id, tx);
          await WaitlistRepo.updateWaitlistEntry(entry.id, { status: WaitlistStatus.EXPIRED }, tx);
        });
        result.expiredEntriesCount++;
      } catch (error) {
        console.error(`Failed to expire waitlist entry ${entry.id}:`, error);
      }
    }

    return result;
  },
};
