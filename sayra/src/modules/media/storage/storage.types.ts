export type StorageDriver = 'local' | 's3';

export interface StorageUploadInput {
  key: string;
  body: Buffer;
  contentType?: string;
  cacheControl?: string;
}

export interface StorageUploadResult {
  key: string;
  url: string;
}

export interface StorageAdapter {
  upload(input: StorageUploadInput): Promise<StorageUploadResult>;
}
