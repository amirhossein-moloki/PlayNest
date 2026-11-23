import { Response } from 'express';
import httpStatus from 'http-status';
import { AppRequest } from '../../types/express';
import { commissionsStation } from './commissions.station';
import { prisma } from '../../config/prisma';
import AppError from '../../common/errors/AppError';

async function ensureGamingCenterExists(gamingCenterId: string) {
  const center = await prisma.gamingCenter.findUnique({
    where: { id: gamingCenterId },
    select: { id: true },
  });
  if (!center) {
    throw new AppError('GamingCenter not found.', httpStatus.NOT_FOUND);
  }
}

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

export const getTargetProgress = async (
  req: AppRequest,
  res: Response
) => {
  const targetPeriod = req.query.targetPeriod as string | undefined;
  const progress = await commissionsStation.getTargetProgress(
    req.tenant.gamingCenterId,
    targetPeriod
  );
  res.ok(progress);
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

export const waiveCommission = async (
  req: AppRequest,
  res: Response
) => {
  const earning = await commissionsStation.waiveCommission(
    req.params.earningId,
    req.tenant.gamingCenterId,
    req.body || {},
    req.actor,
    { ip: req.ip, userAgent: req.headers['user-agent'] }
  );
  res.ok(earning);
};

export const platformGetPolicy = async (
  req: AppRequest,
  res: Response
) => {
  const { gamingCenterId } = req.params;
  await ensureGamingCenterExists(gamingCenterId);
  const policy = await commissionsStation.getPolicy(gamingCenterId);
  res.ok(policy);
};

export const platformUpsertPolicy = async (
  req: AppRequest,
  res: Response
) => {
  const { gamingCenterId } = req.params;
  await ensureGamingCenterExists(gamingCenterId);
  const policy = await commissionsStation.upsertPolicy(
    gamingCenterId,
    req.body,
    req.actor,
    { ip: req.ip, userAgent: req.headers['user-agent'] }
  );
  res.ok(policy);
};

export const platformListEarnings = async (
  req: AppRequest,
  res: Response
) => {
  const result = await commissionsStation.listAllEarnings(req.query);
  res.ok(result.data, { pagination: result.meta });
};

export const platformPayCommission = async (
  req: AppRequest,
  res: Response
) => {
  const payment = await commissionsStation.payCommission(
    req.params.earningId,
    undefined,
    req.body,
    req.actor,
    { ip: req.ip, userAgent: req.headers['user-agent'] }
  );
  res.created(payment);
};

export const platformWaiveCommission = async (
  req: AppRequest,
  res: Response
) => {
  const earning = await commissionsStation.waiveCommission(
    req.params.earningId,
    undefined,
    req.body || {},
    req.actor,
    { ip: req.ip, userAgent: req.headers['user-agent'] }
  );
  res.ok(earning);
};
