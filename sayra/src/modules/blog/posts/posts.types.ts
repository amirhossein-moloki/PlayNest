import { PageStatus, PostVisibility, SeriesOrderStrategy } from '@prisma/client';

export type CreatePostInput = {
  gamingCenterId: string;
  authorId: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  categoryId?: string;
  seriesId?: string;
  coverMediaId?: string;
  ogImageId?: string;
  seoTitle?: string;
  seoDescription?: string;
  status?: PageStatus;
  visibility?: PostVisibility;
  publishedAt?: Date;
  scheduledAt?: Date;
  isHot?: boolean;
  tagIds?: string[];
};

export type UpdatePostInput = Partial<Omit<CreatePostInput, 'gamingCenterId' | 'authorId'>> & {
  isActive?: boolean;
  changeNote?: string;
};

export type CreateSeriesInput = {
  gamingCenterId: string;
  slug: string;
  title: string;
  description?: string;
  orderStrategy?: SeriesOrderStrategy;
};

export type UpdateSeriesInput = Partial<Omit<CreateSeriesInput, 'gamingCenterId'>> & {
  isActive?: boolean;
};
