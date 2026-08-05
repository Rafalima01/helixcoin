import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Exercises the real route → controller → validation chain for
 * POST /api/auth/register, focused on the new "Convidar Afiliados" atomic
 * attribution wiring (see /affiliate-invite/[code]/route.ts and
 * AuthController.handleRegister): a `managerCode` in the signup payload
 * must trigger `affiliateService.assignManagerIfUnset(user.id, managerCode)`
 * right after `autoEnroll`, best-effort (never blocks/fails signup), and
 * must NOT be called at all when no managerCode is present. AuthService's
 * own registration logic (referredById, referralCode generation, etc.)
 * already has dedicated coverage in src/modules/identity/tests/**.
 */
const registerMock = vi.fn();
vi.mock("@/modules/identity/container", () => ({
  identityContainer: {
    authService: { register: (...args: unknown[]) => registerMock(...args) },
    userManagementService: {},
  },
}));

const findActiveBySlugMock = vi.fn().mockResolvedValue(null);
const autoEnrollMock = vi.fn().mockResolvedValue(undefined);
const assignManagerIfUnsetMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/modules/affiliate/container", () => ({
  affiliateContainer: {
    affiliateLinkService: { findActiveBySlug: (...args: unknown[]) => findActiveBySlugMock(...args) },
    affiliateService: {
      autoEnroll: (...args: unknown[]) => autoEnrollMock(...args),
      assignManagerIfUnset: (...args: unknown[]) => assignManagerIfUnsetMock(...args),
    },
  },
}));

import { handleRegister } from "@/modules/identity/controllers/auth.controller";

const fakeUser = {
  id: "user-1",
  firstName: "Ana",
  lastName: "Silva",
  username: "ana_silva",
  email: "ana@player.helixcoin.internal",
  phone: "+5511999999999",
  avatar: null,
  cpf: "12345678901",
  dateOfBirth: null,
  locale: "pt-BR",
  timezone: "America/Sao_Paulo",
  status: "ACTIVE",
  role: "USER",
  tags: [],
  lastLoginAt: null,
  emailVerifiedAt: null,
  phoneVerifiedAt: null,
  mfaEnabled: false,
  lockedUntil: null,
  referralCode: "ANA123",
  xp: 0,
  level: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function registerRequest(body: unknown) {
  return new NextRequest("http://localhost/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const BASE_BODY = {
  firstName: "Ana",
  lastName: "Silva",
  phone: "11999999999",
  password: "senha12345",
  cpf: "11122233043",
};

describe("POST /api/auth/register (integration)", () => {
  beforeEach(() => {
    registerMock.mockReset().mockResolvedValue(fakeUser as never);
    autoEnrollMock.mockReset().mockResolvedValue(undefined);
    assignManagerIfUnsetMock.mockReset().mockResolvedValue(undefined);
  });

  it("calls assignManagerIfUnset with the new user's id and managerCode when present", async () => {
    const res = await handleRegister(registerRequest({ ...BASE_BODY, managerCode: "MGR001" }));
    expect(res.status).toBe(201);
    expect(autoEnrollMock).toHaveBeenCalledWith("user-1");
    expect(assignManagerIfUnsetMock).toHaveBeenCalledWith("user-1", "MGR001");
  });

  it("never calls assignManagerIfUnset when no managerCode is in the payload", async () => {
    const res = await handleRegister(registerRequest(BASE_BODY));
    expect(res.status).toBe(201);
    expect(autoEnrollMock).toHaveBeenCalledWith("user-1");
    expect(assignManagerIfUnsetMock).not.toHaveBeenCalled();
  });

  it("signup still succeeds even if assignManagerIfUnset rejects (best-effort, never blocks registration)", async () => {
    assignManagerIfUnsetMock.mockRejectedValue(new Error("boom"));
    const res = await handleRegister(registerRequest({ ...BASE_BODY, managerCode: "MGR001" }));
    expect(res.status).toBe(201);
  });
});
