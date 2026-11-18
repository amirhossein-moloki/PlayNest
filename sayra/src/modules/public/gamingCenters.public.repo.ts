import { prisma } from '../../config/prisma';

export interface RegisteredCityItem {
  city: string;
  gamingCenterCount: number;
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
        AND a."city" IS NOT NULL
        AND TRIM(a."city") <> ''
      GROUP BY TRIM(a."city")
      ORDER BY "gamingCenterCount" DESC, "city" ASC
    `;

    return rows
      .map((r) => ({
        city: typeof r.city === 'string' ? r.city.trim() : '',
        gamingCenterCount: Number(r.gamingCenterCount) || 0,
      }))
      .filter((r) => r.city.length > 0 && r.gamingCenterCount > 0);
  },
};
