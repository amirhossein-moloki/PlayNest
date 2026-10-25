import { GameStation } from '@prisma/client';

export interface StationSnapshot {
  name: string;
  hourlyPrice: number;
  stationType: string;
}

/**
 * Creates a station snapshot for reservation immutability.
 */
export const createStationSnapshot = (station: {
  name: string;
  hourlyPrice: number;
  stationType: string;
}): StationSnapshot => {
 * Creates a station snapshot object from a GameStation model for immutable reservation history.
 */
export function createStationSnapshot(station: Pick<GameStation, 'name' | 'hourlyPrice' | 'stationType'>): StationSnapshot {
  return {
    name: station.name,
    hourlyPrice: station.hourlyPrice,
    stationType: station.stationType,
  };
};
}
