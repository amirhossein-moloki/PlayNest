import { Response } from 'express';
import { CustomerPanelStation } from './customer-panel.station';
import { PaymentsStation } from '../payments/payments.station';
import { AppRequest } from '../../types/express';

export const getMe = async (req: AppRequest, res: Response) => {
  const customerAccountId = req.actor.id;
  const profile = await CustomerPanelStation.getProfile(customerAccountId);
  res.ok(profile);
};

export const updateMe = async (req: AppRequest, res: Response) => {
  const customerAccountId = req.actor.id;
  const updatedProfile = await CustomerPanelStation.updateProfile(customerAccountId, req.body);
  res.ok(updatedProfile);
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

export const rescheduleMyReservation = async (req: AppRequest, res: Response) => {
  const customerAccountId = req.actor.id;
  const { reservationId } = req.params;

  const reservation = await CustomerPanelStation.rescheduleReservation(
    reservationId,
    customerAccountId,
    req.body,
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

export const getMyProposals = async (req: AppRequest, res: Response) => {
  const customerAccountId = req.actor.id;
  const { reservationId } = req.params;

  const proposals = await CustomerPanelStation.getCustomerProposals(
    reservationId,
    customerAccountId
  );

  res.ok(proposals);
};

export const acceptProposal = async (req: AppRequest, res: Response) => {
  const customerAccountId = req.actor.id;
  const { reservationId, proposalId } = req.params;

  const result = await CustomerPanelStation.acceptProposal(
    reservationId,
    proposalId,
    customerAccountId,
    { ip: req.ip, userAgent: req.headers['user-agent'] }
  );

  res.ok(result);
};

export const rejectProposal = async (req: AppRequest, res: Response) => {
  const customerAccountId = req.actor.id;
  const { reservationId, proposalId } = req.params;

  const proposal = await CustomerPanelStation.rejectProposal(
    reservationId,
    proposalId,
    customerAccountId,
    { ip: req.ip, userAgent: req.headers['user-agent'] }
  );

  res.ok(proposal);
};

export const initMyReservationPayment = async (req: AppRequest, res: Response) => {
  const { reservationId } = req.params;
  const idempotencyKey = req.header('Idempotency-Key');
  const providerName = req.body?.provider;
  const useWallet = req.body?.useWallet;

  const reservation = await CustomerPanelStation.getReservationDetails(reservationId, req.actor.id);

  const result = await PaymentsStation.initiatePayment({
    gamingCenterId: reservation.gamingCenterId,
    reservationId,
    idempotencyKey: idempotencyKey ?? null,
    providerName,
    useWallet,
    actor: req.actor,
  });

  res.created(result);
};

export const calculateMyReservationPayment = async (req: AppRequest, res: Response) => {
  const { reservationId } = req.params;
  const useWallet = req.query.useWallet === 'true' || req.query.useWallet === '1';

  const reservation = await CustomerPanelStation.getReservationDetails(reservationId, req.actor.id);

  const result = await PaymentsStation.calculatePayment({
    gamingCenterId: reservation.gamingCenterId,
    reservationId,
    useWallet,
    actor: req.actor,
  });

  res.ok(result);
};

export const getMyReservationPaymentStatus = async (req: AppRequest, res: Response) => {
  const { reservationId } = req.params;

  const reservation = await CustomerPanelStation.getReservationDetails(reservationId, req.actor.id);

  const result = await PaymentsStation.getPaymentStatus({
    gamingCenterId: reservation.gamingCenterId,
    reservationId,
  });

  res.ok(result);
};
