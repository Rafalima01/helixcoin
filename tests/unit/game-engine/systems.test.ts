import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/game-engine/audio", () => ({
  AudioManager: {
    init: vi.fn(),
    impact: vi.fn(),
    ice: vi.fn(),
    pass: vi.fn(),
    coin: vi.fn(),
    fireOn: vi.fn(),
    smash: vi.fn(),
    boost: vi.fn(),
    death: vi.fn(),
    cashout: vi.fn(),
    goal: vi.fn(),
  },
}));

vi.mock("@/game-engine/components/particles", () => ({
  particleBus: { spawnBurst: vi.fn() },
}));

import { AudioManager } from "@/game-engine/audio";
import { activeEngineConfig as CFG } from "@/game-engine/config";
import { createRuntime, type EngineRuntime } from "@/game-engine/types";
import { handleTouch, stepGameplay, type EngineCallbacks } from "@/game-engine/systems";
import { ringVisible } from "@/game-engine/tower-state";
import { useGameStore } from "@/store/game-store";

const BET_CENTS = 1000;

/** Minimal fake conforming to the subset of RapierRigidBody systems.ts actually calls. */
function fakeBall(initialY: number) {
  let y = initialY;
  let vy = -5;
  return {
    isValid: () => true,
    translation: () => ({ x: CFG.ballOrbitRadius, y, z: 0 }),
    linvel: () => ({ x: 0, y: vy, z: 0 }),
    setLinvel: (v: { x: number; y: number; z: number }) => {
      vy = v.y;
    },
    setGravityScale: () => {},
    setY: (newY: number) => {
      y = newY;
    },
  };
}

/** y such that stepGameplay's depth-crossing math reports exactly `crossed` rings passed. */
function yForCrossed(crossed: number): number {
  const depth = Math.max(0, crossed - 1) * CFG.ringSpacing;
  return -depth - CFG.ballRadius * 1.4;
}

function buildRuntime(y: number) {
  const ball = fakeBall(y);
  const ballRef = { current: ball as unknown as EngineRuntime["ballRef"]["current"] };
  const runtime = createRuntime(ballRef);
  return { runtime, ball };
}

function buildCallbacks(): EngineCallbacks {
  return { bumpPhysicsVersion: vi.fn(), onDeath: vi.fn() };
}

describe("systems — platform consumption (ring passed -> broken)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useGameStore.getState().reset();
    useGameStore.getState().startMatch("m1", "t1", BET_CENTS, 5, BET_CENTS * 5);
  });

  it("marks exactly the ring index just passed as broken, and no others", () => {
    const { runtime, ball } = buildRuntime(yForCrossed(0));
    const cb = buildCallbacks();
    ball.setY(yForCrossed(1));

    stepGameplay(runtime, cb, 1 / 60);

    expect(runtime.broken.has(0)).toBe(true);
    expect(runtime.broken.has(1)).toBe(false);
    expect(useGameStore.getState().platformsPassed).toBe(1);
  });

  it("marks every ring index consumed when the ball crosses several in one step", () => {
    const { runtime, ball } = buildRuntime(yForCrossed(0));
    const cb = buildCallbacks();
    ball.setY(yForCrossed(3));

    stepGameplay(runtime, cb, 1 / 60);

    expect(runtime.broken.has(0)).toBe(true);
    expect(runtime.broken.has(1)).toBe(true);
    expect(runtime.broken.has(2)).toBe(true);
    expect(useGameStore.getState().platformsPassed).toBe(3);
  });

  it("never re-processes an index already counted (no repeated pass on the same depth)", () => {
    const { runtime, ball } = buildRuntime(yForCrossed(0));
    const cb = buildCallbacks();
    ball.setY(yForCrossed(1));
    stepGameplay(runtime, cb, 1 / 60);
    stepGameplay(runtime, cb, 1 / 60); // ball hasn't moved further

    expect(useGameStore.getState().platformsPassed).toBe(1);
    expect(runtime.broken.size).toBe(1);
  });

  it("plays the coin feedback exactly once per platform consumed", () => {
    const { runtime, ball } = buildRuntime(yForCrossed(0));
    const cb = buildCallbacks();
    ball.setY(yForCrossed(2));

    stepGameplay(runtime, cb, 1 / 60);

    expect(AudioManager.coin).toHaveBeenCalledTimes(2);
  });

  it("a consumed ring is invisible (no longer rendered) via the same ringVisible gate physics uses", () => {
    const { runtime } = buildRuntime(yForCrossed(0));
    const ring = { index: 0, y: 0, baseRotation: 0, segments: [], variant: "normal" as const, motion: { kind: "static" as const }, colorIndex: 0 };
    expect(ringVisible(runtime, ring, 0, 0)).toBe(true);

    runtime.broken.add(0);
    expect(ringVisible(runtime, ring, 0, 0)).toBe(false);
  });
});

describe("systems — handleTouch: red is the only loss zone", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useGameStore.getState().reset();
    useGameStore.getState().startMatch("m2", "t2", BET_CENTS, 5, BET_CENTS * 5);
    // vitest.config.ts runs this suite under environment: "node" — triggerDeath's
    // deathOverlayDelayMs callback uses window.setTimeout, so stub a synchronous one.
    vi.stubGlobal("window", { setTimeout: (fn: () => void) => (fn(), 0) });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("touching a 'danger' segment kills the ball", () => {
    const { runtime } = buildRuntime(yForCrossed(0));
    runtime.rings[10] = {
      index: 10,
      y: -15,
      baseRotation: 0,
      segments: [],
      variant: "normal",
      motion: { kind: "static" },
      colorIndex: 0,
    };
    const cb = buildCallbacks();

    handleTouch(runtime, cb, 10, "danger");

    // Stubbed window.setTimeout above runs synchronously, so by the time we
    // assert, triggerDeath has already gone all the way to "lost" — the
    // intermediate "resolving" state (real freeze-frame delay) is what a
    // browser run would observe mid-flight; here we assert the end state.
    expect(runtime.dead).toBe(true);
    expect(useGameStore.getState().status).toBe("lost");
    expect(AudioManager.death).toHaveBeenCalledTimes(1);
    expect(cb.onDeath).toHaveBeenCalledTimes(1);
  });

  it("touching a 'solid' segment bounces — never kills", () => {
    const { runtime } = buildRuntime(yForCrossed(0));
    runtime.rings[10] = {
      index: 10,
      y: -15,
      baseRotation: 0,
      segments: [],
      variant: "normal",
      motion: { kind: "static" },
      colorIndex: 0,
    };
    const cb = buildCallbacks();

    handleTouch(runtime, cb, 10, "solid");

    expect(runtime.dead).toBe(false);
    expect(useGameStore.getState().status).toBe("playing");
    expect(AudioManager.death).not.toHaveBeenCalled();
  });

  it("a consumed (broken) ring never triggers handleTouch again — no double events, no death, no bounce", () => {
    const { runtime } = buildRuntime(yForCrossed(0));
    runtime.rings[5] = {
      index: 5,
      y: -7.5,
      baseRotation: 0,
      segments: [],
      variant: "normal",
      motion: { kind: "static" },
      colorIndex: 0,
    };
    runtime.broken.add(5);
    const cb = buildCallbacks();

    handleTouch(runtime, cb, 5, "danger");
    handleTouch(runtime, cb, 5, "solid");

    expect(runtime.dead).toBe(false);
    expect(useGameStore.getState().status).toBe("playing");
    expect(AudioManager.death).not.toHaveBeenCalled();
    expect(AudioManager.impact).not.toHaveBeenCalled();
  });
});
