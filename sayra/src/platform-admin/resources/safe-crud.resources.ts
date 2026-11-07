/* eslint-disable @typescript-eslint/no-explicit-any */
import { getPrismaModelTarget } from '../utils/model-access';
import { buildSensitivePropertiesConfiguration } from './resource.defaults';

/**
 * Verified low-risk configuration and CMS resources where direct CRUD operations are safe.
 * Inspects: Category, Tag, SiteSettings
 */
import { ADMIN_NAVIGATION_GROUPS } from '../config/admin.navigation';
import { AdminAuditService } from '../services/admin-audit.service';
import { PlatformMediaStation } from '../../modules/platform-admin/media.station';

/**
 * Creates actions with audit logging and media lifecycle management for catalog items.
 */
function createCatalogActions(entityName: 'DeviceCatalog' | 'GameCatalog'): Record<string, any> {
  return {
    edit: {
      after: async (originalResponse: any, request: any, context: any) => {
        if (
          request.method === 'post' &&
          originalResponse.record &&
          !Object.keys(originalResponse.record.errors || {}).length
        ) {
          const oldUrl = context.record?.params?.coverImageUrl;
          const newUrl = originalResponse.record?.params?.coverImageUrl;

          // If the image was replaced, clean up the previous file if it was on server
          if (oldUrl && newUrl && oldUrl !== newUrl && oldUrl.startsWith('/uploads/')) {
            await PlatformMediaStation.deleteMediaByUrl(oldUrl);
          }

          await AdminAuditService.logAdminEvent({
            platformAdminId: context.currentAdmin?.id,
            action: `${entityName.toUpperCase()}_UPDATE`,
            entity: entityName,
            entityId: originalResponse.record.id,
            oldData: context.record?.params,
            newData: originalResponse.record?.params,
          });
        }
        return originalResponse;
      },
    },
    delete: {
      after: async (originalResponse: any, request: any, context: any) => {
        if (request.method === 'post' && context.record) {
          const coverUrl = context.record.params?.coverImageUrl;
          if (coverUrl && coverUrl.startsWith('/uploads/')) {
            await PlatformMediaStation.deleteMediaByUrl(coverUrl);
          }

          const entityId =
            (typeof context.record.id === 'function' ? context.record.id() : context.record.id) ||
            context.record.params?.id;

          await AdminAuditService.logAdminEvent({
            platformAdminId: context.currentAdmin?.id,
            action: `${entityName.toUpperCase()}_DELETE`,
            entity: entityName,
            entityId: String(entityId),
            oldData: context.record.params,
          });
        }
        return originalResponse;
      },
    },
    new: {
      after: async (originalResponse: any, request: any, context: any) => {
        if (
          request.method === 'post' &&
          originalResponse.record &&
          !Object.keys(originalResponse.record.errors || {}).length
        ) {
          await AdminAuditService.logAdminEvent({
            platformAdminId: context.currentAdmin?.id,
            action: `${entityName.toUpperCase()}_CREATE`,
            entity: entityName,
            entityId: originalResponse.record.id,
            newData: originalResponse.record?.params,
          });
        }
        return originalResponse;
      },
    },
  };
}

export function getSafeCrudResources(components?: { coverImageComponentId?: string }): any[] {
  const coverImageComponent = components?.coverImageComponentId || 'CoverImageField';

  return [
    {
      resource: getPrismaModelTarget('Category'),
      options: {
        navigation: ADMIN_NAVIGATION_GROUPS.CONTENT_PORTAL,
        properties: {
          ...buildSensitivePropertiesConfiguration(),
          id: { isVisible: { list: true, show: true, edit: false, filter: true } },
          createdAt: { isVisible: { list: true, show: true, edit: false, filter: true } },
          updatedAt: { isVisible: { list: false, show: true, edit: false, filter: false } },
        },
      },
    },
    {
      resource: getPrismaModelTarget('Tag'),
      options: {
        navigation: ADMIN_NAVIGATION_GROUPS.CONTENT_PORTAL,
        properties: {
          ...buildSensitivePropertiesConfiguration(),
          id: { isVisible: { list: true, show: true, edit: false, filter: true } },
          createdAt: { isVisible: { list: true, show: true, edit: false, filter: true } },
          updatedAt: { isVisible: { list: false, show: true, edit: false, filter: false } },
        },
      },
    },
    {
      resource: getPrismaModelTarget('SiteSettings'),
      options: {
        navigation: ADMIN_NAVIGATION_GROUPS.CONTENT_PORTAL,
        properties: {
          ...buildSensitivePropertiesConfiguration(),
          id: { isVisible: { list: true, show: true, edit: false, filter: true } },
          createdAt: { isVisible: { list: true, show: true, edit: false, filter: true } },
          updatedAt: { isVisible: { list: false, show: true, edit: false, filter: false } },
        },
      },
    },
    {
      resource: getPrismaModelTarget('DeviceCatalog'),
      options: {
        navigation: ADMIN_NAVIGATION_GROUPS.STATIONS_CATALOG,
        actions: createCatalogActions('DeviceCatalog'),
        properties: {
          ...buildSensitivePropertiesConfiguration(),
          id: { isVisible: { list: true, show: true, edit: false, filter: true } },
          coverImageUrl: {
            components: {
              edit: coverImageComponent,
              show: coverImageComponent,
              list: coverImageComponent,
            },
          },
        },
      },
    },
    {
      resource: getPrismaModelTarget('GameCatalog'),
      options: {
        navigation: ADMIN_NAVIGATION_GROUPS.STATIONS_CATALOG,
        actions: createCatalogActions('GameCatalog'),
        properties: {
          ...buildSensitivePropertiesConfiguration(),
          id: { isVisible: { list: true, show: true, edit: false, filter: true } },
          coverImageUrl: {
            components: {
              edit: coverImageComponent,
              show: coverImageComponent,
              list: coverImageComponent,
            },
          },
        },
      },
    },
  ];
}
