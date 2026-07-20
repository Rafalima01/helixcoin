export interface UploadInput {
  /** Storage key/path, e.g. "kyc/user_123/document.pdf" — caller decides the namespace. */
  key: string;
  buffer: Buffer;
  contentType: string;
}

export interface UploadResult {
  key: string;
  /** Publicly resolvable URL (local driver) or a URL requiring `getSignedUrl` (private S3 objects). */
  url: string;
}

export interface IStorageDriver {
  upload(input: UploadInput): Promise<UploadResult>;
  delete(key: string): Promise<void>;
  /** Time-limited access URL — for a local driver this just returns the same public URL. */
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
}
