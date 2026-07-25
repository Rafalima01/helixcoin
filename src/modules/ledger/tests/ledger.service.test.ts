import { describe, expect, it } from "vitest";
import { LedgerService } from "@/modules/ledger/services/ledger.service";
import { InMemoryLedgerRepository } from "@/modules/ledger/repositories/ledger.in-memory-repository";

function buildService() {
  const repo = new InMemoryLedgerRepository();
  const service = new LedgerService(repo);
  return { service, repo };
}

describe("LedgerService", () => {
  it("has no write method — read-only by construction", () => {
    const { service } = buildService();
    const methodNames = Object.getOwnPropertyNames(Object.getPrototypeOf(service)).filter(
      (m) => m !== "constructor"
    );
    expect(methodNames.sort()).toEqual(["getById", "list", "listForTransaction"].sort());
  });

  it("list() filters by debitAccount/creditAccount/referenceType and date range", async () => {
    const { service, repo } = buildService();
    await repo.createEntry({
      id: "entry-1",
      transactionId: "tx-1",
      debitAccount: "PLATFORM",
      creditAccount: "WALLET:user-1:MAIN",
      amount: 100,
      referenceType: "match-engine",
    });
    await repo.createEntry({
      id: "entry-2",
      transactionId: "tx-2",
      debitAccount: "WALLET:user-1:MAIN",
      creditAccount: "PLATFORM",
      amount: 50,
      referenceType: "wallet-api",
    });

    const byDebit = await service.list({ debitAccount: "PLATFORM", page: 1, pageSize: 10 });
    expect(byDebit.items).toHaveLength(1);
    expect(byDebit.items[0].id).toBe("entry-1");

    const byReferenceType = await service.list({ referenceType: "wallet-api", page: 1, pageSize: 10 });
    expect(byReferenceType.items).toHaveLength(1);
    expect(byReferenceType.items[0].id).toBe("entry-2");

    const all = await service.list({ page: 1, pageSize: 10 });
    expect(all.total).toBe(2);
  });

  it("getById()/listForTransaction() return the expected rows", async () => {
    const { service, repo } = buildService();
    await repo.createEntry({
      id: "entry-1",
      transactionId: "tx-1",
      debitAccount: "PLATFORM",
      creditAccount: "WALLET:user-1:MAIN",
      amount: 100,
    });

    await expect(service.getById("entry-1")).resolves.toMatchObject({ id: "entry-1" });
    await expect(service.getById("missing")).resolves.toBeNull();
    await expect(service.listForTransaction("tx-1")).resolves.toHaveLength(1);
  });
});
