import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/audit", () => ({ AuditService: { record: vi.fn() } }));

/** Lock distribuído substituído por um in-process — ver payment.service.simulated-withdraw.test.ts. */
vi.mock("@/server/cache/cache.service", () => ({
  CacheService: {
    withLock: vi.fn(async <T,>(_key: string, _ttlMs: number, fn: () => Promise<T>) => fn()),
    remember: vi.fn(async <T,>(_key: string, _ttl: number, fn: () => Promise<T>) => fn()),
    get: vi.fn(async () => null),
    set: vi.fn(async () => undefined),
    del: vi.fn(async () => undefined),
  },
}));

import { buildPaymentTestHarness } from "@/modules/payments/tests/test-helpers";
import { BusinessRuleError } from "@/server/errors";
import type { WalletActor } from "@/modules/wallet/entities/wallet.entity";

describe("PaymentService — Conta Demo isolation", () => {
  async function seedDemoUser(users: Awaited<ReturnType<typeof buildPaymentTestHarness>>["users"]) {
    return users.create({
      firstName: "Conta",
      lastName: "Demo",
      username: "demo11111",
      email: "demo11111@demo.helixcoin.internal",
      passwordHash: "hash",
      referralCode: "DEMO1111",
      status: "ACTIVE",
      role: "USER",
      isDemo: true,
      tags: ["demo"],
    });
  }

  it("rejects createDeposit for a Conta Demo", async () => {
    const { paymentService, users } = await buildPaymentTestHarness();
    const demoUser = await seedDemoUser(users);
    await expect(paymentService.createDeposit(demoUser.id, 5000)).rejects.toThrow(BusinessRuleError);
  });

  it("no longer rejects requestWithdraw for a Conta Demo — it creates a SIMULATED request instead", async () => {
    const { paymentService, users, walletService, withdraws } = await buildPaymentTestHarness();
    const demoUser = await seedDemoUser(users);
    await walletService.adjust({
      userId: demoUser.id,
      amountCents: 20_000,
      reason: "saldo demo",
      observation: "setup de teste",
      idempotencyKey: `test-demo-balance:${demoUser.id}`,
      actor: { actorId: demoUser.id, actorType: "USER" },
    });

    const actor: WalletActor = { actorId: demoUser.id, actorType: "USER" };
    const result = await paymentService.requestWithdraw(demoUser.id, 5000, "chave-pix", "CPF", actor);

    expect(result.status).toBe("PENDING");
    const row = await withdraws.findById(result.withdrawId);
    expect(row?.isSimulated).toBe(true);
    // As duas garantias estruturais: sem gateway e sem id de provedor.
    expect(row?.gatewayCredentialId).toBeNull();
    expect(row?.providerTransactionId).toBeNull();
  });

  it("still allows createDeposit for a regular (non-demo) user", async () => {
    const { paymentService, users } = await buildPaymentTestHarness();
    const regularUser = await users.create({
      firstName: "Regular",
      lastName: "User",
      username: "regular1",
      email: "regular1@test.com",
      passwordHash: "hash",
      referralCode: "REG1111",
      status: "ACTIVE",
      role: "USER",
    });
    const created = await paymentService.createDeposit(regularUser.id, 5000);
    expect(created.status).toBe("PENDING");
  });
});
