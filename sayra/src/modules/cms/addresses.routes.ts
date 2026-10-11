import { Router } from 'express';
import * as controller from './addresses.controller';
import { validate } from '../../common/middleware/validate';
import { createAddressSchema, updateAddressSchema } from './addresses.validators';
import { asyncHandler } from '../../common/middleware/asyncHandler';

export const cmsAddressesRouter = Router({ mergeParams: true });

cmsAddressesRouter.get('/', asyncHandler(controller.getAddresses));
cmsAddressesRouter.post('/', validate(createAddressSchema), asyncHandler(controller.createAddress));
cmsAddressesRouter.patch('/:addressId', validate(updateAddressSchema), asyncHandler(controller.updateAddress));
cmsAddressesRouter.delete('/:addressId', asyncHandler(controller.deleteAddress));
