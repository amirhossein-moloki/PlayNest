import { z } from 'zod';
import {
  createStationSchema,
  updateStationSchema,
  createStationsFromCatalogSchema,
  addGamesFromCatalogSchema,
  updateGamingCenterGameSchema,
  listGamingCenterGamesQuerySchema,
  replaceStationGamesSchema,
} from './station.validator';

// Type for the body of the create station request
export type CreateStationInput = z.infer<typeof createStationSchema>['body'];

// Type for the body of the update station request
export type UpdateStationInput = z.infer<typeof updateStationSchema>['body'];

// Type for creating stations from catalog
export type CreateStationsFromCatalogInput = z.infer<typeof createStationsFromCatalogSchema>['body'];

// Type for adding games from catalog
export type AddGamesFromCatalogInput = z.infer<typeof addGamesFromCatalogSchema>['body'];

// Type for updating a gaming center game's play mode
export type UpdateGamingCenterGameInput = z.infer<typeof updateGamingCenterGameSchema>['body'];

// Type for replacing games assigned to a specific station
export type ReplaceStationGamesInput = z.infer<typeof replaceStationGamesSchema>['body'];

// Type for listing gaming center games query
export type ListGamingCenterGamesQuery = z.infer<typeof listGamingCenterGamesQuerySchema>;
