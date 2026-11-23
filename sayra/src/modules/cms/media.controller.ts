import { Request, Response } from 'express';
import * as MediaStation from './media.station';
import { CreateMediaInput, UpdateMediaInput } from './media.types';
import { invalidatePublicCacheByPrefix } from '../../common/utils/publicCache';

export async function createMedia(
  req: Request<{ gamingCenterId: string }, unknown, CreateMediaInput>,
  res: Response
) {
  const { gamingCenterId } = req.params;
  const media = await MediaStation.createMedia(gamingCenterId, req.body);
  void invalidatePublicCacheByPrefix('public:gc:');
  res.created(media);
}

export async function updateMedia(
  req: Request<{ gamingCenterId: string; mediaId: string }, unknown, UpdateMediaInput>,
  res: Response
) {
  const { gamingCenterId, mediaId } = req.params;
  const media = await MediaStation.updateMedia(gamingCenterId, mediaId, req.body);
  void invalidatePublicCacheByPrefix('public:gc:');
  res.ok(media);
}

export async function deleteMedia(
  req: Request<{ gamingCenterId: string; mediaId: string }>,
  res: Response
) {
  const { gamingCenterId, mediaId } = req.params;
  await MediaStation.deleteMedia(gamingCenterId, mediaId);
  void invalidatePublicCacheByPrefix('public:gc:');
  res.noContent();
}
