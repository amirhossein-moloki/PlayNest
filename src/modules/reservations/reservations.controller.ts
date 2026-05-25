
import { Response } from 'express';
import { SessionActorType, UserRole } from '@prisma/client';
import { AppRequest } from '../../types/express';
import { reservationsService } from './reservations.station';

export const createBooking = async (
  req: AppRequest,
  res: Response
) => {
  const data = {
    ...req.body,
    gamingCenterId: req.tenant.gamingCenterId,
    createdByUserId: req.actor.id,
    requestId: req.id,
  };
  const reservation = await reservationsService.createBooking(data);
  res.created(reservation);
};

export const createPublicBooking = async (
  req: AppRequest,
  res: Response
) => {
  const { gamingCenterSlug } = req.params;

  const reservation = await reservationsService.createPublicBooking(
    gamingCenterSlug,
    req.body
  );

  res.created(reservation);
};

export const getBookings = async (
  req: AppRequest,
  res: Response
) => {
  const result = await reservationsService.getBookings(
    req.tenant.gamingCenterId,
    req.query,
    req.actor as { id: string; role: UserRole }
  );
  res.ok(result.data, { pagination: result.meta });
};

export const getBookingById = async (
  req: AppRequest,
  res: Response
) => {
  const reservation = await reservationsService.getBookingById(
    req.params.reservationId,
    req.tenant.gamingCenterId,
    req.actor as { id: string; role: UserRole }
  );
  res.ok(reservation);
};

export const updateBooking = async (
  req: AppRequest,
  res: Response
) => {
  const reservation = await reservationsService.updateBooking(
    req.params.reservationId,
    req.tenant.gamingCenterId,
    req.body,
    req.actor as { id: string; actorType: SessionActorType },
    { ip: req.ip, userAgent: req.headers['user-agent'] }
  );
  res.ok(reservation);
};

export const confirmBooking = async (
  req: AppRequest,
  res: Response
) => {
  const reservation = await reservationsService.confirmBooking(
    req.params.reservationId,
    req.tenant.gamingCenterId,
    req.actor as { id: string; role: UserRole }
  );
  res.ok(reservation);
};

export const cancelBooking = async (
  req: AppRequest,
  res: Response
) => {
  const reservation = await reservationsService.cancelBooking(
    req.params.reservationId,
    req.tenant.gamingCenterId,
    req.actor as { id: string; role: UserRole; actorType: SessionActorType },
    req.body,
    { ip: req.ip, userAgent: req.headers['user-agent'] }
  );
  res.ok(reservation);
};

export const completeBooking = async (
  req: AppRequest,
  res: Response
) => {
  const reservation = await reservationsService.completeBooking(
    req.params.reservationId,
    req.tenant.gamingCenterId,
    req.actor as { id: string; role: UserRole; actorType: SessionActorType },
    { ip: req.ip, userAgent: req.headers['user-agent'] }
  );
  res.ok(reservation);
};

export const markAsNoShow = async (
  req: AppRequest,
  res: Response
) => {
  const reservation = await reservationsService.markAsNoShow(
    req.params.reservationId,
    req.tenant.gamingCenterId,
    req.actor as { id: string; role: UserRole; actorType: SessionActorType },
    { ip: req.ip, userAgent: req.headers['user-agent'] }
  );
  res.ok(reservation);
};
