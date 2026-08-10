/**
 * Adaptive render-quality tiers — HIGH / MEDIUM / LOW / PERFORMANCE.
 *
 * Every field here is PURELY VISUAL/RENDER (DPR, antialias, how many rings
 * are drawn ahead, particle count/ttl, decorative geometry density, HUD
 * indicator refresh rate). Nothing here ever touches gameplay-affecting
 * config (src/game-engine/config.ts's ENGINE_CONFIG) — gravity, bounce,
 * danger odds, segment count, physicsAhead/physicsBehind (the physics
 * simulation window) are untouched by quality tier. See the perf-audit
 * report: tiering is Priority 7, scoped to render cost only.
 *
 * Same live-module-binding pattern as config.ts's activeEngineConfig —
 * non-component modules (tower-renderer.tsx, particles.tsx) can't use
 * React context, so `activeQualitySettings` is a plain mutable binding every
 * consumer imports and reads fresh each frame/render.
 */

export type QualityTier = "high" | "medium" | "low" | "performance";

export interface QualitySettings {
  /** [min, max] passed directly to <Canvas dpr>. */
  dpr: [number, number];
  antialias: boolean;
  /** Rings drawn below the ball, purely for visual lookahead — independent of CFG.physicsAhead. */
  renderAhead: number;
  /** Rings drawn above the ball. */
  renderBehind: number;
  /** Multiplier on particleBus.spawnBurst's `count` option. */
  particleCountScale: number;
  /** Multiplier on particleBus.spawnBurst's `ttl` option. */
  particleTtlScale: number;
  /** Ball sphereGeometry width/height segments (visual only — BallCollider radius is unaffected). */
  ballSegments: number;
  /** Central column cylinderGeometry radial segments (visual only, no collider). */
  columnRadialSegments: number;
}

const TIERS: Record<QualityTier, QualitySettings> = {
  high: {
    dpr: [1, 1.75],
    antialias: true,
    renderAhead: 16,
    renderBehind: 2,
    particleCountScale: 1,
    particleTtlScale: 1,
    ballSegments: 20,
    columnRadialSegments: 24,
  },
  medium: {
    dpr: [1, 1.5],
    antialias: true,
    renderAhead: 11,
    renderBehind: 2,
    particleCountScale: 0.6,
    particleTtlScale: 1,
    ballSegments: 20,
    columnRadialSegments: 24,
  },
  low: {
    dpr: [1, 1],
    antialias: false,
    renderAhead: 8,
    renderBehind: 1,
    particleCountScale: 0.35,
    particleTtlScale: 0.7,
    ballSegments: 12,
    columnRadialSegments: 14,
  },
  performance: {
    dpr: [1, 1],
    antialias: false,
    renderAhead: 6,
    renderBehind: 1,
    particleCountScale: 0.2,
    particleTtlScale: 0.55,
    ballSegments: 12,
    columnRadialSegments: 12,
  },
};

export const QUALITY_TIER_ORDER: QualityTier[] = ["performance", "low", "medium", "high"];

export let activeQualityTier: QualityTier = "high";
export let activeQualitySettings: QualitySettings = TIERS.high;

export function setQualityTier(tier: QualityTier): void {
  activeQualityTier = tier;
  activeQualitySettings = TIERS[tier];
}

const STORAGE_KEY = "helijump.quality.v1";

interface StoredQuality {
  tier: QualityTier;
  /** true = user explicitly picked this in settings; auto-detection must never overwrite it. */
  manual: boolean;
}

function readStorage(): StoredQuality | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredQuality>;
    if (parsed && QUALITY_TIER_ORDER.includes(parsed.tier as QualityTier)) {
      return { tier: parsed.tier as QualityTier, manual: Boolean(parsed.manual) };
    }
  } catch {
    // corrupted/blocked storage — fall through to detection
  }
  return null;
}

function writeStorage(value: StoredQuality): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // storage unavailable (private mode, quota) — tier still works for this session
  }
}

/**
 * Coarse starting guess before any real frame-time sample exists — used only
 * to avoid launching the very first match "blind" at HIGH on a device that's
 * obviously constrained. Never the final word: `sampleAndRefine` below
 * always gets the chance to move off this guess based on real measured frame
 * time, which is what the perf audit calls for ("baseado principalmente no
 * frame time real"). Deliberately NOT a device/model name list — only broad,
 * self-reported capability signals.
 */
