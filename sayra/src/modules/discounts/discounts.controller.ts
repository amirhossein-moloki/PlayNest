import { Response } from 'express';
import { AppRequest } from '../../types/express';
import { discountsStation } from './discounts.station';
import {
  CreateDiscountInput,
  ListDiscountQuery,
  UpdateDiscountInput,
  UpdateDiscountStatusInput,
} from './discounts.dto';

export const createDiscount = async (req: AppRequest, res: Response) => {
  const { gamingCenterId } = req.params;
  const body = req.body as CreateDiscountInput;

  const discount = await discountsStation.createDiscount(
    gamingCenterId,
    req.actor.id,
    body,
    req.actor,
    { ip: req.ip, userAgent: req.get('user-agent') }
  );

  res.created(discount);
};

export const getDiscountById = async (req: AppRequest, res: Response) => {
  const { gamingCenterId, id } = req.params;
  const discount = await discountsStation.getDiscountById(id, gamingCenterId);
  res.ok(discount);
};

export const listDiscounts = async (req: AppRequest, res: Response) => {
  const { gamingCenterId } = req.params;
  const query = req.query as unknown as ListDiscountQuery;
  const result = await discountsStation.listDiscounts(gamingCenterId, query);
  res.ok(result.data, { pagination: result.meta });
};

export const updateDiscount = async (req: AppRequest, res: Response) => {
  const { gamingCenterId, id } = req.params;
  const body = req.body as UpdateDiscountInput;

  const discount = await discountsStation.updateDiscount(
    id,
    gamingCenterId,
    body,
    req.actor,
    { ip: req.ip, userAgent: req.get('user-agent') }
  );

  res.ok(discount);
};

export const updateDiscountStatus = async (req: AppRequest, res: Response) => {
  const { gamingCenterId, id } = req.params;
  const body = req.body as UpdateDiscountStatusInput;

  const discount = await discountsStation.updateDiscountStatus(
    id,
    gamingCenterId,
    body,
    req.actor,
    { ip: req.ip, userAgent: req.get('user-agent') }
  );

  res.ok(discount);
};

export const deleteDiscount = async (req: AppRequest, res: Response) => {
  const { gamingCenterId, id } = req.params;

  const deleted = await discountsStation.deleteDiscount(
    id,
    gamingCenterId,
    req.actor,
    { ip: req.ip, userAgent: req.get('user-agent') }
  );

  res.ok(deleted);
};
