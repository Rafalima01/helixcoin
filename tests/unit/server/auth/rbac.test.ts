import { describe, expect, it } from "vitest";
import { hasRole } from "@/server/auth/rbac";

// Fine-grained permission checks moved to the identity module's
// PermissionService (DB-backed Permission/RolePermission tables) — see
// src/modules/identity/tests/permission.service.test.ts.

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
