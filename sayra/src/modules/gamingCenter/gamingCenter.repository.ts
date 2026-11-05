import { prisma } from '../../config/prisma';
import { CreateGamingCenterInput, UpdateGamingCenterInput, GamingCenterListItem } from './gamingCenter.types';
import { Prisma, GameStation, Rating, Settings, Address } from '@prisma/client';
import { ListGamingCentersQuery, GetGamingCenterDetailsQuery } from './gamingCenter.validation';
import { getPaginationParams, formatPaginatedResult } from '../../common/utils/pagination';
import { toZonedTime } from 'date-fns-tz';

export function checkIsOpen(
  openingTime?: string | null,
  closingTime?: string | null,
  timeZone: string = 'Asia/Tehran',
  now: Date = new Date()
): boolean {
  if (!openingTime || !closingTime) {
    return true; // Default open if no schedule defined
  }

  const [openH, openM] = openingTime.split(':').map(Number);
  const [closeH, closeM] = closingTime.split(':').map(Number);

  if (isNaN(openH) || isNaN(openM) || isNaN(closeH) || isNaN(closeM)) {
    return true;
  }

  let zonedDate: Date;
  try {
    zonedDate = toZonedTime(now, timeZone);
  } catch {
    zonedDate = now;
  }

  const currentMinutes = zonedDate.getHours() * 60 + zonedDate.getMinutes();
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  if (openMinutes === closeMinutes) {
    return true; // Open 24h
  }

  if (closeMinutes > openMinutes) {
    // Normal day interval (e.g. 10:00 to 23:00)
    return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
  } else {
    // Overnight interval (e.g. 14:00 to 02:00)
    return currentMinutes >= openMinutes || currentMinutes < closeMinutes;
  }
}

type GamingCenterWithRelations = Prisma.GamingCenterGetPayload<{
  include: {
    addresses: true;
    ratings: true;
    settings: true;
  };
}> & {
  stations?: GameStation[];
};

export function transformGamingCenter(
  gc: GamingCenterWithRelations,
  deviceCounts?: { PC: number; PLAYSTATION: number; XBOX: number; SWITCH: number; VR: number }
): GamingCenterListItem {
  const stations: GameStation[] = gc.stations || [];
  const ratings: Rating[] = gc.ratings || [];
  const settings: Settings | null = gc.settings || null;
  const addresses: Address[] = gc.addresses || [];

  let hasPc = (deviceCounts ? deviceCounts.PC > 0 : false) || gc.pcCount > 0;
  let hasPs4 = false;
  let hasPs5 = deviceCounts ? deviceCounts.PLAYSTATION > 0 : false;
  let hasXbox = deviceCounts ? deviceCounts.XBOX > 0 : false;

  for (const st of stations) {
    const type = st.stationType;
    const nameLower = (st.name || '').toLowerCase();

    if (type === 'PC') {
      hasPc = true;
    } else if (type === 'PLAYSTATION') {
      if (nameLower.includes('ps4')) {
        hasPs4 = true;
      } else if (nameLower.includes('ps5')) {
        hasPs5 = true;
      } else {
        // Default playstation station to ps5 if not explicitly ps4
        hasPs5 = true;
      }
    } else if (type === 'XBOX') {
      hasXbox = true;
    }
  }

  // Fallback checks from description or center fields if not indicated in stations
  const descLower = (gc.description || '').toLowerCase();
  if (descLower.includes('ps4')) {
    hasPs4 = true;
  }
  if (descLower.includes('ps5')) {
    hasPs5 = true;
  }
  if (descLower.includes('xbox')) {
    hasXbox = true;
  }

  // Calculate rating and comment count
  const publishedRatings = ratings.filter((r) => r.status === 'PUBLISHED');
  const count = publishedRatings.length;
  let avgRating = 0;
  if (count > 0) {
    const sum = publishedRatings.reduce((acc, curr) => acc + curr.rating, 0);
    avgRating = Math.round((sum / count) * 10) / 10;
  }

  const commentCount = publishedRatings.filter((r) => r.comment && r.comment.trim().length > 0).length;

  const openTime = settings?.workStartTime || gc.openingTime;
  const closeTime = settings?.workEndTime || gc.closingTime;
  const tz = settings?.timeZone || 'Asia/Tehran';
  const isOpen = checkIsOpen(openTime, closeTime, tz);

  const finalPcCount = deviceCounts && (deviceCounts.PC > 0 || gc.stations !== undefined) ? deviceCounts.PC : gc.pcCount;
  const finalConsoleCount = deviceCounts && ((deviceCounts.PLAYSTATION + deviceCounts.XBOX + deviceCounts.SWITCH + deviceCounts.VR) > 0 || gc.stations !== undefined)
    ? deviceCounts.PLAYSTATION + deviceCounts.XBOX + deviceCounts.SWITCH + deviceCounts.VR
    : gc.consoleCount;

  return {
    id: gc.id,
    name: gc.name,
    isActive: gc.isActive,
    slug: gc.slug,
    description: gc.description,
    pcCount: finalPcCount,
    consoleCount: finalConsoleCount,
    ps4: hasPs4,
    ps5: hasPs5,
    pc: hasPc,
    xbox: hasXbox,
    is_open: isOpen,
    hourlyRate: gc.hourlyRate,
    raiting: avgRating,
    comment_count: commentCount > 0 ? commentCount : count,
    createdAt: gc.createdAt,
    updatedAt: gc.updatedAt,
    addresses,
    ...(deviceCounts ? { deviceCounts } : {}),
  };
}

