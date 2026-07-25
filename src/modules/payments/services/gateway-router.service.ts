import { eventBus } from "@/server/events";
import { ProviderFactory } from "@/modules/payments/factories/provider.factory";
import { roundRobinOrder, weightedOrder } from "@/modules/payments/utils/routing.util";
import { PAYMENT_EVENTS } from "@/modules/payments/events/payments.events";
import type { IGatewayCredentialRepository } from "@/modules/payments/interfaces/gateway-credential-repository.interface";
import type { IGatewayHealthRepository } from "@/modules/payments/interfaces/gateway-health-repository.interface";
import type { GatewayCredential, GatewayHealth, PaymentSettings } from "@/modules/payments/entities/payments.entity";

/**
 * Decides candidate ORDER for a payment attempt — the actual try/catch/
 * retry-next loop lives in PaymentService.withFailover, not here. Kept
 * separate so routing-mode logic (SINGLE/ROUND_ROBIN/WEIGHTED/FAILOVER) and
 * retry/error-handling logic can be tested and reasoned about independently.
 */
export class GatewayRouterService {
  private roundRobinCounter = 0;

  constructor(
    private readonly credentials: IGatewayCredentialRepository,
    private readonly health: IGatewayHealthRepository
  ) {}

  /** Full preference order over every ACTIVE credential — first entry is the primary pick, the rest are fallback order for withFailover. */
  async resolveCandidates(settings: PaymentSettings): Promise<GatewayCredential[]> {
    const active = await this.credentials.listActive();
    if (active.length === 0) return [];

    switch (settings.routingMode) {
      case "SINGLE": {
        const primary =
          (settings.defaultGatewayCredentialId
            ? active.find((c) => c.id === settings.defaultGatewayCredentialId)
            : undefined) ?? active[0];
        return [primary, ...active.filter((c) => c.id !== primary.id)];
      }
      case "FAILOVER":
        return [...active].sort((a, b) => a.priority - b.priority);
      case "ROUND_ROBIN": {
        const ordered = [...active].sort((a, b) => a.priority - b.priority);
        const startIdx = this.roundRobinCounter;
        this.roundRobinCounter = (this.roundRobinCounter + 1) % ordered.length;
        return roundRobinOrder(ordered, startIdx);
      }
      case "WEIGHTED":
        return weightedOrder(active);
      default:
        return active;
    }
  }

  /** Drops candidates whose LATEST health check is OFFLINE. No check yet recorded = benefit of the doubt, kept in. */
  async filterHealthy(candidates: GatewayCredential[]): Promise<GatewayCredential[]> {
    const checked = await Promise.all(
      candidates.map(async (c) => ({ credential: c, latest: await this.health.findLatest(c.id) }))
    );
    return checked.filter(({ latest }) => !latest || latest.status !== "OFFLINE").map(({ credential }) => credential);
  }

  /** Runs `provider.health()`, writes an append-only GatewayHealth row, and publishes gatewayUnavailable/gatewayRecovered when the status actually changed since the last check. */
  async recordHealthCheck(credential: GatewayCredential): Promise<GatewayHealth> {
    const previous = await this.health.findLatest(credential.id);
    const provider = ProviderFactory.create(credential);

    let result: { status: "ONLINE" | "DEGRADED" | "OFFLINE"; latencyMs: number; message?: string };
    try {
      result = await provider.health();
    } catch (err) {
      result = { status: "OFFLINE", latencyMs: 0, message: err instanceof Error ? err.message : "health check failed" };
    }

    const row = await this.health.create({
      gatewayCredentialId: credential.id,
      status: result.status,
      latencyMs: result.latencyMs,
      message: result.message ?? null,
    });

    if (previous?.status !== result.status) {
      if (result.status === "OFFLINE") {
        eventBus.publish(PAYMENT_EVENTS.gatewayUnavailable, {
          gatewayCredentialId: credential.id,
          provider: credential.provider,
          status: result.status,
          previousStatus: previous?.status ?? null,
        });
      } else if (previous?.status === "OFFLINE") {
        eventBus.publish(PAYMENT_EVENTS.gatewayRecovered, {
          gatewayCredentialId: credential.id,
          provider: credential.provider,
          status: result.status,
          previousStatus: previous.status,
        });
      }
    }

    return row;
  }
}
