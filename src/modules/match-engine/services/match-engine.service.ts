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
  CANONICAL_PROGRESS_GRACE,
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
    const { mode, configVersion, general, antiCheat, engineParams: params, maintenanceMode } =
      await this.gameConfig.resolveForUser(userId);

    if (maintenanceMode) {
      throw new BusinessRuleError("O jogo está em manutenção no momento. Tente novamente em instantes.");
    }

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
    // Compare-and-swap — a concurrent duplicate begin() (double-tap, network
    // retry) or a racing forfeit (AWAITING_START -> CANCELLED is also a
    // valid transition) could otherwise both pass the assertTransition
    // above and both write: a plain update() would let the loser silently
    // reset startedAt/updatedAt to a LATER timestamp and fire a duplicate
    // STARTED event. On CAS failure, return whatever the winner committed.
    const updated = await this.matches.updateIfStatusIn(matchId, [match.status], {
      status: "IN_PROGRESS",
      startedAt: now,
    });
    if (!updated) {
      const current = await this.matches.findById(matchId);
      if (!current) throw new NotFoundError("Match");
      return current;
    }

    await this.matchEvents.create({ matchId, type: "STARTED" });
    eventBus.publish(MATCH_ENGINE_EVENTS.started, { match: updated }, matchId);
    return updated;
  }

  async reportProgress(matchId: string, userId: string, input: MatchProgressInput): Promise<Match> {
    const match = await this.loadOwned(matchId, userId, input.token);
    if (!ACTIVE_STATUSES.includes(match.status) || match.status === "AWAITING_START") {
      throw new BusinessRuleError("Partida não está em andamento");
    }

    const now = new Date();
    const elapsedSeconds = this.elapsedSeconds(match);
    const progress = this.computeCanonicalProgress(match, input.platformsPassed, now);
    const antiCheat = this.runAntiCheat(match, "loss", input.platformsPassed, elapsedSeconds, progress, input);
    if (antiCheat?.flagged) {
      return this.invalidate(match, antiCheat.reason ?? "unknown", antiCheat.riskScore, userId);
    }

    // Multiplier/potentialPayout are derived EXCLUSIVELY from the server's
    // own canonical progress value (progress.canonical) — never from
    // input.platformsPassed directly. See computeCanonicalProgress's doc
    // comment: this is what makes the server, not the client, authoritative
    // over the number that determines the payout.
    const multiplier = getMultiplierForPlatforms(progress.canonical);
    const potentialPayout = Math.round(match.betAmount * multiplier);
    const goalReached = multiplier >= match.targetMultiplier - MULTIPLIER_EPSILON;

    let nextStatus = match.status;
    if (goalReached && match.status === "IN_PROGRESS") {
      assertTransition(match.status, "GOAL_REACHED");
      nextStatus = "GOAL_REACHED";
    }

    // Compare-and-swap, guarded to the EXACT status this call read at
    // loadOwned() above: without it, a stale reportProgress racing a
    // concurrent resolve()/invalidate() for the same match could silently
    // overwrite a status either of those just committed (e.g. resurrecting
    // a match anti-cheat just invalidated back to IN_PROGRESS) — a plain
    // update() has no way to detect that the row moved out from under it.
    // On CAS failure, someone else already won; return their committed row
    // and skip emitting a duplicate/incorrect event trail.
    let updated = await this.matches.updateIfStatusIn(matchId, [match.status], {
      status: nextStatus,
      platformsPassed: progress.canonical,
      multiplier,
      potentialPayout,
      longestStreak: Math.max(match.longestStreak, input.longestStreak ?? progress.canonical),
      collisionCount: input.collisionCount ?? match.collisionCount,
      avgSpeed: input.avgSpeed ?? match.avgSpeed,
      riskScore: antiCheat?.riskScore ?? match.riskScore,
    });
    if (!updated) {
      const current = await this.matches.findById(matchId);
      if (!current) throw new NotFoundError("Match");
      return current;
    }

    if (nextStatus === "GOAL_REACHED") {
      await this.matchEvents.create({
        matchId,
        type: "GOAL_REACHED",
        payload: { platformsPassed: progress.canonical, claimedPlatformsPassed: input.platformsPassed, multiplier },
      });
      eventBus.publish(MATCH_ENGINE_EVENTS.goalReached, { match: updated }, matchId);

      assertTransition(updated.status, "CASHOUT_AVAILABLE");
      // Our own CAS write above is what just set GOAL_REACHED, so this
      // promotion is uncontested in practice — CAS anyway for consistency
      // with every other status write in this file.
      const promoted = await this.matches.updateIfStatusIn(matchId, ["GOAL_REACHED"], { status: "CASHOUT_AVAILABLE" });
      if (promoted) updated = promoted;
    }

    await this.matchEvents.create({
      matchId,
      type: "PROGRESSED",
      payload: {
        platformsPassed: progress.canonical,
        claimedPlatformsPassed: input.platformsPassed,
        multiplier,
        potentialPayout,
        riskScore: updated.riskScore,
      },
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

    const now = new Date();
    const elapsedSeconds = this.elapsedSeconds(match);
    const progress = this.computeCanonicalProgress(match, input.platformsPassed, now);
    const action = input.action === "cashout" ? "cashout" : input.action === "forfeit" ? "forfeit" : "loss";
    const antiCheat = this.runAntiCheat(match, action, input.platformsPassed, elapsedSeconds, progress, input);
    if (antiCheat?.flagged) {
      return this.invalidate(match, antiCheat.reason ?? "unknown", antiCheat.riskScore, userId);
    }

    if (input.action === "loss" || input.action === "forfeit") {
      return this.resolveTermination(
        match,
        input,
        progress.canonical,
        input.action === "forfeit" ? "CANCELLED" : "LOST",
        elapsedSeconds
      );
    }
    return this.resolveCashout(match, input, progress.canonical, elapsedSeconds);
  }

  private async resolveTermination(
    match: Match,
    input: MatchResolveInput,
    canonicalPlatformsPassed: number,
    status: "LOST" | "CANCELLED",
    elapsedSeconds: number
  ): Promise<Match> {
    assertTransition(match.status, status);
    const multiplier = getMultiplierForPlatforms(canonicalPlatformsPassed);
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

    // Compare-and-swap (updateIfStatusIn, not plain update): a concurrent
    // resolve() for the same match could have already written a terminal
    // status between loadOwned() above and this write. If so, `updated` is
    // null and we fall back to returning the winner's already-committed row
    // — idempotent, no double MatchEvent trail. The wallet call above is
    // itself idempotent per-match (see IWalletLedger's idempotency-key
    // scheme), so a "lost" race here never double-refunds.
    const updated = await this.matches.updateIfStatusIn(match.id, [...ACTIVE_STATUSES], {
      status,
      platformsPassed: canonicalPlatformsPassed,
      multiplier,
      payout: 0,
      potentialPayout: 0,
      balanceAfter,
      resolvedAt: now,
      durationSeconds: Math.round(elapsedSeconds),
    });
    if (!updated) {
      const current = await this.matches.findById(match.id);
      if (!current) throw new NotFoundError("Match");
      return current;
    }

    await this.matchEvents.create({
      matchId: match.id,
      type: status === "LOST" ? "LOST" : "CANCELLED",
      payload: { platformsPassed: canonicalPlatformsPassed, claimedPlatformsPassed: input.platformsPassed },
    });
    eventBus.publish(status === "LOST" ? MATCH_ENGINE_EVENTS.lost : MATCH_ENGINE_EVENTS.cancelled, { match: updated }, match.id);
    return updated;
  }

  private async resolveCashout(
    match: Match,
    input: MatchResolveInput,
    canonicalPlatformsPassed: number,
    elapsedSeconds: number
  ): Promise<Match> {
    await this.matchEvents.create({
      matchId: match.id,
      type: "CASHOUT_REQUESTED",
      payload: { platformsPassed: canonicalPlatformsPassed, claimedPlatformsPassed: input.platformsPassed },
    });
    eventBus.publish(MATCH_ENGINE_EVENTS.cashoutRequested, { match }, match.id);

    if (match.status !== "CASHOUT_AVAILABLE") {
      await this.matchEvents.create({ matchId: match.id, type: "CASHOUT_DENIED", payload: { reason: "goal_not_reached" } });
      eventBus.publish(MATCH_ENGINE_EVENTS.cashoutDenied, { match, reason: "goal_not_reached" }, match.id);
      throw new BusinessRuleError("Meta ainda não atingida — o resgate está bloqueado.");
    }

    const multiplier = getMultiplierForPlatforms(canonicalPlatformsPassed);
    if (multiplier < match.targetMultiplier - MULTIPLIER_EPSILON) {
      await this.matchEvents.create({ matchId: match.id, type: "CASHOUT_DENIED", payload: { reason: "multiplier_below_target" } });
      eventBus.publish(MATCH_ENGINE_EVENTS.cashoutDenied, { match, reason: "multiplier_below_target" }, match.id);
      throw new BusinessRuleError("Meta ainda não atingida — o resgate está bloqueado.");
    }

    assertTransition(match.status, "CASHED_OUT");
    const payout = Math.round(match.betAmount * multiplier);
    const walletMove = await this.wallet.creditForPayout(match.userId, payout, match.id);
    const now = new Date();

    // See resolveTermination's comment on updateIfStatusIn — same
    // compare-and-swap, same wallet-idempotency backstop against a
    // concurrent double-resolve.
    const updated = await this.matches.updateIfStatusIn(match.id, [...ACTIVE_STATUSES], {
      status: "CASHED_OUT",
      platformsPassed: canonicalPlatformsPassed,
      multiplier,
      payout,
      potentialPayout: payout,
      balanceAfter: walletMove.balanceAfter,
      resolvedAt: now,
      durationSeconds: Math.round(elapsedSeconds),
    });
    if (!updated) {
      const current = await this.matches.findById(match.id);
      if (!current) throw new NotFoundError("Match");
      return current;
    }

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

    // Compare-and-swap here too — see resolveTermination's comment. A
    // concurrent resolve()/reportProgress() on the same match could have
    // already written a terminal status; if so, this is a no-op refund
    // attempt (wallet idempotency-keyed, safe) and we return the winner's row.
    const updated = await this.matches.updateIfStatusIn(match.id, [...ACTIVE_STATUSES], {
      status: "INVALIDATED",
      payout: 0,
      potentialPayout: 0,
      balanceAfter,
      resolvedAt: now,
      durationSeconds: Math.round(this.elapsedSeconds(match)),
      riskScore,
      invalidationReason: reason,
    });
    if (!updated) {
      const current = await this.matches.findById(match.id);
      if (!current) throw new NotFoundError("Match");
      return current;
    }

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

  /**
   * The server's own authoritative view of match progress.
   * `claimedPlatformsPassed` (whatever the client just sent) is a claim,
   * never a fact — this computes what's actually achievable since the last
   * server-recorded checkpoint (`match.updatedAt` / `match.platformsPassed`,
   * both already updated on every prior write, so no new column is needed)
   * using the admin-configured `AntiCheatConfig.maxPlatformsPerSecond`
   * applied PER INTERVAL rather than as a whole-match average. A claim can
   * never push the canonical value past what real elapsed wall-clock time
   * (measured by the server, not reported by the client) permits, and the
   * result only ever moves forward (`Math.max` floor at the previous
   * canonical value) — so a stray lower resubmission can't regress it.
   *
   * `reportProgress`/`resolve` use ONLY the returned `canonical` value to
   * compute the multiplier/payout — `claimedPlatformsPassed` itself never
   * reaches `getMultiplierForPlatforms`. `intervalSeconds`/`intervalClaimed`
   * are handed to AntiCheatService so blatant (not just borderline) claims
   * still invalidate the match, not merely get clamped away.
   */
  private computeCanonicalProgress(
    match: Match,
    claimedPlatformsPassed: number,
    now: Date
  ): { canonical: number; intervalSeconds: number; intervalClaimed: number } {
    const previousCanonical = match.platformsPassed;
    const intervalSeconds = Math.max(0, (now.getTime() - match.updatedAt.getTime()) / 1000);
    const limit = (match.antiCheatSnapshot as unknown as AntiCheatConfig | null)?.maxPlatformsPerSecond;
    const maxDelta =
      limit === undefined || !Number.isFinite(limit)
        ? Infinity
        : Math.floor(intervalSeconds * limit) + CANONICAL_PROGRESS_GRACE;
    const intervalClaimed = Math.max(0, claimedPlatformsPassed - previousCanonical);
    const canonical = Math.max(previousCanonical, Math.min(claimedPlatformsPassed, previousCanonical + maxDelta));
    return { canonical, intervalSeconds, intervalClaimed };
  }

  private runAntiCheat(
    match: Match,
    action: "cashout" | "loss" | "forfeit",
    platformsPassed: number,
    elapsedSeconds: number,
    progress: { intervalSeconds: number; intervalClaimed: number },
    telemetry: {
      maxVerticalSpeed?: number;
      /**
       * Raw contact count. The collisions/second RATE is derived inside
       * AntiCheatService from this and the server-measured elapsed time —
       * the client is never asked for, and never trusted with, a rate.
       */
      collisionCount?: number;
    }
  ) {
    if (!match.antiCheatSnapshot) return null;
    const { antiCheatService } = gameConfigContainer;
    return antiCheatService.check({
      action,
      platformsPassed,
      elapsedSeconds,
      intervalPlatformsClaimed: progress.intervalClaimed,
      intervalSeconds: progress.intervalSeconds,
      reportedMaxVerticalSpeed: telemetry.maxVerticalSpeed,
      reportedCollisionCount: telemetry.collisionCount,
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
