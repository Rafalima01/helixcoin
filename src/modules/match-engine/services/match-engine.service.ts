import type { IMatchRepository } from "@/modules/match-engine/interfaces/match-repository.interface";
import type { IMatchEventRepository } from "@/modules/match-engine/interfaces/match-event-repository.interface";
import type { IWalletLedger } from "@/modules/match-engine/interfaces/wallet-ledger.interface";
import type { IGameConfigResolver } from "@/modules/match-engine/interfaces/game-config-resolver.interface";
import type { Match } from "@/modules/match-engine/entities/match.entity";
import type {
  CreateMatchInput as ValidatedCreateInput,
  MatchProgressInput,
  MatchResolveInput,
} from "@/modules/match-engine/validators/match.validator";
import { assertTransition, ACTIVE_STATUSES } from "@/modules/match-engine/utils/match-state-machine";
import { generateMatchToken, verifyMatchToken } from "@/modules/match-engine/utils/match-token.util";
import { generateMatchNumber } from "@/modules/match-engine/utils/match-number.util";
import {
  ENGINE_VERSION,
  MULTIPLIER_EPSILON,
  ANTI_CHEAT_INVALIDATION_POLICY,
} from "@/modules/match-engine/constants/match-engine.constants";
import { MATCH_ENGINE_EVENTS } from "@/modules/match-engine/events/match-engine.events";
import { getMultiplierForPlatforms, roundToCents } from "@/lib/multiplier";
import { gameConfigContainer } from "@/modules/game-config/container";
import { recordAntiCheatViolation } from "@/modules/game-config/services/anti-cheat-violation-recorder";
import { currentPreset } from "@/modules/game-config/utils/difficulty-preset.util";
import type { AntiCheatConfig } from "@/modules/game-config/entities/game-economy-config.entity";
import { NotFoundError, ForbiddenError, BusinessRuleError } from "@/server/errors";
import { eventBus } from "@/server/events";
import { createChildLogger } from "@/server/logger";

const logger = createChildLogger({ module: "match-engine.service" });

export interface RequestMeta {
  ip: string | null;
  userAgent: string | null;
  device: string | null;
  os: string | null;
}

export interface CreatedMatch {
  match: Match;
  token: string;
}

/**
 * The one place a match is created, played through, and resolved. Every
 * mutation goes through `assertTransition` before touching the repository,
 * every mutation writes a MatchEvent and publishes on the existing
 * `eventBus` — see this module's README for the full transition diagram.
 *
 * Depends on repository INTERFACES only (constructor injection) — never
 * imports Prisma directly, same discipline as every other module's service
 * (see tests/match-engine.service.test.ts, which injects the in-memory
 * repositories from this module).
 */
export class MatchEngineService {
  constructor(
    private readonly matches: IMatchRepository,
    private readonly matchEvents: IMatchEventRepository,
    private readonly wallet: IWalletLedger,
    private readonly gameConfig: IGameConfigResolver
  ) {}

