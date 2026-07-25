import { PrismaMatchRepository } from "@/modules/match-engine/repositories/match.prisma-repository";
import { PrismaMatchEventRepository } from "@/modules/match-engine/repositories/match-event.prisma-repository";
import { PrismaWalletLedger } from "@/modules/match-engine/repositories/wallet-ledger.prisma-repository";
import { GameConfigResolver } from "@/modules/match-engine/repositories/game-config-resolver.prisma-repository";
import { MatchEngineService } from "@/modules/match-engine/services/match-engine.service";

const matches = new PrismaMatchRepository();
const matchEvents = new PrismaMatchEventRepository();
const wallet = new PrismaWalletLedger();
const gameConfig = new GameConfigResolver();

/** Module-scope singletons — controllers import from here. */
export const matchEngineContainer = {
  matchEngineService: new MatchEngineService(matches, matchEvents, wallet, gameConfig),
};
