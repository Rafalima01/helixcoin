import { describe, expect, it } from "vitest";
import { encrypt } from "@/server/security/crypto-utils";
import { GatewayRouterService } from "@/modules/payments/services/gateway-router.service";
import { InMemoryGatewayCredentialRepository } from "@/modules/payments/repositories/gateway-credential.in-memory-repository";
import { InMemoryGatewayHealthRepository } from "@/modules/payments/repositories/gateway-health.in-memory-repository";
import type { PaymentSettings, RoutingMode } from "@/modules/payments/entities/payments.entity";

function baseSettings(routingMode: RoutingMode, defaultGatewayCredentialId: string | null = null): PaymentSettings {
  return {
    id: "global",
    defaultGatewayCredentialId,
    routingMode,
    timeoutMs: 15000,
    maxRetries: 2,
    pixExpirationMinutes: 30,
    depositMinCents: 500,
    depositMaxCents: 1000000,
    withdrawMinCents: 1000,
    withdrawMaxCents: 1000000,
    maxWebhookProcessingMs: 5000,
    updatedAt: new Date(),
  };
}

async function seedTwoCredentials(credentials: InMemoryGatewayCredentialRepository) {
  const a = await credentials.create({
    name: "A",
    provider: "MOCK",
    active: true,
    priority: 0,
    weight: 1,
    credentialsEncrypted: encrypt("{}"),
    webhookSecretEncrypted: encrypt("secret-a"),
  });
  const b = await credentials.create({
    name: "B",
    provider: "MOCK",
    active: true,
    priority: 1,
    weight: 9,
    credentialsEncrypted: encrypt("{}"),
    webhookSecretEncrypted: encrypt("secret-b"),
  });
  return { a, b };
}

describe("GatewayRouterService routing modes", () => {
  it("SINGLE puts the configured default credential first, falling back to the rest", async () => {
    const credentials = new InMemoryGatewayCredentialRepository();
    const health = new InMemoryGatewayHealthRepository();
    const { a, b } = await seedTwoCredentials(credentials);
    const router = new GatewayRouterService(credentials, health);

    const candidates = await router.resolveCandidates(baseSettings("SINGLE", b.id));
    expect(candidates.map((c) => c.id)).toEqual([b.id, a.id]);
  });

  it("SINGLE with no configured default falls back to the first active credential", async () => {
    const credentials = new InMemoryGatewayCredentialRepository();
    const health = new InMemoryGatewayHealthRepository();
    const { a, b } = await seedTwoCredentials(credentials);
    const router = new GatewayRouterService(credentials, health);

    const candidates = await router.resolveCandidates(baseSettings("SINGLE", null));
    expect(candidates.map((c) => c.id)).toEqual([a.id, b.id]);
  });

  it("FAILOVER orders strictly by priority", async () => {
    const credentials = new InMemoryGatewayCredentialRepository();
    const health = new InMemoryGatewayHealthRepository();
    const { a, b } = await seedTwoCredentials(credentials);
    const router = new GatewayRouterService(credentials, health);

    const candidates = await router.resolveCandidates(baseSettings("FAILOVER"));
    expect(candidates.map((c) => c.id)).toEqual([a.id, b.id]);
  });

  it("ROUND_ROBIN rotates the starting candidate on each successive call", async () => {
    const credentials = new InMemoryGatewayCredentialRepository();
    const health = new InMemoryGatewayHealthRepository();
    const { a, b } = await seedTwoCredentials(credentials);
    const router = new GatewayRouterService(credentials, health);

    const first = await router.resolveCandidates(baseSettings("ROUND_ROBIN"));
    const second = await router.resolveCandidates(baseSettings("ROUND_ROBIN"));
    const third = await router.resolveCandidates(baseSettings("ROUND_ROBIN"));

    expect(first.map((c) => c.id)).toEqual([a.id, b.id]);
    expect(second.map((c) => c.id)).toEqual([b.id, a.id]);
    expect(third.map((c) => c.id)).toEqual([a.id, b.id]);
  });

  it("WEIGHTED returns a full permutation of every active candidate", async () => {
    const credentials = new InMemoryGatewayCredentialRepository();
    const health = new InMemoryGatewayHealthRepository();
    const { a, b } = await seedTwoCredentials(credentials);
    const router = new GatewayRouterService(credentials, health);

    const candidates = await router.resolveCandidates(baseSettings("WEIGHTED"));
    expect(candidates).toHaveLength(2);
    expect(new Set(candidates.map((c) => c.id))).toEqual(new Set([a.id, b.id]));
  });

  it("WEIGHTED heavily favors the higher-weight candidate as primary across many draws", async () => {
    const credentials = new InMemoryGatewayCredentialRepository();
    const health = new InMemoryGatewayHealthRepository();
    const { b } = await seedTwoCredentials(credentials); // a.weight=1, b.weight=9
    const router = new GatewayRouterService(credentials, health);

    let bPrimaryCount = 0;
    const draws = 200;
    for (let i = 0; i < draws; i++) {
      const candidates = await router.resolveCandidates(baseSettings("WEIGHTED"));
      if (candidates[0].id === b.id) bPrimaryCount++;
    }

    // Expected ~90%; assert it's at least clearly weight-driven, not 50/50, to avoid flakiness.
    expect(bPrimaryCount).toBeGreaterThan(draws * 0.6);
  });

  it("resolveCandidates returns an empty list when there are no active credentials", async () => {
    const credentials = new InMemoryGatewayCredentialRepository();
    const health = new InMemoryGatewayHealthRepository();
    const router = new GatewayRouterService(credentials, health);

    const candidates = await router.resolveCandidates(baseSettings("FAILOVER"));
    expect(candidates).toEqual([]);
  });
});
