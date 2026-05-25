import { Response } from 'express';
import { CustomerPanelService } from './customer-panel.station';
import { AppRequest } from '../../types/express';

export const getMe = async (req: AppRequest, res: Response) => {
  const customerAccountId = req.actor.id;
  const profile = await CustomerPanelService.getProfile(customerAccountId);
  res.ok(profile);
};

export const getMyBookings = async (req: AppRequest, res: Response) => {
  const customerAccountId = req.actor.id;
  const result = await CustomerPanelService.getBookings(customerAccountId, req.query);
  res.ok(result.data, { pagination: result.meta });
};

export const getMyBookingDetails = async (req: AppRequest, res: Response) => {
  const customerAccountId = req.actor.id;
  const { reservationId } = req.params;
  const reservation = await CustomerPanelService.getBookingDetails(reservationId, customerAccountId);
  res.ok(reservation);
};

export const cancelMyBooking = async (req: AppRequest, res: Response) => {
  const customerAccountId = req.actor.id;
  const { reservationId } = req.params;
  const { reason } = req.body;

  const reservation = await CustomerPanelService.cancelBooking(
    reservationId,
    customerAccountId,
    reason,
    { ip: req.ip, userAgent: req.headers['user-agent'] }
  );

  res.ok(reservation);
};

export const submitMyReview = async (req: AppRequest, res: Response) => {
  const customerAccountId = req.actor.id;
  const { reservationId } = req.params;

  const rating = await CustomerPanelService.submitReview(
    reservationId,
    customerAccountId,
    req.body
  );

  res.created(rating);
};
