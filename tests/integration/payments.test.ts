import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { signAccessToken } from "@/server/auth/jwt";

/**
 * Exercises the real route → auth guard → controller → validation →
 * error-mapping chain for every /api/payments/** and /api/admin/payments/**
 * endpoint — the same HTTP-layer-focused approach as tests/integration/
 * wallet.test.ts and matches.test.ts. PaymentService's own business logic
 * (settlement, idempotency, failover, webhook signatures) already has
 * dedicated coverage in src/modules/payments/tests/**; what's specific to
 * the HTTP layer here is: auth is enforced, permission checks gate admin
 * routes, Zod validation rejects bad bodies, the webhook route has no auth
 * guard but is rate-limited, and thrown AppError subtypes map to the right
 * status codes.
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

const createDepositMock = vi.fn();
const getDepositMock = vi.fn();
const simulateDepositMock = vi.fn();
const requestWithdrawMock = vi.fn();
const handleWebhookMock = vi.fn();
const decideWithdrawMock = vi.fn();
const listDepositsAdminMock = vi.fn();
const listWithdrawsAdminMock = vi.fn();
const listGatewaysAdminMock = vi.fn();
const createGatewayMock = vi.fn();
const testGatewayConnectionMock = vi.fn();
const listWebhooksAdminMock = vi.fn();
const reprocessWebhookMock = vi.fn();
const listGatewayLogsAdminMock = vi.fn();
const getSettingsMock = vi.fn();
const updateSettingsMock = vi.fn();

vi.mock("@/modules/payments/container", () => ({
  paymentsContainer: {
    paymentService: {
      createDeposit: (...args: unknown[]) => createDepositMock(...args),
      getDeposit: (...args: unknown[]) => getDepositMock(...args),
      simulateDeposit: (...args: unknown[]) => simulateDepositMock(...args),
      requestWithdraw: (...args: unknown[]) => requestWithdrawMock(...args),
      handleWebhook: (...args: unknown[]) => handleWebhookMock(...args),
      decideWithdraw: (...args: unknown[]) => decideWithdrawMock(...args),
      listDepositsAdmin: (...args: unknown[]) => listDepositsAdminMock(...args),
      listWithdrawsAdmin: (...args: unknown[]) => listWithdrawsAdminMock(...args),
      listGatewaysAdmin: (...args: unknown[]) => listGatewaysAdminMock(...args),
      createGateway: (...args: unknown[]) => createGatewayMock(...args),
      testGatewayConnection: (...args: unknown[]) => testGatewayConnectionMock(...args),
      listWebhooksAdmin: (...args: unknown[]) => listWebhooksAdminMock(...args),
      reprocessWebhook: (...args: unknown[]) => reprocessWebhookMock(...args),
      listGatewayLogsAdmin: (...args: unknown[]) => listGatewayLogsAdminMock(...args),
      getSettings: (...args: unknown[]) => getSettingsMock(...args),
      updateSettings: (...args: unknown[]) => updateSettingsMock(...args),
    },
  },
}));

import { POST as createDepositRoute } from "@/app/api/payments/deposits/route";
import { GET as getDepositRoute } from "@/app/api/payments/deposits/[id]/route";
import { POST as simulateDepositRoute } from "@/app/api/payments/deposits/[id]/simulate/route";
import { POST as requestWithdrawRoute } from "@/app/api/payments/withdrawals/route";
import { POST as webhookRoute } from "@/app/api/payments/webhook/[provider]/route";
import { GET as listDepositsAdminRoute } from "@/app/api/admin/payments/deposits/route";
import { POST as decideWithdrawAdminRoute } from "@/app/api/admin/payments/withdrawals/[id]/decide/route";
import { GET as listGatewaysAdminRoute, POST as createGatewayAdminRoute } from "@/app/api/admin/payments/gateways/route";
import { POST as testConnectionAdminRoute } from "@/app/api/admin/payments/gateways/[id]/test-connection/route";
import { POST as reprocessWebhookAdminRoute } from "@/app/api/admin/payments/webhooks/[id]/reprocess/route";
import { GET as getSettingsAdminRoute, PUT as updateSettingsAdminRoute } from "@/app/api/admin/payments/settings/route";
import { BusinessRuleError } from "@/server/errors";

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

describe("/api/payments routes (integration)", () => {
  beforeEach(() => {
    hasPermissionMock.mockReset().mockResolvedValue(true);
    createDepositMock.mockReset();
    getDepositMock.mockReset();
    simulateDepositMock.mockReset();
    requestWithdrawMock.mockReset();
    handleWebhookMock.mockReset();
    decideWithdrawMock.mockReset();
    listDepositsAdminMock.mockReset();
    listWithdrawsAdminMock.mockReset();
    listGatewaysAdminMock.mockReset();
    createGatewayMock.mockReset();
    testGatewayConnectionMock.mockReset();
    listWebhooksAdminMock.mockReset();
    reprocessWebhookMock.mockReset();
    listGatewayLogsAdminMock.mockReset();
    getSettingsMock.mockReset();
    updateSettingsMock.mockReset();
  });

  describe("POST /api/payments/deposits", () => {
    it("401s with no token", async () => {
      const res = await createDepositRoute(makeRequest("/api/payments/deposits", { amount: 10 }), {});
      expect(res.status).toBe(401);
      expect(createDepositMock).not.toHaveBeenCalled();
    });

    it("400s on a malformed body", async () => {
      const token = await playerToken();
      const res = await createDepositRoute(makeRequest("/api/payments/deposits", { amount: -5 }, token), {});
      expect(res.status).toBe(400);
      expect(createDepositMock).not.toHaveBeenCalled();
    });

    it("201s and returns the PIX charge on success", async () => {
      createDepositMock.mockResolvedValue({
        depositId: "dep-1",
        pixCode: "00020126...",
        qrCodeUrl: null,
        expiresAt: new Date().toISOString(),
        amountCents: 1000,
        status: "PENDING",
      });
      const token = await playerToken();
      const res = await createDepositRoute(makeRequest("/api/payments/deposits", { amount: 10 }, token), {});
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.depositId).toBe("dep-1");
      expect(json.data.pixCode).toBeTruthy();
    });

    it("maps a business rule violation (amount outside configured range) to 422", async () => {
      createDepositMock.mockRejectedValue(new BusinessRuleError("Valor fora do intervalo permitido"));
      const token = await playerToken();
      const res = await createDepositRoute(makeRequest("/api/payments/deposits", { amount: 999999 }, token), {});
      expect(res.status).toBe(422);
    });
  });

  describe("GET /api/payments/deposits/[id]", () => {
    it("401s with no token", async () => {
      const res = await getDepositRoute(new NextRequest("http://localhost/api/payments/deposits/dep-1"), {
        params: Promise.resolve({ id: "dep-1" }),
      });
      expect(res.status).toBe(401);
    });

    it("200s with the deposit on success", async () => {
      getDepositMock.mockResolvedValue({
        id: "dep-1",
        status: "PENDING",
        amountCents: 1000,
        pixCode: "code",
        qrCodeUrl: null,
        expiresAt: null,
        createdAt: new Date(),
        confirmedAt: null,
      });
      const token = await playerToken();
      const res = await getDepositRoute(
        new NextRequest("http://localhost/api/payments/deposits/dep-1", { headers: { authorization: `Bearer ${token}` } }),
        { params: Promise.resolve({ id: "dep-1" }) }
      );
      expect(res.status).toBe(200);
    });
  });

  describe("POST /api/payments/deposits/[id]/simulate", () => {
    it("200s and forwards the outcome to PaymentService", async () => {
      simulateDepositMock.mockResolvedValue({ status: 200 });
      const token = await playerToken();
      const res = await simulateDepositRoute(
        makeRequest("/api/payments/deposits/dep-1/simulate", { outcome: "PAID" }, token),
        { params: Promise.resolve({ id: "dep-1" }) }
      );
      expect(res.status).toBe(200);
      expect(simulateDepositMock).toHaveBeenCalledWith("dep-1", "user-1", "PAID");
    });
  });

  describe("POST /api/payments/withdrawals", () => {
    it("400s on a malformed body (missing pixKey)", async () => {
      const token = await playerToken();
      const res = await requestWithdrawRoute(makeRequest("/api/payments/withdrawals", { amount: 20 }, token), {});
      expect(res.status).toBe(400);
      expect(requestWithdrawMock).not.toHaveBeenCalled();
    });

    it("maps insufficient funds (BusinessRuleError) to 422", async () => {
      requestWithdrawMock.mockRejectedValue(new BusinessRuleError("Saldo insuficiente para bloqueio"));
      const token = await playerToken();
      const res = await requestWithdrawRoute(
        makeRequest("/api/payments/withdrawals", { amount: 20, pixKey: "user@example.com" }, token),
        {}
      );
      expect(res.status).toBe(422);
    });

    it("201s with a PENDING status on success", async () => {
      requestWithdrawMock.mockResolvedValue({ withdrawId: "wd-1", status: "PENDING", amountCents: 2000 });
      const token = await playerToken();
      const res = await requestWithdrawRoute(
        makeRequest("/api/payments/withdrawals", { amount: 20, pixKey: "user@example.com" }, token),
        {}
      );
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.status).toBe("PENDING");
    });
  });

  describe("POST /api/payments/webhook/[provider]", () => {
    it("requires no auth token and forwards the raw body + signature header", async () => {
      handleWebhookMock.mockResolvedValue({ status: 200 });
      const req = new NextRequest("http://localhost/api/payments/webhook/MOCK", {
        method: "POST",
        headers: { "x-mock-signature": "abc123" },
        body: '{"eventType":"deposit.paid"}',
      });
      const res = await webhookRoute(req, { params: Promise.resolve({ provider: "MOCK" }) });
      expect(res.status).toBe(200);
      expect(handleWebhookMock).toHaveBeenCalledWith("MOCK", '{"eventType":"deposit.paid"}', "abc123", null);
    });

    it("rejects an unknown provider before ever calling PaymentService", async () => {
      const req = new NextRequest("http://localhost/api/payments/webhook/UNKNOWN_PROVIDER", {
        method: "POST",
        body: "{}",
      });
      const res = await webhookRoute(req, { params: Promise.resolve({ provider: "UNKNOWN_PROVIDER" }) });
      expect(res.status).toBe(400);
      expect(handleWebhookMock).not.toHaveBeenCalled();
    });
  });
});

describe("/api/admin/payments routes (integration)", () => {
  beforeEach(() => {
    hasPermissionMock.mockReset().mockResolvedValue(true);
    listDepositsAdminMock.mockReset();
    decideWithdrawMock.mockReset();
    listGatewaysAdminMock.mockReset();
    createGatewayMock.mockReset();
    testGatewayConnectionMock.mockReset();
    reprocessWebhookMock.mockReset();
    getSettingsMock.mockReset();
    updateSettingsMock.mockReset();
  });

  describe("GET /api/admin/payments/deposits", () => {
    it("401s with no token", async () => {
      const res = await listDepositsAdminRoute(new NextRequest("http://localhost/api/admin/payments/deposits"), {});
      expect(res.status).toBe(401);
    });

    it("403s for a player role (rejected by withRole before the permission check)", async () => {
      const token = await playerToken();
      const res = await listDepositsAdminRoute(
        new NextRequest("http://localhost/api/admin/payments/deposits", { headers: { authorization: `Bearer ${token}` } }),
        {}
      );
      expect(res.status).toBe(403);
      expect(hasPermissionMock).not.toHaveBeenCalled();
    });

    it("403s when the role lacks payments.deposits.read", async () => {
      hasPermissionMock.mockResolvedValue(false);
      const token = await adminToken();
      const res = await listDepositsAdminRoute(
        new NextRequest("http://localhost/api/admin/payments/deposits", { headers: { authorization: `Bearer ${token}` } }),
        {}
      );
      expect(res.status).toBe(403);
    });

    it("200s with the permission", async () => {
      listDepositsAdminMock.mockResolvedValue({ items: [], total: 0 });
      const token = await adminToken();
      const res = await listDepositsAdminRoute(
        new NextRequest("http://localhost/api/admin/payments/deposits", { headers: { authorization: `Bearer ${token}` } }),
        {}
      );
      expect(res.status).toBe(200);
    });
  });

  describe("POST /api/admin/payments/withdrawals/[id]/decide", () => {
    it("400s when REJECT has no rejectionReason", async () => {
      const token = await adminToken();
      const res = await decideWithdrawAdminRoute(
        makeRequest("/api/admin/payments/withdrawals/wd-1/decide", { action: "REJECT" }, token),
        { params: Promise.resolve({ id: "wd-1" }) }
      );
      expect(res.status).toBe(400);
      expect(decideWithdrawMock).not.toHaveBeenCalled();
    });

    it("200s on a valid APPROVE decision", async () => {
      decideWithdrawMock.mockResolvedValue({ status: 200 });
      const token = await adminToken();
      const res = await decideWithdrawAdminRoute(
        makeRequest("/api/admin/payments/withdrawals/wd-1/decide", { action: "APPROVE" }, token),
        { params: Promise.resolve({ id: "wd-1" }) }
      );
      expect(res.status).toBe(200);
      expect(decideWithdrawMock).toHaveBeenCalledWith("wd-1", "APPROVE", undefined);
    });
  });

  describe("GET/POST /api/admin/payments/gateways", () => {
    it("200s listing gateways", async () => {
      listGatewaysAdminMock.mockResolvedValue({ items: [], total: 0 });
      const token = await adminToken();
      const res = await listGatewaysAdminRoute(
        new NextRequest("http://localhost/api/admin/payments/gateways", { headers: { authorization: `Bearer ${token}` } }),
        {}
      );
      expect(res.status).toBe(200);
    });

    it("400s creating a gateway with too-short a webhook secret", async () => {
      const token = await adminToken();
      const res = await createGatewayAdminRoute(
        makeRequest("/api/admin/payments/gateways", { name: "Mock", provider: "MOCK", webhookSecret: "short" }, token),
        {}
      );
      expect(res.status).toBe(400);
      expect(createGatewayMock).not.toHaveBeenCalled();
    });

    it("201s creating a valid gateway", async () => {
      createGatewayMock.mockResolvedValue({ id: "cred-1" });
      const token = await adminToken();
      const res = await createGatewayAdminRoute(
        makeRequest(
          "/api/admin/payments/gateways",
          { name: "Mock", provider: "MOCK", webhookSecret: "a-long-enough-secret" },
          token
        ),
        {}
      );
      expect(res.status).toBe(201);
    });
  });

  describe("POST /api/admin/payments/gateways/[id]/test-connection", () => {
    it("200s and returns the health check result", async () => {
      testGatewayConnectionMock.mockResolvedValue({ status: "ONLINE", latencyMs: 5 });
      const token = await adminToken();
      const res = await testConnectionAdminRoute(makeRequest("/api/admin/payments/gateways/cred-1/test-connection", undefined, token), {
        params: Promise.resolve({ id: "cred-1" }),
      });
      expect(res.status).toBe(200);
    });
  });

  describe("POST /api/admin/payments/webhooks/[id]/reprocess", () => {
    it("200s and forwards to PaymentService.reprocessWebhook", async () => {
      reprocessWebhookMock.mockResolvedValue({ status: 200 });
      const token = await adminToken();
      const res = await reprocessWebhookAdminRoute(makeRequest("/api/admin/payments/webhooks/wh-1/reprocess", undefined, token), {
        params: Promise.resolve({ id: "wh-1" }),
      });
      expect(res.status).toBe(200);
      expect(reprocessWebhookMock).toHaveBeenCalledWith("wh-1");
    });
  });

  describe("GET/PUT /api/admin/payments/settings", () => {
    it("200s reading settings", async () => {
      getSettingsMock.mockResolvedValue({
        id: "global",
        defaultGatewayCredentialId: null,
        routingMode: "SINGLE",
        timeoutMs: 15000,
        maxRetries: 2,
        pixExpirationMinutes: 30,
        depositMinCents: 500,
        depositMaxCents: 1000000,
        withdrawMinCents: 1000,
        withdrawMaxCents: 1000000,
        maxWebhookProcessingMs: 5000,
        updatedAt: new Date(),
      });
      const token = await adminToken();
      const res = await getSettingsAdminRoute(
        new NextRequest("http://localhost/api/admin/payments/settings", { headers: { authorization: `Bearer ${token}` } }),
        {}
      );
      expect(res.status).toBe(200);
    });

    it("403s updating settings without payments.gateways.manage", async () => {
      hasPermissionMock.mockResolvedValue(false);
      const token = await adminToken();
      const res = await updateSettingsAdminRoute(
        makeRequest("/api/admin/payments/settings", { routingMode: "FAILOVER" }, token),
        {}
      );
      expect(res.status).toBe(403);
      expect(updateSettingsMock).not.toHaveBeenCalled();
    });
  });
});
