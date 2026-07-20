import type {
  IPlayerEconomySnapshotRepository,
  PlayerEconomySnapshot,
} from "@/modules/game-config/interfaces/player-economy-snapshot-repository.interface";

/** In-memory implementation for tests — set snapshots directly via `.set(userId, snapshot)`. */
export class InMemoryPlayerEconomySnapshotRepository implements IPlayerEconomySnapshotRepository {
  private readonly snapshots = new Map<string, PlayerEconomySnapshot>();

  set(userId: string, snapshot: PlayerEconomySnapshot): void {
    this.snapshots.set(userId, snapshot);
  }

  async getSnapshot(userId: string): Promise<PlayerEconomySnapshot> {
    return this.snapshots.get(userId) ?? { tags: [], balance: 0, totalWithdrawn: 0 };
  }
}
