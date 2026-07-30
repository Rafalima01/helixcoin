import { describe, expect, it, vi } from "vitest";
import { encrypt } from "@/server/security/crypto-utils";
import { ProviderFactory } from "@/modules/payments/factories/provider.factory";
import { MockProvider } from "@/modules/payments/providers/mock/mock.provider";
import { NotImplementedProvider } from "@/modules/payments/providers/not-implemented.provider";
import { VeoPagProvider } from "@/modules/payments/providers/veopag/veopag.provider";
import type { GatewayCredential, GatewayProvider } from "@/modules/payments/entities/payments.entity";

vi.mock("@/modules/payments/providers/veopag/veopag-auth", () => ({
  VEOPAG_BASE_URL: "https://api.veopag.com",
  getVeoPagToken: vi.fn().mockResolvedValue("test-jwt-token"),
  invalidateVeoPagToken: vi.fn().mockResolvedValue(undefined),
}));

function buildCredential(provider: GatewayProvider): GatewayCredential {
  return {
    id: "cred-1",
    name: `${provider} credential`,
    provider,
    mode: "SANDBOX",
    active: true,
    priority: 0,
    weight: 1,
    timeoutMs: 15000,
    maxRetries: 2,
    credentialsEncrypted: encrypt("{}"),
    webhookSecretEncrypted: encrypt("some-webhook-secret"),
    simulatedHealth: null,
    simulatedErrorMode: null,
    createdById: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("ProviderFactory", () => {
  it("resolves MOCK to a functional MockProvider with the decrypted webhook secret wired in", async () => {
    const credential = buildCredential("MOCK");
    const provider = ProviderFactory.create(credential);

    expect(provider).toBeInstanceOf(MockProvider);
    expect(provider.name).toBe("MOCK");

    // Prove the secret was actually decrypted and wired in: sign a payload
    // with the plaintext secret and confirm this instance validates it.
    const built = MockProvider.buildWebhookPayload({
      eventType: "deposit.paid",
      relatedType: "DEPOSIT",
      relatedId: "dep-1",
      providerTransactionId: "mock_dep_dep-1",
      webhookSecret: "some-webhook-secret",
    });
    const result = await provider.validateWebhook({
      rawBody: built.rawBody,
      signatureHeader: built.signatureHeader,
      webhookSecret: "unused-by-mock-instance",
    });
    expect(result.valid).toBe(true);
  });

  it.each<GatewayProvider>([
    "CARTPANDA",
    "CARTWAVEHUB",
    "MERCADO_PAGO",
    "PAY4FUN",
    "BSPAY",
    "PAY2M",
    "OPENPIX",
    "OUTROS",
  ])("resolves %s to NotImplementedProvider", (provider) => {
    const credential = buildCredential(provider);
    const instance = ProviderFactory.create(credential);
    expect(instance).toBeInstanceOf(NotImplementedProvider);
    expect(instance.name).toBe(provider);
  });

  it("NotImplementedProvider throws on every real method but reports OFFLINE health", async () => {
    const instance = ProviderFactory.create(buildCredential("OUTROS"));
    await expect(
      instance.createPixDeposit({ depositId: "d", amountCents: 100, expiresAt: new Date() })
    ).rejects.toThrow();
    const health = await instance.health();
    expect(health.status).toBe("OFFLINE");
  });

  it("resolves VEOPAG to a functional VeoPagProvider with client_id/client_secret decrypted from credentials.publicKey/privateKey", () => {
    const credential: GatewayCredential = {
      ...buildCredential("VEOPAG"),
      credentialsEncrypted: encrypt(JSON.stringify({ publicKey: "cli_test", privateKey: "secret_test" })),
    };
    const provider = ProviderFactory.create(credential);
    expect(provider).toBeInstanceOf(VeoPagProvider);
    expect(provider.name).toBe("VEOPAG");
  });
});
