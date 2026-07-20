import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, normalize, resolve, sep } from "node:path";
import { env } from "@/server/config/env";
import { ValidationError } from "@/server/errors";
import type { IStorageDriver, UploadInput, UploadResult } from "@/server/uploads/storage.interface";

const baseDir = resolve(process.cwd(), env.UPLOADS_LOCAL_DIR);

/** Rejects a key that would resolve outside `baseDir` (e.g. "../../etc/passwd"). */
function resolveSafePath(key: string): string {
  const target = resolve(baseDir, normalize(key));
  if (target !== baseDir && !target.startsWith(baseDir + sep)) {
    throw new ValidationError("Invalid storage key");
  }
  return target;
}

/**
 * Disk-backed storage driver — the default (`UPLOADS_DRIVER=local`) for
 * development and single-instance deployments. Files land under
 * `UPLOADS_LOCAL_DIR`; nothing here serves them over HTTP yet (no route
 * reads from this directory) — that's for the module that has an actual
 * upload to serve.
 */
export class LocalStorageDriver implements IStorageDriver {
  async upload({ key, buffer }: UploadInput): Promise<UploadResult> {
    const path = resolveSafePath(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, buffer);
    return { key, url: `/uploads/${key}` };
  }

  async delete(key: string): Promise<void> {
    const path = resolveSafePath(key);
    await rm(path, { force: true });
  }

  async getSignedUrl(key: string): Promise<string> {
    // No expiring-URL concept for local disk — same public path either way.
    resolveSafePath(key); // still validate the key
    return `/uploads/${key}`;
  }

  /** Test/debug helper — not part of IStorageDriver. */
  async readForTest(key: string): Promise<Buffer> {
    return readFile(resolveSafePath(key));
  }
}

// Re-exported for callers that only need one file's absolute path (e.g. a
// future static-serving route handler).
export function localStoragePath(key: string): string {
  return join(baseDir, normalize(key));
}
