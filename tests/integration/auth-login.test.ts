import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { UserEntity } from "@/modules/identity/entities/user.entity";

/**
 * Route-level integration test: exercises the real Next.js route handler
 * (createRouteHandler → withRateLimit → controller → toUserResponseDto →
 * cookie helpers) with only the identity container's services and the raw
 * Redis client swapped for fakes — nothing about the HTTP wiring itself is
 * mocked. This is the layer src/modules/identity/tests/*.test.ts doesn't
 * reach (those test services directly, with no route/cookie/rate-limit code
 * in the loop).
 */
vi.mock("@/server/cache/redis", () => ({
  redis: {
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    ttl: vi.fn().mockResolvedValue(60),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
    exists: vi.fn().mockResolvedValue(0),
    sadd: vi.fn().mockResolvedValue(1),
    srem: vi.fn().mockResolvedValue(1),
    smembers: vi.fn().mockResolvedValue([]),
  },
}));

const loginMock = vi.fn();
vi.mock("@/modules/identity/container", () => ({
  identityContainer: {
    authService: { login: (...args: unknown[]) => loginMock(...args) },
    userManagementService: { getById: vi.fn() },
  },
}));

import { POST } from "@/app/api/auth/login/route";

function fakeUser(overrides: Partial<UserEntity> = {}): UserEntity {
  const now = new Date();
  return {
    id: "user_1",
    firstName: "Rafael",
    lastName: "Lima",
    username: "rafa",
    email: "rafa@test.com",
    phone: null,
    passwordHash: "hashed",
    avatar: null,
    cpf: null,
    dateOfBirth: null,
    locale: "pt-BR",
    timezone: "America/Sao_Paulo",
    status: "ACTIVE",
    role: "USER",
    tags: [],
    lastLoginAt: now,
    emailVerifiedAt: null,
    phoneVerifiedAt: null,
    mfaEnabled: false,
    loginAttempts: 0,
    lockedUntil: null,
    suspendedUntil: null,
    referralCode: "RAFA1234",
    referredById: null,
    xp: 0,
    level: 1,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}

describe("POST /api/auth/login (integration)", () => {
  beforeEach(() => loginMock.mockReset());

  it("sets httpOnly access/refresh cookies and returns the user on success", async () => {
    loginMock.mockResolvedValue({
      user: fakeUser(),
      accessToken: "access.jwt.token",
      refreshToken: "refresh.jwt.token",
      sessionId: "fam_1",
    });

    const req = new NextRequest("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "rafa@test.com", password: "correct-password" }),
    });

    const res = await POST(req, {});

    expect(res.status).toBe(200);
    expect(loginMock).toHaveBeenCalledTimes(1);

    const accessCookie = res.cookies.get("hj_access_token");
    const refreshCookie = res.cookies.get("hj_refresh_token");
    expect(accessCookie?.value).toBe("access.jwt.token");
    expect(refreshCookie?.value).toBe("refresh.jwt.token");
    expect(accessCookie?.httpOnly).toBe(true);

    const body = await res.json();
    expect(body.data.user.email).toBe("rafa@test.com");
    expect(body.data.user.passwordHash).toBeUndefined();
  });

  it("rejects a malformed body with a 400 (Zod validation) and never calls the service", async () => {
    const req = new NextRequest("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "not-an-email" }),
    });

    const res = await POST(req, {});
    expect(res.status).toBe(400);
    expect(loginMock).not.toHaveBeenCalled();
  });
});
