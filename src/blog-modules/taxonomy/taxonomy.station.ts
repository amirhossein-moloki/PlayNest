import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import { taxonomyRepository } from './taxonomy.repository';
import { CreateCategoryInput, UpdateCategoryInput, CreateTagInput, UpdateTagInput } from './taxonomy.types';
import { ListTaxonomyQuery } from './taxonomy.validation';
import { SessionActorType } from '@prisma/client';
import { auditService } from '../audit/audit.station';

export const taxonomyStation = {
  // --- Category Logic ---
  async createCategory(
    data: CreateCategoryInput,
    actor: { id: string; actorType: SessionActorType },
    context?: { ip?: string; userAgent?: string }
  ) {
    const existing = await taxonomyRepository.findCategoryBySlug(data.slug, data.gamingCenterId);
    if (existing) {
      throw new AppError('Category with this slug already exists for this tenant', httpStatus.CONFLICT);
    }

    if (data.parentId) {
      const parent = await taxonomyRepository.findCategoryById(data.parentId, data.gamingCenterId);
      if (!parent) {
        throw new AppError('Parent category not found', httpStatus.NOT_FOUND);
      }
    }

    const category = await taxonomyRepository.createCategory(data);

    await auditService.log(
      data.gamingCenterId,
      actor,
      'CMS_CATEGORY_CREATE',
      { name: 'Category', id: category.id },
      { old: null, new: category },
      context
    );

    return category;
  },

  async getCategoryById(id: string, gamingCenterId: string) {
    const category = await taxonomyRepository.findCategoryById(id, gamingCenterId);
    if (!category) {
      throw new AppError('Category not found', httpStatus.NOT_FOUND);
    }
    return category;
  },

  async getAllCategories(gamingCenterId: string, query: ListTaxonomyQuery) {
    return taxonomyRepository.findAllCategories(gamingCenterId, query);
  },

  async updateCategory(
    id: string,
    gamingCenterId: string,
    data: UpdateCategoryInput,
    actor: { id: string; actorType: SessionActorType },
    context?: { ip?: string; userAgent?: string }
  ) {
    const category = await taxonomyRepository.findCategoryById(id, gamingCenterId);
    if (!category) {
      throw new AppError('Category not found', httpStatus.NOT_FOUND);
    }

    if (data.slug && data.slug !== category.slug) {
      const existing = await taxonomyRepository.findCategoryBySlug(data.slug, gamingCenterId);
      if (existing) {
        throw new AppError('Category with this slug already exists for this tenant', httpStatus.CONFLICT);
      }
    }

    if (data.parentId) {
      if (data.parentId === id) {
        throw new AppError('Category cannot be its own parent', httpStatus.BAD_REQUEST);
      }
      const parent = await taxonomyRepository.findCategoryById(data.parentId, gamingCenterId);
      if (!parent) {
        throw new AppError('Parent category not found', httpStatus.NOT_FOUND);
      }
    }

    const updated = await taxonomyRepository.updateCategory(id, data);

    await auditService.log(
      gamingCenterId,
      actor,
      'CMS_CATEGORY_UPDATE',
      { name: 'Category', id },
      { old: category, new: updated },
      context
    );

    return updated;
  },

  async deleteCategory(
    id: string,
    gamingCenterId: string,
    actor: { id: string; actorType: SessionActorType },
    context?: { ip?: string; userAgent?: string }
  ) {
    const category = await taxonomyRepository.findCategoryById(id, gamingCenterId);
    if (!category) {
      throw new AppError('Category not found', httpStatus.NOT_FOUND);
    }
    const result = await taxonomyRepository.softDeleteCategory(id);

    await auditService.log(
      gamingCenterId,
      actor,
      'CMS_CATEGORY_DELETE',
      { name: 'Category', id },
      { old: category, new: result },
      context
    );

    return result;
  },

  // --- Tag Logic ---
  async createTag(
    data: CreateTagInput,
    actor: { id: string; actorType: SessionActorType },
    context?: { ip?: string; userAgent?: string }
  ) {
    const existing = await taxonomyRepository.findTagBySlug(data.slug, data.gamingCenterId);
    if (existing) {
      throw new AppError('Tag with this slug already exists for this tenant', httpStatus.CONFLICT);
    }

    const tag = await taxonomyRepository.createTag(data);

    await auditService.log(
      data.gamingCenterId,
      actor,
      'CMS_TAG_CREATE',
      { name: 'Tag', id: tag.id },
      { old: null, new: tag },
      context
    );

    return tag;
  },

  async getTagById(id: string, gamingCenterId: string) {
    const tag = await taxonomyRepository.findTagById(id, gamingCenterId);
    if (!tag) {
      throw new AppError('Tag not found', httpStatus.NOT_FOUND);
    }
    return tag;
  },

  async getAllTags(gamingCenterId: string, query: ListTaxonomyQuery) {
    return taxonomyRepository.findAllTags(gamingCenterId, query);
  },

  async updateTag(
    id: string,
    gamingCenterId: string,
    data: UpdateTagInput,
    actor: { id: string; actorType: SessionActorType },
    context?: { ip?: string; userAgent?: string }
  ) {
    const tag = await taxonomyRepository.findTagById(id, gamingCenterId);
    if (!tag) {
      throw new AppError('Tag not found', httpStatus.NOT_FOUND);
    }

    if (data.slug && data.slug !== tag.slug) {
      const existing = await taxonomyRepository.findTagBySlug(data.slug, gamingCenterId);
      if (existing) {
        throw new AppError('Tag with this slug already exists for this tenant', httpStatus.CONFLICT);
      }
    }

    const updated = await taxonomyRepository.updateTag(id, data);

    await auditService.log(
      gamingCenterId,
      actor,
      'CMS_TAG_UPDATE',
      { name: 'Tag', id },
      { old: tag, new: updated },
      context
    );

    return updated;
  },

  async deleteTag(
    id: string,
    gamingCenterId: string,
    actor: { id: string; actorType: SessionActorType },
    context?: { ip?: string; userAgent?: string }
  ) {
    const tag = await taxonomyRepository.findTagById(id, gamingCenterId);
    if (!tag) {
      throw new AppError('Tag not found', httpStatus.NOT_FOUND);
    }
    const result = await taxonomyRepository.softDeleteTag(id);

    await auditService.log(
      gamingCenterId,
      actor,
      'CMS_TAG_DELETE',
      { name: 'Tag', id },
      { old: tag, new: result },
      context
    );

    return result;
  },
};
