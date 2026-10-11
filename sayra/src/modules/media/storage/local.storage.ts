import { promises as fs } from 'node:fs';
import path from 'node:path';
import { env } from '../../../config/env';
import { StorageAdapter, StorageUploadInput, StorageUploadResult } from './storage.types';

const ensureDir = async (dir: string) => {
  await fs.mkdir(dir, { recursive: true });
};

const resolveLocalPath = (key: string) => path.join(env.MEDIA_LOCAL_ROOT, key);

const toPublicUrl = (key: string) => {
  const trimmedBase = env.MEDIA_PUBLIC_BASE_URL.replace(/\/$/, '');
  const publicPath = env.MEDIA_LOCAL_PUBLIC_PATH.replace(/\/$/, '');
  return `${trimmedBase}${publicPath}/${key}`;
};

export class LocalStorageAdapter implements StorageAdapter {
  async upload(input: StorageUploadInput): Promise<StorageUploadResult> {
    const targetPath = resolveLocalPath(input.key);
    await ensureDir(path.dirname(targetPath));
    await fs.writeFile(targetPath, input.body);
    return { key: input.key, url: toPublicUrl(input.key) };
  }
}
