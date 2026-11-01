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
  const dashboardComponentPath = path.resolve(__dirname, '../dashboard/dashboard.component');
  dashboardComponentId = componentLoaderInstance.add('Dashboard', dashboardComponentPath);

  return {
    componentLoader: componentLoaderInstance,
    dashboardComponentId,
  };
}
