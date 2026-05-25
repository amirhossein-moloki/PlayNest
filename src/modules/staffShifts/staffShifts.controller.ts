import { Request, Response, NextFunction } from 'express';
import * as staffShiftsService from './staffShifts.station';
import { UpsertShiftsInput } from './staffShifts.validators';

export const upsertShiftsController = async (
  req: Request<{ gamingCenterId: string; userId: string }, any, UpsertShiftsInput>, // eslint-disable-line @typescript-eslint/no-explicit-any
  res: Response,
  next: NextFunction
) => {
  try {
    const { gamingCenterId, userId } = req.params;
    const staffShifts = await staffShiftsService.upsertShifts(gamingCenterId, userId, req.body);
    res.ok(staffShifts);
  } catch (error) {
    next(error);
  }
};
