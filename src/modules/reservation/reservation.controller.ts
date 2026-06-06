
import { Response } from 'express';
import { SessionActorType, UserRole } from '@prisma/client';
import { AppRequest } from '../../types/express';
import { reservationStation } from './reservation.station';

export const createReservation = async (
  req: AppRequest,
  res: Response
) => {
  const data = {
    ...req.body,
    gamingCenterId: req.tenant.gamingCenterId,
    createdByUserId: req.actor.id,
    requestId: req.id,
  };
  const reservation = await reservationStation.createReservation(data);
  res.created(reservation);
};

export const createPublicReservation = async (
  req: AppRequest,
  res: Response
) => {
  const { gamingCenterSlug } = req.params;

  const reservation = await reservationStation.createPublicReservation(
    gamingCenterSlug,
    req.body
  );

  res.created(reservation);
};

export const getReservation = async (
  req: AppRequest,
  res: Response
) => {
  const result = await reservationStation.getReservation(
    req.tenant.gamingCenterId,
    req.query,
    req.actor as { id: string; role: UserRole }
  );
  res.ok(result.data, { pagination: result.meta });
};

export const getReservationById = async (
  req: AppRequest,
  res: Response
) => {
  const reservation = await reservationStation.getReservationById(
    req.params.reservationId,
    req.tenant.gamingCenterId,
    req.actor as { id: string; role: UserRole }
  );
  res.ok(reservation);
};

export const updateReservation = async (
  req: AppRequest,
  res: Response
) => {
  const reservation = await reservationStation.updateReservation(
    req.params.reservationId,
    req.tenant.gamingCenterId,
    req.body,
    req.actor as { id: string; actorType: SessionActorType },
    { ip: req.ip, userAgent: req.headers['user-agent'] }
  );
  res.ok(reservation);
};

export const confirmReservation = async (
  req: AppRequest,
  res: Response
) => {
  const reservation = await reservationStation.confirmReservation(
    req.params.reservationId,
    req.tenant.gamingCenterId
  );
  res.ok(reservation);
};

export const cancelReservation = async (
  req: AppRequest,
  res: Response
) => {
  const reservation = await reservationStation.cancelReservation(
    req.params.reservationId,
    req.tenant.gamingCenterId,
    req.actor as { id: string; role: UserRole; actorType: SessionActorType },
    req.body,
    { ip: req.ip, userAgent: req.headers['user-agent'] }
  );
  res.ok(reservation);
};

export const completeReservation = async (
  req: AppRequest,
  res: Response
) => {
  const reservation = await reservationStation.completeReservation(
    req.params.reservationId,
    req.tenant.gamingCenterId,
    req.actor as { id: string; role: UserRole; actorType: SessionActorType },
    { ip: req.ip, userAgent: req.headers['user-agent'] }
  );
  res.ok(reservation);
};

export const startReservation = async (
  req: AppRequest,
  res: Response
) => {
  const reservation = await reservationStation.startReservation(
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
  const reservation = await reservationStation.markAsNoShow(
    req.params.reservationId,
    req.tenant.gamingCenterId,
    req.actor as { id: string; role: UserRole; actorType: SessionActorType },
    { ip: req.ip, userAgent: req.headers['user-agent'] }
  );
  res.ok(reservation);
};
