import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { signAccessToken } from "@/server/auth/jwt";

/**
 * Exercises the real route → auth guard → controller → validation →
 * error-mapping chain for every /api/admin/wallets/**,
 * /api/admin/transactions/**, and /api/admin/ledger/** endpoint, the same
 * way admin-rbac.test.ts and matches.test.ts do for their modules — the
 * service layer itself (WalletService's 10 methods, idempotency,
 * concurrency, rollback) already has dedicated unit coverage in
 * src/modules/wallet/tests/**; what's specific to the HTTP layer and worth
 * proving here is: auth is enforced, permission checks gate the admin
 * routes, Zod validation rejects bad bodies, and thrown AppError subtypes
 * map to the right status codes.
 *
 * The old /api/wallet/deposit, /api/wallet/deposit/confirm, and
 * /api/wallet/withdraw routes were removed in Phase 7 — deposit/withdraw
 * now go through /api/payments/** (see tests/integration/payments.test.ts),
 * which is the only thing allowed to initiate those wallet movements.
 */
vi.mock("@/server/cache/redis", () => ({
  redis: {
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    ttl: vi.fn().mockResolvedValue(10),
    get: vi.fn().mockResolvedValue(null),
    exists: vi.fn().mockResolvedValue(0),
    set: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
  },
}));

const hasPermissionMock = vi.fn().mockResolvedValue(true);
vi.mock("@/modules/identity/container", () => ({
  identityContainer: {
    permissionService: { hasPermission: (...args: unknown[]) => hasPermissionMock(...args) },
  },
}));

const getTransactionByIdMock = vi.fn();
const adjustMock = vi.fn();
const getBalanceMock = vi.fn();
const listTransactionsMock = vi.fn();
const listWalletsAdminMock = vi.fn();

vi.mock("@/modules/wallet/container", () => ({
  walletContainer: {
    walletService: {
      getTransactionById: (...args: unknown[]) => getTransactionByIdMock(...args),
      adjust: (...args: unknown[]) => adjustMock(...args),
      getBalance: (...args: unknown[]) => getBalanceMock(...args),
      listTransactions: (...args: unknown[]) => listTransactionsMock(...args),
      listWalletsAdmin: (...args: unknown[]) => listWalletsAdminMock(...args),
    },
  },
}));

const ledgerGetByIdMock = vi.fn();
const ledgerListMock = vi.fn();
vi.mock("@/modules/ledger/container", () => ({
  ledgerContainer: {
    ledgerService: {
      getById: (...args: unknown[]) => ledgerGetByIdMock(...args),
      list: (...args: unknown[]) => ledgerListMock(...args),
    },
  },
}));

import { GET as listWalletsAdminRoute } from "@/app/api/admin/wallets/route";
import { GET as getWalletAdminRoute } from "@/app/api/admin/wallets/[userId]/route";
import { POST as adjustWalletRoute } from "@/app/api/admin/wallets/[userId]/adjust/route";
import { GET as listTransactionsAdminRoute } from "@/app/api/admin/transactions/route";
import { GET as getTransactionAdminRoute } from "@/app/api/admin/transactions/[id]/route";
import { GET as listLedgerAdminRoute } from "@/app/api/admin/ledger/route";
import { GET as getLedgerEntryAdminRoute } from "@/app/api/admin/ledger/[id]/route";

