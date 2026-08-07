import type { AntiCheatConfig } from "@/modules/game-config/entities/game-economy-config.entity";

export interface CheckResolveInput {
  action: "cashout" | "loss" | "forfeit";
  platformsPassed: number;
  /** Seconds since the match started. */
  elapsedSeconds: number;
  /** Optional client-reported telemetry — absent values simply skip that check. */
  reportedMaxVerticalSpeed?: number;
  /**
   * Raw contact COUNT for the match. The collisions-per-second rate is
   * derived here, server-side, from this and `elapsedSeconds` — the client
   * never sends a rate. A rate is exactly the kind of value a bot would
   * forge (report 2/s while actually auto-clicking at 40/s); a raw count
   * cross-checked against the server's own clock is much harder to fake
   * without also faking the wall-clock the server measured itself.
   */
  reportedCollisionCount?: number;
  /**
   * Progress claimed since the server's own previous checkpoint for this
   * match (not since match start) — see MatchEngineService.computeCanonicalProgress,
   * the caller that populates these. `platformsPassed`/`elapsedSeconds` above
   * only catch a whole-match AVERAGE, which a script can defeat by waiting
   * out the clock before reporting a burst; this pair catches the burst
   * itself, regardless of how much total time has passed.
   */
  intervalPlatformsClaimed?: number;
  intervalSeconds?: number;
  limits: AntiCheatConfig;
}

export interface CheckResolveResult {
  flagged: boolean;
  reason?: string;
  observed?: Record<string, number>;
  /**
   * 0-100 — highest observed/limit ratio across every dimension checked,
   * populated even when `flagged` is false (e.g. 45 = "somewhat fast, but
   * under threshold"). Used by src/modules/match-engine to record a
   * continuous risk signal on every match, not just a boolean.
   */
  riskScore: number;
}

/**
 * Slack applied only to the interval-rate INVALIDATION gate below (never to
 * the canonical payout clamp in MatchEngineService, which stays exact) — a
 * measurement-tolerance constant for checkpoint-timing/network jitter
 * between two consecutive reports, not a business/difficulty knob. Keeping
 * it here (not admin-configurable) mirrors how `MULTIPLIER_EPSILON` is a
 * fixed float-noise absorber rather than a tunable field.
 */
const INTERVAL_RATE_TOLERANCE = 1.5;

function ratio(observed: number, limit: number): number {
  if (limit <= 0) return observed > 0 ? 1 : 0;
  return observed / limit;
}

/** For "must be at least this much elapsed time" floors — the violation is being UNDER the limit, so the ratio grows as elapsed approaches 0. */
function floorRatio(elapsedSeconds: number, minSeconds: number): number {
  if (minSeconds <= 0) return 0;
  if (elapsedSeconds >= minSeconds) return 0;
  return minSeconds / Math.max(elapsedSeconds, 0.001);
}

/**
 * Server-derived collisions/second, or null when it can't be computed
 * honestly. Returning null (instead of a large number) for a non-positive or
 * non-finite elapsed time is deliberate: a 0s match would divide by zero and
 * flag every player whose clock happened to round down, which would punish
 * the honest case to catch a case `maxPlatformsPerSecond` already covers.
 */
export function deriveCollisionsPerSecond(
  collisionCount: number | undefined,
  elapsedSeconds: number
): number | null {
  if (collisionCount === undefined) return null;
  if (!Number.isFinite(collisionCount) || collisionCount < 0) return null;
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0) return null;
  return collisionCount / elapsedSeconds;
}

/**
 * Continuous risk signal (0-100), independent of the pass/fail gate below —
 * computed from the same inputs/limits, but never short-circuits, so it
 * reflects the single worst dimension even when nothing crossed its
 * threshold. Kept as a separate pure function so the existing, already-
 * tested gating logic in `check()` never has to change shape.
 */
