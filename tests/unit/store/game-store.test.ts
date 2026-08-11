import { describe, expect, it, beforeEach } from "vitest";
import { useGameStore, REWARD_POPUP_INCREMENT_CENTS } from "@/store/game-store";
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

  it("GANHO INCREMENTAL — a single platform advance queues exactly +R$0,50 (REWARD_POPUP_INCREMENT_CENTS), never a multiplier-derived amount", () => {
    useGameStore.getState().registerPass(1);
    const { rewardEvents } = useGameStore.getState();

    expect(REWARD_POPUP_INCREMENT_CENTS).toBe(50);
    expect(rewardEvents[0].amountCents).toBe(50);
  });

  it("GANHO INCREMENTAL — every subsequent advance also queues a fixed +R$0,50, never the growing multiplier-curve delta (R$0,27/R$0,21/R$1,37 style variation)", () => {
    for (let i = 0; i < 8; i++) useGameStore.getState().registerPass(1);
    const { rewardEvents } = useGameStore.getState();

    expect(rewardEvents).toHaveLength(8);
    for (const event of rewardEvents) {
      expect(event.amountCents).toBe(REWARD_POPUP_INCREMENT_CENTS);
    }
    // Sanity check that the multiplier curve genuinely is non-linear here —
    // otherwise this test wouldn't actually distinguish "fixed" from "curve
    // happens to be flat for these 8 platforms".
    const curveIsNonLinear =
      getMultiplierForPlatforms(2) - getMultiplierForPlatforms(1) !==
      getMultiplierForPlatforms(8) - getMultiplierForPlatforms(7);
    expect(curveIsNonLinear).toBe(true);
  });

  it("GANHO DO MOMENTO vs ACUMULADO — the fixed R$0,50 popup never equals the accumulated bet×multiplier value it used to show", () => {
    useGameStore.getState().registerPass(1);
    const { rewardEvents, multiplier } = useGameStore.getState();

    const accumulatedCents = Math.round(BET_CENTS * multiplier);
    expect(rewardEvents[0].amountCents).toBe(50);
    expect(rewardEvents[0].amountCents).not.toBe(accumulatedCents);
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
