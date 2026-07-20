import { activeEngineConfig as CFG } from "@/game-engine/config";
import type { EngineRuntime, RingData } from "@/game-engine/types";

/**
 * Single source of truth for ring orientation. Physics colliders and rendered
 * instances both call these, so what you see is exactly what you collide with.
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

/** How many rings the ball has fully passed at a given height. */
export function passesForHeight(ballY: number): number {
  const depth = -(ballY + CFG.ballRadius * 1.4);
  if (depth < 0) return 0;
  return Math.floor(depth / CFG.ringSpacing) + 1;
}
