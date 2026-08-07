import { describe, expect, it, vi } from "vitest";

/**
 * Real Set/string semantics (not just vi.fn() stubs) so this test exercises
 * the actual A2 contract end-to-end: blacklistFamilyAccessTokens() must read
 * whatever issueTokenPair() actually wrote, and isAccessTokenBlacklisted()
 * must actually reflect it afterwards — a stub-only mock would let a broken
 * implementation pass silently. Every test below mints its own fresh random
 * user/family/session (via issueTokenPair's own crypto.randomUUID()
 * defaults), so no reset-between-tests is needed even though the maps below
 * are shared module state for the whole file.
 */
vi.mock("@/server/cache/redis", () => {
  const strings = new Map<string, string>();
  const sets = new Map<string, Set<string>>();
  return {
    redis: {
      async get(key: string) {
        return strings.get(key) ?? null;
      },
      async set(key: string, value: string) {
        strings.set(key, value);
        return "OK";
      },
      async del(...keys: string[]) {
        let n = 0;
        for (const k of keys) {
          if (strings.delete(k)) n++;
          if (sets.delete(k)) n++;
        }
        return n;
      },
      async exists(key: string) {
        return strings.has(key) || sets.has(key) ? 1 : 0;
      },
      async expire() {
        return 1;
      },
      async sadd(key: string, member: string) {
        if (!sets.has(key)) sets.set(key, new Set());
        sets.get(key)!.add(member);
        return 1;
      },
      async srem(key: string, member: string) {
        return sets.get(key)?.delete(member) ? 1 : 0;
      },
      async smembers(key: string) {
        return [...(sets.get(key) ?? [])];
      },
    },
  };
});

import {
  issueTokenPair,
  blacklistFamilyAccessTokens,
  isAccessTokenBlacklisted,
  revokeFamily,
} from "@/server/auth/tokens";

describe("blacklistFamilyAccessTokens (A2: immediate access-token invalidation)", () => {
  it("blacklists the live access token for every session in the family", async () => {
    const issued = await issueTokenPair("user_1", "USER");
    await expect(isAccessTokenBlacklisted(issued.sessionId)).resolves.toBe(false);

    await blacklistFamilyAccessTokens(issued.familyId);

    await expect(isAccessTokenBlacklisted(issued.sessionId)).resolves.toBe(true);
  });

  it("is safe to call on a family with no live sessions (already logged out)", async () => {
    await expect(blacklistFamilyAccessTokens("nonexistent-family")).resolves.toBeUndefined();
  });

  it("must run BEFORE revokeFamily — revokeFamily deletes the set it reads from", async () => {
    const issued = await issueTokenPair("user_2", "USER");

    // Wrong order: revokeFamily first empties the family's session set, so a
    // blacklist call afterwards would find nothing to blacklist.
    await revokeFamily(issued.familyId);
    await blacklistFamilyAccessTokens(issued.familyId);
    await expect(isAccessTokenBlacklisted(issued.sessionId)).resolves.toBe(false);
  });

  it("does not blacklist a DIFFERENT user's session — per-family granularity, not global", async () => {
    const targetUser = await issueTokenPair("user_3", "USER");
    const otherUser = await issueTokenPair("user_4", "USER");

    await blacklistFamilyAccessTokens(targetUser.familyId);

    await expect(isAccessTokenBlacklisted(targetUser.sessionId)).resolves.toBe(true);
    await expect(isAccessTokenBlacklisted(otherUser.sessionId)).resolves.toBe(false);
  });
});
