import { createRng } from "@/lib/rng";
import { activeEngineConfig as CFG } from "@/game-engine/config";
import type { RingData, RingMotion, RingVariant, SegmentType } from "@/game-engine/types";

/**
 * Procedural, seeded tower generation.
 *
 * Path guarantee: every ring has a contiguous opening of `holeWidthSegments`,
 * and the segments adjacent to the opening are never dangerous — so there is
 * always a safe landing pad next to the hole. Since the player has unlimited
 * time (the ball bounces in place), a route always exists.
 */

function pickVariant(rng: () => number, depth: number): RingVariant {
  const v = CFG.variants;
  const roll = rng();
  if (depth >= v.boostFrom && roll < 0.08) return "boost";
  if (depth >= v.iceFrom && roll < 0.18) return "ice";
  if (depth >= v.fragileFrom && roll < 0.3) return "fragile";
  return "normal";
}

function pickMotion(rng: () => number, depth: number): RingMotion {
  const v = CFG.variants;
  const roll = rng();
  if (depth >= v.blinkingFrom && roll < 0.07) {
    return { kind: "blinking", period: 2.2 + rng() * 1.4, duty: 0.62, phase: rng() * 10 };
  }
  if (depth >= v.spinningFrom && roll < 0.17) {
    return { kind: "spinning", speed: (rng() < 0.5 ? -1 : 1) * (0.35 + rng() * 0.4) };
  }
  if (depth >= v.oscillatingFrom && roll < 0.3) {
    return {
      kind: "oscillating",
      amplitude: 0.4 + rng() * 0.45,
      speed: 0.8 + rng() * 0.7,
      phase: rng() * Math.PI * 2,
    };
  }
  return { kind: "static" };
}

function dangerBudget(rng: () => number, depth: number): number {
  if (depth < CFG.safeDepth) return 0;
  // Admin-facing "Chance de segmentos vermelhos" — gates whether the
  // depth-scaled budget below applies at all for this ring. 1 (the default)
  // means it always does, exactly like before this was configurable.
  if (rng() > CFG.dangerChance) return 0;
  // RTP11: ramps one step every 6 rings past safeDepth (was 9) — the
  // curve still starts gentle right after the protected opening, but now
  // reaches each admin-configured maxDangerSegments cap noticeably sooner,
  // instead of staying near-minimum for the first ~40 platforms of a run.
  const base = Math.min(CFG.maxDangerSegments, 1 + Math.floor((depth - CFG.safeDepth) / 6));
  // Biased toward hitting the ramped target (was a 75/25 split) so realized
  // difficulty tracks the curve above more consistently.
  return rng() < 0.85 ? base : Math.max(0, base - 1);
}

export function generateRing(seed: string, index: number): RingData {
  const rng = createRng(`${seed}#ring:${index}`);
  const n = CFG.segmentsPerRing;

  const segments: SegmentType[] = Array.from({ length: n }, () => "solid");

  // Carve the guaranteed opening.
  const holeStart = Math.floor(rng() * n);
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

  // Occasionally a gold bonus segment.
  if (index >= CFG.safeDepth && rng() < CFG.variants.bonusChance) {
    const spot = eligible.slice(dangers).find((i) => segments[i] === "solid");
    if (spot !== undefined) segments[spot] = "bonus";
  }

  const motion = pickMotion(rng, index);
  // Motion rings keep a plain surface so behaviors never stack confusingly.
  const variant: RingVariant = motion.kind === "static" ? pickVariant(rng, index) : "normal";

  return {
    index,
    y: -index * CFG.ringSpacing,
    baseRotation: rng() * Math.PI * 2,
    segments,
    variant,
    motion,
    colorIndex: index % CFG.colors.palette.length,
  };
}

export function generateRings(seed: string, from: number, count: number): RingData[] {
  return Array.from({ length: count }, (_, i) => generateRing(seed, from + i));
}