function makeRequest(url: string, body?: unknown, token?: string) {
  return new NextRequest(`http://localhost${url}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

async function playerToken(userId = "user-1") {
  return signAccessToken({ sub: userId, role: "USER", sessionId: "s1", familyId: "f1" });
}

async function adminToken() {
  return signAccessToken({ sub: "admin-1", role: "ADMIN", sessionId: "s2", familyId: "f2" });
}

const fakeBalances = { userId: "user-1", walletId: "wallet-1", main: 10000, locked: 0, bonus: 0, updatedAt: new Date() };
const fakeTransaction = {
  id: "tx-1",
  walletId: "wallet-1",
  userId: "user-1",
  ledgerId: "ledger-1",
  type: "DEPOSIT_PENDING",
  account: "MAIN",
  amount: 5000,
  balanceBefore: null,
  balanceAfter: null,
  origin: "wallet-api",
  originId: null,
  description: null,
  status: "PENDING",
  idempotencyKey: "key-1",
  metadata: null,
  createdAt: new Date(),
};

describe("/api/wallet routes (integration)", () => {
  beforeEach(() => {
    hasPermissionMock.mockReset().mockResolvedValue(true);
    getTransactionByIdMock.mockReset();
    adjustMock.mockReset();
    getBalanceMock.mockReset();
    listTransactionsMock.mockReset();
    listWalletsAdminMock.mockReset();
    ledgerGetByIdMock.mockReset();
    ledgerListMock.mockReset();
  });

  describe("GET /api/admin/wallets", () => {
    it("401s with no token", async () => {
      const res = await listWalletsAdminRoute(new NextRequest("http://localhost/api/admin/wallets"), {});
      expect(res.status).toBe(401);
    });

    it("403s for a player role (rejected by withRole before the permission check)", async () => {
      const token = await playerToken();
      const res = await listWalletsAdminRoute(
        new NextRequest("http://localhost/api/admin/wallets", { headers: { authorization: `Bearer ${token}` } }),
        {}
      );
      expect(res.status).toBe(403);
      expect(hasPermissionMock).not.toHaveBeenCalled();
    });

    it("403s when the role lacks wallet.read", async () => {
      hasPermissionMock.mockResolvedValue(false);
      const token = await adminToken();
      const res = await listWalletsAdminRoute(
        new NextRequest("http://localhost/api/admin/wallets", { headers: { authorization: `Bearer ${token}` } }),
        {}
      );
      expect(res.status).toBe(403);
    });

    it("200s with wallet.read", async () => {
      listWalletsAdminMock.mockResolvedValue({ items: [], total: 0 });
      const token = await adminToken();
      const res = await listWalletsAdminRoute(
        new NextRequest("http://localhost/api/admin/wallets", { headers: { authorization: `Bearer ${token}` } }),
        {}
      );
      expect(res.status).toBe(200);
    });
  });

  describe("GET /api/admin/wallets/[userId]", () => {
    it("200s with balances and recent transactions", async () => {
      getBalanceMock.mockResolvedValue(fakeBalances);
      listTransactionsMock.mockResolvedValue({ items: [fakeTransaction], total: 1 });
      const token = await adminToken();
      const res = await getWalletAdminRoute(
        new NextRequest("http://localhost/api/admin/wallets/user-1", { headers: { authorization: `Bearer ${token}` } }),
        { params: Promise.resolve({ userId: "user-1" }) }
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.balances.main).toBe(10000);
      expect(json.data.recentTransactions).toHaveLength(1);
    });
  });

  describe("POST /api/admin/wallets/[userId]/adjust", () => {
    it("400s when reason/observation are missing", async () => {
      const token = await adminToken();
      const res = await adjustWalletRoute(
        makeRequest("/api/admin/wallets/user-1/adjust", { amount: 500 }, token),
        { params: Promise.resolve({ userId: "user-1" }) }
      );
      expect(res.status).toBe(400);
      expect(adjustMock).not.toHaveBeenCalled();
    });

    it("200s and credits on a valid manual adjustment", async () => {
      adjustMock.mockResolvedValue({
        transaction: { ...fakeTransaction, type: "ADJUSTMENT" },
        balanceBefore: fakeBalances,
        balanceAfter: { ...fakeBalances, main: 10500 },
        idempotent: false,
      });
      const token = await adminToken();
      const res = await adjustWalletRoute(
        makeRequest(
          "/api/admin/wallets/user-1/adjust",
          { amount: 500, reason: "correção", observation: "erro no suporte" },
          token
        ),
        { params: Promise.resolve({ userId: "user-1" }) }
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.balances.main).toBe(10500);
    });
  });

  describe("GET /api/admin/transactions", () => {
    it("200s with a paginated list", async () => {
      listTransactionsMock.mockResolvedValue({ items: [fakeTransaction], total: 1 });
      const token = await adminToken();
      const res = await listTransactionsAdminRoute(
        new NextRequest("http://localhost/api/admin/transactions", { headers: { authorization: `Bearer ${token}` } }),
        {}
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toHaveLength(1);
    });
  });

  describe("GET /api/admin/transactions/[id]", () => {
    it("404s when not found", async () => {
      getTransactionByIdMock.mockResolvedValue(null);
      const token = await adminToken();
      const res = await getTransactionAdminRoute(
        new NextRequest("http://localhost/api/admin/transactions/missing", {
          headers: { authorization: `Bearer ${token}` },
        }),
        { params: Promise.resolve({ id: "missing" }) }
      );
      expect(res.status).toBe(404);
    });

    it("200s when found", async () => {
      getTransactionByIdMock.mockResolvedValue(fakeTransaction);
      const token = await adminToken();
      const res = await getTransactionAdminRoute(
        new NextRequest("http://localhost/api/admin/transactions/tx-1", {
          headers: { authorization: `Bearer ${token}` },
        }),
        { params: Promise.resolve({ id: "tx-1" }) }
      );
      expect(res.status).toBe(200);
    });
  });

  describe("GET /api/admin/ledger", () => {
    it("403s when the role lacks ledger.read", async () => {
      hasPermissionMock.mockResolvedValue(false);
      const token = await adminToken();
      const res = await listLedgerAdminRoute(
        new NextRequest("http://localhost/api/admin/ledger", { headers: { authorization: `Bearer ${token}` } }),
        {}
      );
      expect(res.status).toBe(403);
    });

    it("200s with a paginated list", async () => {
      ledgerListMock.mockResolvedValue({ items: [], total: 0 });
      const token = await adminToken();
      const res = await listLedgerAdminRoute(
        new NextRequest("http://localhost/api/admin/ledger", { headers: { authorization: `Bearer ${token}` } }),
        {}
      );
      expect(res.status).toBe(200);
    });
  });

  describe("GET /api/admin/ledger/[id]", () => {
    it("404s when not found", async () => {
      ledgerGetByIdMock.mockResolvedValue(null);
      const token = await adminToken();
      const res = await getLedgerEntryAdminRoute(
        new NextRequest("http://localhost/api/admin/ledger/missing", { headers: { authorization: `Bearer ${token}` } }),
        { params: Promise.resolve({ id: "missing" }) }
      );
      expect(res.status).toBe(404);
    });

    it("200s when found", async () => {
      ledgerGetByIdMock.mockResolvedValue({
        id: "entry-1",
        transactionId: "tx-1",
        debitAccount: "PLATFORM",
        creditAccount: "WALLET:user-1:MAIN",
        amount: 500,
        currency: "BRL",
        reference: null,
        referenceType: null,
        description: null,
        createdAt: new Date(),
      });
      const token = await adminToken();
      const res = await getLedgerEntryAdminRoute(
        new NextRequest("http://localhost/api/admin/ledger/entry-1", { headers: { authorization: `Bearer ${token}` } }),
        { params: Promise.resolve({ id: "entry-1" }) }
      );
      expect(res.status).toBe(200);
    });
  });
});
