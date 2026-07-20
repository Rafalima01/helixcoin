import { PrismaGameEconomyConfigRepository } from "@/modules/game-config/repositories/game-economy-config.prisma-repository";
import { PrismaPlayerEconomySnapshotRepository } from "@/modules/game-config/repositories/player-economy-snapshot.prisma-repository";
import { GameConfigService } from "@/modules/game-config/services/game-config.service";
import { AntiCheatService } from "@/modules/game-config/services/anti-cheat.service";

const configs = new PrismaGameEconomyConfigRepository();
const playerSnapshots = new PrismaPlayerEconomySnapshotRepository();

/** Module-scope singletons — controllers and other modules' runtime integration import from here. */
export const gameConfigContainer = {
  gameConfigService: new GameConfigService(configs, playerSnapshots),
  antiCheatService: new AntiCheatService(),
};
