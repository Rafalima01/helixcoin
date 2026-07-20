import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/server/config/env";
import { ExternalServiceError } from "@/server/errors";
import type { IStorageDriver, UploadInput, UploadResult } from "@/server/uploads/storage.interface";

/**
 * S3-compatible driver (works against real AWS S3 or any compatible
 * provider — Cloudflare R2, MinIO, Backblaze B2 — by pointing
 * UPLOADS_S3_REGION/endpoint config at it). Selected via
 * `UPLOADS_DRIVER=s3`; see storage.ts for how the driver is chosen.
 */
export class S3StorageDriver implements IStorageDriver {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor() {
    if (!env.UPLOADS_S3_BUCKET) {
      throw new Error("UPLOADS_S3_BUCKET must be set when UPLOADS_DRIVER=s3");
    }
    this.bucket = env.UPLOADS_S3_BUCKET;
    this.client = new S3Client({
      region: env.UPLOADS_S3_REGION || "auto",
      credentials:
        env.UPLOADS_S3_ACCESS_KEY_ID && env.UPLOADS_S3_SECRET_ACCESS_KEY
          ? {
              accessKeyId: env.UPLOADS_S3_ACCESS_KEY_ID,
              secretAccessKey: env.UPLOADS_S3_SECRET_ACCESS_KEY,
            }
          : undefined,
    });
  }

  async upload({ key, buffer, contentType }: UploadInput): Promise<UploadResult> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        })
      );
      return {
        key,
        url: `https://${this.bucket}.s3.${env.UPLOADS_S3_REGION}.amazonaws.com/${key}`,
      };
    } catch (err) {
      throw new ExternalServiceError("s3", err instanceof Error ? err.message : "Upload failed");
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (err) {
      throw new ExternalServiceError("s3", err instanceof Error ? err.message : "Delete failed");
    }
  }

  async getSignedUrl(key: string, expiresInSeconds = 900): Promise<string> {
    try {
      const command = new PutObjectCommand({ Bucket: this.bucket, Key: key });
      return await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
    } catch (err) {
      throw new ExternalServiceError(
        "s3",
        err instanceof Error ? err.message : "Failed to sign URL"
      );
    }
  }
}
