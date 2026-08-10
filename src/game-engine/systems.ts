import { activeEngineConfig as CFG } from "@/game-engine/config";
import type { EngineRuntime, TouchKind } from "@/game-engine/types";
import { AudioManager } from "@/game-engine/audio";
import { particleBus } from "@/game-engine/components/particles";
import { passesForHeight } from "@/game-engine/tower-state";
import { useGameStore } from "@/store/game-store";

/**
 * Gameplay rules that react to physics contacts. Pure TS module — called from
 * collision events and the frame loop, mutates only runtime + zustand store.
 */

export interface EngineCallbacks {
  /** Force React to drop/remount ring bodies after a break. */
  bumpPhysicsVersion: () => void;
  /** Called once, after the death freeze-frame, with the final pass count. */
  onDeath: (platformsPassed: number) => void;
}

function ringColor(runtime: EngineRuntime, ringIndex: number): string {
  const ring = runtime.rings[ringIndex];
  if (!ring) return CFG.colors.platform;
  if (ring.variant === "ice") return CFG.colors.ice;
  if (ring.variant === "boost") return CFG.colors.boost;
  if (ring.variant === "fragile") return CFG.colors.fragile;
  return CFG.colors.platform;
}

/** The ball body, or null if it isn't alive in the physics world right now. */
export function liveBall(runtime: EngineRuntime) {
  const body = runtime.ballRef.current;
  return body && body.isValid() ? body : null;
}

function ballPos(runtime: EngineRuntime): { x: number; y: number; z: number } {
  const body = liveBall(runtime);
  return body ? body.translation() : { x: CFG.ballOrbitRadius, y: CFG.ballSpawnY, z: 0 };
}

export function breakRing(
  runtime: EngineRuntime,
  cb: EngineCallbacks,
  ringIndex: number,
  fromFire: boolean
) {
  if (runtime.broken.has(ringIndex)) return;
  runtime.broken.add(ringIndex);
  cb.bumpPhysicsVersion();

  const ring = runtime.rings[ringIndex];
  const p = ballPos(runtime);
  particleBus.spawnBurst(p.x, ring ? ring.y : p.y, p.z, ringColor(runtime, ringIndex), {
    count: 26,
    speed: 3.6,
    upward: 2.4,
    size: 0.07,
    ttl: 0.7,
  });
  AudioManager.smash();

  if (fromFire) {
    runtime.trauma = Math.min(1, runtime.trauma + CFG.trauma.fireBreak);
    // Punch through: contact zeroed the velocity, restore the fall.
    liveBall(runtime)?.setLinvel({ x: 0, y: -CFG.fireBreakFallSpeed, z: 0 }, true);
    runtime.fireBreaksLeft -= 1;
    if (runtime.fireBreaksLeft <= 0) {
      useGameStore.getState().setFire(false);
    }
  }
}

export function triggerDeath(runtime: EngineRuntime, cb: EngineCallbacks) {
  if (runtime.dead) return;
  runtime.dead = true;

  const store = useGameStore.getState();
  // "resolving" pauses physics immediately (freeze frame) and disables HUD
  // actions, while keeping the canvas visible for the explosion.
  store.setResolving();

  const p = ballPos(runtime);
  AudioManager.death();
  runtime.trauma = 1;
  particleBus.spawnBurst(p.x, p.y, p.z, CFG.colors.danger, {
    count: 42,
    speed: 5,
    upward: 3.4,
    size: 0.085,
    ttl: 0.9,
    gravity: -5,
  });
  particleBus.spawnBurst(p.x, p.y, p.z, "#FFD166", {
    count: 18,
    speed: 3,
    upward: 2.2,
    size: 0.05,
    ttl: 0.7,
  });

  window.setTimeout(() => {
    const s = useGameStore.getState();
    s.resolveLost();
    cb.onDeath(s.platformsPassed);
  }, CFG.deathOverlayDelayMs);
}

