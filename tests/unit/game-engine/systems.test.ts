import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/game-engine/audio", () => ({
  AudioManager: {
    init: vi.fn(),
    impact: vi.fn(),
    pass: vi.fn(),
    coin: vi.fn(),
    fireOn: vi.fn(),
    smash: vi.fn(),
    death: vi.fn(),
    cashout: vi.fn(),
    goal: vi.fn(),
  },
}));

vi.mock("@/game-engine/components/particles", () => ({
  particleBus: { spawnBurst: vi.fn() },
}));

import { AudioManager } from "@/game-engine/audio";
import { activeEngineConfig as CFG, setActiveEngineConfig } from "@/game-engine/config";
import { createRuntime, type EngineRuntime } from "@/game-engine/types";
import { advanceRotation, handleTouch, stepGameplay, type EngineCallbacks } from "@/game-engine/systems";
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

/**
 * y such that stepGameplay's depth-crossing math reports exactly `crossed`
 * rings passed. Nudged fractionally past the boundary (not landed exactly on
 * it) so floating-point rounding of the clearance sum can never flip which
 * bracket `Math.floor` picks — the real ball is never at an exact analytic
 * boundary either.
 */
function yForCrossed(crossed: number): number {
  const depth = Math.max(0, crossed - 1) * CFG.ringSpacing;
  return -depth - (CFG.ringThickness + CFG.ballRadius) - 1e-6;
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

describe("systems — advanceRotation", () => {
  it("advances runtime.time by exactly dt, every call, regardless of match status", () => {
    const { runtime } = buildRuntime(0);
    useGameStore.getState().reset(); // status !== "playing" here — must still advance

    advanceRotation(runtime, 1 / 60);
    expect(runtime.time).toBeCloseTo(1 / 60, 10);

    advanceRotation(runtime, 1 / 60);
    expect(runtime.time).toBeCloseTo(2 / 60, 10);
  });

  it("chases rot.target smoothly instead of snapping instantly", () => {
    const { runtime } = buildRuntime(0);
    runtime.rot.target = Math.PI;
    expect(runtime.rot.current).toBe(0);

    advanceRotation(runtime, 1 / 60);

    expect(runtime.rot.current).toBeGreaterThan(0);
    expect(runtime.rot.current).toBeLessThan(Math.PI);
  });

  it("applies fling momentum to the target while not dragging, and decays it", () => {
    const { runtime } = buildRuntime(0);
    runtime.rot.velPs = 2;
    runtime.rot.dragging = false;

    advanceRotation(runtime, 1 / 60);

    expect(runtime.rot.target).toBeGreaterThan(0);
    expect(runtime.rot.velPs).toBeLessThan(2);
  });

  it("is FPS-independent: the same real time produces essentially the same rotation at 30 FPS and at 60 FPS", () => {
    // advanceRotation scales every update by dt (real elapsed time), never
    // by call count — so simulating 1 second as 30 calls of dt=1/30 or as 60
    // calls of dt=1/60 must land within numerical-integration tolerance of
    // each other. A frame-rate-COUPLED bug (e.g. advancing by a fixed amount
    // per call regardless of dt) would instead show roughly a 2x gap here,
    // since 60 FPS calls advanceRotation twice as often as 30 FPS.
    const thirty = buildRuntime(0);
    thirty.runtime.rot.velPs = 2;
    thirty.runtime.rot.dragging = false;
    for (let i = 0; i < 30; i++) advanceRotation(thirty.runtime, 1 / 30);

    const sixty = buildRuntime(0);
    sixty.runtime.rot.velPs = 2;
    sixty.runtime.rot.dragging = false;
    for (let i = 0; i < 60; i++) advanceRotation(sixty.runtime, 1 / 60);

    expect(thirty.runtime.time).toBeCloseTo(1, 10);
    expect(sixty.runtime.time).toBeCloseTo(1, 10);

    const ratio = sixty.runtime.rot.current / thirty.runtime.rot.current;
    expect(ratio).toBeGreaterThan(0.95);
    expect(ratio).toBeLessThan(1.05);
  });

  it("rotationSpeed raises the per-step rotation ceiling — same huge target gap, faster mode closes more of it in one tick", () => {
    // With current far from target, the exponential chase would jump nearly
    // the whole gap in one step; advanceRotation clamps that to
    // CFG.maxFlingSpeed * CFG.rotationSpeed * 1.5 * dt (systems.ts:184), so a
    // higher rotationSpeed must let runtime.rot.current advance further in
    // the SAME step under the SAME conditions.
    setActiveEngineConfig({ rotationSpeed: 2 });
    let fastCurrent: number;
    try {
      const fast = buildRuntime(0);
      fast.runtime.rot.target = 100;
      advanceRotation(fast.runtime, 1 / 60);
      fastCurrent = fast.runtime.rot.current;
    } finally {
      setActiveEngineConfig(null);
    }

    setActiveEngineConfig({ rotationSpeed: 1 });
    let normalCurrent: number;
    try {
      const normal = buildRuntime(0);
      normal.runtime.rot.target = 100;
      advanceRotation(normal.runtime, 1 / 60);
      normalCurrent = normal.runtime.rot.current;
    } finally {
      setActiveEngineConfig(null);
    }

    expect(fastCurrent).toBeGreaterThan(normalCurrent);
  });
});

describe("systems — platform consumption (ring passed -> broken)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useGameStore.getState().reset();
    useGameStore.getState().startMatch("m1", "t1", BET_CENTS, 5, BET_CENTS * 5);
  });

  it("marks exactly the ring index just passed as broken, and no others", () => {
    const { runtime, ball } = buildRuntime(yForCrossed(0));
    ball.setY(yForCrossed(1));

    stepGameplay(runtime);

    expect(runtime.broken.has(0)).toBe(true);
    expect(runtime.broken.has(1)).toBe(false);
    expect(useGameStore.getState().platformsPassed).toBe(1);
  });

  it("marks every ring index consumed when the ball crosses several in one step", () => {
    const { runtime, ball } = buildRuntime(yForCrossed(0));
    ball.setY(yForCrossed(3));

    stepGameplay(runtime);

    expect(runtime.broken.has(0)).toBe(true);
    expect(runtime.broken.has(1)).toBe(true);
    expect(runtime.broken.has(2)).toBe(true);
    expect(useGameStore.getState().platformsPassed).toBe(3);
  });

  it("never re-processes an index already counted (no repeated pass on the same depth)", () => {
    const { runtime, ball } = buildRuntime(yForCrossed(0));
    ball.setY(yForCrossed(1));
    stepGameplay(runtime);
    stepGameplay(runtime); // ball hasn't moved further

    expect(useGameStore.getState().platformsPassed).toBe(1);
    expect(runtime.broken.size).toBe(1);
  });

  it("plays the coin feedback exactly once per platform consumed", () => {
    const { runtime, ball } = buildRuntime(yForCrossed(0));
    ball.setY(yForCrossed(2));

    stepGameplay(runtime);

    expect(AudioManager.coin).toHaveBeenCalledTimes(2);
  });

  it("bouncing/resting on a ring, even with contact-penetration jitter short of full clearance, never consumes that ring", () => {
    const { runtime, ball } = buildRuntime(yForCrossed(0));
    // Land on ring 1 (consumes ring 0, matching the "landed past it" rule).
    const restY = -1 * CFG.ringSpacing + CFG.ballRadius;
    ball.setY(restY);
    stepGameplay(runtime);
    expect(useGameStore.getState().platformsPassed).toBe(1);
    expect(runtime.broken.has(1)).toBe(false);

    // Descent required, below the resting contact point, before ring 1
    // itself (not just ring 0) counts as passed: the ball's top must clear
    // the ring's full physical slab (ring.y - ringThickness), i.e. it must
    // fall an extra `2*ballRadius + ringThickness` below where it rests.
    const consumeGap = 2 * CFG.ballRadius + CFG.ringThickness;

    // Simulate a bounce's contact penetration: the ball dips below its own
    // resting contact point, but well short of that gap.
    ball.setY(restY - consumeGap * 0.5);
    stepGameplay(runtime);
    expect(useGameStore.getState().platformsPassed).toBe(1);
    expect(runtime.broken.has(1)).toBe(false);

    // Only once the ball has cleared the ring's full physical slab does it count.
    ball.setY(restY - consumeGap - 0.05);
    stepGameplay(runtime);
    expect(useGameStore.getState().platformsPassed).toBe(2);
    expect(runtime.broken.has(1)).toBe(true);
  });

  it("a consumed ring is invisible (no longer rendered) via the same ringVisible gate physics uses", () => {
    const { runtime } = buildRuntime(yForCrossed(0));
    const ring = { index: 0, y: 0, baseRotation: 0, segments: [], motion: { kind: "static" as const } };
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
      motion: { kind: "static" },
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
      motion: { kind: "static" },
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
      motion: { kind: "static" },
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

describe("systems — bounce is constant-height, not impact-proportional", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useGameStore.getState().reset();
    useGameStore.getState().startMatch("m3", "t3", BET_CENTS, 5, BET_CENTS * 5);
  });

  afterEach(() => {
    useGameStore.getState().reset();
  });

  function bounceAfterImpact(impactVy: number): number {
    const { runtime, ball } = buildRuntime(yForCrossed(0));
    runtime.rings[10] = {
      index: 10,
      y: -15,
      baseRotation: 0,
      segments: [],
      motion: { kind: "static" },
    };
    // The impact speed the ball arrived with — the value the old
    // impact-proportional formula multiplied by bounceRestitution.
    runtime.lastVy = impactVy;
    handleTouch(runtime, buildCallbacks(), 10, "solid");
    return ball.linvel().y;
  }

  it("gives the SAME launch speed for a gentle and a violent impact", () => {
    // Regression guard for the "rubber ball" bug: bounce used to be
    // |lastVy| * restitution, so a faster fall produced a higher bounce,
    // which produced a longer fall, which produced a higher bounce...
    const gentle = bounceAfterImpact(-4);
    const violent = bounceAfterImpact(-16);

    expect(gentle).toBeGreaterThan(0);
    expect(violent).toBeCloseTo(gentle, 10);
  });

  it("launches at exactly the speed needed to reach the configured bounce height", () => {
    const expected = Math.sqrt(2 * Math.abs(CFG.gravity) * CFG.bounceHeightRatio * CFG.ringSpacing);
    expect(bounceAfterImpact(-9)).toBeCloseTo(expected, 6);
  });

  it("never exceeds the safety rails", () => {
    const v = bounceAfterImpact(-40);
    expect(v).toBeLessThanOrEqual(CFG.maxBounceVelocity);
    expect(v).toBeGreaterThanOrEqual(CFG.minBounceVelocity);
  });
});
