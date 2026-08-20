import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { signAccessToken } from "@/server/auth/jwt";

/**
 * Exercises the real route -> auth guard -> controller chain for the
 * "Saques Comerciais" admin refinement: hierarchy resolution (Afiliado
 * Direto vs Afiliado de Gerente vs Gerente), the new payeeRole/bond/período
 * filters actually reaching the repository query (not just a client-side
 * filter), the new /summary endpoint, and RBAC. Mirrors
 * tests/integration/affiliate.test.ts's approach.
 */
const hasPermissionMock = vi.fn().mockResolvedValue(true);
vi.mock("@/modules/identity/container", () => ({
  identityContainer: {
    permissionService: { hasPermission: (...args: unknown[]) => hasPermissionMock(...args) },
  },
}));

const affiliateProfileFindManyMock = vi.fn().mockResolvedValue([]);
const managerProfileFindManyMock = vi.fn().mockResolvedValue([]);
vi.mock("@/lib/prisma", () => ({
  prisma: {
    affiliateProfile: { findMany: (...args: unknown[]) => affiliateProfileFindManyMock(...args) },
    managerProfile: { findMany: (...args: unknown[]) => managerProfileFindManyMock(...args) },
  },
}));

const listAdminMock = vi.fn();
const getAdminMock = vi.fn();
const getSummaryMock = vi.fn();

vi.mock("@/modules/commercial-withdrawals/container", () => ({
  commercialWithdrawalsContainer: {
    commercialWithdrawService: {
      listAdmin: (...args: unknown[]) => listAdminMock(...args),
      getAdmin: (...args: unknown[]) => getAdminMock(...args),
    },
    commercialWithdrawRepository: {
      getSummary: (...args: unknown[]) => getSummaryMock(...args),
    },
  },
}));

// Unused by these tests but imported transitively by the controller.
vi.mock("@/modules/affiliate/container", () => ({ affiliateContainer: { affiliateService: {} } }));
vi.mock("@/modules/manager/container", () => ({ managerContainer: { managerService: {} } }));

import { GET as listRoute } from "@/app/api/admin/commercial-withdrawals/route";
import { GET as getOneRoute } from "@/app/api/admin/commercial-withdrawals/[id]/route";
import { GET as summaryRoute } from "@/app/api/admin/commercial-withdrawals/summary/route";

async function adminToken() {
  return signAccessToken({ sub: "admin-1", role: "ADMIN", sessionId: "s1", familyId: "f1" });
}
async function affiliateToken() {
  return signAccessToken({ sub: "aff-user-1", role: "AFFILIATE", sessionId: "s2", familyId: "f2" });
}

function adminRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "cw-1",
    userId: "user-1",
    userName: "Fulano",
    userEmail: "fulano@example.com",
    payeeRole: "AFFILIATE",
    amountCents: 5000,
    status: "PENDING",
    pixKeyType: "EMAIL",
    pixKeyEncrypted: "enc:x",
    holderCpf: "12345678901",
    rejectionReason: null,
    decidedByUserId: null,
    requestedAt: new Date(),
    processedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("/api/admin/commercial-withdrawals (integration)", () => {
  beforeEach(() => {
    hasPermissionMock.mockReset().mockResolvedValue(true);
    listAdminMock.mockReset();
    getAdminMock.mockReset();
    getSummaryMock.mockReset().mockResolvedValue({ pendingCents: 0, totalRequestedCents: 0, paidCents: 0, count: 0 });
    affiliateProfileFindManyMock.mockReset().mockResolvedValue([]);
    managerProfileFindManyMock.mockReset().mockResolvedValue([]);
  });

  describe("GET /api/admin/commercial-withdrawals — RBAC", () => {
    it("401s with no token", async () => {
      const res = await listRoute(new NextRequest("http://localhost/api/admin/commercial-withdrawals"), {});
      expect(res.status).toBe(401);
      expect(listAdminMock).not.toHaveBeenCalled();
    });

    it("403s for an AFFILIATE role — an affiliate can never reach the admin commercial-withdrawals list", async () => {
      const token = await affiliateToken();
      const res = await listRoute(
        new NextRequest("http://localhost/api/admin/commercial-withdrawals", { headers: { authorization: `Bearer ${token}` } }),
        {}
      );
      expect(res.status).toBe(403);
      expect(listAdminMock).not.toHaveBeenCalled();
    });

    it("403s when the admin role lacks commercial.withdrawals.read", async () => {
      hasPermissionMock.mockResolvedValue(false);
      const token = await adminToken();
      const res = await listRoute(
        new NextRequest("http://localhost/api/admin/commercial-withdrawals", { headers: { authorization: `Bearer ${token}` } }),
        {}
      );
      expect(res.status).toBe(403);
    });
  });

  describe("GET /api/admin/commercial-withdrawals — hierarchy resolution", () => {
    it("an AFFILIATE row with no manager comes back as 'Afiliado direto' (isDirectAffiliate=true, managerId=null)", async () => {
      listAdminMock.mockResolvedValue({ items: [{ row: adminRow(), pixKeyMasked: "***@example.com" }], total: 1 });
      affiliateProfileFindManyMock.mockResolvedValue([{ userId: "user-1", managerId: null, manager: null }]);

      const token = await adminToken();
      const res = await listRoute(
        new NextRequest("http://localhost/api/admin/commercial-withdrawals", { headers: { authorization: `Bearer ${token}` } }),
        {}
      );
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.data[0].isDirectAffiliate).toBe(true);
      expect(json.data[0].managerId).toBeNull();
      expect(json.data[0].managerName).toBeNull();
      // Only ONE batched query for every AFFILIATE row, never one per row.
      expect(affiliateProfileFindManyMock).toHaveBeenCalledTimes(1);
    });

    it("an AFFILIATE row WITH a manager comes back as 'Afiliado de gerente' with the real manager's name/id — never invented", async () => {
      listAdminMock.mockResolvedValue({ items: [{ row: adminRow(), pixKeyMasked: "***@example.com" }], total: 1 });
      affiliateProfileFindManyMock.mockResolvedValue([
        {
          userId: "user-1",
          managerId: "mgr-1",
          manager: { user: { firstName: "Carlos", lastName: "Gerente", email: "carlos@example.com" } },
        },
      ]);

      const token = await adminToken();
      const res = await listRoute(
        new NextRequest("http://localhost/api/admin/commercial-withdrawals", { headers: { authorization: `Bearer ${token}` } }),
        {}
      );
      const json = await res.json();
      expect(json.data[0].isDirectAffiliate).toBe(false);
      expect(json.data[0].managerId).toBe("mgr-1");
      expect(json.data[0].managerName).toBe("Carlos Gerente");
      expect(json.data[0].managerEmail).toBe("carlos@example.com");
    });

    it("a MANAGER row comes back with the real affiliateCount (_count.affiliates), and no affiliate-only fields", async () => {
      listAdminMock.mockResolvedValue({
        items: [{ row: adminRow({ payeeRole: "MANAGER", userId: "mgr-user-1" }), pixKeyMasked: "***@example.com" }],
        total: 1,
      });
      managerProfileFindManyMock.mockResolvedValue([{ userId: "mgr-user-1", _count: { affiliates: 12 } }]);

      const token = await adminToken();
      const res = await listRoute(
        new NextRequest("http://localhost/api/admin/commercial-withdrawals", { headers: { authorization: `Bearer ${token}` } }),
        {}
      );
      const json = await res.json();
      expect(json.data[0].affiliateCount).toBe(12);
      expect(json.data[0].isDirectAffiliate).toBeNull();
      expect(json.data[0].managerId).toBeNull();
      // No AffiliateProfile lookup at all — this row is payeeRole=MANAGER only.
      expect(affiliateProfileFindManyMock).not.toHaveBeenCalled();
    });
  });

  describe("GET /api/admin/commercial-withdrawals — filters actually reach the backend query", () => {
    it("payeeRole=MANAGER in the querystring is forwarded to commercialWithdrawService.listAdmin", async () => {
      listAdminMock.mockResolvedValue({ items: [], total: 0 });
      const token = await adminToken();
      await listRoute(
        new NextRequest("http://localhost/api/admin/commercial-withdrawals?payeeRole=MANAGER", {
          headers: { authorization: `Bearer ${token}` },
        }),
        {}
      );
      expect(listAdminMock).toHaveBeenCalledWith(expect.objectContaining({ payeeRole: "MANAGER" }));
    });

    it("bond=DIRECT resolves AffiliateProfile.managerId=null into a concrete userIdIn list passed to listAdmin — a real backend filter, not client-side", async () => {
      listAdminMock.mockResolvedValue({ items: [], total: 0 });
      affiliateProfileFindManyMock.mockResolvedValue([{ userId: "direct-1" }, { userId: "direct-2" }]);

      const token = await adminToken();
      await listRoute(
        new NextRequest("http://localhost/api/admin/commercial-withdrawals?bond=DIRECT", {
          headers: { authorization: `Bearer ${token}` },
        }),
        {}
      );

      expect(affiliateProfileFindManyMock).toHaveBeenCalledWith({ where: { managerId: null }, select: { userId: true } });
      expect(listAdminMock).toHaveBeenCalledWith(expect.objectContaining({ userIdIn: ["direct-1", "direct-2"] }));
    });

    it("bond=MANAGED resolves AffiliateProfile.managerId != null", async () => {
      listAdminMock.mockResolvedValue({ items: [], total: 0 });
      affiliateProfileFindManyMock.mockResolvedValue([{ userId: "managed-1" }]);

      const token = await adminToken();
      await listRoute(
        new NextRequest("http://localhost/api/admin/commercial-withdrawals?bond=MANAGED", {
          headers: { authorization: `Bearer ${token}` },
        }),
        {}
      );

      expect(affiliateProfileFindManyMock).toHaveBeenCalledWith({ where: { managerId: { not: null } }, select: { userId: true } });
      expect(listAdminMock).toHaveBeenCalledWith(expect.objectContaining({ userIdIn: ["managed-1"] }));
    });

    it("from/to in the querystring are parsed into Date objects and forwarded to listAdmin", async () => {
      listAdminMock.mockResolvedValue({ items: [], total: 0 });
      const token = await adminToken();
      const from = "2026-01-01T00:00:00.000Z";
      const to = "2026-01-31T23:59:59.000Z";
      await listRoute(
        new NextRequest(`http://localhost/api/admin/commercial-withdrawals?from=${from}&to=${to}`, {
          headers: { authorization: `Bearer ${token}` },
        }),
        {}
      );
      expect(listAdminMock).toHaveBeenCalledWith(
        expect.objectContaining({ from: new Date(from), to: new Date(to) })
      );
    });
  });

  describe("GET /api/admin/commercial-withdrawals/[id]", () => {
    it("200s with hierarchy resolved for a single row too", async () => {
      getAdminMock.mockResolvedValue({ withdraw: adminRow(), pixKeyMasked: "***@example.com" });
      affiliateProfileFindManyMock.mockResolvedValue([{ userId: "user-1", managerId: null, manager: null }]);

      const token = await adminToken();
      const res = await getOneRoute(
        new NextRequest("http://localhost/api/admin/commercial-withdrawals/cw-1", { headers: { authorization: `Bearer ${token}` } }),
        { params: Promise.resolve({ id: "cw-1" }) }
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.isDirectAffiliate).toBe(true);
    });
  });

  describe("GET /api/admin/commercial-withdrawals/summary", () => {
    it("401s with no token", async () => {
      const res = await summaryRoute(new NextRequest("http://localhost/api/admin/commercial-withdrawals/summary"), {});
      expect(res.status).toBe(401);
      expect(getSummaryMock).not.toHaveBeenCalled();
    });

    it("403s for an AFFILIATE role", async () => {
      const token = await affiliateToken();
      const res = await summaryRoute(
        new NextRequest("http://localhost/api/admin/commercial-withdrawals/summary", { headers: { authorization: `Bearer ${token}` } }),
        {}
      );
      expect(res.status).toBe(403);
    });

    it("200s and returns the real aggregate numbers from the repository, unmodified", async () => {
      getSummaryMock.mockResolvedValue({ pendingCents: 1000, totalRequestedCents: 5000, paidCents: 3000, count: 4 });
      const token = await adminToken();
      const res = await summaryRoute(
        new NextRequest("http://localhost/api/admin/commercial-withdrawals/summary", { headers: { authorization: `Bearer ${token}` } }),
        {}
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toEqual({ pendingCents: 1000, totalRequestedCents: 5000, paidCents: 3000, count: 4 });
    });

    it("payeeRole filter is forwarded to getSummary", async () => {
      const token = await adminToken();
      await summaryRoute(
        new NextRequest("http://localhost/api/admin/commercial-withdrawals/summary?payeeRole=AFFILIATE", {
          headers: { authorization: `Bearer ${token}` },
        }),
        {}
      );
      expect(getSummaryMock).toHaveBeenCalledWith(expect.objectContaining({ payeeRole: "AFFILIATE" }));
    });
  });
});
