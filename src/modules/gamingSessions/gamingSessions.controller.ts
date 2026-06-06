import { Response } from 'express';
import { AppRequest } from '../../types/express';
import { GamingSessionsService } from './gamingSessions.station';
import { asyncHandler } from '../../common/middleware/asyncHandler';

export const startSession = asyncHandler(async (req: AppRequest, res: Response) => {
  const { reservationId } = req.params;
  const { stationId } = req.body; // or get from reservation if not provided

  const session = await GamingSessionsService.startSession(reservationId, stationId);
  res.created(session);
});

export const endSession = asyncHandler(async (req: AppRequest, res: Response) => {
  const { reservationId } = req.params;

  const session = await GamingSessionsService.endSession(reservationId);
  res.ok(session);
});

export const pauseSession = asyncHandler(async (req: AppRequest, res: Response) => {
  const { reservationId } = req.params;
  const session = await GamingSessionsService.pauseSession(reservationId);
  res.ok(session);
});

export const resumeSession = asyncHandler(async (req: AppRequest, res: Response) => {
  const { reservationId } = req.params;
  const session = await GamingSessionsService.resumeSession(reservationId);
  res.ok(session);
});

export const GamingSessionsController = {
  startSession,
  pauseSession,
  resumeSession,
  endSession,
};
