/* eslint-disable @typescript-eslint/no-explicit-any */
import path from 'path';

let componentLoaderInstance: any = null;
let dashboardComponentId: string | null = null;
let coverImageComponentId: string | null = null;

export async function getComponentLoader(ComponentLoaderClass: any): Promise<{
  componentLoader: any;
  dashboardComponentId: string;
  coverImageComponentId: string;
}> {
  if (componentLoaderInstance && dashboardComponentId && coverImageComponentId) {
    return {
      componentLoader: componentLoaderInstance,
      dashboardComponentId,
      coverImageComponentId,
    };
  }

  componentLoaderInstance = new ComponentLoaderClass();
  const fs = await import('fs');

  // Candidate paths covering both runtime dist and development src environments
  const candidateDashboardPaths = [
    path.resolve(__dirname, '../dashboard/dashboard.component'),
    path.resolve(process.cwd(), 'dist/platform-admin/dashboard/dashboard.component'),
    path.resolve(process.cwd(), 'src/platform-admin/dashboard/dashboard.component'),
  ];

  const candidateCoverImagePaths = [
    path.resolve(__dirname, './cover-image.component'),
    path.resolve(process.cwd(), 'dist/platform-admin/components/cover-image.component'),
    path.resolve(process.cwd(), 'src/platform-admin/components/cover-image.component'),
  ];

  const extensions = ['.tsx', '.jsx', '.ts', '.js', ''];

  let dashboardComponentPath = candidateDashboardPaths[0];
  for (const candidate of candidateDashboardPaths) {
    const found = extensions.some((ext) => fs.existsSync(candidate + ext));
    if (found) {
      dashboardComponentPath = candidate;
      break;
    }
  }

  let coverImageComponentPath = candidateCoverImagePaths[0];
  for (const candidate of candidateCoverImagePaths) {
    const found = extensions.some((ext) => fs.existsSync(candidate + ext));
    if (found) {
      coverImageComponentPath = candidate;
      break;
    }
  }

  dashboardComponentId = componentLoaderInstance.add('Dashboard', dashboardComponentPath);
  coverImageComponentId = componentLoaderInstance.add('CoverImageField', coverImageComponentPath);

  return {
    componentLoader: componentLoaderInstance,
    dashboardComponentId,
    coverImageComponentId,
  };
}
