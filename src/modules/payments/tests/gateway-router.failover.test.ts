import { describe, expect, it, vi } from "vitest";
import { encrypt } from "@/server/security/crypto-utils";
import { eventBus } from "@/server/events";
import { GatewayRouterService } from "@/modules/payments/services/gateway-router.service";
import { InMemoryGatewayCredentialRepository } from "@/modules/payments/repositories/gateway-credential.in-memory-repository";
import { InMemoryGatewayHealthRepository } from "@/modules/payments/repositories/gateway-health.in-memory-repository";
import { PAYMENT_EVENTS } from "@/modules/payments/events/payments.events";
import type { PaymentSettings } from "@/modules/payments/entities/payments.entity";

function baseSettings(overrides: Partial<PaymentSettings> = {}): PaymentSettings {
  return {
    id: "global",
    defaultGatewayCredentialId: null,
    routingMode: "FAILOVER",
    timeoutMs: 15000,
    maxRetries: 2,
    pixExpirationMinutes: 30,
    depositMinCents: 500,
    depositMaxCents: 1000000,
    withdrawMinCents: 1000,
    withdrawMaxCents: 1000000,
    maxWebhookProcessingMs: 5000,
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("GatewayRouterService failover", () => {
  it("recordHealthCheck marks a MOCK credential OFFLINE via simulatedHealth, and filterHealthy then excludes it in favor of the other candidate", async () => {
    const credentials = new InMemoryGatewayCredentialRepository();
    const health = new InMemoryGatewayHealthRepository();
    const router = new GatewayRouterService(credentials, health);

    const offlineCred = await credentials.create({
      name: "Mock A (forced offline)",
      provider: "MOCK",
      active: true,
      priority: 0,
      credentialsEncrypted: encrypt("{}"),
      webhookSecretEncrypted: encrypt("secret-a"),
      simulatedHealth: "OFFLINE",
    });
    const onlineCred = await credentials.create({
      name: "Mock B",
      provider: "MOCK",
      active: true,
      priority: 1,
      credentialsEncrypted: encrypt("{}"),
      webhookSecretEncrypted: encrypt("secret-b"),
    });

    await router.recordHealthCheck(offlineCred);
    await router.recordHealthCheck(onlineCred);

    const candidates = await router.resolveCandidates(baseSettings({ routingMode: "FAILOVER" }));
    expect(candidates.map((c) => c.id)).toEqual([offlineCred.id, onlineCred.id]);

    const healthy = await router.filterHealthy(candidates);
    expect(healthy.map((c) => c.id)).toEqual([onlineCred.id]);
  });

  it("publishes gatewayUnavailable when a credential's health flips ONLINE -> OFFLINE, and gatewayRecovered on the way back", async () => {
    const credentials = new InMemoryGatewayCredentialRepository();
    const health = new InMemoryGatewayHealthRepository();
    const router = new GatewayRouterService(credentials, health);

    const unavailableHandler = vi.fn();
    const recoveredHandler = vi.fn();
    const offUnavailable = eventBus.subscribe(PAYMENT_EVENTS.gatewayUnavailable, unavailableHandler);
    const offRecovered = eventBus.subscribe(PAYMENT_EVENTS.gatewayRecovered, recoveredHandler);

    try {
      const cred = await credentials.create({
        name: "Mock flapping",
        provider: "MOCK",
        active: true,
        credentialsEncrypted: encrypt("{}"),
        webhookSecretEncrypted: encrypt("secret"),
        simulatedHealth: null,
      });

      await router.recordHealthCheck(cred); // ONLINE, no previous -> no event
      expect(unavailableHandler).not.toHaveBeenCalled();

      await credentials.update(cred.id, { simulatedHealth: "OFFLINE" });
      const offlineCred = await credentials.findById(cred.id);
      await router.recordHealthCheck(offlineCred!);
      expect(unavailableHandler).toHaveBeenCalledTimes(1);

      await credentials.update(cred.id, { simulatedHealth: null });
      const recoveredCred = await credentials.findById(cred.id);
      await router.recordHealthCheck(recoveredCred!);
      expect(recoveredHandler).toHaveBeenCalledTimes(1);
    } finally {
      offUnavailable();
      offRecovered();
    }
  });
});
