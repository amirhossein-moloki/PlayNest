import { Response } from 'express';
import { CustomerPanelStation } from './customer-panel.station';
import { AppRequest } from '../../types/express';

export const getMe = async (req: AppRequest, res: Response) => {
  const customerAccountId = req.actor.id;
  const profile = await CustomerPanelStation.getProfile(customerAccountId);
  res.ok(profile);
};

export const getMyReservation = async (req: AppRequest, res: Response) => {
  const customerAccountId = req.actor.id;
  const result = await CustomerPanelStation.getReservation(customerAccountId, req.query);
  res.ok(result.data, { pagination: result.meta });
};

export const getMyReservationDetails = async (req: AppRequest, res: Response) => {
  const customerAccountId = req.actor.id;
  const { reservationId } = req.params;
  const reservation = await CustomerPanelStation.getReservationDetails(reservationId, customerAccountId);
  res.ok(reservation);
};

export const cancelMyReservation = async (req: AppRequest, res: Response) => {
  const customerAccountId = req.actor.id;
  const { reservationId } = req.params;
  const { reason } = req.body;

  const reservation = await CustomerPanelStation.cancelReservation(
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

  const rating = await CustomerPanelStation.submitReview(
    reservationId,
    customerAccountId,
    req.body
  );

  res.created(rating);
};
