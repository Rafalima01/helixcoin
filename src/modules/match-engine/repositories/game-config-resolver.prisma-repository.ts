import { gameConfigContainer } from "@/modules/game-config/container";
import type {
  IGameConfigResolver,
  ResolvedMatchConfig,
} from "@/modules/match-engine/interfaces/game-config-resolver.interface";

export class GameConfigResolver implements IGameConfigResolver {
  async resolveForUser(userId: string): Promise<ResolvedMatchConfig> {
    const { gameConfigService } = gameConfigContainer;
    const { mode, config, params } = await gameConfigService.buildEnginePayloadForUser(userId);
    return {
      mode,
      configVersion: config.version,
      general: {
        betMin: config.general.betMin,
        betMax: config.general.betMax,
        targetMultiplierDefault: config.general.targetMultiplierDefault,
        goalMultiplierMin: config.general.goalMultiplierMin,
        goalMultiplierMax: config.general.goalMultiplierMax,
      },
      antiCheat: config.antiCheat as unknown as Record<string, number>,
      engineParams: params,
    };
  }
}
