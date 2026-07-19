import { prisma } from '../../config/prisma';
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
      where: { id, gamingCenterId },
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

  async update(id: string, data: Prisma.CommentUncheckedUpdateInput) {
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

  async findAll(gamingCenterId: string, query: CommentQueryDto) {
    const { page = 1, pageSize = 20, status, postId } = query;
    const skip = (page - 1) * pageSize;

    const where: Prisma.CommentWhereInput = {
      gamingCenterId,
      status,
      postId,
      isActive: true,
    };

    const [data, total] = await Promise.all([
      prisma.comment.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
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
        total,
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
      isActive: true,
      status: CommentStatus.APPROVED,
    };

    const [data, total] = await Promise.all([
      prisma.comment.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
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
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  },

  async findDescendantsForRoots(rootIds: string[]) {
    return prisma.comment.findMany({
      where: {
        rootId: { in: rootIds },
        isActive: true,
        status: CommentStatus.APPROVED,
      },
      orderBy: { createdAt: 'asc' },
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

  async findDuplicate(userId: string, postId: string, content: string) {
    return prisma.comment.findFirst({
      where: {
        userId,
        postId,
        content,
        createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) }, // 5 minutes duplicate check
      },
    });
  }
};
