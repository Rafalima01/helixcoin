import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { signAccessToken } from "@/server/auth/jwt";

/**
 * Exercises the real route → withRole("MANAGER")/withRole(...ROLE_HIERARCHY) guard
 * → controller → validation → error-mapping chain for /api/manager/** and
 * /api/admin/manager/**, the same HTTP-layer-focused approach as
 * tests/integration/affiliate.test.ts. ManagerService's own scoping/aggregation
 * logic already has dedicated coverage in src/modules/manager/tests/**.
 */
const hasPermissionMock = vi.fn().mockResolvedValue(true);
vi.mock("@/modules/identity/container", () => ({
  identityContainer: {
    permissionService: { hasPermission: (...args: unknown[]) => hasPermissionMock(...args) },
  },
}));

const getByUserIdMock = vi.fn();
const getDashboardMock = vi.fn();
const listApprovalsMock = vi.fn();
const decideApplicationMock = vi.fn();
const getNetworkAffiliateMock = vi.fn();
const listNetworkMock = vi.fn();
const getNetworkWithStatsMock = vi.fn();
const listAdminMock = vi.fn();
const getByIdAdminMock = vi.fn();
const activateProfileMock = vi.fn();
const updateCommissionMock = vi.fn();

vi.mock("@/modules/manager/container", () => ({
  managerContainer: {
    managerService: {
      getByUserId: (...args: unknown[]) => getByUserIdMock(...args),
      getDashboard: (...args: unknown[]) => getDashboardMock(...args),
      listApprovals: (...args: unknown[]) => listApprovalsMock(...args),
      decideApplication: (...args: unknown[]) => decideApplicationMock(...args),
      getNetworkAffiliate: (...args: unknown[]) => getNetworkAffiliateMock(...args),
      listNetwork: (...args: unknown[]) => listNetworkMock(...args),
      getNetworkWithStats: (...args: unknown[]) => getNetworkWithStatsMock(...args),
      listAdmin: (...args: unknown[]) => listAdminMock(...args),
      getByIdAdmin: (...args: unknown[]) => getByIdAdminMock(...args),
      activateProfile: (...args: unknown[]) => activateProfileMock(...args),
      updateCommission: (...args: unknown[]) => updateCommissionMock(...args),
    },
  },
}));

import { GET as getMeRoute } from "@/app/api/manager/me/route";
import { GET as getDashboardRoute } from "@/app/api/manager/dashboard/route";
import { GET as listApprovalsRoute } from "@/app/api/manager/approvals/route";
import { POST as decideApprovalRoute } from "@/app/api/manager/approvals/[id]/decide/route";
import { GET as listNetworkRoute } from "@/app/api/manager/network/route";
import { GET as getNetworkAffiliateRoute } from "@/app/api/manager/network/[id]/route";
import { GET as listManagersAdminRoute } from "@/app/api/admin/manager/route";
import { GET as getManagerAdminRoute } from "@/app/api/admin/manager/[id]/route";
import { PATCH as activateManagerRoute } from "@/app/api/admin/manager/[id]/activate/route";
import { PATCH as updateCommissionRoute } from "@/app/api/admin/manager/[id]/commission/route";
import { NotFoundError, ForbiddenError } from "@/server/errors";

