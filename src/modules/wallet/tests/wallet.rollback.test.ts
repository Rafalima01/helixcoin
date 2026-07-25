import { describe, expect, it, vi } from "vitest";
import { WalletService } from "@/modules/wallet/services/wallet.service";
import { InMemoryWalletRepository } from "@/modules/wallet/repositories/wallet.in-memory-repository";
import type { WalletActor } from "@/modules/wallet/entities/wallet.entity";

const USER_ID = "user-1";
const ACTOR: WalletActor = { actorId: null, actorType: "SYSTEM" };

describe("WalletService rollback", () => {
  it("a failure writing the LedgerEntry rolls back the whole operation — balance unchanged, no WalletTransaction persisted", async () => {
    const wallets = new InMemoryWalletRepository();
    const service = new WalletService(wallets);
    wallets.setBalance(USER_ID, { main: 1000 });

    vi.spyOn(wallets.ledger, "createEntry").mockRejectedValueOnce(new Error("simulated ledger write failure"));

    await expect(
      service.credit({
        userId: USER_ID,
        amountCents: 500,
        type: "DEPOSIT",
        origin: "test",
        idempotencyKey: "rollback-key-1",
        actor: ACTOR,
      })
    ).rejects.toThrow("simulated ledger write failure");

    const balance = await service.getBalance(USER_ID);
    expect(balance.main).toBe(1000);

    const tx = await wallets.findTransactionByIdempotencyKey("rollback-key-1");
    expect(tx).toBeNull();
  });

  it("a failure mid-transfer rolls back BOTH wallets, not just one side", async () => {
    const wallets = new InMemoryWalletRepository();
    const service = new WalletService(wallets);
    wallets.setBalance("user-a", { main: 1000 });
    wallets.setBalance("user-b", { main: 1000 });

    vi.spyOn(wallets.ledger, "createEntry").mockRejectedValueOnce(new Error("simulated ledger write failure"));

    await expect(
      service.transfer({
        fromUserId: "user-a",
        toUserId: "user-b",
        amountCents: 300,
        origin: "test",
        idempotencyKey: "rollback-transfer-1",
        actor: ACTOR,
      })
    ).rejects.toThrow("simulated ledger write failure");

    const balanceA = await service.getBalance("user-a");
    const balanceB = await service.getBalance("user-b");
    expect(balanceA.main).toBe(1000);
    expect(balanceB.main).toBe(1000);
  });

  it("subsequent operations still work normally after a rolled-back attempt", async () => {
    const wallets = new InMemoryWalletRepository();
    const service = new WalletService(wallets);
    wallets.setBalance(USER_ID, { main: 1000 });

    vi.spyOn(wallets.ledger, "createEntry").mockRejectedValueOnce(new Error("simulated failure"));
    await expect(
      service.credit({
        userId: USER_ID,
        amountCents: 500,
        type: "DEPOSIT",
        origin: "test",
        idempotencyKey: "rollback-key-2",
        actor: ACTOR,
      })
    ).rejects.toThrow();

    const result = await service.credit({
      userId: USER_ID,
      amountCents: 500,
      type: "DEPOSIT",
      origin: "test",
      idempotencyKey: "rollback-key-3",
      actor: ACTOR,
    });
    expect(result.balanceAfter.main).toBe(1500);
  });
});
