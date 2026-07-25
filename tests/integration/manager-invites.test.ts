import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { signAccessToken } from "@/server/auth/jwt";

/**
 * Exercises the real route → withRole(...ROLE_HIERARCHY)/withRateLimit guard
 * → controller → validation → error-mapping chain for
 * /api/admin/manager/invites/** (admin) and /api/manager-invites/** (public,
 * unauthenticated, rate-limited like /api/auth/login). ManagerInviteService's
 * own lifecycle logic already has dedicated coverage in
 * src/modules/manager/tests/manager-invite.service.test.ts.
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
  },
}));

const hasPermissionMock = vi.fn().mockResolvedValue(true);
vi.mock("@/modules/identity/container", () => ({
  identityContainer: {
    permissionService: { hasPermission: (...args: unknown[]) => hasPermissionMock(...args) },
  },
}));

const createMock = vi.fn();
const listAdminMock = vi.fn();
const getByIdAdminMock = vi.fn();
const regenerateMock = vi.fn();
const revokeMock = vi.fn();
const getPublicByTokenMock = vi.fn();
const acceptMock = vi.fn();

vi.mock("@/modules/manager/container", () => ({
  managerContainer: {
    managerInviteService: {
      create: (...args: unknown[]) => createMock(...args),
      listAdmin: (...args: unknown[]) => listAdminMock(...args),
      getByIdAdmin: (...args: unknown[]) => getByIdAdminMock(...args),
      regenerate: (...args: unknown[]) => regenerateMock(...args),
      revoke: (...args: unknown[]) => revokeMock(...args),
      getPublicByToken: (...args: unknown[]) => getPublicByTokenMock(...args),
      accept: (...args: unknown[]) => acceptMock(...args),
    },
  },
}));

import { GET as listInvitesRoute, POST as createInviteRoute } from "@/app/api/admin/manager/invites/route";
import { GET as getInviteRoute } from "@/app/api/admin/manager/invites/[id]/route";
import { POST as regenerateInviteRoute } from "@/app/api/admin/manager/invites/[id]/regenerate/route";
import { POST as revokeInviteRoute } from "@/app/api/admin/manager/invites/[id]/revoke/route";
import { GET as getPublicInviteRoute } from "@/app/api/manager-invites/[token]/route";
import { POST as acceptInviteRoute } from "@/app/api/manager-invites/[token]/accept/route";
import { NotFoundError, BusinessRuleError } from "@/server/errors";

function makeRequest(url: string, body?: unknown, token?: string) {
  return new NextRequest(`http://localhost${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

function getRequest(url: string, token?: string) {
  return new NextRequest(`http://localhost${url}`, { headers: token ? { authorization: `Bearer ${token}` } : {} });
}

async function playerToken() {
  return signAccessToken({ sub: "user-1", role: "USER", sessionId: "s1", familyId: "f1" });
}
async function adminToken() {
  return signAccessToken({ sub: "admin-1", role: "ADMIN", sessionId: "s2", familyId: "f2" });
}

const fakeInviteAdmin = {
  id: "inv-1",
  name: "Novo Gerente",
  email: "novo@gerente.com",
  phone: null,
  notes: null,
  commissionPercent: 10,
  initialStatus: "ACTIVE",
  status: "ACTIVE",
  expiresAt: null,
  createdById: "admin-1",
  createdByName: "Admin",
  acceptedAt: null,
  acceptedByUserId: null,
  acceptedIp: null,
  revokedAt: null,
  revokedById: null,
  revokedByName: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const fakeManagerProfile = {
  id: "mgr-1",
  userId: "new-manager",
  inviteCode: "ABC12345",
  commissionPercent: 10,
  status: "ACTIVE",
  createdAt: new Date(),
};

describe("/api/admin/manager/invites routes (integration)", () => {
  beforeEach(() => {
    hasPermissionMock.mockReset().mockResolvedValue(true);
    createMock.mockReset();
    listAdminMock.mockReset().mockResolvedValue({ items: [], total: 0 });
    getByIdAdminMock.mockReset();
    regenerateMock.mockReset();
    revokeMock.mockReset();
  });

  describe("POST /api/admin/manager/invites", () => {
    it("401s with no token", async () => {
      const res = await createInviteRoute(makeRequest("/api/admin/manager/invites", {}), {});
      expect(res.status).toBe(401);
    });

    it("403s for a player role", async () => {
      const token = await playerToken();
      const res = await createInviteRoute(
        makeRequest("/api/admin/manager/invites", { name: "X", email: "x@y.com", commissionPercent: 10 }, token),
        {}
      );
      expect(res.status).toBe(403);
    });

    it("400s with an out-of-range expiresInDays", async () => {
      const token = await adminToken();
      const res = await createInviteRoute(
        makeRequest("/api/admin/manager/invites", { expiresInDays: 0 }, token),
        {}
      );
      expect(res.status).toBe(400);
      expect(createMock).not.toHaveBeenCalled();
    });

    it("201s generating a bare invite link — no candidate identity required", async () => {
      createMock.mockResolvedValue({ invite: { id: "inv-1" }, rawToken: "a".repeat(64) });
      getByIdAdminMock.mockResolvedValue(fakeInviteAdmin);
      const token = await adminToken();
      const res = await createInviteRoute(makeRequest("/api/admin/manager/invites", {}, token), {});
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.inviteLink).toContain("/invite/");
      expect(createMock).toHaveBeenCalledWith({}, expect.anything(), expect.anything());
    });
  });

  describe("GET /api/admin/manager/invites", () => {
    it("200s listing invites", async () => {
      const token = await adminToken();
      const res = await listInvitesRoute(getRequest("/api/admin/manager/invites", token), {});
      expect(res.status).toBe(200);
    });

    it("403s when the role lacks manager.read", async () => {
      hasPermissionMock.mockResolvedValue(false);
      const token = await adminToken();
      const res = await listInvitesRoute(getRequest("/api/admin/manager/invites", token), {});
      expect(res.status).toBe(403);
    });
  });

  describe("GET /api/admin/manager/invites/[id]", () => {
    it("404s for an unknown invite", async () => {
      getByIdAdminMock.mockRejectedValue(new NotFoundError("Convite"));
      const token = await adminToken();
      const res = await getInviteRoute(getRequest("/api/admin/manager/invites/nope", token), {
        params: Promise.resolve({ id: "nope" }),
      });
      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/admin/manager/invites/[id]/regenerate", () => {
    it("200s regenerating and returns a fresh link", async () => {
      regenerateMock.mockResolvedValue({ rawToken: "b".repeat(64) });
      getByIdAdminMock.mockResolvedValue(fakeInviteAdmin);
      const token = await adminToken();
      const res = await regenerateInviteRoute(makeRequest("/api/admin/manager/invites/inv-1/regenerate", {}, token), {
        params: Promise.resolve({ id: "inv-1" }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.inviteLink).toContain("b".repeat(64));
    });

    it("422s when the invite was already used", async () => {
      regenerateMock.mockRejectedValue(new BusinessRuleError("Convite já utilizado — não pode ser regenerado"));
      const token = await adminToken();
      const res = await regenerateInviteRoute(makeRequest("/api/admin/manager/invites/inv-1/regenerate", {}, token), {
        params: Promise.resolve({ id: "inv-1" }),
      });
      expect(res.status).toBe(422);
    });
  });

  describe("POST /api/admin/manager/invites/[id]/revoke", () => {
    it("200s revoking an invite", async () => {
      revokeMock.mockResolvedValue({});
      getByIdAdminMock.mockResolvedValue({ ...fakeInviteAdmin, status: "REVOKED" });
      const token = await adminToken();
      const res = await revokeInviteRoute(makeRequest("/api/admin/manager/invites/inv-1/revoke", {}, token), {
        params: Promise.resolve({ id: "inv-1" }),
      });
      expect(res.status).toBe(200);
    });
  });
});

describe("/api/manager-invites routes (integration, public/unauthenticated)", () => {
  beforeEach(() => {
    getPublicByTokenMock.mockReset();
    acceptMock.mockReset();
  });

  describe("GET /api/manager-invites/[token]", () => {
    it("200s with the safe public shape for a valid token — no candidate identity, just redeemability", async () => {
      getPublicByTokenMock.mockResolvedValue({ status: "ACTIVE" });
      const res = await getPublicInviteRoute(getRequest("/api/manager-invites/validtoken"), {
        params: Promise.resolve({ token: "validtoken" }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.status).toBe("ACTIVE");
      expect(json.data.email).toBeUndefined();
    });

    it("404s for an unknown token", async () => {
      getPublicByTokenMock.mockRejectedValue(new NotFoundError("Convite"));
      const res = await getPublicInviteRoute(getRequest("/api/manager-invites/bogus"), {
        params: Promise.resolve({ token: "bogus" }),
      });
      expect(res.status).toBe(404);
    });

    it("422s for an expired/used/revoked token", async () => {
      getPublicByTokenMock.mockRejectedValue(new BusinessRuleError("Este convite expirou"));
      const res = await getPublicInviteRoute(getRequest("/api/manager-invites/expired"), {
        params: Promise.resolve({ token: "expired" }),
      });
      expect(res.status).toBe(422);
    });
  });

  describe("POST /api/manager-invites/[token]/accept", () => {
    const CANDIDATE = { name: "Novo Gerente", email: "novo@gerente.com", phone: "11999999999" };

    it("400s when passwords don't match", async () => {
      const res = await acceptInviteRoute(
        makeRequest("/api/manager-invites/validtoken/accept", { ...CANDIDATE, password: "SenhaForte123!", confirmPassword: "Diferente123!" }),
        { params: Promise.resolve({ token: "validtoken" }) }
      );
      expect(res.status).toBe(400);
      expect(acceptMock).not.toHaveBeenCalled();
    });

    it("400s when the candidate's name is missing", async () => {
      const res = await acceptInviteRoute(
        makeRequest("/api/manager-invites/validtoken/accept", { email: CANDIDATE.email, password: "SenhaForte123!", confirmPassword: "SenhaForte123!" }),
        { params: Promise.resolve({ token: "validtoken" }) }
      );
      expect(res.status).toBe(400);
      expect(acceptMock).not.toHaveBeenCalled();
    });

    it("201s creating the manager account on a valid acceptance, from the candidate's own submitted identity", async () => {
      acceptMock.mockResolvedValue(fakeManagerProfile);
      const res = await acceptInviteRoute(
        makeRequest("/api/manager-invites/validtoken/accept", { ...CANDIDATE, password: "SenhaForte123!", confirmPassword: "SenhaForte123!" }),
        { params: Promise.resolve({ token: "validtoken" }) }
      );
      expect(res.status).toBe(201);
      expect(acceptMock).toHaveBeenCalledWith(
        "validtoken",
        { name: CANDIDATE.name, email: CANDIDATE.email, phone: CANDIDATE.phone, password: "SenhaForte123!" },
        expect.anything()
      );
    });

    it("422s when the invite was already used", async () => {
      acceptMock.mockRejectedValue(new BusinessRuleError("Este convite já foi utilizado"));
      const res = await acceptInviteRoute(
        makeRequest("/api/manager-invites/usedtoken/accept", { ...CANDIDATE, password: "SenhaForte123!", confirmPassword: "SenhaForte123!" }),
        { params: Promise.resolve({ token: "usedtoken" }) }
      );
      expect(res.status).toBe(422);
    });
  });
});
