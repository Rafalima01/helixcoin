import { describe, expect, it } from "vitest";
import { WalletService } from "@/modules/wallet/services/wallet.service";
import { InMemoryWalletRepository } from "@/modules/wallet/repositories/wallet.in-memory-repository";
import { BusinessRuleError } from "@/server/errors";
import type { WalletActor } from "@/modules/wallet/entities/wallet.entity";

const ACTOR: WalletActor = { actorId: null, actorType: "SYSTEM" };

/**
 * Proves InMemoryWalletRepository's per-userId mutex serializes correctly —
 * NOT Postgres's real `SELECT ... FOR UPDATE` row lock, which only
 * PrismaWalletRepository exercises and which this suite has no live
 * database to test against (see this module's README / the Fase 6 plan).
 */
describe("WalletService concurrency", () => {
  it("N concurrent debits against one wallet never overdraw it — exactly the affordable count succeed", async () => {
    const wallets = new InMemoryWalletRepository();
    const service = new WalletService(wallets);
    const userId = "user-concurrent-1";
    wallets.setBalance(userId, { main: 1000 });

    // 10 concurrent debits of 200 each against a 1000 balance — only 5 can possibly succeed.
    const attempts = Array.from({ length: 10 }, (_, i) =>
      service
        .debit({
          userId,
          amountCents: 200,
          type: "BET",
          origin: "test",
          idempotencyKey: `race-debit-${i}`,
          actor: ACTOR,
        })
        .then(() => "ok" as const)
        .catch((err) => {
          if (err instanceof BusinessRuleError) return "rejected" as const;
          throw err;
        })
    );

    const outcomes = await Promise.all(attempts);
    const succeeded = outcomes.filter((o) => o === "ok").length;
    const rejected = outcomes.filter((o) => o === "rejected").length;

    expect(succeeded).toBe(5);
    expect(rejected).toBe(5);
    const balance = await service.getBalance(userId);
    expect(balance.main).toBe(0);
    expect(balance.main).toBeGreaterThanOrEqual(0);
  });

  it("concurrent operations against two different wallets never interfere with each other's balances", async () => {
    const wallets = new InMemoryWalletRepository();
    const service = new WalletService(wallets);
    wallets.setBalance("user-a", { main: 1000 });
    wallets.setBalance("user-b", { main: 1000 });

    await Promise.all([
      ...Array.from({ length: 5 }, (_, i) =>
        service.debit({
          userId: "user-a",
          amountCents: 100,
          type: "BET",
          origin: "test",
          idempotencyKey: `a-${i}`,
          actor: ACTOR,
        })
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        service.debit({
          userId: "user-b",
          amountCents: 50,
          type: "BET",
          origin: "test",
          idempotencyKey: `b-${i}`,
          actor: ACTOR,
        })
      ),
    ]);

    const balanceA = await service.getBalance("user-a");
    const balanceB = await service.getBalance("user-b");
    expect(balanceA.main).toBe(500);
    expect(balanceB.main).toBe(750);
  });
});