function makeRequest(url: string, body?: unknown, token?: string) {
  return new NextRequest(`http://localhost${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

function getRequest(url: string, token?: string) {
  return new NextRequest(`http://localhost${url}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

async function playerToken(userId = "user-1") {
  return signAccessToken({ sub: userId, role: "USER", sessionId: "s1", familyId: "f1" });
}
async function managerToken(userId = "manager-user-1") {
  return signAccessToken({ sub: userId, role: "MANAGER", sessionId: "s2", familyId: "f2" });
}
async function adminToken() {
  return signAccessToken({ sub: "admin-1", role: "ADMIN", sessionId: "s3", familyId: "f3" });
}

const fakeManagerProfile = {
  id: "mgr-1",
  userId: "manager-user-1",
  inviteCode: "ABC12345",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const fakeAffiliateRow = {
  id: "aff-1",
  userId: "affiliate-user-1",
  userName: "X",
  userEmail: "x@y.com",
  userPhone: null,
  managerId: "mgr-1",
  managerName: null,
  status: "PENDING",
  documentsJson: null,
  pixKeyEncrypted: null,
  cpaOverrideCents: null,
  revShareOverridePercent: null,
  requestedAt: new Date(),
  approvedAt: null,
  approvedById: null,
  rejectionReason: null,
  blockedAt: null,
  blockedReason: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const fakeNetworkStatsRow = {
  ...fakeAffiliateRow,
  playersReferredCount: 2,
  ftdCount: 1,
  depositTotalCents: 5000,
  paidToAffiliateCents: 700,
  keptByManagerCents: 300,
};

describe("/api/manager routes (integration)", () => {
  beforeEach(() => {
    hasPermissionMock.mockReset().mockResolvedValue(true);
    getByUserIdMock.mockReset().mockResolvedValue(fakeManagerProfile);
    getDashboardMock.mockReset();
    listApprovalsMock.mockReset().mockResolvedValue({ items: [], total: 0 });
    decideApplicationMock.mockReset();
    getNetworkAffiliateMock.mockReset();
    listNetworkMock.mockReset().mockResolvedValue({ items: [], total: 0 });
    getNetworkWithStatsMock.mockReset().mockResolvedValue({ items: [], total: 0 });
  });

  describe("GET /api/manager/me", () => {
    it("401s with no token", async () => {
      const res = await getMeRoute(getRequest("/api/manager/me"), {});
      expect(res.status).toBe(401);
    });

    it("403s for a player role", async () => {
      const token = await playerToken();
      const res = await getMeRoute(getRequest("/api/manager/me", token), {});
      expect(res.status).toBe(403);
    });

    it("200s for a manager", async () => {
      const token = await managerToken();
      const res = await getMeRoute(getRequest("/api/manager/me", token), {});
      expect(res.status).toBe(200);
    });

    it("404s when the caller has no ManagerProfile", async () => {
      getByUserIdMock.mockRejectedValue(new NotFoundError("Perfil de gerente"));
      const token = await managerToken();
      const res = await getMeRoute(getRequest("/api/manager/me", token), {});
      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/manager/dashboard", () => {
    it("200s with aggregated, financial-data-free stats, split into paid-to-affiliates vs kept-by-manager", async () => {
      getDashboardMock.mockResolvedValue({
        affiliatesActive: 2,
        affiliatesPending: 1,
        playersReferred: 0,
        paidToAffiliatesTodayCents: 0,
        keptByManagerTodayCents: 0,
        paidToAffiliates7dCents: 0,
        keptByManager7dCents: 0,
        paidToAffiliates30dCents: 5000,
        keptByManager30dCents: 2000,
        paidToAffiliatesTotalCents: 5000,
        keptByManagerTotalCents: 2000,
      });
      const token = await managerToken();
      const res = await getDashboardRoute(getRequest("/api/manager/dashboard", token), {});
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.paidToAffiliatesTotalCents).toBe(5000);
      expect(json.data.keptByManagerTotalCents).toBe(2000);
      expect(json.data).not.toHaveProperty("commissionTotalCents");
      expect(json.data).not.toHaveProperty("walletBalance");
    });
  });

  describe("GET /api/manager/approvals", () => {
    it("200s listing pending applications scoped to the caller's own network", async () => {
      listApprovalsMock.mockResolvedValue({ items: [fakeAffiliateRow], total: 1 });
      const token = await managerToken();
      const res = await listApprovalsRoute(getRequest("/api/manager/approvals", token), {});
      expect(res.status).toBe(200);
      expect(listApprovalsMock).toHaveBeenCalledWith(fakeManagerProfile.id);
    });
  });

  describe("POST /api/manager/approvals/[id]/decide", () => {
    it("400s when REJECT has no reason", async () => {
      const token = await managerToken();
      const res = await decideApprovalRoute(
        makeRequest("/api/manager/approvals/aff-1/decide", { action: "REJECT" }, token),
        { params: Promise.resolve({ id: "aff-1" }) }
      );
      expect(res.status).toBe(400);
      expect(decideApplicationMock).not.toHaveBeenCalled();
    });

    it("200s on a valid APPROVE decision, scoped to the caller's own manager id", async () => {
      getNetworkAffiliateMock.mockResolvedValue({ ...fakeAffiliateRow, status: "APPROVED" });
      const token = await managerToken();
      const res = await decideApprovalRoute(
        makeRequest("/api/manager/approvals/aff-1/decide", { action: "APPROVE" }, token),
        { params: Promise.resolve({ id: "aff-1" }) }
      );
      expect(res.status).toBe(200);
      expect(decideApplicationMock).toHaveBeenCalledWith(fakeManagerProfile.id, "aff-1", "APPROVE", undefined, "manager-user-1");
    });

    it("403s when the affiliate belongs to a different manager's network", async () => {
      decideApplicationMock.mockRejectedValue(new ForbiddenError());
      const token = await managerToken();
      const res = await decideApprovalRoute(
        makeRequest("/api/manager/approvals/aff-2/decide", { action: "APPROVE" }, token),
        { params: Promise.resolve({ id: "aff-2" }) }
      );
      expect(res.status).toBe(403);
    });
  });

  describe("GET /api/manager/network", () => {
    it("200s listing the manager's own affiliate network with the financial rollup", async () => {
      getNetworkWithStatsMock.mockResolvedValue({ items: [fakeNetworkStatsRow], total: 1 });
      const token = await managerToken();
      const res = await listNetworkRoute(getRequest("/api/manager/network", token), {});
      expect(res.status).toBe(200);
      expect(getNetworkWithStatsMock).toHaveBeenCalledWith(fakeManagerProfile.id);
      const json = await res.json();
      expect(json.data[0].depositTotalCents).toBe(5000);
      expect(json.data[0].keptByManagerCents).toBe(300);
    });
  });

  describe("GET /api/manager/network/[id]", () => {
    it("200s with a single affiliate's detail", async () => {
      getNetworkAffiliateMock.mockResolvedValue(fakeAffiliateRow);
      const token = await managerToken();
      const res = await getNetworkAffiliateRoute(getRequest("/api/manager/network/aff-1", token), {
        params: Promise.resolve({ id: "aff-1" }),
      });
      expect(res.status).toBe(200);
    });

    it("403s when the affiliate belongs to another manager", async () => {
      getNetworkAffiliateMock.mockRejectedValue(new ForbiddenError());
      const token = await managerToken();
      const res = await getNetworkAffiliateRoute(getRequest("/api/manager/network/aff-2", token), {
        params: Promise.resolve({ id: "aff-2" }),
      });
      expect(res.status).toBe(403);
    });
  });
});

describe("/api/admin/manager routes (integration)", () => {
  beforeEach(() => {
    hasPermissionMock.mockReset().mockResolvedValue(true);
    listAdminMock.mockReset().mockResolvedValue({ items: [], total: 0 });
    getByIdAdminMock.mockReset();
    activateProfileMock.mockReset();
    updateCommissionMock.mockReset();
  });

  describe("GET /api/admin/manager", () => {
    it("401s with no token", async () => {
      const res = await listManagersAdminRoute(getRequest("/api/admin/manager"), {});
      expect(res.status).toBe(401);
    });

    it("403s for a player role", async () => {
      const token = await playerToken();
      const res = await listManagersAdminRoute(getRequest("/api/admin/manager", token), {});
      expect(res.status).toBe(403);
    });

    it("403s when the role lacks manager.read", async () => {
      hasPermissionMock.mockResolvedValue(false);
      const token = await adminToken();
      const res = await listManagersAdminRoute(getRequest("/api/admin/manager", token), {});
      expect(res.status).toBe(403);
    });

    it("200s with the permission", async () => {
      const token = await adminToken();
      const res = await listManagersAdminRoute(getRequest("/api/admin/manager", token), {});
      expect(res.status).toBe(200);
    });
  });

  describe("GET /api/admin/manager/[id]", () => {
    it("200s with manager detail", async () => {
      getByIdAdminMock.mockResolvedValue({
        ...fakeManagerProfile,
        userName: "Y",
        userEmail: "y@z.com",
        userPhone: null,
        affiliateCount: 0,
      });
      const token = await adminToken();
      const res = await getManagerAdminRoute(getRequest("/api/admin/manager/mgr-1", token), {
        params: Promise.resolve({ id: "mgr-1" }),
      });
      expect(res.status).toBe(200);
    });

    it("404s for an unknown manager", async () => {
      getByIdAdminMock.mockRejectedValue(new NotFoundError("Gerente"));
      const token = await adminToken();
      const res = await getManagerAdminRoute(getRequest("/api/admin/manager/nope", token), {
        params: Promise.resolve({ id: "nope" }),
      });
      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /api/admin/manager/[id]/activate", () => {
    it("200s activating a PENDING manager", async () => {
      activateProfileMock.mockResolvedValue({ ...fakeManagerProfile, status: "ACTIVE" });
      const token = await adminToken();
      const res = await activateManagerRoute(makeRequest("/api/admin/manager/mgr-1/activate", {}, token), {
        params: Promise.resolve({ id: "mgr-1" }),
      });
      expect(res.status).toBe(200);
      expect(activateProfileMock).toHaveBeenCalledWith("mgr-1", { id: "admin-1", role: "ADMIN" }, expect.anything());
    });

    it("403s when the role lacks manager.manage", async () => {
      hasPermissionMock.mockResolvedValue(false);
      const token = await adminToken();
      const res = await activateManagerRoute(makeRequest("/api/admin/manager/mgr-1/activate", {}, token), {
        params: Promise.resolve({ id: "mgr-1" }),
      });
      expect(res.status).toBe(403);
      expect(activateProfileMock).not.toHaveBeenCalled();
    });

    it("422s when the manager is already active", async () => {
      const { BusinessRuleError } = await import("@/server/errors");
      activateProfileMock.mockRejectedValue(new BusinessRuleError("Gerente já está ativo"));
      const token = await adminToken();
      const res = await activateManagerRoute(makeRequest("/api/admin/manager/mgr-1/activate", {}, token), {
        params: Promise.resolve({ id: "mgr-1" }),
      });
      expect(res.status).toBe(422);
    });
  });

  describe("PATCH /api/admin/manager/[id]/commission", () => {
    it("400s with an out-of-range commissionPercent", async () => {
      const token = await adminToken();
      const res = await updateCommissionRoute(
        makeRequest("/api/admin/manager/mgr-1/commission", { commissionPercent: 150 }, token),
        { params: Promise.resolve({ id: "mgr-1" }) }
      );
      expect(res.status).toBe(400);
      expect(updateCommissionMock).not.toHaveBeenCalled();
    });

    it("200s updating the commission percentage", async () => {
      updateCommissionMock.mockResolvedValue({ ...fakeManagerProfile, commissionPercent: 12.5 });
      const token = await adminToken();
      const res = await updateCommissionRoute(
        makeRequest("/api/admin/manager/mgr-1/commission", { commissionPercent: 12.5 }, token),
        { params: Promise.resolve({ id: "mgr-1" }) }
      );
      expect(res.status).toBe(200);
      expect(updateCommissionMock).toHaveBeenCalledWith("mgr-1", 12.5, { id: "admin-1", role: "ADMIN" }, expect.anything());
    });
  });
});
