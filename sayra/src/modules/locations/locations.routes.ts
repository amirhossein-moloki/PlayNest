import { Router } from 'express';
import { LocationsController } from './locations.controller';

export const locationsRouter = Router();

locationsRouter.get('/provinces', LocationsController.getProvinces);
locationsRouter.get('/provinces/:id/cities', LocationsController.getCities);
