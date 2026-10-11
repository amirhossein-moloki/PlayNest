import { z } from 'zod';
import { CommentStatus } from '@prisma/client';

export const createCommentSchema = z.object({
  postId: z.string().cuid(),
  parentId: z.string().cuid().optional(),
  content: z.string().min(1).max(5000),
});

export const updateCommentSchema = z.object({
  content: z.string().min(1).max(5000),
});

export const moderateCommentSchema = z.object({
  status: z.nativeEnum(CommentStatus),
});

export const commentQuerySchema = z.object({
  page: z.string().optional().transform(val => (val ? parseInt(val, 10) : 1)),
  pageSize: z.string().optional().transform(val => (val ? parseInt(val, 10) : 20)),
  status: z.nativeEnum(CommentStatus).optional(),
  postId: z.string().cuid().optional(),
});
