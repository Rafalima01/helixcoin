import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "@/server/config/env";

/**
 * AES-256-GCM for at-rest encryption of sensitive fields a future module
 * stores (PIX keys, document numbers) — never for passwords, those go
 * through server/auth/password.ts's bcrypt hashing instead. GCM gives
 * authenticated encryption: `decrypt` throws if the ciphertext was
 * tampered with, it doesn't silently return garbage.
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit nonce, the GCM-recommended size

function getKey(): Buffer {
  const key = Buffer.from(env.ENCRYPTION_KEY, "base64");
  if (key.length !== 32) {
    throw new Error(
      `ENCRYPTION_KEY must decode to exactly 32 bytes (got ${key.length}) — generate with: openssl rand -base64 32`
    );
  }
  return key;
}

/** Returns `iv:authTag:ciphertext`, each base64, colon-joined — self-contained, nothing else to store alongside it. */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(
    ":"
  );
}

export function decrypt(payload: string): string {
  const [ivB64, authTagB64, ciphertextB64] = payload.split(":");
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error("Malformed encrypted payload");
  }
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

/** One-way SHA-256, hex-encoded. For lookups/idempotency keys (e.g. hashing a webhook payload) — not for passwords. */
export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}
