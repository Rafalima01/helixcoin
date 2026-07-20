import { describe, expect, it } from "vitest";
import { hasRole, hasPermission } from "@/server/auth/rbac";

describe("hasRole", () => {
  it("denies when no role is present", () => {
    expect(hasRole(undefined, ["ADMIN"])).toBe(false);
  });

  it("allows an exact match", () => {
    expect(hasRole("FINANCE", ["FINANCE", "ADMIN"])).toBe(true);
  });

  it("denies a role not in the allowed list", () => {
    expect(hasRole("SUPPORT", ["FINANCE", "ADMIN"])).toBe(false);
  });

  it("SUPER_ADMIN always passes, even for an empty allowlist", () => {
    expect(hasRole("SUPER_ADMIN", [])).toBe(true);
  });
});

describe("hasPermission", () => {
  it("SUPER_ADMIN passes any permission string", () => {
    expect(hasPermission("SUPER_ADMIN", "anything:at-all")).toBe(true);
  });

  it("fails closed for every other role — no permission matrix defined yet", () => {
    expect(hasPermission("ADMIN", "wallets:adjust")).toBe(false);
    expect(hasPermission("FINANCE", "withdrawals:approve")).toBe(false);
  });

  it("denies when no role is present", () => {
    expect(hasPermission(undefined, "wallets:adjust")).toBe(false);
  });
});
