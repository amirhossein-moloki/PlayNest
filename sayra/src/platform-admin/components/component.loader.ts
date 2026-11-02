/* eslint-disable @typescript-eslint/no-explicit-any */
import path from 'path';

let componentLoaderInstance: any = null;
let dashboardComponentId: string | null = null;

export async function getComponentLoader(ComponentLoaderClass: any): Promise<{
  componentLoader: any;
  dashboardComponentId: string;
}> {
  if (componentLoaderInstance && dashboardComponentId) {
    return {
      componentLoader: componentLoaderInstance,
      dashboardComponentId,
    };
  }

  componentLoaderInstance = new ComponentLoaderClass();
  const fs = await import('fs');
  // Check if TypeScript source component exists (e.g. In src/ or development), otherwise check dist
  let dashboardComponentPath = path.resolve(__dirname, '../dashboard/dashboard.component');
  if (!fs.existsSync(dashboardComponentPath + '.tsx') && !fs.existsSync(dashboardComponentPath + '.js')) {
    const srcPath = path.resolve(process.cwd(), 'src/platform-admin/dashboard/dashboard.component');
    if (fs.existsSync(srcPath + '.tsx') || fs.existsSync(srcPath + '.js')) {
      dashboardComponentPath = srcPath;
    }
  }
  dashboardComponentId = componentLoaderInstance.add('Dashboard', dashboardComponentPath);

  return {
    componentLoader: componentLoaderInstance,
    dashboardComponentId,
  };
}
