import { Request, Response } from 'express';
import httpStatus from 'http-status';
import { SessionActorType } from '@prisma/client';
import AppError from '../../common/errors/AppError';
import { AppRequest } from '../../types/express';
import { ShortLinksService } from './shortLinks.service';
import { ShortLinkActor } from './shortLinks.types';
import {
  listCampaignsQuerySchema,
  listShortLinksQuerySchema,
  qrCodeQuerySchema,
  shortLinkStatsQuerySchema,
} from './shortLinks.validators';

function requireActor(req: Request): ShortLinkActor {
  const appReq = req as AppRequest;
  if (!appReq.actor || !appReq.actor.id) {
    throw new AppError('Unauthorized', httpStatus.UNAUTHORIZED);
  }
  if (appReq.actor.actorType === SessionActorType.CUSTOMER) {
    throw new AppError(
      'Forbidden: Short link management is restricted to staff, managers, and platform admins.',
      httpStatus.FORBIDDEN
    );
  }
  return {
    id: appReq.actor.id,
    actorId: appReq.actor.actorId || appReq.actor.id,
    actorType: appReq.actor.actorType,
    gamingCenterId: appReq.tenant?.gamingCenterId || appReq.actor.gamingCenterId,
    role: appReq.actor.role,
    isSuperuser: appReq.actor.isSuperuser,
  };
}

