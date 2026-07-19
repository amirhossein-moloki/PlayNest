import { prisma } from '../../config/prisma';
import { CreatePostInput, UpdatePostInput, CreateSeriesInput, UpdateSeriesInput } from './posts.types';
import { Prisma } from '@prisma/client';
import { ListPostsQuery } from './posts.validation';
import { getPaginationParams, formatPaginatedResult } from '../../common/utils/pagination';

export const postsRepository = {
  // --- Post Operations ---
  async createPost(data: CreatePostInput) {
    const { tagIds, ...postData } = data;
    return prisma.post.create({
      data: {
        ...postData,
        tags: tagIds ? {
          create: tagIds.map(tagId => ({
            tagId,
          })),
        } : undefined,
      },
      include: {
        author: true,
        category: true,
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });
  },

  async findPostById(id: string, gamingCenterId: string) {
    return prisma.post.findFirst({
      where: { id, gamingCenterId, isActive: true },
      include: {
        author: true,
        category: true,
        series: true,
        coverMedia: true,
        ogImage: true,
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });
  },

  async findPostBySlug(slug: string, gamingCenterId: string) {
    return prisma.post.findUnique({
      where: { gamingCenterId_slug: { slug, gamingCenterId } },
    });
  },

  async findAllPosts(gamingCenterId: string, query: ListPostsQuery) {
    const { page, limit, search, status, categoryId, authorId, isActive } = query;
    const { skip, take } = getPaginationParams(page, limit);

    const where: Prisma.PostWhereInput = {
      gamingCenterId,
      isActive: isActive !== undefined ? isActive : true,
      status,
      categoryId,
      authorId,
    };

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.post.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          author: true,
          category: true,
        },
      }),
      prisma.post.count({ where }),
    ]);

    return formatPaginatedResult(data, total, page, limit);
  },

  async updatePost(id: string, data: UpdatePostInput) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { tagIds, changeNote: _unused, ...postData } = data;

    return prisma.post.update({
      where: { id },
      data: {
        ...postData,
        tags: tagIds ? {
          deleteMany: {},
          create: tagIds.map(tagId => ({
            tagId,
          })),
        } : undefined,
      },
      include: {
        author: true,
        category: true,
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });
  },

  async softDeletePost(id: string) {
    return prisma.post.update({
      where: { id },
      data: { isActive: false },
    });
  },

  // --- Series Operations ---
  async createSeries(data: CreateSeriesInput) {
    return prisma.series.create({
      data,
    });
  },

  async findSeriesById(id: string, gamingCenterId: string) {
    return prisma.series.findFirst({
      where: { id, gamingCenterId, isActive: true },
    });
  },

  async findSeriesBySlug(slug: string, gamingCenterId: string) {
    return prisma.series.findUnique({
      where: { gamingCenterId_slug: { slug, gamingCenterId } },
    });
  },

  async findAllSeries(gamingCenterId: string) {
    return prisma.series.findMany({
      where: { gamingCenterId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  },

  async updateSeries(id: string, data: UpdateSeriesInput) {
    return prisma.series.update({
      where: { id },
      data,
    });
  },

  // --- Revision Operations ---
  async createRevision(data: { postId: string; editorId: string; title: string; content: string; excerpt: string; changeNote?: string }) {
    return prisma.revision.create({
      data,
    });
  },

  async findRevisionsByPostId(postId: string) {
    return prisma.revision.findMany({
      where: { postId, isActive: true },
      orderBy: { createdAt: 'desc' },
      include: {
        editor: true,
      },
    });
  },
};