  async create(userId: string, input: ValidatedCreateInput, meta: RequestMeta): Promise<CreatedMatch> {
    const { mode, configVersion, general, antiCheat, engineParams: params } = await this.gameConfig.resolveForUser(userId);

    const betAmountCents = roundToCents(input.amount);
    if (betAmountCents < general.betMin || betAmountCents > general.betMax) {
      throw new BusinessRuleError("Valor de aposta fora dos limites permitidos");
    }

    const targetMultiplier = general.targetMultiplierDefault;
    const goalAmount = Math.round(betAmountCents * targetMultiplier);
    const preset = currentPreset(params);
    const { token, tokenHash } = generateMatchToken();
    const seed = `${userId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    // Pre-generated so the bet debit (which happens before the Match row
    // exists) has a real matchId to key its idempotency key/ledger
    // reference off of — same precedent as matchNumber/tokenHash.
    const matchId = crypto.randomUUID();

    // Debit BEFORE creating the row — if this throws (insufficient
    // balance), nothing is ever persisted. Not wrapped in a single DB
    // transaction with the create() below: the wallet and the match
    // repository are separate modules by design (same architectural
    // tradeoff every other cross-repository flow in this codebase already
    // has, e.g. resolveCashout's credit-then-update). A crash between the
    // two would leave a debited wallet with no match row — rare, and a
    // real reconciliation/outbox pattern is out of scope for this phase.
    const walletMove = await this.wallet.debitForBet(userId, betAmountCents, matchId);

    let match = await this.matches.create({
      id: matchId,
      matchNumber: generateMatchNumber(),
      userId,
      betAmount: betAmountCents,
      goalAmount,
      balanceBefore: walletMove.balanceBefore,
      seed,
      tokenHash,
      targetMultiplier,
      mode,
      configVersion,
      presetKey: preset?.key ?? null,
      engineParams: params,
      goalSnapshot: {
        targetMultiplierDefault: general.targetMultiplierDefault,
        goalMultiplierMin: general.goalMultiplierMin,
        goalMultiplierMax: general.goalMultiplierMax,
        betMin: general.betMin,
        betMax: general.betMax,
      },
      antiCheatSnapshot: antiCheat,
      engineVersion: ENGINE_VERSION,
      ip: meta.ip,
      userAgent: meta.userAgent,
      device: meta.device,
      os: meta.os,
    });

    await this.matchEvents.create({ matchId: match.id, type: "CREATED", payload: { mode, betAmount: betAmountCents } });
    eventBus.publish(MATCH_ENGINE_EVENTS.created, { match }, match.id);

    assertTransition(match.status, "AWAITING_START");
    match = await this.matches.update(match.id, { status: "AWAITING_START" });

    logger.info({ matchId: match.id, userId, mode, betAmountCents }, "match created");
    return { match, token };
  }

  async begin(matchId: string, userId: string, token: string): Promise<Match> {
    const match = await this.loadOwned(matchId, userId, token);
    assertTransition(match.status, "IN_PROGRESS");

    const now = new Date();
    const updated = await this.matches.update(matchId, { status: "IN_PROGRESS", startedAt: now });

    await this.matchEvents.create({ matchId, type: "STARTED" });
    eventBus.publish(MATCH_ENGINE_EVENTS.started, { match: updated }, matchId);
    return updated;
  }

  async reportProgress(matchId: string, userId: string, input: MatchProgressInput): Promise<Match> {
    const match = await this.loadOwned(matchId, userId, input.token);
    if (!ACTIVE_STATUSES.includes(match.status) || match.status === "AWAITING_START") {
      throw new BusinessRuleError("Partida não está em andamento");
    }

    const elapsedSeconds = this.elapsedSeconds(match);
    const antiCheat = this.runAntiCheat(match, "loss", input.platformsPassed, elapsedSeconds, input);
    if (antiCheat?.flagged) {
      return this.invalidate(match, antiCheat.reason ?? "unknown", antiCheat.riskScore, userId);
    }

    const multiplier = getMultiplierForPlatforms(input.platformsPassed);
    const potentialPayout = Math.round(match.betAmount * multiplier);
    const goalReached = multiplier >= match.targetMultiplier - MULTIPLIER_EPSILON;

    let nextStatus = match.status;
    if (goalReached && match.status === "IN_PROGRESS") {
      assertTransition(match.status, "GOAL_REACHED");
      nextStatus = "GOAL_REACHED";
    }

    let updated = await this.matches.update(matchId, {
      status: nextStatus,
      platformsPassed: input.platformsPassed,
      multiplier,
      potentialPayout,
      longestStreak: Math.max(match.longestStreak, input.longestStreak ?? input.platformsPassed),
      collisionCount: input.collisionCount ?? match.collisionCount,
      avgSpeed: input.avgSpeed ?? match.avgSpeed,
      riskScore: antiCheat?.riskScore ?? match.riskScore,
    });

    if (nextStatus === "GOAL_REACHED") {
      await this.matchEvents.create({ matchId, type: "GOAL_REACHED", payload: { platformsPassed: input.platformsPassed, multiplier } });
      eventBus.publish(MATCH_ENGINE_EVENTS.goalReached, { match: updated }, matchId);

      assertTransition(updated.status, "CASHOUT_AVAILABLE");
      updated = await this.matches.update(matchId, { status: "CASHOUT_AVAILABLE" });
    }

    await this.matchEvents.create({
      matchId,
      type: "PROGRESSED",
      payload: { platformsPassed: input.platformsPassed, multiplier, potentialPayout, riskScore: updated.riskScore },
    });
    eventBus.publish(MATCH_ENGINE_EVENTS.progressed, { match: updated }, matchId);

    return updated;
  }

  async resolve(matchId: string, userId: string, input: MatchResolveInput): Promise<Match> {
    const match = await this.loadOwned(matchId, userId, input.token);

    if (!ACTIVE_STATUSES.includes(match.status)) {
      // Already resolved — idempotent read, matches the previous route's behavior.
      return match;
    }

    const elapsedSeconds = this.elapsedSeconds(match);
    const action = input.action === "cashout" ? "cashout" : input.action === "forfeit" ? "forfeit" : "loss";
    const antiCheat = this.runAntiCheat(match, action, input.platformsPassed, elapsedSeconds, input);
    if (antiCheat?.flagged) {
      return this.invalidate(match, antiCheat.reason ?? "unknown", antiCheat.riskScore, userId);
    }

    if (input.action === "loss" || input.action === "forfeit") {
      return this.resolveTermination(match, input, input.action === "forfeit" ? "CANCELLED" : "LOST", elapsedSeconds);
    }
    return this.resolveCashout(match, input, elapsedSeconds);
  }

  private async resolveTermination(
    match: Match,
    input: MatchResolveInput,
    status: "LOST" | "CANCELLED",
    elapsedSeconds: number
  ): Promise<Match> {
    assertTransition(match.status, status);
    const multiplier = getMultiplierForPlatforms(input.platformsPassed);
    const now = new Date();

    // CANCELLED ("forfeit") refunds the bet — the wallet was debited at
    // create() and nothing has credited it back until now. LOST keeps the
    // debit (spec: nothing happens on a loss), so balanceAfter there is
    // genuinely just the unchanged balanceBefore, not a placeholder.
    let balanceAfter = match.balanceBefore;
    if (status === "CANCELLED") {
      const walletMove = await this.wallet.refundBet(match.userId, match.betAmount, match.id, "forfeit");
      balanceAfter = walletMove.balanceAfter;
    }

    const updated = await this.matches.update(match.id, {
      status,
      platformsPassed: input.platformsPassed,
      multiplier,
      payout: 0,
      potentialPayout: 0,
      balanceAfter,
      resolvedAt: now,
      durationSeconds: Math.round(elapsedSeconds),
    });

    await this.matchEvents.create({ matchId: match.id, type: status === "LOST" ? "LOST" : "CANCELLED", payload: { platformsPassed: input.platformsPassed } });
    eventBus.publish(status === "LOST" ? MATCH_ENGINE_EVENTS.lost : MATCH_ENGINE_EVENTS.cancelled, { match: updated }, match.id);
    return updated;
  }

  private async resolveCashout(match: Match, input: MatchResolveInput, elapsedSeconds: number): Promise<Match> {
    await this.matchEvents.create({ matchId: match.id, type: "CASHOUT_REQUESTED", payload: { platformsPassed: input.platformsPassed } });
    eventBus.publish(MATCH_ENGINE_EVENTS.cashoutRequested, { match }, match.id);

    if (match.status !== "CASHOUT_AVAILABLE") {
      await this.matchEvents.create({ matchId: match.id, type: "CASHOUT_DENIED", payload: { reason: "goal_not_reached" } });
      eventBus.publish(MATCH_ENGINE_EVENTS.cashoutDenied, { match, reason: "goal_not_reached" }, match.id);
      throw new BusinessRuleError("Meta ainda não atingida — o resgate está bloqueado.");
    }

    const multiplier = getMultiplierForPlatforms(input.platformsPassed);
    if (multiplier < match.targetMultiplier - MULTIPLIER_EPSILON) {
      await this.matchEvents.create({ matchId: match.id, type: "CASHOUT_DENIED", payload: { reason: "multiplier_below_target" } });
      eventBus.publish(MATCH_ENGINE_EVENTS.cashoutDenied, { match, reason: "multiplier_below_target" }, match.id);
      throw new BusinessRuleError("Meta ainda não atingida — o resgate está bloqueado.");
    }

    assertTransition(match.status, "CASHED_OUT");
    const payout = Math.round(match.betAmount * multiplier);
    const walletMove = await this.wallet.creditForPayout(match.userId, payout, match.id);
    const now = new Date();

    const updated = await this.matches.update(match.id, {
      status: "CASHED_OUT",
      platformsPassed: input.platformsPassed,
      multiplier,
      payout,
      potentialPayout: payout,
      balanceAfter: walletMove.balanceAfter,
      resolvedAt: now,
      durationSeconds: Math.round(elapsedSeconds),
    });

    await this.matchEvents.create({ matchId: match.id, type: "CASHOUT_APPROVED", payload: { payout, multiplier } });
    eventBus.publish(MATCH_ENGINE_EVENTS.cashoutApproved, { match: updated }, match.id);
    await this.matchEvents.create({ matchId: match.id, type: "COMPLETED", payload: { payout } });
    eventBus.publish(MATCH_ENGINE_EVENTS.completed, { match: updated }, match.id);

    return updated;
  }

  private async invalidate(match: Match, reason: string, riskScore: number, userId: string): Promise<Match> {
    assertTransition(match.status, "INVALIDATED");
    const now = new Date();

    // ANTI_CHEAT_INVALIDATION_POLICY (currently the only implemented
    // policy): refund just the bet, never the full potential payout.
    let balanceAfter = match.balanceBefore;
    if (ANTI_CHEAT_INVALIDATION_POLICY === "refund_bet_only") {
      const walletMove = await this.wallet.refundBet(match.userId, match.betAmount, match.id, "anti_cheat_invalidation");
      balanceAfter = walletMove.balanceAfter;
    }

    const updated = await this.matches.update(match.id, {
      status: "INVALIDATED",
      payout: 0,
      potentialPayout: 0,
      balanceAfter,
      resolvedAt: now,
      durationSeconds: Math.round(this.elapsedSeconds(match)),
      riskScore,
      invalidationReason: reason,
    });

    await this.matchEvents.create({ matchId: match.id, type: "INVALIDATED", payload: { reason, riskScore } });
    eventBus.publish(MATCH_ENGINE_EVENTS.invalidated, { match: updated }, match.id);

    if (match.antiCheatSnapshot) {
      await recordAntiCheatViolation({
        userId,
        matchId: match.id,
        result: { flagged: true, reason, riskScore },
        limits: match.antiCheatSnapshot,
      });
    }

    return updated;
  }

  private runAntiCheat(
    match: Match,
    action: "cashout" | "loss" | "forfeit",
    platformsPassed: number,
    elapsedSeconds: number,
    telemetry: {
      maxVerticalSpeed?: number;
      maxHorizontalSpeed?: number;
      maxAcceleration?: number;
      collisionsPerSecond?: number;
    }
  ) {
    if (!match.antiCheatSnapshot) return null;
    const { antiCheatService } = gameConfigContainer;
    return antiCheatService.check({
      action,
      platformsPassed,
      elapsedSeconds,
      reportedMaxVerticalSpeed: telemetry.maxVerticalSpeed,
      reportedMaxHorizontalSpeed: telemetry.maxHorizontalSpeed,
      reportedMaxAcceleration: telemetry.maxAcceleration,
      reportedCollisionsPerSecond: telemetry.collisionsPerSecond,
      limits: match.antiCheatSnapshot as unknown as AntiCheatConfig,
    });
  }

  private elapsedSeconds(match: Match): number {
    const from = match.startedAt ?? match.createdAt;
    return (Date.now() - from.getTime()) / 1000;
  }

  private async loadOwned(matchId: string, userId: string, token: string): Promise<Match> {
    const match = await this.matches.findById(matchId);
    if (!match || match.userId !== userId) throw new NotFoundError("Match");
    if (!verifyMatchToken(match.tokenHash, token)) throw new ForbiddenError("Token de partida inválido");
    return match;
  }

  async listForUser(userId: string, limit: number) {
    return this.matches.listForUser(userId, limit);
  }

  async getDetailForAdmin(matchId: string) {
    const match = await this.matches.findById(matchId);
    if (!match) throw new NotFoundError("Match");
    const events = await this.matchEvents.listForMatch(matchId);
    return { match, events };
  }

  async listForAdmin(filter: Parameters<IMatchRepository["listAdmin"]>[0]) {
    return this.matches.listAdmin(filter);
  }
}