function computeRiskScore(input: CheckResolveInput): number {
  const { limits, elapsedSeconds, platformsPassed, action } = input;
  const ratios: number[] = [];

  const platformsPerSecond = elapsedSeconds > 0 ? platformsPassed / elapsedSeconds : platformsPassed;
  ratios.push(ratio(platformsPerSecond, limits.maxPlatformsPerSecond));

  if (input.intervalSeconds !== undefined && input.intervalPlatformsClaimed !== undefined) {
    const intervalRate =
      input.intervalSeconds > 0 ? input.intervalPlatformsClaimed / input.intervalSeconds : input.intervalPlatformsClaimed;
    ratios.push(ratio(intervalRate, limits.maxPlatformsPerSecond));
  }

  if (action === "cashout") {
    ratios.push(floorRatio(elapsedSeconds, limits.minSecondsToGoal));
    ratios.push(floorRatio(elapsedSeconds, limits.minSecondsBeforeCashout));
  }
  if (input.reportedMaxVerticalSpeed !== undefined) {
    ratios.push(ratio(input.reportedMaxVerticalSpeed, limits.maxVerticalSpeed));
  }

  const collisionsPerSecond = deriveCollisionsPerSecond(input.reportedCollisionCount, elapsedSeconds);
  if (collisionsPerSecond !== null) {
    ratios.push(ratio(collisionsPerSecond, limits.maxCollisionsPerSecond));
  }

  const maxRatio = ratios.length > 0 ? Math.max(...ratios) : 0;
  return Math.max(0, Math.min(100, Math.round(maxRatio * 100)));
}

/**
 * Heuristic, server-side-only anti-cheat: rate limits and plausibility
 * bounds against the values snapshotted on the match at start time. This is
 * intentionally NOT trying to detect DevTools/FPS-manipulation/memory-hacks
 * client-side — that's not achievable from an untrusted browser and would
 * be a false sense of security. What IS achievable, and is what this
 * implements: reject and flag resolutions that are statistically
 * implausible given the elapsed wall-clock time and the configured limits.
 *
 * Pure and stateless — no repository, no Prisma — so it's fully unit
 * tested without a database (see tests/anti-cheat.service.test.ts). Side
 * effects for a flagged result (audit log, admin notification, user tag)
 * are the caller's job — see `recordAntiCheatViolation` below.
 */
export class AntiCheatService {
  check(input: CheckResolveInput): CheckResolveResult {
    const { limits, elapsedSeconds, platformsPassed, action } = input;
    const riskScore = computeRiskScore(input);

    const platformsPerSecond = elapsedSeconds > 0 ? platformsPassed / elapsedSeconds : platformsPassed;
    if (platformsPerSecond > limits.maxPlatformsPerSecond) {
      return {
        flagged: true,
        reason: "platforms_per_second_exceeded",
        observed: { platformsPerSecond, limit: limits.maxPlatformsPerSecond },
        riskScore,
      };
    }

    if (input.intervalSeconds !== undefined && input.intervalPlatformsClaimed !== undefined) {
      const intervalRate =
        input.intervalSeconds > 0 ? input.intervalPlatformsClaimed / input.intervalSeconds : input.intervalPlatformsClaimed;
      if (intervalRate > limits.maxPlatformsPerSecond * INTERVAL_RATE_TOLERANCE) {
        return {
          flagged: true,
          reason: "platforms_per_interval_exceeded",
          observed: { intervalRate, limit: limits.maxPlatformsPerSecond },
          riskScore,
        };
      }
    }

    if (action === "cashout") {
      if (elapsedSeconds < limits.minSecondsToGoal) {
        return {
          flagged: true,
          reason: "goal_reached_too_fast",
          observed: { elapsedSeconds, limit: limits.minSecondsToGoal },
          riskScore,
        };
      }
      if (elapsedSeconds < limits.minSecondsBeforeCashout) {
        return {
          flagged: true,
          reason: "cashout_too_fast",
          observed: { elapsedSeconds, limit: limits.minSecondsBeforeCashout },
          riskScore,
        };
      }
    }

    if (input.reportedMaxVerticalSpeed !== undefined && input.reportedMaxVerticalSpeed > limits.maxVerticalSpeed) {
      return {
        flagged: true,
        reason: "vertical_speed_exceeded",
        observed: { value: input.reportedMaxVerticalSpeed, limit: limits.maxVerticalSpeed },
        riskScore,
      };
    }

    // Rate derived here from the raw count and the server's own elapsed
    // clock — never taken from the client. Strictly greater-than, so a match
    // sitting exactly on the configured limit passes (consistent with every
    // other ceiling check above).
    const collisionsPerSecond = deriveCollisionsPerSecond(input.reportedCollisionCount, elapsedSeconds);
    if (collisionsPerSecond !== null && collisionsPerSecond > limits.maxCollisionsPerSecond) {
      return {
        flagged: true,
        reason: "collision_rate_exceeded",
        observed: {
          collisionsPerSecond,
          collisionCount: input.reportedCollisionCount ?? 0,
          elapsedSeconds,
          limit: limits.maxCollisionsPerSecond,
        },
        riskScore,
      };
    }

    return { flagged: false, riskScore };
  }
}
