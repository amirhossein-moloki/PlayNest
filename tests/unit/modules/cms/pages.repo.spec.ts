import { describe, it, expect } from '@jest/globals';
import { prismaMock } from '../../../mocks/prisma';
import * as PagesRepo from '../../../../src/modules/cms/pages.repo';
import { PageType } from '@prisma/client';

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('PagesRepo', () => {
  const gamingCenterId = 'gc-1';
  const pageMock = prismaMock.page as any;
  const sectionMock = prismaMock.pageSection as any;
  const historyMock = prismaMock.pageSlugHistory as any;

  describe('createPage', () => {
    it('should create a page with sections', async () => {
      const data = {
        title: 'Home',
        slug: 'home',
        type: PageType.HOME,
        sections: [{ type: 'HERO', dataJson: '{}' }]
      };
      pageMock.create.mockResolvedValue({ id: 'p-1', ...data });

      await PagesRepo.createPage(gamingCenterId, data as any);
      expect(pageMock.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          gamingCenterId,
          sections: {
            create: expect.arrayContaining([
              expect.objectContaining({ type: 'HERO' })
            ])
          }
        })
      }));
    });
  });

  describe('listPagesBySalon', () => {
    it('should return total and pages in transaction', async () => {
      (prismaMock as any).$transaction.mockResolvedValue([5, []]);
      const result = await PagesRepo.listPagesBySalon(gamingCenterId, { limit: 10, offset: 0 });
      expect(result.total).toBe(5);
      expect((prismaMock as any).$transaction).toHaveBeenCalled();
    });
  });

  describe('updatePage', () => {
    it('should update page and sections in transaction', async () => {
      (prismaMock as any).$transaction.mockImplementation(async (cb: any) => cb(prismaMock));
      pageMock.updateMany.mockResolvedValue({ count: 1 });
      pageMock.findFirst.mockResolvedValue({ id: 'p-1', title: 'Updated' });

      await PagesRepo.updatePage(gamingCenterId, 'p-1', { title: 'Updated' }, [{ type: 'TEXT', dataJson: '{}' }] as any, 'old-slug');

      expect(pageMock.updateMany).toHaveBeenCalled();
      expect(historyMock.create).toHaveBeenCalledWith({
        data: { pageId: 'p-1', oldSlug: 'old-slug' }
      });
      expect(sectionMock.deleteMany).toHaveBeenCalledWith({ where: { pageId: 'p-1' } });
      expect(sectionMock.createMany).toHaveBeenCalled();
    });
  });
});
