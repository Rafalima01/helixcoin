import { createRng } from "@/lib/rng";
import { activeEngineConfig as CFG } from "@/game-engine/config";
import type { RingData, RingMotion, SegmentType } from "@/game-engine/types";

/**
 * Procedural, seeded tower generation.
 *
 * Path guarantee: every ring has a contiguous opening of `holeWidthSegments`,
 * and the segments adjacent to the opening are never dangerous — so there is
 * always a safe landing pad next to the hole. Since the player has unlimited
 * time (the ball bounces in place), a route always exists.
 */

/** Absolute depth at which a motion threshold kicks in — CFG.variants stores offsets from the protected opening (see config.ts's `variants` doc comment). */
function variantDepth(offset: number): number {
  return CFG.safeDepth + offset;
}

function pickMotion(rng: () => number, depth: number): RingMotion {
  const v = CFG.variants;
  const roll = rng();
  if (depth >= variantDepth(v.blinkingFrom) && roll < 0.07) {
    return { kind: "blinking", period: 2.2 + rng() * 1.4, duty: 0.62, phase: rng() * 10 };
  }
  if (depth >= variantDepth(v.spinningFrom) && roll < 0.17) {
    return { kind: "spinning", speed: (rng() < 0.5 ? -1 : 1) * (0.35 + rng() * 0.4) };
  }
  if (depth >= variantDepth(v.oscillatingFrom) && roll < 0.3) {
    return {
      kind: "oscillating",
      amplitude: 0.4 + rng() * 0.45,
      speed: 0.8 + rng() * 0.7,
      phase: rng() * Math.PI * 2,
    };
  }
  return { kind: "static" };
}

/** Shortest segment-count distance between two positions on a ring of `n` segments, wrapping either direction. */
function circularDistance(a: number, b: number, n: number): number {
  const diff = Math.abs(a - b) % n;
  return Math.min(diff, n - diff);
}

/**
 * Minimum required circular distance (in segments) between a new ring's
 * opening and each of its `holeSeparationLookback` predecessors — the
 * harder a mode is (narrower `gapWidth` relative to `n`), the more of a
 * rotation it demands between consecutive openings, exactly the "quanto
 * maior a dificuldade, maior a variação angular exigida" requirement.
 * Capped at n/3 so the excluded arc can never approach the whole ring —
 * a rule this strict would make some seeds unsolvable-feeling by luck
 * rather than by skill, which is the "padrão artificial" this must avoid.
 */
function minHoleSeparation(n: number, gapWidth: number): number {
  const raw = Math.ceil(n / (2 * gapWidth));
  return Math.min(Math.max(raw, 2), Math.floor(n / 3));
}

/**
 * Deterministic, memoized, pure function of (seed, index, n) — safe to call
 * standalone for any index (as generateRing already is, e.g. in tests)
 * without first generating the rings above it: it recurses on its own
 * lookback window using this SAME function, so it always agrees with what
 * generateRing(seed, index-1)/(index-2)/... will itself place. Memoized
 * because that recursion would otherwise revisit the same lower indices
 * from multiple callers; the cache is keyed by (seed, index) and never
 * invalidated because the mapping is pure — entries for old match seeds
 * just sit unused afterward, a session's realistic total is a few thousand
 * numbers, not worth evicting.
 *
 * Never uses CFG.holeWidthSegments/segmentsPerRing/holeSeparationLookback
 * as free-floating globals inside the recursion — reads them once via the
 * `n`/`gapWidth`/`lookback` params so a mid-batch config change (there
 * isn't one mid-match today, but nothing here should assume that) can't
 * make a memoized entry disagree with a fresh one for the same key.
 */
const holeStartCache = new Map<string, number>();

