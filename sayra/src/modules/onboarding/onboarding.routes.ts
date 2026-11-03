import { Router } from 'express';
import { OnboardingController } from './onboarding.controller';
import { asyncHandler } from '../../common/middleware/asyncHandler';

export const onboardingRouter = Router();

// 1. Initial info & OTP
onboardingRouter.post('/start', asyncHandler(OnboardingController.startOnboarding));
onboardingRouter.post('/otp/verify', asyncHandler(OnboardingController.verifyOtp));

// 2. Address & Location
onboardingRouter.put('/:id/location', asyncHandler(OnboardingController.updateLocation));

// 3. Working Hours
onboardingRouter.put('/:id/working-hours', asyncHandler(OnboardingController.updateWorkingHours));

// 4. Media
onboardingRouter.put('/:id/media', asyncHandler(OnboardingController.updateMedia));

// 5. Preview
onboardingRouter.get('/:id/preview', asyncHandler(OnboardingController.getPreview));

// 6. Complete
onboardingRouter.post('/:id/complete', asyncHandler(OnboardingController.completeOnboarding));
