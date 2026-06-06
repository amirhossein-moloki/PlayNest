import { Response } from 'express';
import { AppRequest } from '../../types/express';
import { gamingSessionsStation } from './gamingSessions.station';
import { asyncHandler } from '../../common/middleware/asyncHandler';

export const startSession = asyncHandler(async (req: AppRequest, res: Response) => {
  const { reservationId } = req.params;
  const { stationId } = req.body; // or get from reservation if not provided

  const session = await gamingSessionsStation.startSession(reservationId, stationId);
  res.created(session);
});

export const endSession = asyncHandler(async (req: AppRequest, res: Response) => {
  const { reservationId } = req.params;

  const session = await gamingSessionsStation.endSession(reservationId);
  res.ok(session);
});

export const pauseSession = asyncHandler(async (req: AppRequest, res: Response) => {
  const { reservationId } = req.params;
  const session = await gamingSessionsStation.pauseSession(reservationId);
  res.ok(session);
});

export const resumeSession = asyncHandler(async (req: AppRequest, res: Response) => {
  const { reservationId } = req.params;
  const session = await gamingSessionsStation.resumeSession(reservationId);
  res.ok(session);
});

export const GamingSessionsController = {
  startSession,
  pauseSession,
  resumeSession,
  endSession,
};
