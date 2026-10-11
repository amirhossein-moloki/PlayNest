import { Request, Response, NextFunction } from 'express';
import * as staffShiftsStation from './staffShifts.station';
import { UpsertShiftsInput } from './staffShifts.validators';

export const upsertShiftsController = async (
  req: Request<{ gamingCenterId: string; userId: string }, unknown, UpsertShiftsInput>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { gamingCenterId, userId } = req.params;
    const staffShifts = await staffShiftsStation.upsertShifts(
      gamingCenterId,
      userId,
      req.body,
      req.actor!,
      { ip: req.ip, userAgent: req.headers['user-agent'] }
    );
    res.ok(staffShifts);
  } catch (error) {
    next(error);
  }
};
