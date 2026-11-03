import { z } from 'zod';
import {
  createStationSchema,
  updateStationSchema,
  createStationsFromCatalogSchema,
  addGamesFromCatalogSchema,
} from './station.validator';

// Type for the body of the create station request
export type CreateStationInput = z.infer<typeof createStationSchema>['body'];

// Type for the body of the update station request
export type UpdateStationInput = z.infer<typeof updateStationSchema>['body'];

// Type for creating stations from catalog
export type CreateStationsFromCatalogInput = z.infer<typeof createStationsFromCatalogSchema>['body'];

// Type for adding games from catalog
export type AddGamesFromCatalogInput = z.infer<typeof addGamesFromCatalogSchema>['body'];
