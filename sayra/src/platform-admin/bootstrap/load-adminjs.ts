/* eslint-disable @typescript-eslint/no-explicit-any */
// Dedicated dynamic loader to import ESM modules into CommonJS runtime safely.
const dynamicImport = new Function('specifier', 'return import(specifier)') as <T = any>(
  specifier: string
) => Promise<T>;

export interface AdminJSPackages {
  AdminJS: any;
  AdminJSExpress: any;
  AdminJSPrisma: any;
  ComponentLoader: any;
}

let cachedPackages: AdminJSPackages | null = null;

export async function loadAdminJSPackages(): Promise<AdminJSPackages> {
  if (cachedPackages) {
    return cachedPackages;
  }

  const [adminjsModule, expressModule, prismaModule] = await Promise.all([
    dynamicImport<any>('adminjs'),
    dynamicImport<any>('@adminjs/express'),
    dynamicImport<any>('@adminjs/prisma'),
  ]);

  const AdminJS = adminjsModule.default || adminjsModule;
  const AdminJSExpress = expressModule.default || expressModule;
  const AdminJSPrisma = prismaModule.default || prismaModule;
  const ComponentLoader = adminjsModule.ComponentLoader;

  cachedPackages = {
    AdminJS,
    AdminJSExpress,
    AdminJSPrisma,
    ComponentLoader,
  };

  return cachedPackages;
}
