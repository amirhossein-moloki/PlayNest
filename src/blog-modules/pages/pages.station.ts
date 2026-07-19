import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import { pagesRepository } from './pages.repository';
import { CreatePageInput, UpdatePageInput } from './pages.types';
import { PageStatus, SessionActorType } from '@prisma/client';
import { auditService } from '../audit/audit.station';
import { prisma } from '../../config/prisma';
import xss from 'xss';
import { eventEmitter } from '../../common/events/event-emitter';

export const pagesStation = {
  async createPage(
    data: CreatePageInput,
    actor: { id: string; actorType: SessionActorType },
    context?: { ip?: string; userAgent?: string }
  ) {
    // 1. Resolve Hierarchy & Path
    let fullPath = data.slug;
    let depth = 0;

    if (data.parentId) {
      const parent = await prisma.page.findUnique({ where: { id: data.parentId } });
      if (!parent) throw new AppError('Parent page not found', httpStatus.NOT_FOUND);
      fullPath = `${parent.fullPath}/${data.slug}`.replace(/\/+/g, '/');
      depth = parent.depth + 1;
    }

    // 2. Uniqueness Check
    const existing = await pagesRepository.findPageByFullPath(fullPath, data.gamingCenterId);
    if (existing) {
      throw new AppError('A page with this path already exists for this tenant', httpStatus.CONFLICT);
    }

    // 3. Sanitization
    if (data.content) data.content = xss(data.content);

    // 4. Default publishedAt
    if (data.status === PageStatus.PUBLISHED && !data.publishedAt) {
      data.publishedAt = new Date();
    }

    const page = await pagesRepository.createPage(data, fullPath, depth);

    await auditService.log(
      data.gamingCenterId,
      actor,
      'CMS_PAGE_CREATE',
      { name: 'Page', id: page.id },
      { old: null, new: page },
      context
    );

    eventEmitter.emit('CMS_PAGE_CREATED', { pageId: page.id, gamingCenterId: page.gamingCenterId });
    if (page.status === PageStatus.PUBLISHED) {
      eventEmitter.emit('CMS_PAGE_PUBLISHED', { pageId: page.id, gamingCenterId: page.gamingCenterId });
    }

    return page;
  },

  async updatePage(
    id: string,
    gamingCenterId: string,
    data: UpdatePageInput,
    actor: { id: string; actorType: SessionActorType },
    context?: { ip?: string; userAgent?: string }
  ) {
    const page = await pagesRepository.findPageById(id, gamingCenterId);
    if (!page) throw new AppError('Page not found', httpStatus.NOT_FOUND);

    // Circular Reference Check
    if (data.parentId) {
      if (data.parentId === id) {
        throw new AppError('A page cannot be its own parent', httpStatus.BAD_REQUEST);
      }
      const isDescendant = await this.isDescendant(id, data.parentId);
      if (isDescendant) {
        throw new AppError('A page cannot be moved under its own descendant', httpStatus.BAD_REQUEST);
      }
    }

    let needsPathUpdate = false;
    let newFullPath = page.fullPath;
    let newDepth = page.depth;

    if (data.parentId !== undefined && data.parentId !== page.parentId) {
      needsPathUpdate = true;
      if (data.parentId) {
        const parent = await prisma.page.findUnique({ where: { id: data.parentId } });
        if (!parent) throw new AppError('Parent page not found', httpStatus.NOT_FOUND);
        newFullPath = `${parent.fullPath}/${data.slug || page.slug}`.replace(/\/+/g, '/');
        newDepth = parent.depth + 1;
      } else {
        newFullPath = data.slug || page.slug;
        newDepth = 0;
      }
    } else if (data.slug && data.slug !== page.slug) {
      needsPathUpdate = true;
      if (page.parentId) {
        const parent = await prisma.page.findUnique({ where: { id: page.parentId } });
        newFullPath = `${parent!.fullPath}/${data.slug}`.replace(/\/+/g, '/');
      } else {
        newFullPath = data.slug;
      }
    }

    if (needsPathUpdate) {
      const existing = await pagesRepository.findPageByFullPath(newFullPath, gamingCenterId);
      if (existing && existing.id !== id) {
        throw new AppError('A page with this path already exists for this tenant', httpStatus.CONFLICT);
      }
    }

    if (data.content) data.content = xss(data.content);

    const updated = await pagesRepository.updatePage(id, {
      ...data,
      fullPath: newFullPath,
      depth: newDepth,
    });

    // If path changed, update children recursively
    if (needsPathUpdate) {
      await this.updateChildrenPaths(id, newFullPath, newDepth);
    }

    await auditService.log(
      gamingCenterId,
      actor,
      'CMS_PAGE_UPDATE',
      { name: 'Page', id },
      { old: page, new: updated },
      context
    );

    eventEmitter.emit('CMS_PAGE_UPDATED', { pageId: id, gamingCenterId });
    if (page.status !== PageStatus.PUBLISHED && updated.status === PageStatus.PUBLISHED) {
      eventEmitter.emit('CMS_PAGE_PUBLISHED', { pageId: id, gamingCenterId });
    }

    return updated;
  },

  async updateChildrenPaths(parentId: string, parentPath: string, parentDepth: number) {
    const children = await pagesRepository.findChildren(parentId);
    for (const child of children) {
      const newPath = `${parentPath}/${child.slug}`.replace(/\/+/g, '/');
      const newDepth = parentDepth + 1;
      await pagesRepository.updatePage(child.id, { fullPath: newPath, depth: newDepth });
      await this.updateChildrenPaths(child.id, newPath, newDepth);
    }
  },

  async isDescendant(parentId: string, potentialChildId: string): Promise<boolean> {
    const children = await pagesRepository.findChildren(parentId);
    for (const child of children) {
      if (child.id === potentialChildId) return true;
      if (await this.isDescendant(child.id, potentialChildId)) return true;
    }
    return false;
  },

  async listPages(gamingCenterId: string, filter: Record<string, unknown>) {
    return pagesRepository.findAllPages(gamingCenterId, filter);
  },

  async getPageById(id: string, gamingCenterId: string) {
    return pagesRepository.findPageById(id, gamingCenterId);
  },

  async getPageByPath(path: string, gamingCenterId: string) {
    const page = await pagesRepository.findPageByFullPath(path, gamingCenterId);
    if (!page) throw new AppError('Page not found', httpStatus.NOT_FOUND);
    return page;
  },

  async deletePage(
    id: string,
    gamingCenterId: string,
    actor: { id: string; actorType: SessionActorType },
    context?: { ip?: string; userAgent?: string }
  ) {
    const page = await pagesRepository.findPageById(id, gamingCenterId);
    if (!page) throw new AppError('Page not found', httpStatus.NOT_FOUND);

    const children = await pagesRepository.findChildren(id);
    if (children.length > 0) {
      throw new AppError('Cannot delete a page with children', httpStatus.BAD_REQUEST);
    }

    const result = await pagesRepository.softDeletePage(id);

    await auditService.log(
      gamingCenterId,
      actor,
      'CMS_PAGE_DELETE',
      { name: 'Page', id },
      { old: page, new: result },
      context
    );

    eventEmitter.emit('CMS_PAGE_DELETED', { pageId: id, gamingCenterId });

    return result;
  },
};
