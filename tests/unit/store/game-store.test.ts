import { describe, expect, it, beforeEach } from "vitest";
import { useGameStore } from "@/store/game-store";
import { getMultiplierForPlatforms } from "@/lib/multiplier";

const BET_CENTS = 1000; // R$10,00

describe("useGameStore.registerPass — reward feedback", () => {
  beforeEach(() => {
    useGameStore.getState().reset();
    useGameStore.getState().startMatch("match-1", "token-1", BET_CENTS, 5, BET_CENTS * 5);
  });

  it("queues exactly one reward event per platform consumed", () => {
    useGameStore.getState().registerPass(1);
    expect(useGameStore.getState().rewardEvents).toHaveLength(1);

    useGameStore.getState().registerPass(1);
    expect(useGameStore.getState().rewardEvents).toHaveLength(2);
  });

  it("derives the reward amount exclusively from the existing multiplier curve (no new financial rule)", () => {
    useGameStore.getState().registerPass(1);
    const { rewardEvents, multiplier } = useGameStore.getState();

    const expectedMultiplierDelta = getMultiplierForPlatforms(1) - getMultiplierForPlatforms(0);
    const expectedAmountCents = Math.round(BET_CENTS * expectedMultiplierDelta);

    expect(multiplier).toBeCloseTo(getMultiplierForPlatforms(1));
    expect(rewardEvents[0].amountCents).toBe(expectedAmountCents);
  });

  it("never touches payoutCents — reward popups are display-only", () => {
    for (let i = 0; i < 5; i++) useGameStore.getState().registerPass(1);
    expect(useGameStore.getState().payoutCents).toBe(0);
  });

  it("dismissReward removes exactly the targeted event, leaving the rest untouched", () => {
    useGameStore.getState().registerPass(1);
    useGameStore.getState().registerPass(1);
    const [first, second] = useGameStore.getState().rewardEvents;

    useGameStore.getState().dismissReward(first.id);

    const remaining = useGameStore.getState().rewardEvents;
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(second.id);
  });

  it("assigns each reward event a unique id even across rapid consecutive passes", () => {
    useGameStore.getState().registerPass(1);
    useGameStore.getState().registerPass(1);
    useGameStore.getState().registerPass(1);
    const ids = useGameStore.getState().rewardEvents.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("clears rewardEvents on startMatch and reset", () => {
    useGameStore.getState().registerPass(1);
    expect(useGameStore.getState().rewardEvents.length).toBeGreaterThan(0);

    useGameStore.getState().startMatch("match-2", "token-2", BET_CENTS, 5, BET_CENTS * 5);
    expect(useGameStore.getState().rewardEvents).toHaveLength(0);

    useGameStore.getState().registerPass(1);
    useGameStore.getState().reset();
    expect(useGameStore.getState().rewardEvents).toHaveLength(0);
  });

  it("keeps platformsPassed/multiplier progression unchanged (no regression from the reward feature)", () => {
    for (let i = 0; i < 10; i++) useGameStore.getState().registerPass(1);
    const { platformsPassed, multiplier } = useGameStore.getState();
    expect(platformsPassed).toBe(10);
    expect(multiplier).toBeCloseTo(getMultiplierForPlatforms(10));
  });
});
