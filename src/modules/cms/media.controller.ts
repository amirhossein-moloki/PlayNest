import { Request, Response } from 'express';
import * as MediaService from './media.station';
import { CreateMediaInput, UpdateMediaInput } from './media.types';

export async function createMedia(
  req: Request<{ gamingCenterId: string }, unknown, CreateMediaInput>,
  res: Response
) {
  const { gamingCenterId } = req.params;
  const media = await MediaService.createMedia(gamingCenterId, req.body);
  res.created(media);
}

export async function updateMedia(
  req: Request<{ gamingCenterId: string; mediaId: string }, unknown, UpdateMediaInput>,
  res: Response
) {
  const { gamingCenterId, mediaId } = req.params;
  const media = await MediaService.updateMedia(gamingCenterId, mediaId, req.body);
  res.ok(media);
}
