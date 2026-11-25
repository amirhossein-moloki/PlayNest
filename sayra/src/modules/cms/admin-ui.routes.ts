import { Router } from 'express';
import { escapeHtml } from '../../common/utils/html-sanitize';
import { idSchema } from '../../common/validators/common.validators';
import { PageStatus, PageType, RobotsFollow, RobotsIndex, UserRole } from '@prisma/client';
import { renderPageDocument } from '../public/page-renderer';
import { authMiddleware } from '../../common/middleware/auth';
import { tenantGuard } from '../../common/middleware/tenantGuard';
import { requireRole } from '../../common/middleware/requireRole';
import { pageEditorTemplate, pagesListTemplate } from './admin-ui.templates';

export const cmsAdminUiRouter = Router();

// Secure CMS admin UI routes only under their own prefix
cmsAdminUiRouter.use(
  '/gamingCenters/:gamingCenterId/pages',
  authMiddleware,
  (req, res, next) => {
    if (!parseValidatedId(req.params.gamingCenterId, 'gamingCenterId')) {
      res.status(400).json({ message: 'Invalid gamingCenterId' });
      return;
    }
    next();
  },
  tenantGuard,
  requireRole([UserRole.MANAGER])
);

const buildOptions = (values: string[]) =>
  values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');

const parseValidatedId = (value: string, fieldName: string): string | null => {
  const parsed = idSchema(`${fieldName} is invalid`).safeParse(value);
  return parsed.success ? parsed.data : null;
};

const statusOptions = buildOptions(Object.values(PageStatus));
const typeOptions = buildOptions(Object.values(PageType));
const robotsIndexOptions = buildOptions(Object.values(RobotsIndex));
const robotsFollowOptions = buildOptions(Object.values(RobotsFollow));

cmsAdminUiRouter.get('/gamingCenters/:gamingCenterId/pages', (req, res) => {
  const gamingCenterId = parseValidatedId(req.params.gamingCenterId, 'gamingCenterId');
  if (!gamingCenterId) {
    res.status(400).json({ message: 'Invalid gamingCenterId' });
    return;
  }
  const html = pagesListTemplate(gamingCenterId, statusOptions, typeOptions);
  res.type('html').send(html);
});

cmsAdminUiRouter.post('/gamingCenters/:gamingCenterId/pages/preview', (req, res) => {
  const gamingCenterId = parseValidatedId(req.params.gamingCenterId, 'gamingCenterId');
  if (!gamingCenterId) {
    res.status(400).json({ message: 'Invalid gamingCenterId' });
    return;
  }
  const { title, sections, pageId } = req.body ?? {};
  const html = renderPageDocument({ title, sections, pageId });
  res.type('html').send(html);
});

cmsAdminUiRouter.get('/gamingCenters/:gamingCenterId/pages/:pageId', (req, res) => {
  const gamingCenterId = parseValidatedId(req.params.gamingCenterId, 'gamingCenterId');
  const pageId = parseValidatedId(req.params.pageId, 'pageId');
  if (!gamingCenterId || !pageId) {
    res.status(400).json({ message: 'Invalid gamingCenterId or pageId' });
    return;
  }
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
