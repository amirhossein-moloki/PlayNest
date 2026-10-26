import { Response } from 'express';
import { AppRequest } from '../../types/express';
import { discountsStation } from './discounts.station';
import {
  CreateCampaignInput,
  CreateDiscountInput,
  ListDiscountQuery,
  UpdateCampaignInput,
  UpdateDiscountInput,
  UpdateDiscountStatusInput,
  ValidatePromoCodeInput,
} from './discounts.dto';

export const createCampaign = async (req: AppRequest, res: Response) => {
  const { gamingCenterId } = req.params;
  const body = req.body as CreateCampaignInput;

  const campaign = await discountsStation.createCampaign(
    gamingCenterId || null,
    req.actor?.id || null,
    body,
    req.actor,
    { ip: req.ip, userAgent: req.get('user-agent') }
  );

  res.created(campaign);
};

export const getCampaignById = async (req: AppRequest, res: Response) => {
  const { gamingCenterId, id } = req.params;
  const campaign = await discountsStation.getCampaignById(id, gamingCenterId);
  res.ok(campaign);
};

export const listCampaigns = async (req: AppRequest, res: Response) => {
  const { gamingCenterId } = req.params;
  const query = req.query as any;
  const result = await discountsStation.listCampaigns(gamingCenterId, {
    page: query.page ? Number(query.page) : 1,
    pageSize: query.pageSize ? Number(query.pageSize) : 20,
    isActive: query.isActive === 'true' ? true : query.isActive === 'false' ? false : undefined,
  });
  res.ok(result.data, { pagination: result.meta });
};

export const updateCampaign = async (req: AppRequest, res: Response) => {
  const { gamingCenterId, id } = req.params;
  const body = req.body as UpdateCampaignInput;

  const campaign = await discountsStation.updateCampaign(
    id,
    gamingCenterId,
    body,
    req.actor,
    { ip: req.ip, userAgent: req.get('user-agent') }
  );

  res.ok(campaign);
};

export const validatePromoCode = async (req: AppRequest, res: Response) => {
  const { gamingCenterId } = req.params;
  const body = req.body as ValidatePromoCodeInput;

  const result = await discountsStation.validateAndApplyPromoCode(
    gamingCenterId,
    body.code,
    body.stationId,
    body.basePrice,
    body.customerAccountId,
    new Date(),
    false
  );

  res.ok({
    valid: true,
    campaignId: result.campaign.id,
    campaignName: result.campaign.name,
    code: result.campaign.code,
    discountAmount: result.discountAmount,
    fundingSource: result.fundingSource,
    platformFundedDiscount: result.platformFundedDiscount,
    customerPayableAmount: result.customerPayableAmount,
  });
};

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
