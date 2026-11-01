import { AdminJSPackages } from './load-adminjs';

let isAdapterRegistered = false;

export function registerPrismaAdapter(packages: AdminJSPackages): void {
  if (isAdapterRegistered) {
    return;
  }

  const { AdminJS, AdminJSPrisma } = packages;
  AdminJS.registerAdapter({
    Database: AdminJSPrisma.Database,
    Resource: AdminJSPrisma.Resource,
  });

  isAdapterRegistered = true;
}
