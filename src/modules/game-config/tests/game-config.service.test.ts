import { describe, expect, it } from "vitest";
import { GameConfigService } from "@/modules/game-config/services/game-config.service";
import { InMemoryGameEconomyConfigRepository } from "@/modules/game-config/repositories/game-economy-config.in-memory-repository";
import { InMemoryPlayerEconomySnapshotRepository } from "@/modules/game-config/repositories/player-economy-snapshot.in-memory-repository";
import {
  buildDefaultGeneral,
  buildDefaultModes,
  buildDefaultAntiCheat,
} from "@/modules/game-config/utils/config-defaults.util";
import { ValidationError, ConflictError, NotFoundError } from "@/server/errors";

function buildService() {
  const configs = new InMemoryGameEconomyConfigRepository();
  const snapshots = new InMemoryPlayerEconomySnapshotRepository();
  return { service: new GameConfigService(configs, snapshots), configs, snapshots };
}

const actor = { actorId: "admin-1", actorType: "ADMIN" as const };

async function seedAndActivateFirstVersion(service: GameConfigService) {
  await service.upsertDraft(
    { general: buildDefaultGeneral(), modes: buildDefaultModes(), antiCheat: buildDefaultAntiCheat() },
    actor
  );
  return service.activate(actor);
}

describe("GameConfigService", () => {
  it("creates a draft from defaults when none exists yet", async () => {
    const { service } = buildService();
    const draft = await service.upsertDraft({ description: "primeira versão" }, actor);
    expect(draft.status).toBe("DRAFT");
    expect(draft.version).toBe(1);
    expect(draft.general.betMin).toBeGreaterThan(0);
    expect(draft.modes.NORMAL).toBeDefined();
  });

  it("merges a partial patch onto the existing draft without wiping other fields", async () => {
    const { service } = buildService();
    await service.upsertDraft({ general: { betMin: 200 } }, actor);
    const draft = await service.upsertDraft({ general: { betMax: 500_000 } }, actor);
    expect(draft.general.betMin).toBe(200);
    expect(draft.general.betMax).toBe(500_000);
  });

  it("activate archives the previous ACTIVE version and promotes the draft", async () => {
    const { service } = buildService();
    const v1 = await seedAndActivateFirstVersion(service);
    expect(v1.status).toBe("ACTIVE");

    await service.upsertDraft({ general: { targetMultiplierDefault: 7 } }, actor);
    const v2 = await service.activate(actor);
    expect(v2.version).toBe(2);
    expect(v2.status).toBe("ACTIVE");

    const active = await service.getActive();
    expect(active.id).toBe(v2.id);

    const v1AfterArchive = await service.getById(v1.id);
    expect(v1AfterArchive.status).toBe("ARCHIVED");
  });

  it("activate rejects an incomplete/out-of-bounds draft", async () => {
    const { service } = buildService();
    // betMin above GENERAL_FIELDS' allowed max (1_000_000 cents) — out of bounds.
    await service.upsertDraft({ general: { betMin: 5_000_000 } }, actor);
    await expect(service.activate(actor)).rejects.toThrow(ValidationError);
  });

  it("activate rejects when there is nothing to activate", async () => {
    const { service } = buildService();
    await expect(service.activate(actor)).rejects.toThrow(NotFoundError);
  });

  it("activate rejects re-activating an already-active version", async () => {
    const { service } = buildService();
    const v1 = await seedAndActivateFirstVersion(service);
    await expect(service.activate(actor, v1.id)).rejects.toThrow(ConflictError);
  });

  it("restore clones an old version's payload into a new draft without deleting the original", async () => {
    const { service } = buildService();
    const v1 = await seedAndActivateFirstVersion(service);
    await service.upsertDraft({ general: { targetMultiplierDefault: 99 } }, actor);
    await service.activate(actor);

    const restoredDraft = await service.restore(v1.id, actor);
    expect(restoredDraft.status).toBe("DRAFT");
    expect(restoredDraft.general.targetMultiplierDefault).toBe(v1.general.targetMultiplierDefault);

    const originalStillThere = await service.getById(v1.id);
    expect(originalStillThere.status).toBe("ARCHIVED");
  });

  describe("resolveModeForUser", () => {
    it("returns DEMO for accounts manually tagged 'demo', regardless of balance", async () => {
      const { service, snapshots } = buildService();
      await seedAndActivateFirstVersion(service);
      snapshots.set("user-1", { tags: ["demo"], balance: 999_999_999, totalWithdrawn: 0 });
      await expect(service.resolveModeForUser("user-1")).resolves.toBe("DEMO");
    });

    it("returns NORMAL when the hard-mode threshold is disabled (0)", async () => {
      const { service, snapshots } = buildService();
      await seedAndActivateFirstVersion(service); // default threshold is 0
      snapshots.set("user-2", { tags: [], balance: 999_999_999, totalWithdrawn: 0 });
      await expect(service.resolveModeForUser("user-2")).resolves.toBe("NORMAL");
    });

    it("returns HARD once balance + lifetime withdrawals crosses a configured threshold", async () => {
      const { service, snapshots } = buildService();
      await service.upsertDraft(
        {
          general: { ...buildDefaultGeneral(), hardModeBalanceThreshold: 100_000 },
          modes: buildDefaultModes(),
          antiCheat: buildDefaultAntiCheat(),
        },
        actor
      );
      await service.activate(actor);

      snapshots.set("user-3", { tags: [], balance: 60_000, totalWithdrawn: 50_000 });
      await expect(service.resolveModeForUser("user-3")).resolves.toBe("HARD");

      snapshots.set("user-4", { tags: [], balance: 10_000, totalWithdrawn: 5_000 });
      await expect(service.resolveModeForUser("user-4")).resolves.toBe("NORMAL");
    });
  });

  it("buildEnginePayloadForUser returns the resolved mode's exact profile from the active config", async () => {
    const { service, snapshots } = buildService();
    const v1 = await seedAndActivateFirstVersion(service);
    snapshots.set("user-5", { tags: ["demo"], balance: 0, totalWithdrawn: 0 });

    const payload = await service.buildEnginePayloadForUser("user-5");
    expect(payload.mode).toBe("DEMO");
    expect(payload.params).toEqual(v1.modes.DEMO);
  });
});
