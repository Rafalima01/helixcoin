import type { GameMode } from "@prisma/client";
import type { IGameEconomyConfigRepository } from "@/modules/game-config/interfaces/game-economy-config-repository.interface";
import type { IPlayerEconomySnapshotRepository } from "@/modules/game-config/interfaces/player-economy-snapshot-repository.interface";
import type {
  GameEconomyConfig,
  GameEconomyConfigSummary,
  ModeProfile,
} from "@/modules/game-config/entities/game-economy-config.entity";
import type { UpsertDraftInput } from "@/modules/game-config/validators/game-economy-config.validator";
import { mergeConfigPatch } from "@/modules/game-config/utils/config-merge.util";
import { validateFullConfig } from "@/modules/game-config/utils/config-validate.util";
import {
  buildDefaultGeneral,
  buildDefaultModes,
  buildDefaultAntiCheat,
} from "@/modules/game-config/utils/config-defaults.util";
import { GAME_CONFIG_EVENTS } from "@/modules/game-config/events/game-config.events";
import { NotFoundError, ConflictError } from "@/server/errors";
import { eventBus } from "@/server/events";
import { AuditService, type AuditRecordInput } from "@/server/audit";
import { createChildLogger } from "@/server/logger";

const logger = createChildLogger({ module: "game-config.service" });

export type ConfigActor = Pick<AuditRecordInput, "actorId" | "actorType" | "actorRole" | "ip" | "userAgent">;

export interface EnginePayload {
  mode: GameMode;
  config: GameEconomyConfig;
  params: ModeProfile;
}

/**
 * Business logic for the versioned game economy config. Depends on
 * repository INTERFACES (constructor injection), never on Prisma directly —
 * see tests/game-config.service.test.ts, which injects the in-memory
 * repositories from this module.
 */
export class GameConfigService {
  constructor(
    private readonly configs: IGameEconomyConfigRepository,
    private readonly playerSnapshots: IPlayerEconomySnapshotRepository
  ) {}

  /** The version every match/config-consuming route reads. Throws if the platform was never bootstrapped (see prisma/seed.ts). */
  async getActive(): Promise<GameEconomyConfig> {
    const active = await this.configs.findActive();
    if (!active) throw new NotFoundError("GameEconomyConfig (nenhuma versão ativa)");
    return active;
  }

  async getDraft(): Promise<GameEconomyConfig | null> {
    return this.configs.findDraft();
  }

  async getById(id: string): Promise<GameEconomyConfig> {
    const config = await this.configs.findById(id);
    if (!config) throw new NotFoundError("GameEconomyConfig");
    return config;
  }

  async listVersions(
    page: number,
    pageSize: number
  ): Promise<{ items: GameEconomyConfigSummary[]; total: number }> {
    return this.configs.listVersions(page, pageSize);
  }

  /**
   * Upserts the current draft: merges the patch onto the existing draft (or
   * a fresh copy of the active version, if no draft is open yet) and
   * persists it. A partial patch never invalidates untouched fields — full
   * bounds validation only happens at `activate()`, not here, so an admin
   * can save a work-in-progress edit that only touches one section.
   */
  async upsertDraft(patch: UpsertDraftInput, actor: ConfigActor): Promise<GameEconomyConfig> {
    const existingDraft = await this.configs.findDraft();
    const base = existingDraft ?? (await this.configs.findActive()) ?? this.bootstrapDefaults();
    const merged = mergeConfigPatch(base, patch);

    let result: GameEconomyConfig;
    if (existingDraft) {
      result = await this.configs.updateDraft(existingDraft.id, {
        description: patch.description ?? existingDraft.description,
        ...merged,
      });
    } else {
      const nextVersion = (await this.configs.findLatestVersionNumber()) + 1;
      result = await this.configs.createDraft({
        version: nextVersion,
        description: patch.description ?? null,
        ...merged,
        createdById: actor.actorId ?? "",
      });
    }

    eventBus.publish(GAME_CONFIG_EVENTS.draftSaved, { config: result }, result.id);
    await AuditService.record({
      actorId: actor.actorId,
      actorType: actor.actorType,
      actorRole: actor.actorRole,
      action: "game-config.draft.save",
      entityType: "GameEconomyConfig",
      entityId: result.id,
      before: base,
      after: result,
      ip: actor.ip,
      userAgent: actor.userAgent,
    });

    logger.info({ configId: result.id, version: result.version }, "game config draft saved");
    return result;
  }

