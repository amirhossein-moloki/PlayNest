import { prisma } from '../../config/prisma';

export interface RegisteredCityItem {
  city: string;
  gamingCenterCount: number;
}

export interface MapGamingCenterItem {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

export const PublicGamingCentersRepo = {
  /**
   * Returns unique cities with at least one active GamingCenter using DB-level GROUP BY and COUNT(DISTINCT).
   * Excludes inactive centers and null/empty city values.
   */
  async findRegisteredCities(): Promise<RegisteredCityItem[]> {
    const rows = await prisma.$queryRaw<Array<{ city: string; gamingCenterCount: number }>>`
      SELECT
        TRIM(a."city") AS "city",
        COUNT(DISTINCT a."gamingCenterId")::int AS "gamingCenterCount"
      FROM "Address" a
      INNER JOIN "GamingCenter" gc ON gc."id" = a."gamingCenterId"
      WHERE gc."isActive" = true
        AND gc."verificationStatus" = 'APPROVED'
        AND a."city" IS NOT NULL
        AND TRIM(a."city") <> ''
      GROUP BY TRIM(a."city")
      ORDER BY "gamingCenterCount" DESC, "city" ASC
    `;

    return (rows || [])
      .map((r) => ({
        city: typeof r.city === 'string' ? r.city.trim() : '',
        gamingCenterCount: Number(r.gamingCenterCount) || 0,
      }))
      .filter((r) => r.city.length > 0 && r.gamingCenterCount > 0);
  },

  /**
   * Returns active, approved gaming centers with valid geographic coordinates for a specific city.
   * Only returns minimal map marker fields: id, name, latitude, longitude.
   */
  async findMapGamingCentersByCity(city: string): Promise<MapGamingCenterItem[]> {
    const normalizedCity = typeof city === 'string' ? city.trim() : '';
    if (!normalizedCity) {
      return [];
    }

    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        name: string;
        latitude: number | string | null;
        longitude: number | string | null;
      }>
    >`
      SELECT
        sub."id",
        sub."name",
        sub."latitude",
        sub."longitude"
      FROM (
        SELECT DISTINCT ON (gc."id")
          gc."id" AS "id",
          gc."name" AS "name",
          a."lat"::float8 AS "latitude",
          a."lng"::float8 AS "longitude"
        FROM "GamingCenter" gc
        INNER JOIN "Address" a ON a."gamingCenterId" = gc."id"
        WHERE gc."isActive" = true
          AND gc."verificationStatus" = 'APPROVED'
          AND a."city" IS NOT NULL
          AND LOWER(TRIM(a."city")) = LOWER(TRIM(${normalizedCity}))
          AND a."lat" IS NOT NULL
          AND a."lng" IS NOT NULL
          AND a."lat" BETWEEN -90 AND 90
          AND a."lng" BETWEEN -180 AND 180
          AND NOT (a."lat" = 0 AND a."lng" = 0)
        ORDER BY gc."id", a."isPrimary" DESC, a."createdAt" ASC
      ) sub
      ORDER BY sub."name" ASC, sub."id" ASC
    `;

    const seenIds = new Set<string>();
    const result: MapGamingCenterItem[] = [];

    for (const r of rows || []) {
      if (!r || typeof r !== 'object') continue;
      const id = typeof r.id === 'string' ? r.id.trim() : '';
      const name = typeof r.name === 'string' ? r.name.trim() : '';
      if (!id || !name || seenIds.has(id)) continue;

      const rawLat = r.latitude !== undefined ? r.latitude : (r as { lat?: unknown }).lat;
      const rawLng = r.longitude !== undefined ? r.longitude : (r as { lng?: unknown }).lng;

      if (
        rawLat === null ||
        rawLat === undefined ||
        rawLat === '' ||
        typeof rawLat === 'boolean' ||
        rawLng === null ||
        rawLng === undefined ||
        rawLng === '' ||
        typeof rawLng === 'boolean'
      ) {
        continue;
      }

      const latitude = Number(rawLat);
      const longitude = Number(rawLng);

      if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180 ||
        (latitude === 0 && longitude === 0)
      ) {
        continue;
      }

      seenIds.add(id);
      result.push({
        id,
        name,
        latitude,
        longitude,
      });
    }

    return result;
  },
};
