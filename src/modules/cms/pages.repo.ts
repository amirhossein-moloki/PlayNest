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
  const createInput: Prisma.PageUncheckedCreateInput = {
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

export async function listPagesByGamingCenter(gamingCenterId: string, filters: PageFilters) {
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
  gamingCenterId: string,
  pageId: string,
  data: UpdatePageData,
  sections?: PageSectionInput[],
  slugHistory?: string
) {
  const { sections: _, ...pageData } = data; // eslint-disable-line @typescript-eslint/no-unused-vars

  await prisma.$transaction(async (tx) => {
    const result = await tx.page.updateMany({
      where: { id: pageId, gamingCenterId },
      data: pageData,
    });

    if (result.count === 0) return;

    if (slugHistory) {
      await tx.pageSlugHistory.create({
        data: {
          pageId,
          oldSlug: slugHistory,
        },
      });
    }

    if (sections) {
      await tx.pageSection.deleteMany({
        where: { pageId },
      });
      await tx.pageSection.createMany({
        data: mapSections(sections).map(s => ({ ...s, pageId })),
      });
    }
  });

  return findPageById(gamingCenterId, pageId);
}
