import { prisma } from '../../config/prisma';
import { CreateGamingCenterInput, UpdateGamingCenterInput, GamingCenterListItem } from './gamingCenter.types';
import { Prisma, GameStation, Rating, Settings, Address } from '@prisma/client';
import { ListGamingCentersQuery } from './gamingCenter.validation';
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
    stations: true;
    ratings: true;
    settings: true;
  };
}>;

export function transformGamingCenter(gc: GamingCenterWithRelations): GamingCenterListItem {
  const stations: GameStation[] = gc.stations || [];
  const ratings: Rating[] = gc.ratings || [];
  const settings: Settings | null = gc.settings || null;
  const addresses: Address[] = gc.addresses || [];

  let hasPc = gc.pcCount > 0;
  let hasPs4 = false;
  let hasPs5 = false;
  let hasXbox = false;

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

  return {
    id: gc.id,
    name: gc.name,
    isActive: gc.isActive,
    slug: gc.slug,
    description: gc.description,
    pcCount: gc.pcCount,
    consoleCount: gc.consoleCount,
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
  };
}

export const gamingCenterRepository = {
  async create(data: CreateGamingCenterInput) {
    return prisma.gamingCenter.create({
      data: data as Prisma.GamingCenterCreateInput,
    });
  },

  async findById(id: string): Promise<GamingCenterListItem | null> {
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
  },

  async findBySlug(slug: string) {
    return prisma.gamingCenter.findFirst({
      where: { slug, isActive: true },
    });
  },

  async findAll(query: ListGamingCentersQuery) {
    const { page, limit, search, isActive, sortBy, sortOrder, city, game } = query;
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

    if (city) {
      where.addresses = {
        some: {
          city: { contains: city, mode: 'insensitive' },
        },
      };
    }

    if (game) {
      where.games = {
        has: game,
      };
    }

    const [rawCenters, total] = await Promise.all([
      prisma.gamingCenter.findMany({
        where,
        skip,
        take,
        orderBy: sortBy ? { [sortBy]: sortOrder } : { createdAt: 'desc' },
        include: {
          addresses: true,
          stations: true,
          ratings: true,
          settings: true,
        },
      }),
      prisma.gamingCenter.count({ where }),
    ]);

    const data = rawCenters.map(transformGamingCenter);

    return formatPaginatedResult(data, total, page, limit);
  },

  async update(id: string, data: UpdateGamingCenterInput) {
    return prisma.gamingCenter.update({
      where: { id },
      data,
    });
  },

  async softDelete(id: string) {
    return prisma.gamingCenter.update({
      where: { id },
      data: { isActive: false },
    });
  },
};
