import { Request, Response } from 'express';
import { LocationsService } from './locations.data';
import httpStatus from 'http-status';

export const LocationsController = {
  getProvinces(_req: Request, res: Response) {
    const provinces = LocationsService.getProvinces();
    return res.ok(provinces);
  },

  getCities(req: Request, res: Response) {
    const { id } = req.params;
    const province = LocationsService.findProvinceById(id);
    if (!province) {
      return res.fail('NOT_FOUND', 'Province not found', httpStatus.NOT_FOUND);
    }
    const cities = LocationsService.getCitiesByProvinceId(id);
    return res.ok(cities);
  },
};
