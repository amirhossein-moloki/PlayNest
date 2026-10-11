import { z } from 'zod';
import { createPageSchema, updatePageSchema, listPagesSchema } from './pages.validators';

export type CreatePageInput = z.infer<typeof createPageSchema>['body'];
export type UpdatePageInput = z.infer<typeof updatePageSchema>['body'];
export type ListPagesQuery = z.infer<typeof listPagesSchema>['query'];

export type CreatePageData = Omit<CreatePageInput, 'publishedAt'> & {
  publishedAt?: Date | null;
};

export type UpdatePageData = Omit<UpdatePageInput, 'publishedAt'> & {
  publishedAt?: Date | null;
};
