import { Router } from 'express';
import { PageStatus, PageType, RobotsFollow, RobotsIndex, UserRole } from '@prisma/client';
import { renderPageDocument } from '../public/page-renderer';
import { authMiddleware } from '../../common/middleware/auth';
import { tenantGuard } from '../../common/middleware/tenantGuard';
import { requireRole } from '../../common/middleware/requireRole';
import { pageEditorTemplate, pagesListTemplate } from './admin-ui.templates';

export const cmsAdminUiRouter = Router();

// Secure all admin UI routes
cmsAdminUiRouter.use(authMiddleware, tenantGuard, requireRole([UserRole.MANAGER]));

const buildOptions = (values: string[]) =>
  values.map((value) => `<option value="${value}">${value}</option>`).join('');

const statusOptions = buildOptions(Object.values(PageStatus));
const typeOptions = buildOptions(Object.values(PageType));
const robotsIndexOptions = buildOptions(Object.values(RobotsIndex));
const robotsFollowOptions = buildOptions(Object.values(RobotsFollow));

cmsAdminUiRouter.get('/gamingCenters/:gamingCenterId/pages', (req, res) => {
  const { gamingCenterId } = req.params;
  const html = pagesListTemplate(gamingCenterId, statusOptions, typeOptions);
  res.type('html').send(html);
});

cmsAdminUiRouter.post('/gamingCenters/:gamingCenterId/pages/preview', (req, res) => {
  const { title, sections, pageId } = req.body ?? {};
  const html = renderPageDocument({ title, sections, pageId });
  res.type('html').send(html);
});

cmsAdminUiRouter.get('/gamingCenters/:gamingCenterId/pages/:pageId', (req, res) => {
  const { gamingCenterId, pageId } = req.params;
  const html = pageEditorTemplate(
    gamingCenterId,
    pageId,
    statusOptions,
    typeOptions,
    robotsIndexOptions,
    robotsFollowOptions
  );
  res.type('html').send(html);
});
