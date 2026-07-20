import { describe, expect, it } from "vitest";
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from "@/server/auth/jwt";

describe("access tokens", () => {
  it("round-trips sub/role/sessionId/familyId through sign + verify", async () => {
    const token = await signAccessToken({
      sub: "user_1",
      role: "ADMIN",
      sessionId: "sess_1",
      familyId: "fam_1",
    });
    const claims = await verifyAccessToken(token);
    expect(claims.sub).toBe("user_1");
    expect(claims.role).toBe("ADMIN");
    expect(claims.sessionId).toBe("sess_1");
    expect(claims.familyId).toBe("fam_1");
    expect(claims.exp).toBeGreaterThan(claims.iat!);
  });

  it("rejects a token signed with a different secret", async () => {
    // Simulate a forged token: same payload shape, garbage signature.
    const token = await signAccessToken({ sub: "user_1", sessionId: "sess_1", familyId: "fam_1" });
    const tampered = token.slice(0, -4) + "abcd";
    await expect(verifyAccessToken(tampered)).rejects.toThrow();
  });

  it("rejects a malformed token string", async () => {
    await expect(verifyAccessToken("not-a-jwt")).rejects.toThrow();
  });
});

describe("refresh tokens", () => {
  it("round-trips sub/sessionId/familyId, and is rejected by verifyAccessToken (different secret/shape)", async () => {
    const token = await signRefreshToken({ sub: "user_1", sessionId: "sess_1", familyId: "fam_1" });
    const claims = await verifyRefreshToken(token);
    expect(claims.sub).toBe("user_1");
    expect(claims.familyId).toBe("fam_1");
    await expect(verifyAccessToken(token)).rejects.toThrow();
  });

  it("honors a custom TTL override (remember me)", async () => {
    const shortLived = await signRefreshToken(
      { sub: "user_1", sessionId: "sess_1", familyId: "fam_1" },
      "5m"
    );
    const claims = await verifyRefreshToken(shortLived);
    const ttlSeconds = claims.exp! - claims.iat!;
    expect(ttlSeconds).toBe(5 * 60);
  });
});