/** Contact event entry point — called from ring body collision handlers. */
export function handleTouch(
  runtime: EngineRuntime,
  cb: EngineCallbacks,
  ringIndex: number,
  kind: TouchKind
) {
  const store = useGameStore.getState();
  if (store.status !== "playing" || runtime.dead) return;
  if (runtime.broken.has(ringIndex)) return;

  if (kind === "danger") {
    triggerDeath(runtime, cb);
    return;
  }

  // Fire ball smashes any non-danger platform instead of bouncing.
  if (store.fireMode) {
    breakRing(runtime, cb, ringIndex, true);
    return;
  }

  const now = runtime.time;
  if (now - runtime.lastBounceAt < CFG.contactCooldown) return;
  runtime.lastBounceAt = now;
  runtime.lastMovedAt = now;

  const ring = runtime.rings[ringIndex];
  const body = liveBall(runtime);
  if (!ring || !body) return;

  // Constant-height bounce: solve the launch speed that reaches exactly
  // `bounceHeightRatio * ringSpacing`, from v² = 2*g*h. Deliberately does NOT
  // read runtime.lastVy — bouncing proportionally to impact speed is what
  // made the ball behave like rubber (each bounce fell further than the last,
  // so each bounce was higher than the last; see config.ts's
  // bounceHeightRatio comment). Energy loss is whatever the drop supplied
  // minus what this height needs, which is what makes it read as a real ball
  // settling into a rhythm instead of winding up.
  const targetHeight = CFG.bounceHeightRatio * CFG.ringSpacing;
  let bounce = Math.min(
    CFG.maxBounceVelocity,
    Math.max(CFG.minBounceVelocity, Math.sqrt(2 * Math.abs(CFG.gravity) * targetHeight))
  );

  if (ring.variant === "ice") {
    bounce *= CFG.iceBounceFactor;
    AudioManager.ice();
  }
  if (ring.variant === "boost") {
    runtime.boostUntil = now + CFG.boostDuration;
    AudioManager.boost();
  }

  body.setLinvel({ x: 0, y: bounce, z: 0 }, true);
  store.registerTouch(Math.abs(runtime.lastVy));
  AudioManager.impact();
  runtime.trauma = Math.min(1, runtime.trauma + CFG.trauma.bounce);

  const p = ballPos(runtime);
  particleBus.spawnBurst(p.x, ring.y, p.z, ringColor(runtime, ringIndex), {
    count: 10,
    speed: 2.2,
    upward: 1.4,
  });

  if (ring.variant === "fragile") {
    runtime.pendingBreaks.push({ ring: ringIndex, at: now + CFG.fragileBreakDelay });
  }
}

/**
 * Advances `runtime.time` and the smoothed tower rotation. MUST run inside a
 * `useBeforePhysicsStep` registered before TowerPhysics's own (see
 * game-engine.tsx's EngineSystems) — every physics sub-step (there can be
 * several in one rendered frame after a stutter, since `<Physics
 * timeStep={1/60}>` uses a fixed-step accumulator) needs the collider
 * rotation and this value in sync, or the kinematic collider and the
 * rendered mesh drift apart by up to a frame's worth of rotation. This used
 * to run inside stepGameplay()'s plain useFrame (after the physics step had
 * already used the PREVIOUS frame's runtime.time) — that one-frame lag is
 * exactly what made the ball look like it was floating off a platform's
 * surface while still being treated as grounded.
 */
export function advanceRotation(runtime: EngineRuntime, dt: number): void {
  runtime.time += dt;

  // Input smoothing: momentum after release + exponential chase. The actual
  // angular speed of the tower is capped — the kinematic solver must never
  // see near-instant rotations, no matter what the input device produced.
  const r = runtime.rot;
  if (!r.dragging && Math.abs(r.velPs) > 0.0001) {
    r.target += r.velPs * dt;
    r.velPs *= Math.exp(-CFG.flingDamping * dt);
  }
  const chase = (r.target - r.current) * (1 - Math.exp(-CFG.rotationSmoothing * dt));
  const maxStep = CFG.maxFlingSpeed * 1.5 * dt;
  r.current += Math.max(-maxStep, Math.min(maxStep, chase));
}

