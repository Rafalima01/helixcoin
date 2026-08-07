import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/audit", () => ({ AuditService: { record: vi.fn() } }));
vi.mock("@/server/notifications", () => ({
  NotificationService: { notify: vi.fn() },
  NOTIFICATION_TYPES: { withdrawApproved: "withdraw_approved", withdrawRejected: "withdraw_rejected" },
}));

import { BusinessRuleError, NotFoundError } from "@/server/errors";
import { buildCommercialWithdrawTestHarness, seedUserWithBalance } from "@/modules/commercial-withdrawals/tests/test-helpers";

const ACTOR = { actorId: null, actorType: "USER" as const };

describe("CommercialWithdrawService.request", () => {
  it("with sufficient balance: creates a PENDING row and locks the wallet balance", async () => {
    const h = await buildCommercialWithdrawTestHarness();
    const userId = await seedUserWithBalance(h, { amountCents: 10_000 });
    const pixKey = await h.pixKeys.create({ userId, type: "EMAIL", keyEncrypted: "enc:test@example.com", holderCpf: "12345678901" });

    const withdraw = await h.commercialWithdrawService.request({
      userId,
      payeeRole: "AFFILIATE",
      amountCents: 3000,
      pixKeyId: pixKey.id,
      actor: { ...ACTOR, actorId: userId },
    });

    expect(withdraw.status).toBe("PENDING");
    expect(withdraw.lockWalletTransactionId).toBeTruthy();

    const balance = await h.walletService.getBalance(userId);
    expect(balance.main).toBe(7000);
    expect(balance.locked).toBe(3000);

    const { total } = await h.commercialWithdraws.listByUser(userId, 1, 10);
    expect(total).toBe(1);
  });

  it("with insufficient balance: throws and creates no row", async () => {
    const h = await buildCommercialWithdrawTestHarness();
    const userId = await seedUserWithBalance(h, { amountCents: 1000 });
    const pixKey = await h.pixKeys.create({ userId, type: "EMAIL", keyEncrypted: "enc:test@example.com", holderCpf: "12345678901" });

    await expect(
      h.commercialWithdrawService.request({
        userId,
        payeeRole: "AFFILIATE",
        amountCents: 5000,
        pixKeyId: pixKey.id,
        actor: { ...ACTOR, actorId: userId },
      })
    ).rejects.toThrow(BusinessRuleError);

    const { total } = await h.commercialWithdraws.listByUser(userId, 1, 10);
    expect(total).toBe(0);
    const balance = await h.walletService.getBalance(userId);
    expect(balance.locked).toBe(0);
  });

  it("rejects a pixKeyId that does not belong to the caller", async () => {
    const h = await buildCommercialWithdrawTestHarness();
    const userId = await seedUserWithBalance(h, { amountCents: 10_000 });
    const otherUserId = await seedUserWithBalance(h, { amountCents: 10_000 });
    const othersKey = await h.pixKeys.create({ userId: otherUserId, type: "EMAIL", keyEncrypted: "enc:x", holderCpf: "12345678901" });

    await expect(
      h.commercialWithdrawService.request({
        userId,
        payeeRole: "AFFILIATE",
        amountCents: 1000,
        pixKeyId: othersKey.id,
        actor: { ...ACTOR, actorId: userId },
      })
    ).rejects.toThrow(NotFoundError);
  });

  it("two concurrent request() calls for the same user create exactly one CommercialWithdraw — the second is rejected, not queued as a second real withdrawal", async () => {
    const h = await buildCommercialWithdrawTestHarness();
    const userId = await seedUserWithBalance(h, { amountCents: 10_000 });
    const pixKey = await h.pixKeys.create({ userId, type: "EMAIL", keyEncrypted: "enc:test@example.com", holderCpf: "12345678901" });

    const requestInput = {
      userId,
      payeeRole: "AFFILIATE" as const,
      amountCents: 2000,
      pixKeyId: pixKey.id,
      actor: { ...ACTOR, actorId: userId },
    };

    const [first, second] = await Promise.allSettled([
      h.commercialWithdrawService.request(requestInput),
      h.commercialWithdrawService.request(requestInput),
    ]);

    const outcomes = [first, second];
    const fulfilled = outcomes.filter((o) => o.status === "fulfilled");
    const rejected = outcomes.filter((o) => o.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(BusinessRuleError);

    // Only ONE lock's worth of funds moved — a second real withdrawal would have doubled this.
    const balance = await h.walletService.getBalance(userId);
    expect(balance.locked).toBe(2000);
    expect(balance.main).toBe(8000);

    const { total } = await h.commercialWithdraws.listByUser(userId, 1, 10);
    expect(total).toBe(1);
  });

  it("a second request() succeeds normally once the first has fully completed (the lock isn't held forever)", async () => {
    const h = await buildCommercialWithdrawTestHarness();
    const userId = await seedUserWithBalance(h, { amountCents: 10_000 });
    const pixKey = await h.pixKeys.create({ userId, type: "EMAIL", keyEncrypted: "enc:test@example.com", holderCpf: "12345678901" });

    const first = await h.commercialWithdrawService.request({
      userId,
      payeeRole: "AFFILIATE",
      amountCents: 1000,
      pixKeyId: pixKey.id,
      actor: { ...ACTOR, actorId: userId },
    });
    const second = await h.commercialWithdrawService.request({
      userId,
      payeeRole: "AFFILIATE",
      amountCents: 1500,
      pixKeyId: pixKey.id,
      actor: { ...ACTOR, actorId: userId },
    });

    expect(first.id).not.toBe(second.id);
    const { total } = await h.commercialWithdraws.listByUser(userId, 1, 10);
    expect(total).toBe(2);
  });
});
