import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { signAccessToken } from "@/server/auth/jwt";

/**
 * Exercises the real route → auth guard → controller → validation →
 * error-mapping chain for /api/affiliate/** and /api/admin/affiliate/**,
 * the same HTTP-layer-focused approach as tests/integration/payments.test.ts.
 * The commission engine's own logic (tree-walk, idempotency, CPA) already
 * has dedicated coverage in src/modules/affiliate/tests/**.
 */
const hasPermissionMock = vi.fn().mockResolvedValue(true);
vi.mock("@/modules/identity/container", () => ({
  identityContainer: {
    permissionService: { hasPermission: (...args: unknown[]) => hasPermissionMock(...args) },
  },
}));

const userCountMock = vi.fn().mockResolvedValue(0);
const managerProfileFindUniqueMock = vi.fn().mockResolvedValue(null);
const depositAggregateMock = vi.fn().mockResolvedValue({ _sum: { amountCents: 0 } });
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { count: (...args: unknown[]) => userCountMock(...args) },
    managerProfile: { findUnique: (...args: unknown[]) => managerProfileFindUniqueMock(...args) },
    deposit: { aggregate: (...args: unknown[]) => depositAggregateMock(...args) },
  },
}));

const applyMock = vi.fn();
const getProfileMock = vi.fn();
const autoEnrollMock = vi.fn();
const assignManagerIfUnsetMock = vi.fn();
const listAdminMock = vi.fn();
const getByIdAdminMock = vi.fn();
const decideMock = vi.fn();
const assignManagerMock = vi.fn();
const getSettingsMock = vi.fn();
const updateSettingsMock = vi.fn();
const listForAffiliateMock = vi.fn();
const createLinkMock = vi.fn();
const setStatusMock = vi.fn();
const deleteLinkMock = vi.fn();
const commissionListAdminMock = vi.fn();
const commissionSumMock = vi.fn().mockResolvedValue(0);
const commissionCountConfirmedDepositsMock = vi.fn().mockResolvedValue(0);
const commissionApproveMock = vi.fn();
const commissionRejectMock = vi.fn();

const sumApprovedAmountCentsMock = vi.fn().mockResolvedValue(0);
vi.mock("@/modules/commercial-withdrawals/container", () => ({
  commercialWithdrawalsContainer: {
    commercialWithdrawRepository: {
      sumApprovedAmountCents: (...args: unknown[]) => sumApprovedAmountCentsMock(...args),
    },
  },
}));

vi.mock("@/modules/affiliate/container", () => ({
  affiliateContainer: {
    affiliateService: {
      apply: (...args: unknown[]) => applyMock(...args),
      getProfile: (...args: unknown[]) => getProfileMock(...args),
      autoEnroll: (...args: unknown[]) => autoEnrollMock(...args),
      assignManagerIfUnset: (...args: unknown[]) => assignManagerIfUnsetMock(...args),
      listAdmin: (...args: unknown[]) => listAdminMock(...args),
      getByIdAdmin: (...args: unknown[]) => getByIdAdminMock(...args),
      decide: (...args: unknown[]) => decideMock(...args),
      assignManager: (...args: unknown[]) => assignManagerMock(...args),
      getSettings: (...args: unknown[]) => getSettingsMock(...args),
      updateSettings: (...args: unknown[]) => updateSettingsMock(...args),
    },
    affiliateLinkService: {
      listForAffiliate: (...args: unknown[]) => listForAffiliateMock(...args),
      create: (...args: unknown[]) => createLinkMock(...args),
      setStatus: (...args: unknown[]) => setStatusMock(...args),
      delete: (...args: unknown[]) => deleteLinkMock(...args),
    },
    commissionService: {
      approve: (...args: unknown[]) => commissionApproveMock(...args),
      reject: (...args: unknown[]) => commissionRejectMock(...args),
    },
    commissionRepository: {
      listAdmin: (...args: unknown[]) => commissionListAdminMock(...args),
      sumAmountCents: (...args: unknown[]) => commissionSumMock(...args),
      countConfirmedDeposits: (...args: unknown[]) => commissionCountConfirmedDepositsMock(...args),
    },
  },
}));

