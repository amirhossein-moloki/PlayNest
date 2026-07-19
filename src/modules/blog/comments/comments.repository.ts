import { prisma } from '../../../config/prisma';
import { Prisma, CommentStatus } from '@prisma/client';
import { CommentQueryDto } from './comments.types';

export const commentsRepository = {
  async create(data: Prisma.CommentUncheckedCreateInput) {
    return prisma.comment.create({
      data,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
          },
        },
      },
    });
  },

  async findById(id: string, gamingCenterId: string) {
    return prisma.comment.findFirst({
      where: { id, gamingCenterId, isActive: true },
    });
  },

  async update(id: string, data: Prisma.CommentUpdateInput) {
    return prisma.comment.update({
      where: { id },
      data,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
          },
        },
      },
    });
  },

  async countRecentByUser(userId: string, minutes: number) {
    const since = new Date(Date.now() - minutes * 60 * 1000);
    return prisma.comment.count({
      where: {
        userId,
        createdAt: { gte: since },
      },
    });
  },

  async findDuplicate(userId: string, postId: string, normalizedContent: string) {
    // Normalization check usually done via exact match of trimmed content for recently created comments
    const since = new Date(Date.now() - 5 * 60 * 1000); // 5 mins window
    return prisma.comment.findFirst({
      where: {
        userId,
        postId,
        createdAt: { gte: since },
        content: {
          mode: 'insensitive',
          equals: normalizedContent,
        },
      },
    });
  },

  async findAll(gamingCenterId: string, query: CommentQueryDto) {
    const { page = 1, pageSize = 10, postId, status } = query;
    const skip = (page - 1) * pageSize;

    const where: Prisma.CommentWhereInput = {
      gamingCenterId,
      isActive: true,
      postId,
      status,
    };

    const [data, total] = await Promise.all([
      prisma.comment.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              avatarUrl: true,
            },
          },
        },
      }),
      prisma.comment.count({ where }),
    ]);

    return {
      data,
      meta: {
        totalItems: total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  },

  async findRootsPaginated(gamingCenterId: string, postId: string, page: number, pageSize: number) {
    const skip = (page - 1) * pageSize;
    const where: Prisma.CommentWhereInput = {
      gamingCenterId,
      postId,
      parentId: null,
      status: CommentStatus.APPROVED,
      isActive: true,
    };

    const [data, total] = await Promise.all([
      prisma.comment.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { isPinned: 'desc' }, // Pinned roots first
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              avatarUrl: true,
            },
          },
        },
      }),
      prisma.comment.count({ where }),
    ]);

    return {
      data,
      meta: {
        totalItems: total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  },

  async findDescendantsForRoots(rootIds: string[]) {
    if (rootIds.length === 0) return [];

    return prisma.comment.findMany({
      where: {
        rootId: { in: rootIds },
        status: CommentStatus.APPROVED,
        isActive: true,
      },
      orderBy: { createdAt: 'asc' }, // Chronological thread
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
          },
        },
      },
    });
  },
};
