import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/audit", () => ({ AuditService: { record: vi.fn() } }));

import { buildPaymentTestHarness } from "@/modules/payments/tests/test-helpers";
import type { WalletActor } from "@/modules/wallet/entities/wallet.entity";
import { BusinessRuleError } from "@/server/errors";

const USER_ID = "user-withdraw-idempotency-1";
const ACTOR: WalletActor = { actorId: USER_ID, actorType: "USER" };

describe("PaymentService.requestWithdraw — A6 idempotency (double-click/retry can never create two real withdrawals)", () => {
  it("two concurrent requestWithdraw calls for the same user create exactly one Withdraw — the second is rejected, not queued as a second real withdrawal", async () => {
    const { paymentService, walletService, withdraws } = await buildPaymentTestHarness();

    await walletService.credit({
      userId: USER_ID,
      amountCents: 10_000,
      type: "DEPOSIT",
      origin: "test-setup",
      idempotencyKey: "setup-credit-idempotency",
      actor: { actorId: null, actorType: "SYSTEM" },
    });

    const [first, second] = await Promise.allSettled([
      paymentService.requestWithdraw(USER_ID, 2000, "user@example.com", "EMAIL", ACTOR),
      paymentService.requestWithdraw(USER_ID, 2000, "user@example.com", "EMAIL", ACTOR),
    ]);

    const outcomes = [first, second];
    const fulfilled = outcomes.filter((o) => o.status === "fulfilled");
    const rejected = outcomes.filter((o) => o.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(BusinessRuleError);

    const { total } = await withdraws.listAdmin({ userId: USER_ID, page: 1, pageSize: 10 });
    expect(total).toBe(1);

    // Only ONE lock's worth of funds moved — a second real withdrawal would
    // have doubled this.
    const balance = await walletService.getBalance(USER_ID);
    expect(balance.locked).toBe(2000);
    expect(balance.main).toBe(8000);
  });

  it("a second requestWithdraw succeeds normally once the first has fully completed (the lock isn't held forever)", async () => {
    const { paymentService, walletService, withdraws } = await buildPaymentTestHarness();
    const userId = "user-withdraw-idempotency-2";
    const actor: WalletActor = { actorId: userId, actorType: "USER" };

    await walletService.credit({
      userId,
      amountCents: 10_000,
      type: "DEPOSIT",
      origin: "test-setup",
      idempotencyKey: "setup-credit-idempotency-2",
      actor: { actorId: null, actorType: "SYSTEM" },
    });

    const firstResult = await paymentService.requestWithdraw(userId, 1000, "user@example.com", "EMAIL", actor);
    const secondResult = await paymentService.requestWithdraw(userId, 1500, "user@example.com", "EMAIL", actor);

    expect(firstResult.withdrawId).not.toBe(secondResult.withdrawId);
    const { total } = await withdraws.listAdmin({ userId, page: 1, pageSize: 10 });
    expect(total).toBe(2);
  });
});
