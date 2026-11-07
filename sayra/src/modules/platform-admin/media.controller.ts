import { Request, Response, NextFunction } from 'express';
import { PlatformMediaStation } from './media.station';

export class PlatformMediaController {
  /**
   * POST /api/v1/platform-admin/media/upload
   * Handles direct multipart image uploads from Platform Super Admin and returns public URLs.
   */
  static async uploadMedia(req: Request, res: Response, next: NextFunction) {
    try {
      const file = req.file;
      const platformAdminId = req.actor?.id;

      const result = await PlatformMediaStation.uploadMedia({
        file: file as Express.Multer.File,
        platformAdminId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}
