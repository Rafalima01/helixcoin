import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/audit", () => ({ AuditService: { record: vi.fn() } }));

import { eventBus } from "@/server/events";
import { PAYMENT_EVENTS } from "@/modules/payments/events/payments.events";
import { MockProvider } from "@/modules/payments/providers/mock/mock.provider";
import { buildPaymentTestHarness, MOCK_WEBHOOK_SECRET } from "@/modules/payments/tests/test-helpers";
import type { WalletActor } from "@/modules/wallet/entities/wallet.entity";

const USER_ID = "user-webhook-idem-1";
const ACTOR: WalletActor = { actorId: USER_ID, actorType: "USER" };

describe("PaymentService.handleWebhook — idempotency", () => {
  it("replaying the exact same signed delivery twice credits the wallet exactly once", async () => {
    const { paymentService, walletService, deposits, credential } = await buildPaymentTestHarness();
    const created = await paymentService.createDeposit(USER_ID, 4000);
    const deposit = await deposits.findById(created.depositId);

    const built = MockProvider.buildWebhookPayload({
      eventType: "deposit.paid",
      relatedType: "DEPOSIT",
      relatedId: deposit!.id,
      providerTransactionId: deposit!.providerTransactionId!,
      webhookSecret: MOCK_WEBHOOK_SECRET,
    });

    const first = await paymentService.handleWebhook(credential.provider, built.rawBody, built.signatureHeader);
    const second = await paymentService.handleWebhook(credential.provider, built.rawBody, built.signatureHeader);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const balance = await walletService.getBalance(USER_ID);
    expect(balance.main).toBe(4000);
  });

  it("falls back to payloadHash dedup when the provider supplies no providerEventId at all", async () => {
    const { paymentService, walletService, deposits, credential } = await buildPaymentTestHarness();
    const created = await paymentService.createDeposit(USER_ID, 1500);
    const deposit = await deposits.findById(created.depositId);

    const built = MockProvider.buildWebhookPayload({
      eventType: "deposit.paid",
      relatedType: "DEPOSIT",
      relatedId: deposit!.id,
      providerTransactionId: deposit!.providerTransactionId!,
      webhookSecret: MOCK_WEBHOOK_SECRET,
    });

    // Strip the eventId out of the payload/signature to simulate a provider that never sends one — payloadHash is then the only dedup key.
    const payloadWithoutEventId = JSON.parse(built.rawBody);
    delete payloadWithoutEventId.eventId;
    const rawBody = JSON.stringify(payloadWithoutEventId);
    const { createHmac } = await import("node:crypto");
    const signatureHeader = createHmac("sha256", MOCK_WEBHOOK_SECRET).update(rawBody).digest("hex");

    await paymentService.handleWebhook(credential.provider, rawBody, signatureHeader);
    await paymentService.handleWebhook(credential.provider, rawBody, signatureHeader);

    const balance = await walletService.getBalance(USER_ID);
    expect(balance.main).toBe(1500);
  });

  it("a stale withdraw.rejected arriving after withdraw.approved already settled is a no-op and publishes webhookOutOfOrder (Fase 10)", async () => {
    const { paymentService, walletService, withdraws, credential } = await buildPaymentTestHarness();
    await walletService.credit({
      userId: USER_ID,
      amountCents: 5000,
      type: "DEPOSIT",
      origin: "test-setup",
      idempotencyKey: "setup-credit-out-of-order",
      actor: { actorId: null, actorType: "SYSTEM" },
    });
    const requested = await paymentService.requestWithdraw(USER_ID, 2000, "user@example.com", "EMAIL", ACTOR);
    await paymentService.decideWithdraw(requested.withdrawId, "APPROVE", undefined);

    const balanceAfterApprove = await walletService.getBalance(USER_ID);
    const withdrawAfterApprove = await withdraws.findById(requested.withdrawId);
    expect(withdrawAfterApprove?.status).toBe("APPROVED");

    // A distinct, independently-signed webhook event (its own providerEventId,
    // so idempotency dedup does NOT catch it) for the SAME withdraw — the
    // real-world "webhook fora de ordem" scenario, not a simple replay.
    const staleReject = MockProvider.buildWebhookPayload({
      eventType: "withdraw.rejected",
      relatedType: "WITHDRAW",
      relatedId: requested.withdrawId,
      providerTransactionId: withdrawAfterApprove!.providerTransactionId!,
      webhookSecret: MOCK_WEBHOOK_SECRET,
      extra: { rejectionReason: "stale duplicate" },
    });

    const outOfOrderHandler = vi.fn();
    const unsubscribe = eventBus.subscribe(PAYMENT_EVENTS.webhookOutOfOrder, outOfOrderHandler);
    try {
      const result = await paymentService.handleWebhook(credential.provider, staleReject.rawBody, staleReject.signatureHeader);
      expect(result.status).toBe(200); // accepted-but-no-op, not an error

      expect(outOfOrderHandler).toHaveBeenCalledTimes(1);
      expect(outOfOrderHandler.mock.calls[0][0].payload).toMatchObject({
        relatedId: requested.withdrawId,
        currentStatus: "APPROVED",
        attemptedEventType: "withdraw.rejected",
      });

      // Status/balance stay exactly as the APPROVE left them — the stale reject never unlocked or re-touched anything.
      const withdrawAfter = await withdraws.findById(requested.withdrawId);
      expect(withdrawAfter?.status).toBe("APPROVED");
      const balanceAfter = await walletService.getBalance(USER_ID);
      expect(balanceAfter.main).toBe(balanceAfterApprove.main);
      expect(balanceAfter.locked).toBe(balanceAfterApprove.locked);
    } finally {
      unsubscribe();
    }
  });
});
