import { Request, Response } from 'express';
import * as SiteSettingsStation from './site-settings.station';
import { UpdateSiteSettingsInput } from './site-settings.validators';

export async function getSiteSettings(
  req: Request<{ gamingCenterId: string }>,
  res: Response
) {
  const { gamingCenterId } = req.params;
  const settings = await SiteSettingsStation.getSiteSettings(gamingCenterId);
  res.ok(settings);
}

export async function upsertSiteSettings(
  req: Request<{ gamingCenterId: string }, unknown, UpdateSiteSettingsInput>,
  res: Response
) {
  const { gamingCenterId } = req.params;
  const settings = await SiteSettingsStation.upsertSiteSettings(
    gamingCenterId,
    req.body
  );
  res.ok(settings);
}