export const ShortLinksController = {
  async redirect(req: Request<{ code: string }>, res: Response) {
    const result = await ShortLinksService.resolveRedirect(req.params.code, req);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('Referrer-Policy', 'no-referrer-when-downgrade');
    res.redirect(result.statusCode, result.location);
  },

  async createLink(req: Request, res: Response) {
    const actor = requireActor(req);
    const tenantCenterId = (req as AppRequest).params?.gamingCenterId || (req as AppRequest).tenant?.gamingCenterId;
    const payload = {
      ...req.body,
      ...(tenantCenterId ? { gamingCenterId: tenantCenterId } : {}),
    };
    const created = await ShortLinksService.createLink(actor, payload, req);
    res.created(created);
  },

  async listLinks(req: Request, res: Response) {
    const actor = requireActor(req);
    const tenantCenterId = req.params.gamingCenterId || (req as AppRequest).tenant?.gamingCenterId;
    const query = listShortLinksQuerySchema.parse({
      ...req.query,
      ...(tenantCenterId ? { gamingCenterId: tenantCenterId } : {}),
    });
    const result = await ShortLinksService.listLinks(actor, query);
    res.ok(result);
  },

  async getLinkById(req: Request<{ linkId: string }>, res: Response) {
    const actor = requireActor(req);
    const link = await ShortLinksService.getLinkById(actor, req.params.linkId);
    res.ok(link);
  },

  async updateLink(req: Request<{ linkId: string }>, res: Response) {
    const actor = requireActor(req);
    const updated = await ShortLinksService.updateLink(actor, req.params.linkId, req.body, req);
    res.ok(updated);
  },

  async changeDestination(req: Request<{ linkId: string }>, res: Response) {
    const actor = requireActor(req);
    const updated = await ShortLinksService.changeDestination(
      actor,
      req.params.linkId,
      req.body.destinationUrl,
      req.body.reason,
      req
    );
    res.ok(updated);
  },

  async updateLinkStatus(req: Request<{ linkId: string }>, res: Response) {
    const actor = requireActor(req);
    const updated = await ShortLinksService.updateLinkStatus(
      actor,
      req.params.linkId,
      req.body.status,
      req.body.reason,
      req
    );
    res.ok(updated);
  },

  async deleteLink(req: Request<{ linkId: string }>, res: Response) {
    const actor = requireActor(req);
    await ShortLinksService.deleteLink(actor, req.params.linkId, req);
    res.noContent();
  },

  async getLinkHistory(req: Request<{ linkId: string }>, res: Response) {
    const actor = requireActor(req);
    const page = Math.max(1, Number(req.query.page || 1) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20) || 20));
    const result = await ShortLinksService.getLinkHistory(actor, req.params.linkId, page, limit);
    res.ok(result);
  },

  async getLinkStats(req: Request<{ linkId: string }>, res: Response) {
    const actor = requireActor(req);
    const query = shortLinkStatsQuerySchema.parse(req.query);
    const stats = await ShortLinksService.getLinkStats(actor, req.params.linkId, query);
    res.ok(stats);
  },

  async getLinkQr(req: Request<{ linkId: string }>, res: Response) {
    const actor = requireActor(req);
    const params = qrCodeQuerySchema.parse(req.query);
    const qr = await ShortLinksService.generateLinkQr(actor, req.params.linkId, params);

    if (params.format === 'json' || params.format === 'dataurl') {
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.ok({
        format: qr.format,
        mimeType: params.format === 'json' ? 'image/svg+xml' : 'image/png',
        ...(qr.svg ? { svg: qr.svg } : {}),
        dataUrl: qr.dataUrl,
        meta: qr.meta,
      });
      return;
    }

    const ext = params.format === 'png' ? 'png' : 'svg';
    res.setHeader('Content-Type', qr.mimeType);
    res.setHeader('Cache-Control', 'public, max-age=300');
    if (params.download) {
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="qr-${req.params.linkId}.${ext}"`
      );
    } else {
      res.setHeader('Content-Disposition', `inline; filename="qr-${req.params.linkId}.${ext}"`);
    }
    res.status(httpStatus.OK).send(qr.buffer);
  },

  // Campaigns
  async createCampaign(req: Request, res: Response) {
    const actor = requireActor(req);
    const tenantCenterId = req.params.gamingCenterId || (req as AppRequest).tenant?.gamingCenterId;
    const payload = {
      ...req.body,
      ...(tenantCenterId ? { gamingCenterId: tenantCenterId } : {}),
    };
    const created = await ShortLinksService.createCampaign(actor, payload, req);
    res.created(created);
  },

  async listCampaigns(req: Request, res: Response) {
    const actor = requireActor(req);
    const tenantCenterId = req.params.gamingCenterId || (req as AppRequest).tenant?.gamingCenterId;
    const query = listCampaignsQuerySchema.parse({
      ...req.query,
      ...(tenantCenterId ? { gamingCenterId: tenantCenterId } : {}),
    });
    const result = await ShortLinksService.listCampaigns(actor, query);
    res.ok(result);
  },

  async getCampaignById(req: Request<{ campaignId: string }>, res: Response) {
    const actor = requireActor(req);
    const campaign = await ShortLinksService.getCampaignById(actor, req.params.campaignId);
    res.ok(campaign);
  },

  async updateCampaign(req: Request<{ campaignId: string }>, res: Response) {
    const actor = requireActor(req);
    const updated = await ShortLinksService.updateCampaign(actor, req.params.campaignId, req.body, req);
    res.ok(updated);
  },

  async updateCampaignStatus(req: Request<{ campaignId: string }>, res: Response) {
    const actor = requireActor(req);
    const updated = await ShortLinksService.updateCampaignStatus(
      actor,
      req.params.campaignId,
      req.body.status,
      req
    );
    res.ok(updated);
  },

  async deleteCampaign(req: Request<{ campaignId: string }>, res: Response) {
    const actor = requireActor(req);
    await ShortLinksService.deleteCampaign(actor, req.params.campaignId, req);
    res.noContent();
  },

  async getCampaignStats(req: Request<{ campaignId: string }>, res: Response) {
    const actor = requireActor(req);
    const query = shortLinkStatsQuerySchema.parse(req.query);
    const stats = await ShortLinksService.getCampaignStats(actor, req.params.campaignId, query);
    res.ok(stats);
  },

  // Platform Admin Domain Rules
  async listDomainRules(_req: Request, res: Response) {
    const rules = await ShortLinksService.listDomainRules();
    res.ok(rules);
  },

  async createDomainRule(req: Request, res: Response) {
    const actor = requireActor(req);
    const created = await ShortLinksService.createDomainRule(actor, req.body, req);
    res.created(created);
  },

  async updateDomainRule(req: Request<{ ruleId: string }>, res: Response) {
    const actor = requireActor(req);
    const updated = await ShortLinksService.updateDomainRule(actor, req.params.ruleId, req.body, req);
    res.ok(updated);
  },

  async deleteDomainRule(req: Request<{ ruleId: string }>, res: Response) {
    const actor = requireActor(req);
    await ShortLinksService.deleteDomainRule(actor, req.params.ruleId, req);
    res.noContent();
  },
};
