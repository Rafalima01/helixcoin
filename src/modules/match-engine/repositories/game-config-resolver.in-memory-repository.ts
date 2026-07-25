import type {
  IGameConfigResolver,
  ResolvedMatchConfig,
} from "@/modules/match-engine/interfaces/game-config-resolver.interface";

/** In-memory implementation for tests — set the response any test needs via the constructor, or per-user via `.set()`. */
export class FakeGameConfigResolver implements IGameConfigResolver {
  private readonly perUser = new Map<string, ResolvedMatchConfig>();

  constructor(private readonly defaultConfig: ResolvedMatchConfig) {}

  set(userId: string, config: ResolvedMatchConfig): void {
    this.perUser.set(userId, config);
  }

  async resolveForUser(userId: string): Promise<ResolvedMatchConfig> {
    return this.perUser.get(userId) ?? this.defaultConfig;
  }
}
