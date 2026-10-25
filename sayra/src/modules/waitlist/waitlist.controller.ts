import { Response } from 'express';
import { AppRequest } from '../../types/express';
import { waitlistStation } from './waitlist.station';
import { ReservationRepo } from '../reservation/reservation.repo';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';

export const createCustomerWaitlistEntry = async (req: AppRequest, res: Response) => {
  const gamingCenterId = req.tenant?.gamingCenterId;
  if (!gamingCenterId) {
    throw new AppError('Tenant required.', httpStatus.BAD_REQUEST);
  }

  const entry = await waitlistStation.createEntry(
    gamingCenterId,
    req.body,
    {
      id: req.actor.id,
      actorType: req.actor.actorType,
      customerAccountId: req.actor.id,
    }
  );

  res.created(entry);
};

export const createPublicWaitlistEntry = async (req: AppRequest, res: Response) => {
  const { gamingCenterSlug } = req.params;
  const gamingCenter = await ReservationRepo.findGamingCenterBySlugWithSettings(gamingCenterSlug);
  if (!gamingCenter) {
    throw new AppError('GamingCenter not found.', httpStatus.NOT_FOUND);
  }

  const entry = await waitlistStation.createEntry(gamingCenter.id, req.body);
  res.created(entry);
};

export const getMyWaitlistEntries = async (req: AppRequest, res: Response) => {
  const result = await waitlistStation.getCustomerWaitlistEntries(req.actor.id, req.query);
  res.ok(result.data, { pagination: result.meta });
};

export const cancelMyWaitlistEntry = async (req: AppRequest, res: Response) => {
  const { entryId } = req.params;
  const entry = await waitlistStation.cancelEntry(
    entryId,
    req.tenant?.gamingCenterId || '',
    {
      id: req.actor.id,
      actorType: req.actor.actorType,
      customerAccountId: req.actor.id,
    },
    req.body?.reason
  );
  res.ok(entry);
};

export const getMyOffers = async (req: AppRequest, res: Response) => {
  const result = await waitlistStation.getCustomerOffers(req.actor.id, req.query);
  res.ok(result.data, { pagination: result.meta });
};

export const acceptOffer = async (req: AppRequest, res: Response) => {
  const { offerId } = req.params;
  const reservation = await waitlistStation.acceptOffer(
    offerId,
    req.tenant?.gamingCenterId || '',
    {
      id: req.actor.id,
      actorType: req.actor.actorType,
      customerAccountId: req.actor.id,
    }
  );
  res.created(reservation);
};

export const rejectOffer = async (req: AppRequest, res: Response) => {
  const { offerId } = req.params;
  const offer = await waitlistStation.rejectOffer(
    offerId,
    req.tenant?.gamingCenterId || '',
    {
      id: req.actor.id,
      actorType: req.actor.actorType,
      customerAccountId: req.actor.id,
    }
  );
  res.ok(offer);
};

export const getWaitlistEntries = async (req: AppRequest, res: Response) => {
  const result = await waitlistStation.getWaitlistEntries(req.tenant.gamingCenterId, req.query);
  res.ok(result.data, { pagination: result.meta });
};

export const getWaitlistOffers = async (req: AppRequest, res: Response) => {
  const result = await waitlistStation.getWaitlistOffers(req.tenant.gamingCenterId, req.query);
  res.ok(result.data, { pagination: result.meta });
};

export const cancelWaitlistEntryAdmin = async (req: AppRequest, res: Response) => {
  const { entryId } = req.params;
  const entry = await waitlistStation.cancelEntry(
    entryId,
    req.tenant.gamingCenterId,
    {
      id: req.actor.id,
      actorType: req.actor.actorType,
      role: req.actor.role,
    },
    req.body?.reason
  );
  res.ok(entry);
};

export const triggerWaitlistMatchingAdmin = async (req: AppRequest, res: Response) => {
  const { stationId, startTime, endTime } = req.body;
  if (!stationId || !startTime || !endTime) {
    throw new AppError('stationId, startTime, and endTime are required.', httpStatus.BAD_REQUEST);
  }

  const offer = await waitlistStation.processAvailableSlot(
    req.tenant.gamingCenterId,
    stationId,
    new Date(startTime),
    new Date(endTime)
  );

  res.ok({ matched: Boolean(offer), offer });
};