  /**
   * Activates a DRAFT (or a previously ARCHIVED version, letting `restore`
   * be a two-step "clone then activate"). Archives whatever was ACTIVE
   * beforehand rather than deleting it — history is append-only.
   */
  async activate(actor: ConfigActor, versionId?: string): Promise<GameEconomyConfig> {
    const target = versionId ? await this.configs.findById(versionId) : await this.configs.findDraft();
    if (!target) throw new NotFoundError("Nenhuma versão em rascunho para ativar");
    if (target.status === "ACTIVE") throw new ConflictError("Esta versão já está ativa");

    validateFullConfig(target);

    const previousActive = await this.configs.findActive();
    await this.configs.archiveActive();
    const activated = await this.configs.markActive(target.id);

    eventBus.publish(
      GAME_CONFIG_EVENTS.activated,
      { config: activated, previousVersion: previousActive?.version ?? null },
      activated.id
    );
    await AuditService.record({
      actorId: actor.actorId,
      actorType: actor.actorType,
      actorRole: actor.actorRole,
      action: "game-config.activate",
      entityType: "GameEconomyConfig",
      entityId: activated.id,
      before: previousActive,
      after: activated,
      ip: actor.ip,
      userAgent: actor.userAgent,
    });

    logger.info(
      { configId: activated.id, version: activated.version, previousVersion: previousActive?.version },
      "game config activated"
    );
    return activated;
  }

  /**
   * Clones a past version's payload into a NEW draft — never deletes or
   * overwrites the version being restored, so "restore" is just another
   * entry in the append-only history. The admin still has to call
   * `activate()` to make it live.
   */
  async restore(versionId: string, actor: ConfigActor): Promise<GameEconomyConfig> {
    const old = await this.getById(versionId);
    const existingDraft = await this.configs.findDraft();

    let result: GameEconomyConfig;
    if (existingDraft) {
      result = await this.configs.updateDraft(existingDraft.id, {
        description: `Restaurado da versão ${old.version}`,
        general: old.general,
        modes: old.modes,
        antiCheat: old.antiCheat,
      });
    } else {
      const nextVersion = (await this.configs.findLatestVersionNumber()) + 1;
      result = await this.configs.createDraft({
        version: nextVersion,
        description: `Restaurado da versão ${old.version}`,
        general: old.general,
        modes: old.modes,
        antiCheat: old.antiCheat,
        createdById: actor.actorId ?? "",
      });
    }

    eventBus.publish(GAME_CONFIG_EVENTS.restored, { fromVersion: old.version, draft: result }, result.id);
    await AuditService.record({
      actorId: actor.actorId,
      actorType: actor.actorType,
      actorRole: actor.actorRole,
      action: "game-config.restore",
      entityType: "GameEconomyConfig",
      entityId: result.id,
      before: old,
      after: result,
      ip: actor.ip,
      userAgent: actor.userAgent,
    });

    return result;
  }

  /**
   * DEMO: only accounts an admin manually tagged `"demo"` (User.tags).
   * HARD: everyone else, once (balance + lifetime withdrawals) crosses the
   * configured threshold — 0 disables the feature entirely.
   * NORMAL: everyone else.
   */
  async resolveModeForUser(userId: string): Promise<GameMode> {
    const snapshot = await this.playerSnapshots.getSnapshot(userId);
    if (snapshot.tags.includes("demo")) return "DEMO";

    const active = await this.getActive();
    const threshold = active.general.hardModeBalanceThreshold;
    if (threshold > 0) {
      const totalBalance = snapshot.balance + snapshot.totalWithdrawn;
      if (totalBalance >= threshold) return "HARD";
    }
    return "NORMAL";
  }

  /** What `/api/matches/start` snapshots onto the Match row and returns to the frontend engine. */
  async buildEnginePayloadForUser(userId: string): Promise<EnginePayload> {
    const config = await this.getActive();
    const mode = await this.resolveModeForUser(userId);
    return { mode, config, params: config.modes[mode] };
  }

  private bootstrapDefaults(): Pick<GameEconomyConfig, "general" | "modes" | "antiCheat"> {
    return { general: buildDefaultGeneral(), modes: buildDefaultModes(), antiCheat: buildDefaultAntiCheat() };
  }
}
