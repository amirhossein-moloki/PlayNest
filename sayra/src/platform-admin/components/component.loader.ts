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

  // Candidate paths covering both runtime dist and development src environments
  const candidateBasePaths = [
    path.resolve(__dirname, '../dashboard/dashboard.component'),
    path.resolve(process.cwd(), 'dist/platform-admin/dashboard/dashboard.component'),
    path.resolve(process.cwd(), 'src/platform-admin/dashboard/dashboard.component'),
  ];

  const extensions = ['.tsx', '.jsx', '.ts', '.js', ''];
  let dashboardComponentPath = candidateBasePaths[0];

  for (const candidate of candidateBasePaths) {
    const found = extensions.some((ext) => fs.existsSync(candidate + ext));
    if (found) {
      dashboardComponentPath = candidate;
      break;
    }
  }

  dashboardComponentId = componentLoaderInstance.add('Dashboard', dashboardComponentPath);

  return {
    componentLoader: componentLoaderInstance,
    dashboardComponentId,
  };
}