/** Per-frame gameplay bookkeeping (called from the systems component, after advanceRotation has already run this frame). */
export function stepGameplay(runtime: EngineRuntime, cb: EngineCallbacks) {
  const store = useGameStore.getState();
  const now = runtime.time;

  if (store.status !== "playing" || runtime.dead) return;

  const body = liveBall(runtime);
  if (!body) return;
  const y = body.translation().y;
  const vy = body.linvel().y;

  // ---- Pass detection: counting plane crossings, not contacts ----
  // Sole source of truth for "did the ball really clear this ring" —
  // see passesForHeight's doc comment (tower-state.ts) for the clearance math.
  const crossed = passesForHeight(y);
  if (crossed > store.platformsPassed) {
    const firstConsumedIndex = store.platformsPassed;
    const gained = crossed - firstConsumedIndex;
    if (gained > 1 && process.env.NODE_ENV !== "production") {
      // Purely diagnostic — each index is still only ever consumed once
      // (platformsPassed is monotonic, runtime.broken.add is idempotent).
      // A burst this large usually means a stutter caused the physics
      // accumulator to catch up several ring-depths in one frame.
      console.warn(`stepGameplay: consuming ${gained} platforms in one frame (index ${firstConsumedIndex}..${crossed - 1})`);
    }
    for (let i = 0; i < gained; i++) {
      // Platform ultrapassada: nunca mais colide nem renderiza — reusa o
      // mesmo mecanismo de rings "broken" (fire/fragile) que já exclui um
      // índice de windowRings/ringVisible, só que sem a explosão/som de
      // smash (breakRing()), já que este NÃO é um evento de destruição.
      runtime.broken.add(firstConsumedIndex + i);
      store.registerPass(1);
      const after = useGameStore.getState();
      AudioManager.pass(after.combo);
      AudioManager.coin(); // feedback de recompensa — uma vez por plataforma consumida
      if (!after.fireMode && after.combo >= CFG.fireThreshold) {
        after.setFire(true);
        runtime.fireBreaksLeft = CFG.fireBreaks;
        AudioManager.fireOn();
        runtime.trauma = Math.min(1, runtime.trauma + CFG.trauma.fireOn);
      }
    }
  }

  // ---- Accelerator boost: temporary gravity multiplier ----
  const boosted = now < runtime.boostUntil;
  if (boosted !== runtime.boostApplied) {
    body.setGravityScale(boosted ? CFG.boostGravityFactor : 1, true);
    runtime.boostApplied = boosted;
  }

  // ---- Fragile rings shatter shortly after the bounce ----
  if (runtime.pendingBreaks.length > 0) {
    const due = runtime.pendingBreaks.filter((b) => b.at <= now);
    if (due.length > 0) {
      runtime.pendingBreaks = runtime.pendingBreaks.filter((b) => b.at > now);
      for (const b of due) breakRing(runtime, cb, b.ring, false);
    }
  }

  // ---- Stuck watchdog: physics glitches must never soft-lock a bet ----
  if (Math.abs(vy) > CFG.stuckVelocityThreshold) {
    runtime.lastMovedAt = now;
  } else if (now - runtime.lastMovedAt > CFG.stuckTimeout) {
    runtime.lastMovedAt = now;
    body.setLinvel({ x: 0, y: CFG.minBounceVelocity * 0.9, z: 0 }, true);
  }

  // ---- Goal reached ("meta alcançada"): one-time celebration ----
  const after = useGameStore.getState();
  if (after.goalReached && !runtime.goalCelebrated) {
    runtime.goalCelebrated = true;
    AudioManager.goal();
    runtime.trauma = Math.min(1, runtime.trauma + CFG.trauma.fireOn);
    const p = ballPos(runtime);
    particleBus.spawnBurst(p.x, p.y, p.z, CFG.colors.reward, {
      count: 30,
      speed: 3.6,
      upward: 3.2,
      size: 0.06,
      ttl: 0.9,
      gravity: -4,
    });
    particleBus.spawnBurst(p.x, p.y, p.z, "#16F2A5", {
      count: 20,
      speed: 2.6,
      upward: 2.6,
      size: 0.05,
      ttl: 0.8,
      gravity: -4,
    });
  }
}

/** Physics-step hook body: hard cap on fall speed + impact-speed sampling. */
export function clampFallSpeed(runtime: EngineRuntime) {
  const body = liveBall(runtime);
  if (!body) return;
  const v = body.linvel();
  if (v.y < -CFG.maxFallSpeed) {
    body.setLinvel({ x: 0, y: -CFG.maxFallSpeed, z: 0 }, true);
    runtime.lastVy = -CFG.maxFallSpeed;
  } else {
    // Velocity entering this step — read by the bounce as the impact speed,
    // since the contact solver has already zeroed it by event-drain time.
    runtime.lastVy = v.y;
  }
}
