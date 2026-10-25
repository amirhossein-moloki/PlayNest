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
  return {
    name: station.name,
    hourlyPrice: station.hourlyPrice,
    stationType: station.stationType,
  };
};
