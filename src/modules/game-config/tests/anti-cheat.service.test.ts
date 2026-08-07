import { describe, expect, it } from "vitest";
import { AntiCheatService } from "@/modules/game-config/services/anti-cheat.service";
import { buildDefaultAntiCheat } from "@/modules/game-config/utils/config-defaults.util";

const limits = buildDefaultAntiCheat();
const service = new AntiCheatService();

describe("AntiCheatService", () => {
  it("does not flag a plausible loss", () => {
    const result = service.check({
      action: "loss",
      platformsPassed: 10,
      elapsedSeconds: 20,
      limits,
    });
    expect(result.flagged).toBe(false);
  });

  it("flags a progress rate faster than maxPlatformsPerSecond", () => {
    const result = service.check({
      action: "loss",
      platformsPassed: 100,
      elapsedSeconds: 1,
      limits,
    });
    expect(result.flagged).toBe(true);
    expect(result.reason).toBe("platforms_per_second_exceeded");
  });

  it("flags a cashout attempted before minSecondsToGoal has elapsed", () => {
    const result = service.check({
      action: "cashout",
      platformsPassed: 5,
      elapsedSeconds: limits.minSecondsToGoal - 1,
      limits,
    });
    expect(result.flagged).toBe(true);
    expect(result.reason).toBe("goal_reached_too_fast");
  });

  it("does not flag a cashout that respects both minimum-time thresholds", () => {
    const result = service.check({
      action: "cashout",
      platformsPassed: 5,
      elapsedSeconds: Math.max(limits.minSecondsToGoal, limits.minSecondsBeforeCashout) + 1,
      limits,
    });
    expect(result.flagged).toBe(false);
  });

  it("flags reported vertical speed above the configured limit", () => {
    const result = service.check({
      action: "loss",
      platformsPassed: 1,
      elapsedSeconds: 10,
      reportedMaxVerticalSpeed: limits.maxVerticalSpeed + 1,
      limits,
    });
    expect(result.flagged).toBe(true);
    expect(result.reason).toBe("vertical_speed_exceeded");
  });

  describe("collision rate (server-derived, never client-reported)", () => {
    /** Build a match whose derived rate is exactly `rate` collisions/second. */
    function checkAtRate(rate: number, elapsedSeconds = 10) {
      return service.check({
        action: "loss",
        platformsPassed: 1,
        elapsedSeconds,
        reportedCollisionCount: rate * elapsedSeconds,
        limits,
      });
    }

    it("does not flag a rate below the limit", () => {
      const result = checkAtRate(limits.maxCollisionsPerSecond - 1);
      expect(result.flagged).toBe(false);
    });

    it("does not flag a rate exactly ON the limit (strictly-greater gate)", () => {
      const result = checkAtRate(limits.maxCollisionsPerSecond);
      expect(result.flagged).toBe(false);
    });

    it("flags a rate above the limit (auto-click/bot heuristic)", () => {
      const result = checkAtRate(limits.maxCollisionsPerSecond + 5);
      expect(result.flagged).toBe(true);
      expect(result.reason).toBe("collision_rate_exceeded");
    });

    it("derives the rate from count/elapsed — a huge COUNT over a long match is fine", () => {
      // 600 contacts is only 1/s across a 10-minute match: the raw count is
      // meaningless without the clock, which is the whole point of deriving.
      const result = service.check({
        action: "loss",
        platformsPassed: 1,
        elapsedSeconds: 600,
        reportedCollisionCount: 600,
        limits,
      });
      expect(result.flagged).toBe(false);
    });

    it("reports the derived rate and its inputs in `observed`", () => {
      const result = service.check({
        action: "loss",
        platformsPassed: 1,
        elapsedSeconds: 4,
        reportedCollisionCount: 100, // 25/s
        limits,
      });
      expect(result.flagged).toBe(true);
      expect(result.observed).toMatchObject({
        collisionsPerSecond: 25,
        collisionCount: 100,
        elapsedSeconds: 4,
      });
    });

    it.each([
      ["zero elapsed time (would divide by zero)", 0],
      ["negative elapsed time", -5],
      ["non-finite elapsed time", Number.NaN],
    ])("skips the check for %s instead of flagging an honest player", (_label, elapsedSeconds) => {
      const result = service.check({
        action: "loss",
        platformsPassed: 0,
        elapsedSeconds,
        reportedCollisionCount: 500,
        limits,
      });
      expect(result.reason).not.toBe("collision_rate_exceeded");
    });

    it.each([
      ["negative count", -10],
      ["non-finite count", Number.POSITIVE_INFINITY],
    ])("skips the check for a %s", (_label, reportedCollisionCount) => {
      const result = service.check({
        action: "loss",
        platformsPassed: 1,
        elapsedSeconds: 10,
        reportedCollisionCount,
        limits,
      });
      expect(result.reason).not.toBe("collision_rate_exceeded");
    });

    it("is pure — concurrent checks never leak state between each other", async () => {
      // The service is stateless by design; this pins that down so a future
      // refactor can't quietly introduce a shared accumulator.
      const overLimit = limits.maxCollisionsPerSecond + 10;
      const results = await Promise.all(
        Array.from({ length: 50 }, (_, i) =>
          Promise.resolve(checkAtRate(i % 2 === 0 ? overLimit : 0))
        )
      );
      results.forEach((r, i) => {
        expect(r.flagged).toBe(i % 2 === 0);
      });
    });
  });

  it("ignores telemetry fields the client didn't report", () => {
    const result = service.check({
      action: "loss",
      platformsPassed: 1,
      elapsedSeconds: 10,
      limits,
    });
    expect(result.flagged).toBe(false);
  });
});