import { POST as applyRoute } from "@/app/api/affiliate/apply/route";
import { GET as getMeRoute } from "@/app/api/affiliate/me/route";
import { GET as getDashboardRoute } from "@/app/api/affiliate/dashboard/route";
import { GET as listLinksRoute, POST as createLinkRoute } from "@/app/api/affiliate/links/route";
import { PATCH as updateLinkRoute, DELETE as deleteLinkRoute } from "@/app/api/affiliate/links/[id]/route";
import { GET as listCommissionsRoute } from "@/app/api/affiliate/commissions/route";
import { GET as listApplicationsAdminRoute } from "@/app/api/admin/affiliate/applications/route";
import { POST as decideApplicationAdminRoute } from "@/app/api/admin/affiliate/applications/[id]/decide/route";
import { GET as getPerformanceAdminRoute } from "@/app/api/admin/affiliate/applications/[id]/performance/route";
import { POST as decideCommissionAdminRoute } from "@/app/api/admin/affiliate/commissions/[id]/decide/route";
import { GET as getSettingsAdminRoute, PUT as updateSettingsAdminRoute } from "@/app/api/admin/affiliate/settings/route";
import { ConflictError } from "@/server/errors";

function makeRequest(url: string, body?: unknown, token?: string) {
  return new NextRequest(`http://localhost${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

async function playerToken(userId = "user-1") {
  return signAccessToken({ sub: userId, role: "USER", sessionId: "s1", familyId: "f1" });
}
async function adminToken() {
  return signAccessToken({ sub: "admin-1", role: "ADMIN", sessionId: "s2", familyId: "f2" });
}

const fakeProfile = {
  id: "aff-1",
  userId: "user-1",
  managerId: null,
  status: "APPROVED",
  documentsJson: null,
  pixKeyEncrypted: null,
  cpaOverrideCents: null,
  revShareOverridePercent: null,
  requestedAt: new Date(),
  approvedAt: new Date(),
  approvedById: null,
  rejectionReason: null,
  blockedAt: null,
  blockedReason: null,
  linkClicks: 0,
  canInviteAffiliates: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("/api/affiliate routes (integration)", () => {
  beforeEach(() => {
    hasPermissionMock.mockReset().mockResolvedValue(true);
    applyMock.mockReset();
    getProfileMock.mockReset();
    listForAffiliateMock.mockReset();
    createLinkMock.mockReset();
    setStatusMock.mockReset();
    deleteLinkMock.mockReset();
    commissionListAdminMock.mockReset().mockResolvedValue({ items: [], total: 0 });
    commissionSumMock.mockReset().mockResolvedValue(0);
    commissionCountConfirmedDepositsMock.mockReset().mockResolvedValue(0);
    userCountMock.mockReset().mockResolvedValue(0);
    managerProfileFindUniqueMock.mockReset().mockResolvedValue(null);
    getSettingsMock.mockReset().mockResolvedValue({
      id: "global",
      revShareLevel1Percent: 0.05,
      revShareLevel2Percent: 0.02,
      revShareLevel3Percent: 0.01,
      cpaAmountCents: 0,
      autoApproveCommissions: true,
      requireManagerApprovalForAffiliates: false,
      updatedAt: new Date(),
    });
  });

  describe("POST /api/affiliate/apply", () => {
    it("401s with no token", async () => {
      const res = await applyRoute(makeRequest("/api/affiliate/apply", {}), {});
      expect(res.status).toBe(401);
      expect(applyMock).not.toHaveBeenCalled();
    });

    it("201s on success", async () => {
      applyMock.mockResolvedValue(fakeProfile);
      const token = await playerToken();
      const res = await applyRoute(makeRequest("/api/affiliate/apply", {}, token), {});
      expect(res.status).toBe(201);
    });

    it("maps a duplicate application (ConflictError) to 409", async () => {
      applyMock.mockRejectedValue(new ConflictError("Você já possui uma solicitação de afiliado"));
      const token = await playerToken();
      const res = await applyRoute(makeRequest("/api/affiliate/apply", {}, token), {});
      expect(res.status).toBe(409);
    });
  });

  describe("GET /api/affiliate/me", () => {
    it("200s with the profile", async () => {
      getProfileMock.mockResolvedValue(fakeProfile);
      const token = await playerToken();
      const res = await getMeRoute(
        new NextRequest("http://localhost/api/affiliate/me", { headers: { authorization: `Bearer ${token}` } }),
        {}
      );
      expect(res.status).toBe(200);
    });

    it("returns null (never self-heals/creates a profile) when the account has no AffiliateProfile — the normal state for a regular account now", async () => {
      const { NotFoundError } = await import("@/server/errors");
      getProfileMock.mockRejectedValue(new NotFoundError("Perfil de afiliado"));
      const token = await playerToken();
      const res = await getMeRoute(
        new NextRequest("http://localhost/api/affiliate/me", { headers: { authorization: `Bearer ${token}` } }),
        {}
      );
      expect(res.status).toBe(200);
      expect(autoEnrollMock).not.toHaveBeenCalled();
      const json = await res.json();
      expect(json.data).toBeNull();
    });
  });

  describe("GET /api/affiliate/dashboard", () => {
    it("200s with aggregated KPIs", async () => {
      getProfileMock.mockResolvedValue(fakeProfile);
      const token = await playerToken();
      const res = await getDashboardRoute(
        new NextRequest("http://localhost/api/affiliate/dashboard", { headers: { authorization: `Bearer ${token}` } }),
        {}
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.commissionTotalCents).toBe(0);
      expect(json.data.referredDepositTotalCents).toBe(0);
    });

    /**
     * Regression test — "Indique e Ganhe" must work for a regular account
     * that was NEVER promoted to AffiliateProfile (no autoEnroll at signup,
     * no self-heal on this tab anymore). Before the fix, getProfile()
     * rejecting bubbled up as a 404/500 here instead of a 200 with
     * structurally-zero commission figures and the platform default 5%.
     */
    it("200s (never 404s) for an account with NO AffiliateProfile — real referredCount, zero commission figures, default 5% commissionPercent", async () => {
      const { NotFoundError } = await import("@/server/errors");
      getProfileMock.mockRejectedValue(new NotFoundError("Perfil de afiliado"));
      userCountMock.mockReset().mockResolvedValueOnce(7).mockResolvedValueOnce(0); // referredCount=7, ftdCount=0
      depositAggregateMock.mockReset().mockResolvedValue({ _sum: { amountCents: 12000 } });

      const token = await playerToken();
      const res = await getDashboardRoute(
        new NextRequest("http://localhost/api/affiliate/dashboard", { headers: { authorization: `Bearer ${token}` } }),
        {}
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.referredCount).toBe(7); // real, independent of AffiliateProfile
      expect(json.data.referredDepositTotalCents).toBe(12000); // real, independent of AffiliateProfile
      expect(json.data.commissionTotalCents).toBe(0); // never earned, no AffiliateProfile to have paid it
      expect(json.data.balanceAvailableCents).toBe(0);
      expect(json.data.linkClicks).toBe(0);
      expect(json.data.managerId).toBeNull();
      expect(json.data.resolvedCommissionPercent).toBe(5); // AffiliateSettings.revShareLevel1Percent default, not invented
    });
  });

  describe("GET/POST /api/affiliate/links", () => {
    it("200s listing links", async () => {
      getProfileMock.mockResolvedValue(fakeProfile);
      listForAffiliateMock.mockResolvedValue([]);
      const token = await playerToken();
      const res = await listLinksRoute(
        new NextRequest("http://localhost/api/affiliate/links", { headers: { authorization: `Bearer ${token}` } }),
        {}
      );
      expect(res.status).toBe(200);
    });

    it("400s creating a link with a too-short name", async () => {
      getProfileMock.mockResolvedValue(fakeProfile);
      const token = await playerToken();
      const res = await createLinkRoute(makeRequest("/api/affiliate/links", { name: "x" }, token), {});
      expect(res.status).toBe(400);
      expect(createLinkMock).not.toHaveBeenCalled();
    });

    it("201s creating a valid link", async () => {
      getProfileMock.mockResolvedValue(fakeProfile);
      createLinkMock.mockResolvedValue({
        id: "link-1",
        name: "Instagram",
        slug: "instagram",
        status: "ACTIVE",
        clicks: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const token = await playerToken();
      const res = await createLinkRoute(makeRequest("/api/affiliate/links", { name: "Instagram" }, token), {});
      expect(res.status).toBe(201);
    });
  });

  describe("PATCH/DELETE /api/affiliate/links/[id]", () => {
    it("200s pausing a link", async () => {
      getProfileMock.mockResolvedValue(fakeProfile);
      setStatusMock.mockResolvedValue({
        id: "link-1",
        name: "Instagram",
        slug: "instagram",
        status: "PAUSED",
        clicks: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const token = await playerToken();
      const res = await updateLinkRoute(makeRequest("/api/affiliate/links/link-1", { status: "PAUSED" }, token), {
        params: Promise.resolve({ id: "link-1" }),
      });
      expect(res.status).toBe(200);
    });

    it("200s deleting a link", async () => {
      getProfileMock.mockResolvedValue(fakeProfile);
      const token = await playerToken();
      const res = await deleteLinkRoute(
        new NextRequest("http://localhost/api/affiliate/links/link-1", {
          method: "DELETE",
          headers: { authorization: `Bearer ${token}` },
        }),
        { params: Promise.resolve({ id: "link-1" }) }
      );
      expect(res.status).toBe(200);
      expect(deleteLinkMock).toHaveBeenCalledWith("link-1", fakeProfile.id);
    });
  });

  describe("GET /api/affiliate/commissions", () => {
    it("200s with a paginated list", async () => {
      getProfileMock.mockResolvedValue(fakeProfile);
      const token = await playerToken();
      const res = await listCommissionsRoute(
        new NextRequest("http://localhost/api/affiliate/commissions", { headers: { authorization: `Bearer ${token}` } }),
        {}
      );
      expect(res.status).toBe(200);
    });
  });
});

describe("/api/admin/affiliate routes (integration)", () => {
  beforeEach(() => {
    hasPermissionMock.mockReset().mockResolvedValue(true);
    listAdminMock.mockReset().mockResolvedValue({ items: [], total: 0 });
    decideMock.mockReset();
    getByIdAdminMock.mockReset();
    getSettingsMock.mockReset();
    updateSettingsMock.mockReset();
    commissionSumMock.mockReset().mockResolvedValue(0);
    commissionCountConfirmedDepositsMock.mockReset().mockResolvedValue(0);
    sumApprovedAmountCentsMock.mockReset().mockResolvedValue(0);
    userCountMock.mockReset().mockResolvedValue(0);
    depositAggregateMock.mockReset().mockResolvedValue({ _sum: { amountCents: 0 } });
  });

  describe("GET /api/admin/affiliate/applications", () => {
    it("401s with no token", async () => {
      const res = await listApplicationsAdminRoute(new NextRequest("http://localhost/api/admin/affiliate/applications"), {});
      expect(res.status).toBe(401);
    });

    it("403s for a player role", async () => {
      const token = await playerToken();
      const res = await listApplicationsAdminRoute(
        new NextRequest("http://localhost/api/admin/affiliate/applications", { headers: { authorization: `Bearer ${token}` } }),
        {}
      );
      expect(res.status).toBe(403);
    });

    it("403s when the role lacks affiliate.applications.read", async () => {
      hasPermissionMock.mockResolvedValue(false);
      const token = await adminToken();
      const res = await listApplicationsAdminRoute(
        new NextRequest("http://localhost/api/admin/affiliate/applications", { headers: { authorization: `Bearer ${token}` } }),
        {}
      );
      expect(res.status).toBe(403);
    });

    it("200s with the permission", async () => {
      const token = await adminToken();
      const res = await listApplicationsAdminRoute(
        new NextRequest("http://localhost/api/admin/affiliate/applications", { headers: { authorization: `Bearer ${token}` } }),
        {}
      );
      expect(res.status).toBe(200);
    });
  });

  describe("POST /api/admin/affiliate/applications/[id]/decide", () => {
    it("400s when REJECT has no reason", async () => {
      const token = await adminToken();
      const res = await decideApplicationAdminRoute(
        makeRequest("/api/admin/affiliate/applications/aff-1/decide", { action: "REJECT" }, token),
        { params: Promise.resolve({ id: "aff-1" }) }
      );
      expect(res.status).toBe(400);
      expect(decideMock).not.toHaveBeenCalled();
    });

    it("200s on a valid APPROVE decision", async () => {
      decideMock.mockResolvedValue(fakeProfile);
      getByIdAdminMock.mockResolvedValue({ ...fakeProfile, userName: "X", userEmail: "x@y.com", userPhone: null, managerName: null });
      const token = await adminToken();
      const res = await decideApplicationAdminRoute(
        makeRequest("/api/admin/affiliate/applications/aff-1/decide", { action: "APPROVE" }, token),
        { params: Promise.resolve({ id: "aff-1" }) }
      );
      expect(res.status).toBe(200);
    });
  });

  describe("GET /api/admin/affiliate/applications/[id]/performance", () => {
    it("401s with no token", async () => {
      const res = await getPerformanceAdminRoute(
        new NextRequest("http://localhost/api/admin/affiliate/applications/aff-1/performance"),
        { params: Promise.resolve({ id: "aff-1" }) }
      );
      expect(res.status).toBe(401);
      expect(getByIdAdminMock).not.toHaveBeenCalled();
    });

    it("403s for a player (AFFILIATE/USER) role — an affiliate can never read another affiliate's (or their own) admin performance view through this route", async () => {
      const token = await playerToken();
      const res = await getPerformanceAdminRoute(
        new NextRequest("http://localhost/api/admin/affiliate/applications/aff-1/performance", {
          headers: { authorization: `Bearer ${token}` },
        }),
        { params: Promise.resolve({ id: "aff-1" }) }
      );
      expect(res.status).toBe(403);
      expect(getByIdAdminMock).not.toHaveBeenCalled();
    });

    it("403s when the admin role lacks affiliate.applications.read", async () => {
      hasPermissionMock.mockResolvedValue(false);
      const token = await adminToken();
      const res = await getPerformanceAdminRoute(
        new NextRequest("http://localhost/api/admin/affiliate/applications/aff-1/performance", {
          headers: { authorization: `Bearer ${token}` },
        }),
        { params: Promise.resolve({ id: "aff-1" }) }
      );
      expect(res.status).toBe(403);
    });

    it("200s for an admin, with FTD (distinct referred users) kept separate from referredCount, and commissionPendingCents derived from balance minus what was actually paid", async () => {
      getByIdAdminMock.mockResolvedValue({ ...fakeProfile, userName: "X", userEmail: "x@y.com", userPhone: null, managerName: null });
      // getAffiliateRawMetrics fires, in array order: total, today, 7d, 30d,
      // available, locked, referredCount (user.count #1), confirmedDeposits,
      // ftdCount (user.count #2), depositAggregate.
      commissionSumMock
        .mockResolvedValueOnce(10000) // total
        .mockResolvedValueOnce(0) // today
        .mockResolvedValueOnce(0) // 7d
        .mockResolvedValueOnce(0) // 30d
        .mockResolvedValueOnce(3000) // AVAILABLE
        .mockResolvedValueOnce(1000); // LOCKED
      commissionCountConfirmedDepositsMock.mockResolvedValueOnce(9); // distinct deposits (NOT the FTD figure)
      userCountMock.mockResolvedValueOnce(20).mockResolvedValueOnce(6); // referredCount=20, ftdCount=6
      depositAggregateMock.mockResolvedValueOnce({ _sum: { amountCents: 500000 } });
      sumApprovedAmountCentsMock.mockResolvedValueOnce(1500); // already paid out

      const token = await adminToken();
      const res = await getPerformanceAdminRoute(
        new NextRequest("http://localhost/api/admin/affiliate/applications/aff-1/performance", {
          headers: { authorization: `Bearer ${token}` },
        }),
        { params: Promise.resolve({ id: "aff-1" }) }
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.referredCount).toBe(20);
      expect(json.data.ftdCount).toBe(6); // NOT 9 (confirmedDeposits) — proves FTD isn't conflated with deposit count
      expect(json.data.conversionPercent).toBeCloseTo(30); // 6/20 * 100
      expect(json.data.referredDepositTotalCents).toBe(500000);
      expect(json.data.commissionGeneratedCents).toBe(10000);
      expect(json.data.commissionPaidCents).toBe(1500);
      expect(json.data.commissionPendingCents).toBe(2500); // (3000 available + 1000 locked) - 1500 paid
      expect(sumApprovedAmountCentsMock).toHaveBeenCalledWith(fakeProfile.userId, "AFFILIATE");
    });
  });

  describe("POST /api/admin/affiliate/commissions/[id]/decide", () => {
    it("200s approving a commission", async () => {
      commissionApproveMock.mockResolvedValue({ id: "c-1", status: "AVAILABLE" });
      const token = await adminToken();
      const res = await decideCommissionAdminRoute(
        makeRequest("/api/admin/affiliate/commissions/c-1/decide", { action: "APPROVE" }, token),
        { params: Promise.resolve({ id: "c-1" }) }
      );
      expect(res.status).toBe(200);
    });

    it("400s rejecting without a reason", async () => {
      const token = await adminToken();
      const res = await decideCommissionAdminRoute(
        makeRequest("/api/admin/affiliate/commissions/c-1/decide", { action: "REJECT" }, token),
        { params: Promise.resolve({ id: "c-1" }) }
      );
      expect(res.status).toBe(400);
      expect(commissionRejectMock).not.toHaveBeenCalled();
    });
  });

  describe("GET/PUT /api/admin/affiliate/settings", () => {
    it("200s reading settings", async () => {
      getSettingsMock.mockResolvedValue({
        id: "global",
        revShareLevel1Percent: 0.05,
        revShareLevel2Percent: 0.02,
        revShareLevel3Percent: 0.01,
        cpaAmountCents: 0,
        autoApproveCommissions: true,
        requireManagerApprovalForAffiliates: false,
        updatedAt: new Date(),
      });
      const token = await adminToken();
      const res = await getSettingsAdminRoute(
        new NextRequest("http://localhost/api/admin/affiliate/settings", { headers: { authorization: `Bearer ${token}` } }),
        {}
      );
      expect(res.status).toBe(200);
    });

    it("403s updating settings without affiliate.settings.manage", async () => {
      hasPermissionMock.mockResolvedValue(false);
      const token = await adminToken();
      const res = await updateSettingsAdminRoute(
        makeRequest("/api/admin/affiliate/settings", { cpaAmountCents: 1000 }, token),
        {}
      );
      expect(res.status).toBe(403);
      expect(updateSettingsMock).not.toHaveBeenCalled();
    });
  });
});
