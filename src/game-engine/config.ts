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
  // Purely decorative (see tower-renderer.tsx's plain <mesh>, no RigidBody/
  // collider) — kept just under ringInnerRadius so the column visually meets
  // the platforms with only a hairline technical gap, no physics impact.
  columnRadius: 0.98,

  // ---- Ball ----
  ballRadius: 0.17,
  ballOrbitRadius: 1.7, // fixed world X where the ball lives
  ballSpawnY: 1.0,

  // ---- Physics ----
  gravity: -16,
  maxFallSpeed: 15, // hard cap so the player can always react
  /**
   * Bounce is a TARGET HEIGHT, expressed as a fraction of ringSpacing — not a
   * fraction of impact speed.
   *
   * Impact-proportional restitution (what this used to be) runs away on a
   * descending course: the ball bounces up h, then falls h + ringSpacing to
   * the next platform, so each impact is faster than the last, so each bounce
   * is higher than the last — the "rubber ball" feel, growing until it
   * slammed into the maxBounceVelocity clamp. Measured on the old NORMAL
   * profile the bounce height swung 0.55 -> 1.17 world units (2.1x) purely as
   * a function of how far the ball had fallen.
   *
   * Targeting a height instead makes every bounce identical and readable, at
   * the midpoint of that old range, and makes the admin slider mean literally
   * what its label says ("Altura do quique"). Launch speed is solved per
   * bounce from v = sqrt(2*g*h), so changing gravity no longer silently
   * changes how high the ball goes.
   */
  bounceHeightRatio: 0.56,
  // Absolute safety rails around the solved launch speed — with a fixed
  // target height these should never engage in normal play; they exist so a
  // pathological gravity/height combination can't produce a 0 or a rocket.
  minBounceVelocity: 3.2,
  maxBounceVelocity: 9,
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
  /**
   * Shape of the danger ramp (see generator.ts's dangerBudget). Deliberately
   * NOT admin-configurable: these two describe *how* the configured
   * `maxDangerSegments` is approached, not how dangerous the mode is — that's
   * what maxDangerSegments itself is for. Exposing them would be two more
   * sliders competing to express one idea.
   *
   * `dangerRampStartRatio` is the fix for the "artificially easy opening"
   * problem: the ramp used to always start at 1 red regardless of the mode's
   * ceiling, so a mode configured for 7 reds still looked identical to a mode
   * configured for 2 during the first ~30 platforms — the ceiling only became
   * visible long after most matches had already ended. Starting at a fraction
   * of the ceiling makes `maxDangerSegments` legible from the first
   * unprotected platform, which is what makes the harder modes read as harder
   * immediately instead of eventually.
   */
  dangerRampStartRatio: 0.6,
  /** Rings per +1 red on the ramp, counted from `safeDepth`. */
  dangerRampRings: 4,

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
  // Look target below the ball → upcoming rings on screen. The extra +0.6
  // beyond the original 1.35 is a deliberate, subtle downward pitch (camera
  // reads as slightly above the tower looking down) — position/distance/FOV
  // are untouched, only the look-at aim point moved.
  cameraLookDown: 1.95,
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
  /**
   * Instanced-mesh capacity per bucket (solid / danger). Must cover the
   * worst case the admin panel can actually produce, because
   * tower-renderer.tsx silently STOPS emitting instances past this number
   * while tower-physics.tsx still builds every collider — over the cap you
   * get invisible platforms you can still land on (or die to).
   *
   * Worst case = render window x max segments per ring
   *            = (renderBehind + renderAhead + 1) x segmentsPerPlatform.max
   *            = 19 x 24 = 456.
   * 480 covers that with headroom. This used to be 288, which was fine only
   * while every mode was pinned to 12 segments — the moment a mode uses the
   * registry's upper range (HARD now uses 16) the old value was one config
   * change away from that desync.
   */
  maxInstances: 480,

  // ---- Effects ----
  hitstopMs: 90, // freeze-frame on death (physics pause before overlay)
  deathOverlayDelayMs: 550,
  trauma: {
    bounce: 0.07,
    fireOn: 0.22,
    fireBreak: 0.3,
    death: 1.0,
  },

  /**
   * Depth at which each special/moving ring type starts appearing, counted as
   * an OFFSET FROM `safeDepth` — not as an absolute ring index (see
   * generator.ts's variantDepth). Relative is the right frame because
   * `safeDepth` is the admin-facing "plataformas protegidas": a mode that
   * drops the player straight into hazards should also start throwing moving
   * platforms at them sooner, and a mode with a long protected runway should
   * not waste that runway introducing ice and blinking rings. Absolute
   * thresholds made these fixed for every mode, which is why the harder modes
   * felt like the easy one for their whole opening stretch.
   *
   * Calibrated so NORMAL (safeDepth 4) lands on exactly the absolute depths
   * these had when they were absolute (6/9/11/10/13/16).
   */
  variants: {
    fragileFrom: 2,
    iceFrom: 5,
    boostFrom: 7,
    oscillatingFrom: 6,
    spinningFrom: 9,
    blinkingFrom: 12,
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
    bounceHeightRatio: num(o.bounceForce, base.bounceHeightRatio),
    maxFallSpeed: num(o.ballSpeed, base.maxFallSpeed),
    dangerChance: num(o.dangerChance, base.dangerChance),
    maxDangerSegments: num(o.maxDangerSegments, base.maxDangerSegments),
    safeDepth: num(o.protectedPlatforms, base.safeDepth),
    initialRings: num(o.totalPlatforms, base.initialRings),
    segmentsPerRing: num(o.segmentsPerPlatform, base.segmentsPerRing),
    holeWidthSegments: num(o.gapWidth, base.holeWidthSegments),
  } as EngineConfig;
}
