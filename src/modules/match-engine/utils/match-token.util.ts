import { randomBytes } from "node:crypto";
import { sha256Hex } from "@/server/security";

/** Generated once at match creation; the raw token is returned to the client exactly once and never stored — only its hash is. */
export function generateMatchToken(): { token: string; tokenHash: string } {
  const token = randomBytes(24).toString("hex");
  return { token, tokenHash: sha256Hex(token) };
}

/** Constant-shape comparison isn't needed here (sha256Hex already collapses length), but never short-circuit on the raw token itself. */
export function verifyMatchToken(tokenHash: string, candidate: string): boolean {
  if (!candidate) return false;
  return sha256Hex(candidate) === tokenHash;
}
