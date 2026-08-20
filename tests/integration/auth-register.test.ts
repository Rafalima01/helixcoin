import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Exercises the real route → controller → validation chain for
 * POST /api/auth/register. Signup no longer creates or attributes an
 * AffiliateProfile in any way — `autoEnroll` (auto-approved affiliate at
 * signup) and the "Convidar Afiliados" `assignManagerIfUnset` attribution
 * were BOTH removed from handleRegister by explicit product decision (see
 * auth.controller.ts's updated doc comment): the former because a regular
 * account must never become an affiliate on its own, the latter because it
 * only ever makes sense once an account IS an affiliate, which no longer
 * happens here — keeping that call would have meant it silently failed
 * (NotFoundError, no AffiliateProfile to attribute to) on every signup that
 * carries a managerCode, forever. AuthService's own registration logic
 * (referredById, referralCode generation, etc.) already has dedicated
 * coverage in src/modules/identity/tests/**.
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

  it("never calls autoEnroll or assignManagerIfUnset, even when managerCode is present — a fresh signup never becomes an affiliate", async () => {
    const res = await handleRegister(registerRequest({ ...BASE_BODY, managerCode: "MGR001" }));
    expect(res.status).toBe(201);
    expect(autoEnrollMock).not.toHaveBeenCalled();
    expect(assignManagerIfUnsetMock).not.toHaveBeenCalled();
  });

  it("never calls autoEnroll or assignManagerIfUnset when no managerCode is in the payload either", async () => {
    const res = await handleRegister(registerRequest(BASE_BODY));
    expect(res.status).toBe(201);
    expect(autoEnrollMock).not.toHaveBeenCalled();
    expect(assignManagerIfUnsetMock).not.toHaveBeenCalled();
  });
});
