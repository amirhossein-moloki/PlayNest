import { Router } from 'express';
import { OnboardingController } from './onboarding.controller';
import { asyncHandler } from '../../common/middleware/asyncHandler';
import {
  onboardingStartRateLimiter,
  onboardingOtpVerifyRateLimiter,
  publicApiRateLimiter,
} from '../../common/middleware/rateLimit';

export const onboardingRouter = Router();

// 1. Initial info & OTP
onboardingRouter.post('/start', onboardingStartRateLimiter, asyncHandler(OnboardingController.startOnboarding));
onboardingRouter.post('/otp/verify', onboardingOtpVerifyRateLimiter, asyncHandler(OnboardingController.verifyOtp));

// 2. Address & Location
onboardingRouter.put('/:id/location', publicApiRateLimiter, asyncHandler(OnboardingController.updateLocation));

// 3. Working Hours
onboardingRouter.put('/:id/working-hours', publicApiRateLimiter, asyncHandler(OnboardingController.updateWorkingHours));

// 4. Media
onboardingRouter.put('/:id/media', publicApiRateLimiter, asyncHandler(OnboardingController.updateMedia));

// 5. Preview
onboardingRouter.get('/:id/preview', publicApiRateLimiter, asyncHandler(OnboardingController.getPreview));

// 6. Complete
onboardingRouter.post('/:id/complete', publicApiRateLimiter, asyncHandler(OnboardingController.completeOnboarding));
