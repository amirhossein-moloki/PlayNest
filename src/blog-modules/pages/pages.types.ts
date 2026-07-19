import { PageStatus, PageType, RobotsIndex, RobotsFollow } from '@prisma/client';

export interface CreatePageInput {
  gamingCenterId: string;
  slug: string;
  title: string;
  type?: PageType;
  parentId?: string;
  status?: PageStatus;
  publishedAt?: Date;
  content?: string;
  seoTitle?: string;
  seoDescription?: string;
  canonicalPath?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImageUrl?: string;
  robotsIndex?: RobotsIndex;
  robotsFollow?: RobotsFollow;
  structuredDataJson?: string;
}

export interface UpdatePageInput {
  slug?: string;
  title?: string;
  type?: PageType;
  parentId?: string;
  status?: PageStatus;
  publishedAt?: Date | null;
  content?: string;
  seoTitle?: string;
  seoDescription?: string;
  canonicalPath?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImageUrl?: string;
  robotsIndex?: RobotsIndex;
  robotsFollow?: RobotsFollow;
  structuredDataJson?: string;
  isActive?: boolean;
}

export interface PageResponse {
  id: string;
  gamingCenterId: string;
  slug: string;
  fullPath: string;
  title: string;
  type: PageType;
  parentId: string | null;
  depth: number;
  status: PageStatus;
  publishedAt: Date | null;
  content: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
