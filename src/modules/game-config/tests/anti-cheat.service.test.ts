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

  it("flags a suspicious collision rate (auto-click/bot heuristic)", () => {
    const result = service.check({
      action: "loss",
      platformsPassed: 1,
      elapsedSeconds: 10,
      reportedCollisionsPerSecond: limits.maxCollisionsPerSecond + 5,
      limits,
    });
    expect(result.flagged).toBe(true);
    expect(result.reason).toBe("collision_rate_exceeded");
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
