import { Request, Response, NextFunction } from 'express';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import * as uploadStation from '../../common/stations/upload.station';
import * as MediaStation from './media.station';

export async function uploadMedia(
  req: Request<{ gamingCenterId: string }>,
  res: Response,
  next: NextFunction
) {
  try {
    const { gamingCenterId } = req.params;
    const file = req.file;

    if (!file) {
      throw new AppError('No file uploaded.', httpStatus.BAD_REQUEST);
    }

    // Process image: save original and generate thumbnail
    const { url, thumbUrl } = await uploadStation.processAndStoreImage(file);

    // Create database record using existing station logic
    // We pass the generated URLs to the station
    const media = await MediaStation.createMedia(gamingCenterId, {
      ...req.body,
      url,
      thumbUrl,
    });

    res.created(media);
  } catch (error) {
    next(error);
  }
}