export const gamingCenterRepository = {
  async transaction<T>(callback: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return prisma.$transaction(callback);
  },

  async findUserById(id: string, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.user.findUnique({
      where: { id },
      include: {
        gamingCenter: true,
      },
    });
  },

  async findPlatformAdminById(id: string, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.platformAdmin.findUnique({
      where: { id },
    });
  },

  async create(data: CreateGamingCenterInput, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    const createData: Prisma.GamingCenterCreateInput = {
      name: data.name,
      slug: data.slug,
      games: data.games || [],
    };
    return client.gamingCenter.create({
      data: createData,
    });
  },

  async updateUserGamingCenter(
    userId: string,
    gamingCenterId: string,
    data?: Partial<Prisma.UserUncheckedUpdateInput>,
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || prisma;
    const updateData: Prisma.UserUncheckedUpdateInput = {
      gamingCenterId,
      ...data,
    };
    return client.user.update({
      where: { id: userId },
      data: updateData,
    });
  },

  async createUser(
    data: Prisma.UserUncheckedCreateInput,
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || prisma;
    return client.user.create({
      data,
    });
  },

  async findById(id: string, options?: GetGamingCenterDetailsQuery): Promise<GamingCenterListItem | Record<string, unknown> | null> {
    const isCustomSelection = Boolean(options && (options.include !== undefined || options.fields !== undefined));

    if (!isCustomSelection) {
      const gc = await prisma.gamingCenter.findFirst({
        where: {
          OR: [
            { id },
            { slug: id },
          ],
          isActive: true,
        },
        include: {
          addresses: true,
          stations: true,
          ratings: true,
          settings: true,
        },
      });

      if (!gc) return null;
      return transformGamingCenter(gc);
    }

    // Build targeted include or select
    const includeRelations = options?.include;
    const selectFields = options?.fields;

    const includeClause: Prisma.GamingCenterInclude = {};
    if (includeRelations && includeRelations.length > 0) {
      if (includeRelations.includes('addresses')) includeClause.addresses = true;
      if (includeRelations.includes('stations')) includeClause.stations = true;
      if (includeRelations.includes('ratings')) includeClause.ratings = true;
      if (includeRelations.includes('settings')) includeClause.settings = true;
    }

    if (selectFields && selectFields.length > 0) {
      // Use Prisma select
      const selectClause: Prisma.GamingCenterSelect = {
        id: true, // Always include primary identifier
      };
      for (const field of selectFields) {
        (selectClause as Record<string, boolean>)[field] = true;
      }
      if (includeRelations && includeRelations.length > 0) {
        if (includeRelations.includes('addresses')) selectClause.addresses = true;
        if (includeRelations.includes('stations')) selectClause.stations = true;
        if (includeRelations.includes('ratings')) selectClause.ratings = true;
        if (includeRelations.includes('settings')) selectClause.settings = true;
      }

      const gc = await prisma.gamingCenter.findFirst({
        where: {
          OR: [
            { id },
            { slug: id },
          ],
          isActive: true,
        },
        select: selectClause,
      });

      return gc as Record<string, unknown> | null;
    }

    // Only includes were customized, select all base scalar fields of gamingCenter
    const gc = await prisma.gamingCenter.findFirst({
      where: {
        OR: [
          { id },
          { slug: id },
        ],
        isActive: true,
      },
      include: Object.keys(includeClause).length > 0 ? includeClause : undefined,
    });

    return gc as Record<string, unknown> | null;
  },

  async findBySlug(slug: string, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.gamingCenter.findFirst({
      where: { slug, isActive: true },
    });
  },

  async findAll(query: ListGamingCentersQuery) {
    const {
      page,
      limit,
      search,
      isActive,
      sortBy,
      sortOrder,
      city,
      province,
      district,
      game,
      stationType,
      type,
      minStationCount,
      minHourlyRate,
      maxHourlyRate,
      minPrice,
      maxPrice,
      hasFoodService,
      minRating,
      isOpen,
    } = query;
    const { skip, take } = getPaginationParams(page, limit);

    const where: Prisma.GamingCenterWhereInput = {
      isActive: isActive !== undefined ? isActive : true,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Geographic / address filtering directly in database
    if (city || province || district) {
      where.addresses = {
        some: {
          ...(city ? { city: { contains: city, mode: 'insensitive' } } : {}),
          ...(province ? { province: { contains: province, mode: 'insensitive' } } : {}),
          ...(district ? { district: { contains: district, mode: 'insensitive' } } : {}),
        },
      };
    }

    if (game) {
      where.games = {
        has: game,
      };
    }

    if (hasFoodService !== undefined) {
      where.hasFoodService = hasFoodService;
    }

    // Price range filtering
    const effectiveMinRate = minHourlyRate !== undefined ? minHourlyRate : minPrice;
    const effectiveMaxRate = maxHourlyRate !== undefined ? maxHourlyRate : maxPrice;
    if (effectiveMinRate !== undefined || effectiveMaxRate !== undefined) {
      where.hourlyRate = {
        ...(effectiveMinRate !== undefined ? { gte: effectiveMinRate } : {}),
        ...(effectiveMaxRate !== undefined ? { lte: effectiveMaxRate } : {}),
      };
    }

    // Filter by station types and minimum station count
    const resolvedStationType = stationType || type;
    if (resolvedStationType) {
      where.stations = {
        some: {
          stationType: resolvedStationType,
          isActive: true,
        },
      };
    }

    // Filter by rating directly via relation filter
    if (minRating !== undefined && minRating > 0) {
      where.ratings = {
        some: {
          status: 'PUBLISHED',
          rating: {
            gte: minRating,
          },
        },
      };
    }

    // Sorting
    const allowedSortFields: Record<string, boolean> = {
      createdAt: true,
      updatedAt: true,
      name: true,
      hourlyRate: true,
      pcCount: true,
      consoleCount: true,
    };
    const orderField = sortBy && allowedSortFields[sortBy] ? sortBy : 'createdAt';
    const orderDirection = sortOrder === 'asc' ? 'asc' : 'desc';

    const [rawCenters, total] = await Promise.all([
      prisma.gamingCenter.findMany({
        where,
        skip,
        take,
        orderBy: { [orderField]: orderDirection },
        include: {
          addresses: true,
          ratings: true,
          settings: true,
        },
      }),
      prisma.gamingCenter.count({ where }),
    ]);

    const centerIds = rawCenters.map((c) => c.id);

    // Efficiently aggregate station counts by type directly in the database
    let groupedCounts: Array<{ gamingCenterId: string; stationType: string; _count: { _all: number } }> = [];
    let hasGroupResults = false;
    if (centerIds.length > 0 && typeof prisma.gameStation?.groupBy === 'function') {
      try {
        const res = await prisma.gameStation.groupBy({
          by: ['gamingCenterId', 'stationType'],
          where: {
            gamingCenterId: { in: centerIds },
            isActive: true,
          },
          _count: {
            _all: true,
          },
        });
        if (Array.isArray(res)) {
          groupedCounts = res;
          hasGroupResults = res.length > 0;
        }
      } catch {
        groupedCounts = [];
      }
    }

    const countsMap = new Map<string, { PC: number; PLAYSTATION: number; XBOX: number; SWITCH: number; VR: number }>();
    for (const id of centerIds) {
      countsMap.set(id, {
        PC: 0,
        PLAYSTATION: 0,
        XBOX: 0,
        SWITCH: 0,
        VR: 0,
      });
    }

    for (const group of groupedCounts) {
      const centerCounts = countsMap.get(group.gamingCenterId);
      if (centerCounts && group.stationType in centerCounts) {
        (centerCounts as Record<string, number>)[group.stationType] = group._count?._all ?? 0;
      }
    }

    let data = rawCenters.map((gc) => {
      const deviceCounts = hasGroupResults ? countsMap.get(gc.id) : undefined;
      return transformGamingCenter(gc, deviceCounts);
    });

    // If minStationCount was specified for a device type
    if (minStationCount !== undefined && resolvedStationType) {
      data = data.filter((item) => {
        const count = item.deviceCounts ? (item.deviceCounts as unknown as Record<string, number>)[resolvedStationType] ?? 0 : 0;
        return count >= minStationCount;
      });
    }

    // If isOpen filter was requested
    if (isOpen !== undefined) {
      data = data.filter((item) => item.is_open === isOpen);
    }

    return formatPaginatedResult(data, total, page, limit);
  },

  async update(id: string, data: UpdateGamingCenterInput, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.gamingCenter.update({
      where: { id },
      data,
    });
  },

  async softDelete(id: string, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.gamingCenter.update({
      where: { id },
      data: { isActive: false },
    });
  },
};
