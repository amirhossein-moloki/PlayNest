import { CommentStatus } from '@prisma/client';

export interface CreateCommentDto {
  postId: string;
  parentId?: string;
  content: string;
}

export interface UpdateCommentDto {
  content: string;
}

export interface CommentQueryDto {
  page?: number;
  pageSize?: number;
  status?: CommentStatus;
  postId?: string;
}

export interface CommentResponse {
  id: string;
  postId: string;
  userId: string;
  parentId: string | null;
  rootId: string | null;
  depth: number;
  content: string;
  status: CommentStatus;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    fullName: string;
    avatarUrl: string | null;
  };
  replies?: CommentResponse[];
}
