import { describe, expect, it } from "vitest";
import { requireAuth, requireRole, type AuthContext } from "@/server/auth/context";
import { ForbiddenError, UnauthorizedError } from "@/server/errors";

const ctx: AuthContext = { userId: "u1", role: "SUPPORT", sessionId: "s1", familyId: "f1" };

describe("requireAuth", () => {
  it("returns the context when present", () => {
    expect(requireAuth(ctx)).toBe(ctx);
  });

  it("throws UnauthorizedError when null", () => {
    expect(() => requireAuth(null)).toThrow(UnauthorizedError);
  });
});

describe("requireRole", () => {
  it("returns the context when the role is allowed", () => {
    expect(requireRole(ctx, "SUPPORT", "ADMIN")).toBe(ctx);
  });

  it("throws ForbiddenError when the role is not allowed", () => {
    expect(() => requireRole(ctx, "FINANCE")).toThrow(ForbiddenError);
  });

  it("throws UnauthorizedError (not ForbiddenError) when there is no context at all", () => {
    expect(() => requireRole(null, "SUPPORT")).toThrow(UnauthorizedError);
  });
});
