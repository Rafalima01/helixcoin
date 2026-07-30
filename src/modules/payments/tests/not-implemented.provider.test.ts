import { describe, expect, it } from "vitest";
import { NotImplementedProvider } from "@/modules/payments/providers/not-implemented.provider";

describe("NotImplementedProvider", () => {
  it("every real-operation method throws", async () => {
    const provider = new NotImplementedProvider("MERCADO_PAGO");

    await expect(provider.createPixDeposit({ depositId: "d", amountCents: 100, expiresAt: new Date() })).rejects.toThrow();
    await expect(provider.getDeposit({ providerTransactionId: "d" })).rejects.toThrow();
    await expect(provider.cancelDeposit({ providerTransactionId: "d" })).rejects.toThrow();
    await expect(provider.createWithdraw({ withdrawId: "w", amountCents: 100, pixKey: "x@x.com" })).rejects.toThrow();
    await expect(provider.getWithdraw({ providerTransactionId: "w" })).rejects.toThrow();
    await expect(provider.cancelWithdraw({ providerTransactionId: "w" })).rejects.toThrow();
    await expect(
      provider.validateWebhook({ rawBody: "{}", signatureHeader: null, webhookSecret: "x" })
    ).rejects.toThrow();
  });

  it("health() reports OFFLINE instead of throwing, so GatewayRouterService's health filter naturally excludes it", async () => {
    const provider = new NotImplementedProvider("OPENPIX");
    const health = await provider.health();
    expect(health.status).toBe("OFFLINE");
    expect(health.message).toContain("OPENPIX");
  });

  it("name reflects whichever GatewayProvider enum value it was constructed with", () => {
    expect(new NotImplementedProvider("BSPAY").name).toBe("BSPAY");
    expect(new NotImplementedProvider("OUTROS").name).toBe("OUTROS");
  });
});
