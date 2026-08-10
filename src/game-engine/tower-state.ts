import { activeEngineConfig as CFG } from "@/game-engine/config";
import type { EngineRuntime, RingData } from "@/game-engine/types";

/**
 * Single source of truth for ring orientation. Physics colliders and rendered
 * instances both call these, so what you see is exactly what you collide with.
 *
 * Sign convention: both consumers (tower-renderer.tsx, tower-physics.tsx)
 * apply this value DIRECTLY as a THREE.js Y-axis rotation (no extra negation)
 * — that is what makes a rightward drag (which increases runtime.rot.target
 * in game-engine.tsx's onPointerMove) move the tower visually to the right,
 * given this scene's fixed camera looks from +X toward the origin. An
 * earlier version negated this value at both call sites, which produced a
 * self-consistent (visual matches collision) but backwards-from-input
 * rotation. If you ever need to touch this again: change it here in spirit
 * only — the actual fix has to stay duplicated at both consumer sites,
 * because tower-physics.tsx composes its OWN rotation from a parent
 * kinematic-body rotation plus a per-collider local offset, not a single
 * combined angle like the renderer.
 */

/** World rotation of a ring at time t (tower rotation + own base + motion). */
export function ringRotation(runtime: EngineRuntime, ring: RingData, t: number): number {
  let offset = 0;
  const m = ring.motion;
  if (m.kind === "oscillating") {
    offset = m.amplitude * Math.sin(t * m.speed + m.phase);
  } else if (m.kind === "spinning") {
    offset = t * m.speed;
  }
  return runtime.rot.current + ring.baseRotation + offset;
}

/**
 * Blinking ring visibility. A ring never re-materializes while the ball is
 * inside its vertical band — prevents the ball from being swallowed.
 */
export function ringVisible(
  runtime: EngineRuntime,
  ring: RingData,
  t: number,
  ballY: number
): boolean {
  if (runtime.broken.has(ring.index)) return false;
  const m = ring.motion;
  if (m.kind !== "blinking") return true;
  const cycle = ((t + m.phase) % m.period) / m.period;
  const visible = cycle < m.duty;
  if (!visible) return false;
  const band = CFG.ringThickness + CFG.ballRadius * 2;
  if (ballY < ring.y + band && ballY > ring.y - band) return false;
  return true;
}

/** Ring index of the plane directly below a given ball height. */
export function ringIndexBelow(ballY: number): number {
  return Math.max(0, Math.ceil(-ballY / CFG.ringSpacing));
}

/**
 * Clearance the ball's underside must fall below a ring's own plane before
 * that ring counts as passed: the ring's full physical slab (its collider
 * spans `ringThickness` below `ring.y`, see tower-physics.tsx's RingBody)
 * plus the ball's own radius. Consuming a platform is a pure function of the
 * ball's true vertical position — never of a contact/collision event, never
 * of elapsed time — so a ring can only ever be marked passed once the ball
 * has genuinely fallen clear of it, bounce/contact jitter included: this
 * margin is comfortably larger than any plausible single-substep contact
 * penetration.
 */
const PASS_CLEARANCE = CFG.ringThickness + CFG.ballRadius;

/** How many rings the ball has fully passed at a given height. */
export function passesForHeight(ballY: number): number {
  const depth = -(ballY + PASS_CLEARANCE);
  if (depth < 0) return 0;
  return Math.floor(depth / CFG.ringSpacing) + 1;
}
