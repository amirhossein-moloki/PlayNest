import { env } from '../../../config/env';
import { LocalStorageAdapter } from './local.storage';
import { S3StorageAdapter } from './s3.storage';
import { StorageAdapter } from './storage.types';

let cachedAdapter: StorageAdapter | null = null;

export const getStorageAdapter = (): StorageAdapter => {
  if (cachedAdapter) {
    return cachedAdapter;
  }

  cachedAdapter = env.MEDIA_STORAGE_DRIVER === 's3'
    ? new S3StorageAdapter()
    : new LocalStorageAdapter();

  return cachedAdapter;
};

export * from './storage.types';
