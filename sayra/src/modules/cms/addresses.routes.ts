import { Router } from 'express';
import * as controller from './addresses.controller';
import { validate } from '../../common/middleware/validate';
import { createAddressSchema, updateAddressSchema } from './addresses.validators';
import { asyncHandler } from '../../common/middleware/asyncHandler';

export const cmsAddressesRouter = Router({ mergeParams: true });

cmsAddressesRouter.get('/', asyncHandler(controller.getAddresses));

cmsAddressesRouter.post('/', validate(createAddressSchema), asyncHandler(controller.createAddress));
cmsAddressesRouter.post('/:addressId', validate(updateAddressSchema), asyncHandler(controller.updateAddress));

cmsAddressesRouter.patch('/:addressId', validate(updateAddressSchema), asyncHandler(controller.updateAddress));
cmsAddressesRouter.put('/:addressId', validate(updateAddressSchema), asyncHandler(controller.updateAddress));

cmsAddressesRouter.patch('/', validate(updateAddressSchema), asyncHandler(controller.updateAddress));
cmsAddressesRouter.put('/', validate(updateAddressSchema), asyncHandler(controller.updateAddress));

cmsAddressesRouter.delete('/:addressId', asyncHandler(controller.deleteAddress));
