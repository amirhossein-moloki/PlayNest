import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import { PageStatus, PageType } from '@prisma/client';
import * as PagesRepo from './pages.repo';
import { CreatePageInput, UpdatePageInput } from './pages.types';

const resolvePublishedAt = (
  status: PageStatus,
  publishedAt?: string,
  existingPublishedAt?: Date | null
) => {
  if (status !== PageStatus.PUBLISHED) {
    return null;
  }

  if (publishedAt) {
    return new Date(publishedAt);
  }

  return existingPublishedAt ?? new Date();
};

export async function createPage(gamingCenterId: string, data: CreatePageInput) {
  const status = data.status ?? PageStatus.DRAFT;
  const publishedAt = resolvePublishedAt(status, data.publishedAt);

  return PagesRepo.createPage(gamingCenterId, {
    ...data,
    status,
    publishedAt,
  });
}

export async function listPages(
  gamingCenterId: string,
  filters: { status?: PageStatus; type?: PageType; limit: number; offset: number }
) {
  return PagesRepo.listPagesBySalon(gamingCenterId, {
    status: filters.status,
    type: filters.type,
    limit: filters.limit,
    offset: filters.offset,
  });
}

export async function updatePage(
  gamingCenterId: string,
  pageId: string,
  data: UpdatePageInput
) {
  const existingPage = await PagesRepo.findPageById(gamingCenterId, pageId);
  if (!existingPage) {
    throw new AppError('Page not found', httpStatus.NOT_FOUND);
  }

  const nextStatus = data.status ?? existingPage.status;
  const publishedAt = resolvePublishedAt(
    nextStatus,
    data.publishedAt,
    existingPage.publishedAt
  );
  const slugHistory =
    data.slug && data.slug !== existingPage.slug ? existingPage.slug : undefined;

  return PagesRepo.updatePage(
    pageId,
    {
      ...data,
      status: nextStatus,
      publishedAt,
    },
    data.sections,
    slugHistory
  );
}

export async function getPage(gamingCenterId: string, pageId: string) {
  const page = await PagesRepo.findPageById(gamingCenterId, pageId);
  if (!page) {
    throw new AppError('Page not found', httpStatus.NOT_FOUND);
  }
  return page;
}
