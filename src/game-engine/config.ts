/**
 * Central tuning file for the HeliJump engine.
 * Every gameplay-affecting number lives here — nothing is hardcoded in systems.
 */
export const ENGINE_CONFIG = {
  // ---- Tower geometry ----
  ringSpacing: 1.5, // vertical distance between platforms
  segmentsPerRing: 12, // angular resolution of each ring
  segmentGapFactor: 0.94, // visual seam between segments
  ringInnerRadius: 1.05,
  ringOuterRadius: 2.35,
  ringThickness: 0.34,
  columnRadius: 0.55,

  // ---- Ball ----
  ballRadius: 0.17,
  ballOrbitRadius: 1.7, // fixed world X where the ball lives
  ballSpawnY: 1.0,

  // ---- Physics ----
  gravity: -16,
  maxFallSpeed: 15, // hard cap so the player can always react
  // Bounce is derived from impact speed (weight feel): the ball keeps a
  // fraction of its fall velocity, clamped so play stays readable.
  bounceRestitution: 0.6,
  minBounceVelocity: 4.4,
  maxBounceVelocity: 6.4,
  iceBounceFactor: 0.72, // damped bounce on frozen platforms
  boostGravityFactor: 1.9, // accelerator platforms increase gravity briefly
  boostDuration: 1.1, // seconds of boosted gravity
  contactCooldown: 0.06, // seconds — debounce duplicate contact events
  stuckVelocityThreshold: 0.15,
  stuckTimeout: 0.35, // seconds of near-zero velocity before the watchdog re-bounces
  fireBreakFallSpeed: 7.5, // downward velocity re-applied after smashing a ring

  // ---- Fire mode ----
  fireThreshold: 3, // consecutive pass-throughs to ignite
  fireBreaks: 1, // rings smashed per charge before fire mode ends

  // ---- Special platform rewards ----
  fragileBreakDelay: 0.12, // seconds after bounce before a fragile ring shatters

  // ---- Procedural generation ----
  initialRings: 44,
  extendBatch: 30,
  extendWhenRemaining: 20,
  holeWidthSegments: 2, // 60° opening — always passable
  safeDepth: 4, // first rings have no hazards at all
  maxDangerSegments: 3,
  // Gate in front of the depth-scaled danger budget (see generator.ts's
  // dangerBudget) — 1 means "always apply it, exactly like before this was
  // configurable"; admin-facing as "Chance de segmentos vermelhos".
  dangerChance: 1,

  // ---- Input ----
  dragSensitivity: 0.011, // radians per pixel
  flingDamping: 3.2, // exp decay of momentum after release
  rotationSmoothing: 16, // how fast current rotation chases the target
  maxDragDelta: 0.5, // radians per pointer event — tames synthetic/jumpy inputs
  maxFlingSpeed: 7, // rad/s cap; extreme kinematic speeds can panic the solver

  // ---- Camera ----
  // Helix Jump framing: the camera sits on the ball's radial axis (tower
  // center → ball → camera), so the ball is ALWAYS at the exact horizontal
  // center of the screen and the column is always BEHIND it — occlusion is
  // geometrically impossible, no matter how the tower spins.
  cameraDistance: 6.6, // distance from the tower axis, along the ball's radial
  cameraOffsetY: 2.4, // height above the ball
  cameraLookDown: 1.35, // look target below the ball → upcoming rings on screen
  cameraFov: 55,
  cameraDamping: 10, // per-second exponential follow
  cameraMaxLag: 1.1, // hard clamp: ball never drifts off-frame in either direction
  shakeDecay: 1.9,
  shakeMagnitude: 0.34,

  // ---- Windows (performance) ----
  physicsBehind: 1, // rings kept alive above the ball
  physicsAhead: 5, // rings simulated below the ball
  renderAhead: 16, // rings drawn below the ball
  renderBehind: 2,
  maxInstances: 288, // instanced mesh capacity per bucket

  // ---- Effects ----
  hitstopMs: 90, // freeze-frame on death (physics pause before overlay)
  deathOverlayDelayMs: 550,
  trauma: {
    bounce: 0.07,
    fireOn: 0.22,
    fireBreak: 0.3,
    death: 1.0,
  },

  // ---- Special ring distribution (weights ramp with depth) ----
  variants: {
    fragileFrom: 6,
    iceFrom: 9,
    boostFrom: 11,
    oscillatingFrom: 10,
    spinningFrom: 13,
    blinkingFrom: 16,
  },

  // ---- Palette ----
  colors: {
    palette: ["#8B5CF6", "#FF4FAE", "#16F2A5"],
    fragile: "#B7B3C9",
    ice: "#7DD3FC",
    boost: "#FB923C",
    danger: "#FF4D6D",
    // Decorative gold accent only (goal-reached celebration burst) — not a
    // platform special zone. Red is the platform's only special/loss color.
    reward: "#FFD166",
    ballIdle: "#FFFFFF",
    ballFire: "#FFB86B",
    trailIdle: "#8B5CF6",
    trailFire: "#FF8A3D",
  },
} as const;

