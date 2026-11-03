import { Request, Response, NextFunction } from 'express';
import { OnboardingStation } from './onboarding.station';
import {
  startOnboardingSchema,
  verifyOnboardingOtpSchema,
  updateLocationSchema,
  updateWorkingHoursSchema,
  updateMediaSchema,
  completeOnboardingSchema,
} from './onboarding.validators';

export const OnboardingController = {
  async startOnboarding(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = startOnboardingSchema.parse(req.body) as {
        gameCenterName: string;
        managerFullName: string;
        managerPhone: string;
      };
      const result = await OnboardingStation.startOnboarding(validated);
      return res.created(result);
    } catch (err) {
      next(err);
    }
  },

  async verifyOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = verifyOnboardingOtpSchema.parse(req.body);
      const result = await OnboardingStation.verifyOtp(validated.onboardingId, validated.code);
      return res.ok(result);
    } catch (err) {
      next(err);
    }
  },

  async updateLocation(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const validated = updateLocationSchema.parse(req.body) as {
        provinceId: string;
        cityId: string;
        address: string;
        latitude?: number | null;
        longitude?: number | null;
      };
      const result = await OnboardingStation.updateLocation(id, validated);
      return res.ok(result);
    } catch (err) {
      next(err);
    }
  },

  async updateWorkingHours(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const validated = updateWorkingHoursSchema.parse(req.body) as {
        openingTime: string;
        closingTime: string;
        closedDays?: number[];
        timezone?: string;
      };
      const result = await OnboardingStation.updateWorkingHours(id, validated);
      return res.ok(result);
    } catch (err) {
      next(err);
    }
  },

  async updateMedia(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const validated = updateMediaSchema.parse(req.body);
      const result = await OnboardingStation.updateMedia(id, validated);
      return res.ok(result);
    } catch (err) {
      next(err);
    }
  },

  async getPreview(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await OnboardingStation.getPreview(id);
      return res.ok(result);
    } catch (err) {
      next(err);
    }
  },

  async completeOnboarding(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      completeOnboardingSchema.parse(req.body);
      const result = await OnboardingStation.completeOnboarding(id);
      return res.ok(result);
    } catch (err) {
      next(err);
    }
  },
};
