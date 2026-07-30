import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/audit", () => ({ AuditService: { record: vi.fn() } }));

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

  it("rejects requestWithdraw for a Conta Demo", async () => {
    const { paymentService, users } = await buildPaymentTestHarness();
    const demoUser = await seedDemoUser(users);
    const actor: WalletActor = { actorId: demoUser.id, actorType: "USER" };
    await expect(
      paymentService.requestWithdraw(demoUser.id, 5000, "chave-pix", "CPF", actor)
    ).rejects.toThrow(BusinessRuleError);
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
