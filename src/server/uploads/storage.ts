import { env } from "@/server/config/env";
import { LocalStorageDriver } from "@/server/uploads/local-storage.driver";
import type { IStorageDriver } from "@/server/uploads/storage.interface";

let driver: IStorageDriver | null = null;

/**
 * Storage driver, chosen once by `UPLOADS_DRIVER` and reused for the
 * process lifetime. The S3 driver is imported lazily so its (heavier) SDK
 * dependency and the bucket-presence check in its constructor never run
 * for the common local-dev path.
 */
export async function getStorageDriver(): Promise<IStorageDriver> {
  if (driver) return driver;

  if (env.UPLOADS_DRIVER === "s3") {
    const { S3StorageDriver } = await import("@/server/uploads/s3-storage.driver");
    driver = new S3StorageDriver();
  } else {
    driver = new LocalStorageDriver();
  }

  return driver;
}