function resolveHoleStart(seed: string, index: number, n: number, gapWidth: number, lookback: number): number {
  const cacheKey = `${seed}#${index}#${n}#${gapWidth}`;
  const cached = holeStartCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const rng = createRng(`${seed}#hole:${index}`);
  let result: number;

  if (index <= 0) {
    result = Math.floor(rng() * n);
  } else {
    const back = Math.min(index, lookback);
    const forbidden: number[] = [];
    for (let i = 1; i <= back; i++) {
      forbidden.push(resolveHoleStart(seed, index - i, n, gapWidth, lookback));
    }
    const minSep = minHoleSeparation(n, gapWidth);
    const farEnough = (candidate: number) => forbidden.every((f) => circularDistance(candidate, f, n) >= minSep);

    result = -1;
    for (let attempt = 0; attempt < 6; attempt++) {
      const candidate = Math.floor(rng() * n);
      if (farEnough(candidate)) {
        result = candidate;
        break;
      }
    }
    if (result === -1) {
      // Deterministic fallback that always satisfies the constraint on any
      // ring wide enough to hold it (minHoleSeparation is capped at n/3,
      // so half the ring away from the most recent opening clears every
      // forbidden zone by construction) — never a loop, never a failure.
      result = (forbidden[0] + Math.floor(n / 2)) % n;
    }
  }

  holeStartCache.set(cacheKey, result);
  return result;
}

function dangerBudget(rng: () => number, depth: number): number {
  if (depth < CFG.safeDepth) return 0;
  // Admin-facing "Chance de segmentos vermelhos" — gates whether the
  // depth-scaled budget below applies at all for this ring. 1 (the default)
  // means it always does, exactly like before this was configurable.
  if (rng() > CFG.dangerChance) return 0;
  // The ramp opens at a FRACTION OF the mode's own ceiling rather than always
  // at 1 (see config.ts's dangerRampStartRatio for why), then climbs to that
  // ceiling one red every `dangerRampRings` platforms. So a mode configured
  // for 7 reds already shows ~4 on its first unprotected platform, while a
  // mode configured for 1 shows 1 — the ceiling is what you feel from the
  // start, not something the run has to survive long enough to reveal.
  const rampStart = Math.max(1, Math.round(CFG.maxDangerSegments * CFG.dangerRampStartRatio));
  const base = Math.min(
    CFG.maxDangerSegments,
    rampStart + Math.floor((depth - CFG.safeDepth) / CFG.dangerRampRings)
  );
  // Biased toward hitting the ramped target (was a 75/25 split) so realized
  // difficulty tracks the curve above more consistently.
  return rng() < 0.85 ? base : Math.max(0, base - 1);
}

export function generateRing(seed: string, index: number): RingData {
  const rng = createRng(`${seed}#ring:${index}`);
  const n = CFG.segmentsPerRing;

  const segments: SegmentType[] = Array.from({ length: n }, () => "solid");

  // Carve the guaranteed opening — position resolved with anti-alignment
  // against the preceding rings (see resolveHoleStart) instead of a bare
  // draw, so consecutive platforms never carve a "safe column" straight
  // down the tower.
  const holeStart = resolveHoleStart(seed, index, n, CFG.holeWidthSegments, CFG.holeSeparationLookback);
  for (let i = 0; i < CFG.holeWidthSegments; i++) {
    segments[(holeStart + i) % n] = "hole";
  }

  // Segments flanking the opening stay safe (guaranteed landing pads).
  const forbidden = new Set<number>();
  forbidden.add((holeStart - 1 + n) % n);
  forbidden.add((holeStart + CFG.holeWidthSegments) % n);
  for (let i = 0; i < CFG.holeWidthSegments; i++) forbidden.add((holeStart + i) % n);

  // Place danger sectors on eligible segments.
  const eligible = Array.from({ length: n }, (_, i) => i).filter(
    (i) => segments[i] === "solid" && !forbidden.has(i)
  );
  for (let i = eligible.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [eligible[i], eligible[j]] = [eligible[j], eligible[i]];
  }
  const dangers = dangerBudget(rng, index);
  for (let i = 0; i < dangers && i < eligible.length; i++) {
    segments[eligible[i]] = "danger";
  }

  const motion = pickMotion(rng, index);

  return {
    index,
    y: -index * CFG.ringSpacing,
    baseRotation: rng() * Math.PI * 2,
    segments,
    motion,
  };
}

export function generateRings(seed: string, from: number, count: number): RingData[] {
  return Array.from({ length: count }, (_, i) => generateRing(seed, from + i));
}
