/* eslint-disable @typescript-eslint/no-explicit-any */
import { Express } from 'express';
import { loadAdminJSPackages } from './bootstrap/load-adminjs';
import { mountAdminRouter } from './bootstrap/mount-admin-router';
import logger from '../config/logger';

export async function initPlatformAdminPanel(app: Express): Promise<any> {
  try {
    const packages = await loadAdminJSPackages();
    const adminJS = await mountAdminRouter(app, packages);
    return adminJS;
  } catch (err) {
    logger.error({ err }, 'Failed to initialize Platform Admin Panel');
    throw err;
  }
}

export * from './config/admin.constants';
export * from './config/admin.navigation';
export * from './auth/admin.types';
export * from './auth/admin.authenticate';
export * from './resources';
export * from './services/admin-health.service';
export * from './services/admin-audit.service';
export * from './dashboard/dashboard.service';
