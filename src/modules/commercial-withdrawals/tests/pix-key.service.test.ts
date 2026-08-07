import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/audit", () => ({ AuditService: { record: vi.fn() } }));
vi.mock("@/server/notifications", () => ({
  NotificationService: { notify: vi.fn() },
  NOTIFICATION_TYPES: { withdrawApproved: "withdraw_approved", withdrawRejected: "withdraw_rejected" },
}));

import { BusinessRuleError, ForbiddenError, ValidationError } from "@/server/errors";
import { buildCommercialWithdrawTestHarness, seedUserWithBalance } from "@/modules/commercial-withdrawals/tests/test-helpers";

describe("PixKeyService.create — CPF-match validation", () => {
  it("type CPF with a key that doesn't match User.cpf throws ValidationError", async () => {
    const h = await buildCommercialWithdrawTestHarness();
    const userId = await seedUserWithBalance(h, { cpf: "11122233344" });

    await expect(
      h.pixKeyService.create(userId, { type: "CPF", key: "99988877766", holderCpf: "11122233344" })
    ).rejects.toThrow(ValidationError);
  });

  it("type CPF with a matching key succeeds", async () => {
    const h = await buildCommercialWithdrawTestHarness();
    const userId = await seedUserWithBalance(h, { cpf: "11122233344" });

    const key = await h.pixKeyService.create(userId, { type: "CPF", key: "11122233344", holderCpf: "11122233344" });
    expect(key.type).toBe("CPF");
    expect(key.userId).toBe(userId);
  });

  it("type CPF for a user with no cpf on file throws ValidationError", async () => {
    const h = await buildCommercialWithdrawTestHarness();
    const userId = await seedUserWithBalance(h); // no cpf

    await expect(
      h.pixKeyService.create(userId, { type: "CPF", key: "11122233344", holderCpf: "11122233344" })
    ).rejects.toThrow(ValidationError);
  });

  it("non-CPF types (e.g. EMAIL) are never checked against User.cpf", async () => {
    const h = await buildCommercialWithdrawTestHarness();
    const userId = await seedUserWithBalance(h, { cpf: "11122233344" });

    const key = await h.pixKeyService.create(userId, { type: "EMAIL", key: "someone@example.com", holderCpf: "11122233344" });
    expect(key.type).toBe("EMAIL");
  });
});

describe("PixKeyService.delete — pending-withdrawal guard", () => {
  it("deleting a PixKey referenced by a PENDING CommercialWithdraw throws BusinessRuleError", async () => {
    const h = await buildCommercialWithdrawTestHarness();
    const userId = await seedUserWithBalance(h, { amountCents: 5000 });
    const key = await h.pixKeyService.create(userId, { type: "EMAIL", key: "someone@example.com", holderCpf: "11122233344" });

    await h.commercialWithdrawService.request({
      userId,
      payeeRole: "AFFILIATE",
      amountCents: 1000,
      pixKeyId: key.id,
      actor: { actorId: userId, actorType: "USER" },
    });

    await expect(h.pixKeyService.delete(userId, key.id)).rejects.toThrow(BusinessRuleError);
    const stillThere = await h.pixKeys.findById(key.id);
    expect(stillThere).not.toBeNull();
  });

  it("deleting an unreferenced PixKey succeeds", async () => {
    const h = await buildCommercialWithdrawTestHarness();
    const userId = await seedUserWithBalance(h, { amountCents: 5000 });
    const key = await h.pixKeyService.create(userId, { type: "EMAIL", key: "someone@example.com", holderCpf: "11122233344" });

    await h.pixKeyService.delete(userId, key.id);
    const gone = await h.pixKeys.findById(key.id);
    expect(gone).toBeNull();
  });

  it("deleting another user's PixKey throws ForbiddenError", async () => {
    const h = await buildCommercialWithdrawTestHarness();
    const userId = await seedUserWithBalance(h);
    const otherUserId = await seedUserWithBalance(h);
    const key = await h.pixKeyService.create(otherUserId, { type: "EMAIL", key: "someone@example.com", holderCpf: "11122233344" });

    await expect(h.pixKeyService.delete(userId, key.id)).rejects.toThrow(ForbiddenError);
  });
});
