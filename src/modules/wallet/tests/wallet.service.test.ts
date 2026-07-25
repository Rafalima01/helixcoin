import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/audit", () => ({ AuditService: { record: vi.fn() } }));

import { WalletService } from "@/modules/wallet/services/wallet.service";
import { InMemoryWalletRepository } from "@/modules/wallet/repositories/wallet.in-memory-repository";
import { walletAccountCode, SYSTEM_ACCOUNTS } from "@/modules/ledger/constants/ledger.constants";
import { AuditService } from "@/server/audit";
import { BusinessRuleError, ValidationError } from "@/server/errors";
import type { WalletActor } from "@/modules/wallet/entities/wallet.entity";

const USER_ID = "user-1";
const OTHER_USER_ID = "user-2";
const SYSTEM_ACTOR: WalletActor = { actorId: null, actorType: "SYSTEM" };
const ADMIN_ACTOR: WalletActor = { actorId: "admin-1", actorType: "ADMIN" };

function buildService() {
  const wallets = new InMemoryWalletRepository();
  const service = new WalletService(wallets);
  return { service, wallets };
}

let keyCounter = 0;
function key(): string {
  keyCounter += 1;
  return `test-key-${keyCounter}`;
}

describe("WalletService", () => {
  it("credit() increases the main balance and leaves locked/bonus untouched", async () => {
    const { service } = buildService();
    const result = await service.credit({
      userId: USER_ID,
      amountCents: 1000,
      type: "DEPOSIT",
      origin: "test",
      idempotencyKey: key(),
      actor: SYSTEM_ACTOR,
    });
    expect(result.balanceAfter.main).toBe(1000);
    expect(result.balanceAfter.locked).toBe(0);
    expect(result.balanceAfter.bonus).toBe(0);
  });

  it("debit() decreases the main balance", async () => {
    const { service } = buildService();
    await service.credit({
      userId: USER_ID,
      amountCents: 2000,
      type: "DEPOSIT",
      origin: "test",
      idempotencyKey: key(),
      actor: SYSTEM_ACTOR,
    });
    const result = await service.debit({
      userId: USER_ID,
      amountCents: 500,
      type: "BET",
      origin: "test",
      idempotencyKey: key(),
      actor: SYSTEM_ACTOR,
    });
    expect(result.balanceAfter.main).toBe(1500);
  });

  it("debit() throws BusinessRuleError on insufficient funds and moves nothing", async () => {
    const { service } = buildService();
    await expect(
      service.debit({
        userId: USER_ID,
        amountCents: 500,
        type: "BET",
        origin: "test",
        idempotencyKey: key(),
        actor: SYSTEM_ACTOR,
      })
    ).rejects.toThrow(BusinessRuleError);
    const balance = await service.getBalance(USER_ID);
    expect(balance.main).toBe(0);
  });

  it("lock() moves money from main to locked, unlock() moves it back", async () => {
    const { service } = buildService();
    await service.credit({
      userId: USER_ID,
      amountCents: 1000,
      type: "DEPOSIT",
      origin: "test",
      idempotencyKey: key(),
      actor: SYSTEM_ACTOR,
    });

    const locked = await service.lock({
      userId: USER_ID,
      amountCents: 400,
      type: "WITHDRAW_PENDING",
      origin: "test",
      idempotencyKey: key(),
      actor: SYSTEM_ACTOR,
    });
    expect(locked.balanceAfter.main).toBe(600);
    expect(locked.balanceAfter.locked).toBe(400);

    const unlocked = await service.unlock({
      userId: USER_ID,
      amountCents: 400,
      type: "WITHDRAW_REJECTED",
      origin: "test",
      idempotencyKey: key(),
      actor: SYSTEM_ACTOR,
    });
    expect(unlocked.balanceAfter.main).toBe(1000);
    expect(unlocked.balanceAfter.locked).toBe(0);
  });

  it("lock() throws BusinessRuleError when the main balance is insufficient", async () => {
    const { service } = buildService();
    await expect(
      service.lock({
        userId: USER_ID,
        amountCents: 100,
        type: "WITHDRAW_PENDING",
        origin: "test",
        idempotencyKey: key(),
        actor: SYSTEM_ACTOR,
      })
    ).rejects.toThrow(BusinessRuleError);
  });

  it("transfer() debits one wallet and credits another for the same amount", async () => {
    const { service } = buildService();
    await service.credit({
      userId: USER_ID,
      amountCents: 1000,
      type: "DEPOSIT",
      origin: "test",
      idempotencyKey: key(),
      actor: SYSTEM_ACTOR,
    });

    const { debit, credit } = await service.transfer({
      fromUserId: USER_ID,
      toUserId: OTHER_USER_ID,
      amountCents: 300,
      origin: "test",
      idempotencyKey: key(),
      actor: SYSTEM_ACTOR,
    });
    expect(debit.balanceAfter.main).toBe(700);
    expect(credit.balanceAfter.main).toBe(300);
  });

  it("refund() always types the transaction BET_REFUND", async () => {
    const { service } = buildService();
    const result = await service.refund({
      userId: USER_ID,
      amountCents: 500,
      origin: "match-engine",
      idempotencyKey: key(),
      actor: SYSTEM_ACTOR,
    });
    expect(result.transaction.type).toBe("BET_REFUND");
    expect(result.balanceAfter.main).toBe(500);
  });

  it("adjust() rejects a missing reason/observation before moving any money", async () => {
    const { service } = buildService();
    await expect(
      service.adjust({
        userId: USER_ID,
        amountCents: 500,
        reason: "",
        observation: "ok",
        idempotencyKey: key(),
        actor: ADMIN_ACTOR,
      })
    ).rejects.toThrow(ValidationError);
    const balance = await service.getBalance(USER_ID);
    expect(balance.main).toBe(0);
  });

  it("adjust() moves the balance and records an audit log entry", async () => {
    const { service } = buildService();
    const result = await service.adjust({
      userId: USER_ID,
      amountCents: 1000,
      reason: "correção manual",
      observation: "erro no suporte",
      idempotencyKey: key(),
      actor: ADMIN_ACTOR,
    });
    expect(result.balanceAfter.main).toBe(1000);
    expect(AuditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "wallet.adjust", entityId: USER_ID })
    );
  });

  it("adjust() with a negative amount debits", async () => {
    const { service } = buildService();
    await service.credit({
      userId: USER_ID,
      amountCents: 1000,
      type: "DEPOSIT",
      origin: "test",
      idempotencyKey: key(),
      actor: SYSTEM_ACTOR,
    });
    const result = await service.adjust({
      userId: USER_ID,
      amountCents: -400,
      reason: "estorno",
      observation: "duplicidade",
      idempotencyKey: key(),
      actor: ADMIN_ACTOR,
    });
    expect(result.balanceAfter.main).toBe(600);
  });

  it("reverse() flips a prior credit into a debit of the same amount", async () => {
    const { service } = buildService();
    const original = await service.credit({
      userId: USER_ID,
      amountCents: 700,
      type: "DEPOSIT",
      origin: "test",
      idempotencyKey: key(),
      actor: SYSTEM_ACTOR,
    });
    const reversed = await service.reverse({
      originalTransactionId: original.transaction.id,
      reason: "chargeback",
      actor: ADMIN_ACTOR,
    });
    expect(reversed.transaction.type).toBe("REVERSAL");
    expect(reversed.balanceAfter.main).toBe(0);
  });

  it("reverse() rejects reversing an already-reversed (REVERSAL-typed) transaction", async () => {
    const { service } = buildService();
    const original = await service.credit({
      userId: USER_ID,
      amountCents: 700,
      type: "DEPOSIT",
      origin: "test",
      idempotencyKey: key(),
      actor: SYSTEM_ACTOR,
    });
    const reversed = await service.reverse({
      originalTransactionId: original.transaction.id,
      reason: "chargeback",
      actor: ADMIN_ACTOR,
    });
    await expect(
      service.reverse({ originalTransactionId: reversed.transaction.id, reason: "again", actor: ADMIN_ACTOR })
    ).rejects.toThrow(BusinessRuleError);
  });

  it("getBalance()/validateFunds() reflect the current state", async () => {
    const { service } = buildService();
    await service.credit({
      userId: USER_ID,
      amountCents: 1000,
      type: "DEPOSIT",
      origin: "test",
      idempotencyKey: key(),
      actor: SYSTEM_ACTOR,
    });
    await expect(service.validateFunds(USER_ID, 500)).resolves.toBe(true);
    await expect(service.validateFunds(USER_ID, 5000)).resolves.toBe(false);
  });

  it("every mutation writes a LedgerEntry with accounts matching the movement", async () => {
    const { service, wallets } = buildService();
    const result = await service.credit({
      userId: USER_ID,
      amountCents: 1000,
      type: "DEPOSIT",
      origin: "test",
      idempotencyKey: key(),
      actor: SYSTEM_ACTOR,
    });
    const entries = await wallets.ledger.listForTransaction(result.transaction.id);
    expect(entries).toHaveLength(1);
    expect(entries[0].creditAccount).toBe(walletAccountCode(USER_ID, "MAIN"));
    expect(entries[0].debitAccount).toBe(SYSTEM_ACCOUNTS.platform);
    expect(entries[0].amount).toBe(1000);
  });
});
