import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { signAccessToken } from "@/server/auth/jwt";

/**
 * Exercises the real auth guard chain — getAuthContext → verifyAccessToken
 * → withRole → hasRole — with genuinely signed JWTs (no mocking of the auth
 * mechanism itself), only the identity container's user-search service so
 * this doesn't need a live Postgres. Proves the RBAC gate on /api/admin/**
 * actually rejects unauthenticated and under-privileged callers before ever
 * reaching PermissionService's fine-grained check.
 */
vi.mock("@/server/cache/redis", () => ({
  redis: {
    get: vi.fn().mockResolvedValue(null),
    exists: vi.fn().mockResolvedValue(0),
    set: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
  },
}));

const searchUsersMock = vi.fn();
vi.mock("@/modules/identity/container", () => ({
  identityContainer: {
    userManagementService: { search: (...args: unknown[]) => searchUsersMock(...args) },
    permissionService: { hasPermission: vi.fn().mockResolvedValue(true) },
  },
}));

import { GET } from "@/app/api/admin/users/route";

function makeRequest(token?: string) {
  return new NextRequest("http://localhost/api/admin/users", {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

describe("GET /api/admin/users RBAC gate (integration)", () => {
  beforeEach(() => searchUsersMock.mockReset());

  it("returns 401 with no token at all", async () => {
    const res = await GET(makeRequest(), {});
    expect(res.status).toBe(401);
    expect(searchUsersMock).not.toHaveBeenCalled();
  });

  it("returns 403 for an authenticated player (role USER)", async () => {
    const token = await signAccessToken({ sub: "user_1", role: "USER", sessionId: "s1", familyId: "f1" });
    const res = await GET(makeRequest(token), {});
    expect(res.status).toBe(403);
    expect(searchUsersMock).not.toHaveBeenCalled();
  });

  it("allows a SUPPORT staff member through the role gate", async () => {
    searchUsersMock.mockResolvedValue({ items: [], total: 0 });
    const token = await signAccessToken({ sub: "staff_1", role: "SUPPORT", sessionId: "s2", familyId: "f2" });
    const res = await GET(makeRequest(token), {});
    expect(res.status).toBe(200);
    expect(searchUsersMock).toHaveBeenCalledTimes(1);
  });
});