export type EngineConfig = typeof ENGINE_CONFIG;

/**
 * Angular width of one segment, in radians — depends on `segmentsPerRing`,
 * which is now an admin-configurable, per-mode value (see
 * `applyEngineOverrides` below). Read this via a function call, never cache
 * it in a module-scope constant: tower-renderer.tsx and tower-physics.tsx
 * both derive per-match geometry (mesh shape, collider half-widths) from
 * it, and those must be recomputed fresh for each match's active config —
 * see tower-physics.tsx's `useMemo(() => ..., [])` for how that's done
 * without going stale across matches.
 */
export function getSegmentAngle(): number {
  return (Math.PI * 2) / activeEngineConfig.segmentsPerRing;
}

export const RING_MID_RADIUS = (ENGINE_CONFIG.ringInnerRadius + ENGINE_CONFIG.ringOuterRadius) / 2;

/**
 * Server-driven overrides (src/modules/game-config), applied on top of the
 * defaults above.
 *
 * `activeEngineConfig` is a live ES module binding — every file in this
 * directory does `import { activeEngineConfig as CFG }` instead of
 * importing `ENGINE_CONFIG` directly, so one `setActiveEngineConfig()` call
 * (from GameEngine, once per match, before its first render) updates what
 * every consumer sees. That includes the plain-function modules
 * (generator.ts, systems.ts, tower-state.ts) that aren't React components
 * and can't use context — ESM live bindings make prop/context threading
 * through them unnecessary.
 *
 * This is deliberately a SMALL set — the admin panel only exposes the knobs
 * that meaningfully change perceived difficulty (ball gravity/bounce/speed,
 * red-segment odds and severity, protected-platform count, platform/segment
 * count, opening width). Everything else that used to be individually
 * configurable (ball weight, collision radius/precision, elasticity,
 * friction, rotation min/max, drag sensitivity, camera distance/height/FOV/
 * speed, collision cooldown, bonus-platform chance, ...) was removed from
 * the registry and is now a fixed ENGINE_CONFIG constant — see this
 * module's game-config-rtp-module memory note for the full rationale.
 */
export let activeEngineConfig: EngineConfig = ENGINE_CONFIG;

export function setActiveEngineConfig(overrides: Record<string, number | boolean> | null | undefined): void {
  activeEngineConfig = overrides ? applyEngineOverrides(ENGINE_CONFIG, overrides) : ENGINE_CONFIG;
}

function num(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function applyEngineOverrides(
  base: EngineConfig,
  o: Record<string, number | boolean>
): EngineConfig {
  return {
    ...base,
    gravity: num(o.gravity, base.gravity),
    bounceRestitution: num(o.bounceForce, base.bounceRestitution),
    maxFallSpeed: num(o.ballSpeed, base.maxFallSpeed),
    dangerChance: num(o.dangerChance, base.dangerChance),
    maxDangerSegments: num(o.maxDangerSegments, base.maxDangerSegments),
    safeDepth: num(o.protectedPlatforms, base.safeDepth),
    initialRings: num(o.totalPlatforms, base.initialRings),
    segmentsPerRing: num(o.segmentsPerPlatform, base.segmentsPerRing),
    holeWidthSegments: num(o.gapWidth, base.holeWidthSegments),
  } as EngineConfig;
}
