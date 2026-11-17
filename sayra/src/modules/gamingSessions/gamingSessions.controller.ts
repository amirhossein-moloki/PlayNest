import { Response } from 'express';
import { AppRequest } from '../../types/express';
import { gamingSessionsStation } from './gamingSessions.station';
import { asyncHandler } from '../../common/middleware/asyncHandler';

export const startSession = asyncHandler(async (req: AppRequest, res: Response) => {
  const { reservationId } = req.params;
  const gamingCenterId = req.tenant?.gamingCenterId || req.params.gamingCenterId;
  const stationId = req.body?.stationId;

  const session = await gamingSessionsStation.startSession(
    reservationId,
    stationId,
    gamingCenterId,
    req.actor,
    { ip: req.ip, userAgent: req.headers['user-agent'] }
  );
  res.created(session);
});

export const endSession = asyncHandler(async (req: AppRequest, res: Response) => {
  const { reservationId } = req.params;
  const gamingCenterId = req.tenant?.gamingCenterId || req.params.gamingCenterId;

  const session = await gamingSessionsStation.endSession(
    reservationId,
    gamingCenterId,
    req.actor,
    { ip: req.ip, userAgent: req.headers['user-agent'] }
  );
  res.ok(session);
});

export const pauseSession = asyncHandler(async (req: AppRequest, res: Response) => {
  const { reservationId } = req.params;
  const gamingCenterId = req.tenant?.gamingCenterId || req.params.gamingCenterId;

  const session = await gamingSessionsStation.pauseSession(
    reservationId,
    gamingCenterId,
    req.actor,
    { ip: req.ip, userAgent: req.headers['user-agent'] }
  );
  res.ok(session);
});

export const resumeSession = asyncHandler(async (req: AppRequest, res: Response) => {
  const { reservationId } = req.params;
  const gamingCenterId = req.tenant?.gamingCenterId || req.params.gamingCenterId;

  const session = await gamingSessionsStation.resumeSession(
    reservationId,
    gamingCenterId,
    req.actor,
    { ip: req.ip, userAgent: req.headers['user-agent'] }
  );
  res.ok(session);
});

export const GamingSessionsController = {
  startSession,
  pauseSession,
  resumeSession,
  endSession,
};