function heuristicStartingTier(): QualityTier {
  if (typeof navigator === "undefined") return "high";
  const cores = navigator.hardwareConcurrency ?? 8;
  // deviceMemory is Chromium-only (undefined on Safari/iOS) — never the sole signal.
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const coarsePointer =
    typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;

  if (cores <= 4 || (mem !== undefined && mem <= 2)) return "low";
  if (coarsePointer && (cores <= 6 || (mem !== undefined && mem <= 4))) return "medium";
  return "high";
}

function tierForAvgFrameMs(avgMs: number): QualityTier {
  if (avgMs <= 18) return "high"; // comfortably >=55fps
  if (avgMs <= 28) return "medium"; // ~35fps+
  if (avgMs <= 40) return "low"; // ~25fps+
  return "performance";
}

/** Never auto-promote more than one tier above the current guess in a single sample — avoids a lucky idle sample jumping straight to HIGH mid-fall. */
function clampStep(from: QualityTier, to: QualityTier): QualityTier {
  const fromIdx = QUALITY_TIER_ORDER.indexOf(from);
  const toIdx = QUALITY_TIER_ORDER.indexOf(to);
  if (toIdx > fromIdx + 1) return QUALITY_TIER_ORDER[fromIdx + 1];
  return to;
}

/**
 * Samples real rAF frame time for `durationMs` and resolves to the tier that
 * fits it. Never called if the user has a manual override stored. Safe to
 * call mid-match — it only reads timestamps, never blocks or allocates per
 * frame.
 */
function sampleFrameTime(durationMs: number): Promise<number> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "undefined") {
      resolve(16.7);
      return;
    }
    let last = performance.now();
    const start = last;
    let total = 0;
    let count = 0;
    function tick(now: number) {
      const dt = now - last;
      last = now;
      // Skip the first sample (tab-switch/setup artifacts) once we have data.
      if (count > 0 || now - start > 0) {
        total += dt;
        count++;
      }
      if (now - start < durationMs) {
        requestAnimationFrame(tick);
      } else {
        resolve(count > 0 ? total / count : 16.7);
      }
    }
    requestAnimationFrame(tick);
  });
}

export interface QualityController {
  tier: QualityTier;
  manual: boolean;
  setTier: (tier: QualityTier) => void;
  clearManual: () => void;
}

/**
 * Detection/sampling only ever needs to happen ONCE per browser session —
 * GameEngine remounts on every new match (`key={seed}`, see play-screen.tsx)
 * and would otherwise call this on every single match start. A second+ call
 * just re-applies whatever tier is already active, no re-sampling, no
 * mid-match tier flicker.
 */
let sessionInitialized = false;

/**
 * Call once per match mount (idempotent beyond the first real call this
 * session — see `sessionInitialized`). Applies a stored manual choice
 * immediately if present; otherwise sets a heuristic starting tier
 * synchronously and kicks off a real frame-time sample to refine it, exactly
 * once. Returns a controller for a settings UI to drive.
 */
export function initQuality(onChange?: (tier: QualityTier) => void): QualityController {
  if (sessionInitialized) {
    // Nothing to detect again this session — intentionally does NOT call
    // onChange here: this path runs on every subsequent match mount, and
    // firing a "changed" notification with the same, unchanged tier would
    // trigger a needless re-render loop in whatever called this from a
    // component body (see game-engine.tsx).
    return makeController(onChange);
  }
  sessionInitialized = true;

  const stored = readStorage();

  if (stored?.manual) {
    setQualityTier(stored.tier);
    onChange?.(stored.tier);
  } else {
    const startingTier = stored?.tier ?? heuristicStartingTier();
    setQualityTier(startingTier);
    onChange?.(startingTier);

    // Refine from a real sample once the engine has had a moment to start
    // rendering — a 2.5s window matches the perf audit's "primeiros
    // segundos do jogo" ask without meaningfully delaying feedback.
    void sampleFrameTime(2500).then((avgMs) => {
      const stillNoManual = !readStorage()?.manual;
      if (!stillNoManual) return; // user (or another init) set a manual tier meanwhile
      const measured = tierForAvgFrameMs(avgMs);
      const refined = clampStep(activeQualityTier, measured);
      if (refined !== activeQualityTier) {
        setQualityTier(refined);
        onChange?.(refined);
      }
      writeStorage({ tier: activeQualityTier, manual: false });
    });
  }

  return makeController(onChange);
}

function makeController(onChange?: (tier: QualityTier) => void): QualityController {
  return {
    get tier() {
      return activeQualityTier;
    },
    get manual() {
      return readStorage()?.manual ?? false;
    },
    setTier(tier: QualityTier) {
      setQualityTier(tier);
      writeStorage({ tier, manual: true });
      onChange?.(tier);
    },
    clearManual() {
      writeStorage({ tier: activeQualityTier, manual: false });
    },
  };
}
