import type { AntiCheatConfig } from "@/modules/game-config/entities/game-economy-config.entity";

export interface CheckResolveInput {
  action: "cashout" | "loss" | "forfeit";
  platformsPassed: number;
  /** Seconds since the match started. */
  elapsedSeconds: number;
  /** Optional client-reported telemetry — absent values simply skip that check. */
  reportedMaxVerticalSpeed?: number;
  reportedMaxHorizontalSpeed?: number;
  reportedMaxAcceleration?: number;
  reportedCollisionsPerSecond?: number;
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

  if (action === "cashout") {
    ratios.push(floorRatio(elapsedSeconds, limits.minSecondsToGoal));
    ratios.push(floorRatio(elapsedSeconds, limits.minSecondsBeforeCashout));
  }
  if (input.reportedMaxVerticalSpeed !== undefined) {
    ratios.push(ratio(input.reportedMaxVerticalSpeed, limits.maxVerticalSpeed));
  }
  if (input.reportedMaxHorizontalSpeed !== undefined) {
    ratios.push(ratio(input.reportedMaxHorizontalSpeed, limits.maxHorizontalSpeed));
  }
  if (input.reportedMaxAcceleration !== undefined) {
    ratios.push(ratio(input.reportedMaxAcceleration, limits.maxAcceleration));
  }
  if (input.reportedCollisionsPerSecond !== undefined) {
    ratios.push(ratio(input.reportedCollisionsPerSecond, limits.maxCollisionsPerSecond));
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

    if (
      input.reportedMaxHorizontalSpeed !== undefined &&
      input.reportedMaxHorizontalSpeed > limits.maxHorizontalSpeed
    ) {
      return {
        flagged: true,
        reason: "horizontal_speed_exceeded",
        observed: { value: input.reportedMaxHorizontalSpeed, limit: limits.maxHorizontalSpeed },
        riskScore,
      };
    }

    if (input.reportedMaxAcceleration !== undefined && input.reportedMaxAcceleration > limits.maxAcceleration) {
      return {
        flagged: true,
        reason: "acceleration_exceeded",
        observed: { value: input.reportedMaxAcceleration, limit: limits.maxAcceleration },
        riskScore,
      };
    }

    if (
      input.reportedCollisionsPerSecond !== undefined &&
      input.reportedCollisionsPerSecond > limits.maxCollisionsPerSecond
    ) {
      return {
        flagged: true,
        reason: "collision_rate_exceeded",
        observed: { value: input.reportedCollisionsPerSecond, limit: limits.maxCollisionsPerSecond },
        riskScore,
      };
    }

    return { flagged: false, riskScore };
  }
}
