import { Response, NextFunction } from 'express';
import * as userStation from './users.station';
import { AppRequest } from '../../types/express';
import { listUsersSchema } from './users.validators';

export const createUserController = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { gamingCenterId } = req.params;
    const newUser = await userStation.createStaffMember(
      gamingCenterId,
      req.body,
      req.actor,
      { ip: req.ip, userAgent: req.headers['user-agent'] }
    );
    res.created(newUser);
  } catch (error) {
    next(error);
  }
};

export const deleteUserController = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { gamingCenterId, userId } = req.params;
    await userStation.deleteStaffMember(
      gamingCenterId,
      userId,
      req.actor,
      { ip: req.ip, userAgent: req.headers['user-agent'] }
    );
    res.noContent();
  } catch (error) {
    next(error);
  }
};

export const getUsersController = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { gamingCenterId } = req.params;
    const validatedQuery = listUsersSchema.parse(req.query);
    const staff = await userStation.getStaffList(gamingCenterId, validatedQuery);
    res.ok(staff);
  } catch (error) {
    next(error);
  }
};

export const getUserController = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { gamingCenterId, userId } = req.params;
    const user = await userStation.getStaffMember(gamingCenterId, userId);
    res.ok(user);
  } catch (error) {
    next(error);
  }
};

export const updateUserController = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { gamingCenterId, userId } = req.params;
    const updatedUser = await userStation.updateStaffMember(
      gamingCenterId,
      userId,
      req.body,
      req.actor,
      { ip: req.ip, userAgent: req.headers['user-agent'] }
    );
    res.ok(updatedUser);
  } catch (error) {
    next(error);
  }
};
