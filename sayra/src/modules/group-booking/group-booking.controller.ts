import { Response, NextFunction } from 'express';
import { GroupBookingStation } from './group-booking.station';
import { AppRequest } from '../../types/express';
import { UserRole } from '@prisma/client';

export const createPublicGroupBooking = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { gamingCenterSlug } = req.params;
    const groupBooking = await GroupBookingStation.createPublicGroupBooking(
      gamingCenterSlug,
      req.body
    );
    res.created(groupBooking);
  } catch (error) {
    next(error);
  }
};

export const createGroupBooking = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const gamingCenterId = req.tenant.gamingCenterId;
    const groupBooking = await GroupBookingStation.createGroupBooking({
      gamingCenterId,
      createdByUserId: req.actor.id,
      ...req.body,
      actor: req.actor,
    });
    res.created(groupBooking);
  } catch (error) {
    next(error);
  }
};

export const getGroupBookingById = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const gamingCenterId = req.tenant.gamingCenterId;
    const groupBooking = await GroupBookingStation.getGroupBookingById(
      id,
      gamingCenterId,
      req.actor as { id: string; role?: UserRole }
    );
    res.ok(groupBooking);
  } catch (error) {
    next(error);
  }
};

export const listGroupBookings = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const gamingCenterId = req.tenant.gamingCenterId;
    const result = await GroupBookingStation.listGroupBookings(
      gamingCenterId,
      req.query as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      req.actor as { id: string; role?: UserRole }
    );
    res.ok(result.data, { pagination: result.meta });
  } catch (error) {
    next(error);
  }
};

export const cancelGroupBooking = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const gamingCenterId = req.tenant.gamingCenterId;
    const reason = req.body?.reason;
    const canceled = await GroupBookingStation.cancelGroupBooking(
      id,
      gamingCenterId,
      req.actor as { id: string; role?: UserRole },
      reason,
      { ip: req.ip, userAgent: req.headers['user-agent'] }
    );
    res.ok(canceled);
  } catch (error) {
    next(error);
  }
};
