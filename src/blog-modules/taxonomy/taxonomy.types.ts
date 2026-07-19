import { Category, Tag } from '@prisma/client';

export type CreateCategoryInput = {
  name: string;
  slug: string;
  parentId?: string;
  description?: string;
  order?: number;
  gamingCenterId: string;
};

export type UpdateCategoryInput = Partial<Omit<CreateCategoryInput, 'gamingCenterId'>> & {
  isActive?: boolean;
};

export type CreateTagInput = {
  name: string;
  slug: string;
  description?: string;
  gamingCenterId: string;
};

export type UpdateTagInput = Partial<Omit<CreateTagInput, 'gamingCenterId'>> & {
  isActive?: boolean;
};

export type TaxonomyResponse = {
  categories: Category[];
  tags: Tag[];
};
