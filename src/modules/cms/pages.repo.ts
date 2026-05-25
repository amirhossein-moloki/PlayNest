import { prisma } from '../../config/prisma';
import { CreatePageData, UpdatePageData, CreatePageInput } from './pages.types';
import { PageStatus, PageType, Prisma } from '@prisma/client';

type PageFilters = {
  status?: PageStatus;
  type?: PageType;
  limit: number;
  offset: number;
};

type PageSectionInput = CreatePageInput['sections'][number];

const mapSections = (sections: PageSectionInput[]) =>
  sections.map((section, index) => ({
    id: section.id,
    type: section.type,
    dataJson: section.dataJson,
    sortOrder: section.sortOrder ?? index,
    isEnabled: section.isEnabled ?? true,
  }));

export async function createPage(gamingCenterId: string, data: CreatePageData) {
  const { sections, ...pageData } = data;
  const createInput: Prisma.SalonPageUncheckedCreateInput = {
    ...(pageData as any), // eslint-disable-line @typescript-eslint/no-explicit-any
    gamingCenterId,
    sections: {
      create: mapSections(sections),
    },
  };
  return prisma.page.create({
    data: createInput as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    include: {
      sections: { orderBy: { sortOrder: 'asc' } },
    },
  });
}

export async function findPageById(gamingCenterId: string, pageId: string) {
  return prisma.page.findFirst({
    where: { id: pageId, gamingCenterId },
    include: {
      sections: { orderBy: { sortOrder: 'asc' } },
    },
  });
}

export async function listPagesBySalon(gamingCenterId: string, filters: PageFilters) {
  const { status, type, limit, offset } = filters;

  const whereClause = {
    gamingCenterId,
    ...(status ? { status } : {}),
    ...(type ? { type } : {}),
  };

  const [total, pages] = await prisma.$transaction([
    prisma.page.count({ where: whereClause }),
    prisma.page.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    }),
  ]);

  return { total, pages };
}

export async function updatePage(
  pageId: string,
  data: UpdatePageData,
  sections?: PageSectionInput[],
  slugHistory?: string
) {
  const { sections: _, ...pageData } = data; // eslint-disable-line @typescript-eslint/no-unused-vars
  return prisma.page.update({
    where: { id: pageId },
    data: {
      ...pageData,
      ...(slugHistory
        ? {
          slugHistory: {
            create: {
              oldSlug: slugHistory,
            },
          },
        }
        : {}),
      ...(sections
        ? {
          sections: {
            deleteMany: {},
            create: mapSections(sections),
          },
        }
        : {}),
    },
    include: {
      sections: { orderBy: { sortOrder: 'asc' } },
    },
  });
}
