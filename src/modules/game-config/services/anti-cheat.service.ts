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

    const platformsPerSecond = elapsedSeconds > 0 ? platformsPassed / elapsedSeconds : platformsPassed;
    if (platformsPerSecond > limits.maxPlatformsPerSecond) {
      return {
        flagged: true,
        reason: "platforms_per_second_exceeded",
        observed: { platformsPerSecond, limit: limits.maxPlatformsPerSecond },
      };
    }

    if (action === "cashout") {
      if (elapsedSeconds < limits.minSecondsToGoal) {
        return {
          flagged: true,
          reason: "goal_reached_too_fast",
          observed: { elapsedSeconds, limit: limits.minSecondsToGoal },
        };
      }
      if (elapsedSeconds < limits.minSecondsBeforeCashout) {
        return {
          flagged: true,
          reason: "cashout_too_fast",
          observed: { elapsedSeconds, limit: limits.minSecondsBeforeCashout },
        };
      }
    }

    if (input.reportedMaxVerticalSpeed !== undefined && input.reportedMaxVerticalSpeed > limits.maxVerticalSpeed) {
      return {
        flagged: true,
        reason: "vertical_speed_exceeded",
        observed: { value: input.reportedMaxVerticalSpeed, limit: limits.maxVerticalSpeed },
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
      };
    }

    if (input.reportedMaxAcceleration !== undefined && input.reportedMaxAcceleration > limits.maxAcceleration) {
      return {
        flagged: true,
        reason: "acceleration_exceeded",
        observed: { value: input.reportedMaxAcceleration, limit: limits.maxAcceleration },
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
      };
    }

    return { flagged: false };
  }
}
