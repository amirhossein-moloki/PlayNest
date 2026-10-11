
import { Response } from 'express';
import { AppRequest } from '../../types/express';
import { commissionsStation } from './commissions.station';
export const getPolicy = async (
  req: AppRequest,
  res: Response
) => {
  const policy = await commissionsStation.getPolicy(req.tenant.gamingCenterId);
  res.ok(policy);
};

export const upsertPolicy = async (
  req: AppRequest,
  res: Response
) => {
  const policy = await commissionsStation.upsertPolicy(
    req.tenant.gamingCenterId,
    req.body,
    req.actor,
    { ip: req.ip, userAgent: req.headers['user-agent'] }
  );
  res.ok(policy);
};

export const listEarnings = async (
  req: AppRequest,
  res: Response
) => {
  const result = await commissionsStation.listEarnings(req.tenant.gamingCenterId, req.query);
  res.ok(result.data, { pagination: result.meta });
};

export const payCommission = async (
  req: AppRequest,
  res: Response
) => {
  const payment = await commissionsStation.payCommission(
    req.params.earningId,
    req.tenant.gamingCenterId,
    req.body,
    req.actor,
    { ip: req.ip, userAgent: req.headers['user-agent'] }
  );
  res.created(payment);
};
