import { env } from "@/server/config/env";

/**
 * Feature flags — infrastructure only. No flag currently gates real
 * behavior; this is the loader future modules register against.
 *
 * Source is the `FEATURE_FLAGS` env var (comma-separated keys) for Phase 2.
 * A later phase can swap `loadFlags()`'s body for a database/Redis-backed
 * source (e.g. so ops can flip a flag without a deploy) without touching
 * any call site — everyone goes through `isFeatureEnabled()`.
 */

// `string` for now — no flag exists yet to enumerate. Once the first module
// introduces one, replace this with a literal union (e.g.
// `"rtp.new-curve" | "wallet.instant-payout"`) so a typo at a call site
// becomes a compile error instead of a silently-false flag check.
export type FeatureFlag = string;

function loadFlags(): Set<string> {
  return new Set(
    env.FEATURE_FLAGS.split(",")
      .map((f) => f.trim())
      .filter(Boolean)
  );
}

const activeFlags = loadFlags();

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return activeFlags.has(flag);
}
