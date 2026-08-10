import { describe, expect, it } from "vitest";
import { ENGINE_CONFIG, setActiveEngineConfig, activeEngineConfig } from "@/game-engine/config";
import { generateRings } from "@/game-engine/generator";
import {
  DIFFICULTY_PRESETS,
  MODE_FIELDS,
  GAME_MODES,
} from "@/modules/game-config/constants/field-registry";

/**
 * Guards the difficulty LADDER itself, not any single tuned number.
 *
 * The bug these exist for: presets that differ on paper but not on screen.
 * Before this pass `normal`, `hard` and `very_hard` all shipped `gapWidth: 2`
 * with 12 segments — an identical 60° opening across the whole top half of
 * the range — and the danger ramp always opened at 1 red regardless of the
 * mode's ceiling, so the first ~30 platforms of every mode looked the same.
 * A future retune is free to move any value; what it must not do is flatten
 * a rung, make a profile unplayable, or push the ball outside the physics
 * the engine can actually simulate.
 */

const S = ENGINE_CONFIG.ringSpacing;
const RING_MID = (ENGINE_CONFIG.ringInnerRadius + ENGINE_CONFIG.ringOuterRadius) / 2;
const BALL_DIAMETER = 2 * ENGINE_CONFIG.ballRadius;
/** Centre-of-mass band a step must not skip over for a contact to be possible at all. */
const COLLISION_BAND = ENGINE_CONFIG.ringThickness + 2 * ENGINE_CONFIG.ballRadius;
/** Matches tower-physics.tsx's CuboidCollider chordHalf (the 1.08 seam overlap included). */
const CHORD_OVERLAP = 1.08;

type Profile = { gravity: number; bounceForce: number; ballSpeed: number; dangerChance: number; maxDangerSegments: number; protectedPlatforms: number; segmentsPerPlatform: number; gapWidth: number };

/** Free tangential width of the opening, in ball diameters — what the player must thread. */
function gapInBallDiameters(p: Profile): number {
  const segmentAngle = (2 * Math.PI) / p.segmentsPerPlatform;
  const chordHalf = RING_MID * Math.tan(segmentAngle / 2) * CHORD_OVERLAP;
  const halfFree = (p.gapWidth / 2 + 0.5) * (RING_MID * segmentAngle) - chordHalf;
  return (2 * halfFree) / BALL_DIAMETER;
}

/**
 * Seconds the ball spends per platform in steady state — the real "reaction
 * time" the player gets, and the only honest way to compare two profiles'
 * pace. Derived from the same constant-height bounce systems.ts solves:
 * rise v0/g at v0 = sqrt(2*g*h), then fall h + ringSpacing.
 */
function secondsPerPlatform(p: Profile): number {
  const g = Math.abs(p.gravity);
  const r = p.bounceForce;
  return Math.sqrt((2 * S) / g) * (Math.sqrt(r) + Math.sqrt(r + 1));
}

function launchSpeed(p: Profile): number {
  return Math.sqrt(2 * Math.abs(p.gravity) * p.bounceForce * S);
}

/** Reds on the first platform past the protected opening (generator.ts's ramp start). */
function firstUnprotectedDanger(p: Profile): number {
  return Math.min(
    p.maxDangerSegments,
    Math.max(1, Math.round(p.maxDangerSegments * ENGINE_CONFIG.dangerRampStartRatio))
  );
}

const presets = DIFFICULTY_PRESETS.map((preset) => ({ name: preset.key, p: preset.values as Profile }));
const modes = GAME_MODES.map((mode) => {
  const p = {} as Record<string, number>;
  for (const field of MODE_FIELDS) p[field.key] = Number(field.defaults[mode]);
  return { name: mode, p: p as unknown as Profile };
});
const allProfiles = [...presets, ...modes];

describe("difficulty ladder — every rung is a real, monotonic step", () => {
  it("the opening shrinks strictly from Muito Fácil down to Extremo", () => {
    const widths = presets.map(({ p }) => gapInBallDiameters(p));
    for (let i = 1; i < widths.length; i++) {
      expect(widths[i]).toBeLessThan(widths[i - 1]);
    }
    // Not just "smaller" — meaningfully smaller end to end.
    expect(widths[0] / widths[widths.length - 1]).toBeGreaterThan(3);
  });

  it("the player gets strictly less time per platform at each rung", () => {
    const paces = presets.map(({ p }) => secondsPerPlatform(p));
    for (let i = 1; i < paces.length; i++) {
      expect(paces[i]).toBeLessThan(paces[i - 1]);
    }
    expect(paces[0] / paces[paces.length - 1]).toBeGreaterThan(2);
  });

  it("danger never decreases as difficulty rises, and the protected runway never grows", () => {
    for (let i = 1; i < presets.length; i++) {
      const prev = presets[i - 1].p;
      const cur = presets[i].p;
      expect(cur.maxDangerSegments).toBeGreaterThanOrEqual(prev.maxDangerSegments);
      expect(cur.dangerChance).toBeGreaterThanOrEqual(prev.dangerChance);
      expect(cur.protectedPlatforms).toBeLessThanOrEqual(prev.protectedPlatforms);
    }
  });

  it("Extremo opens at ~1 segment and drops the player straight into hazards", () => {
    const extreme = presets.find((x) => x.name === "extreme")!.p;
    expect(extreme.gapWidth).toBe(1);
    expect(extreme.protectedPlatforms).toBe(0);
    // No artificially easy opening: the very first platform already carries
    // several reds instead of the single one the old flat ramp always gave.
    expect(firstUnprotectedDanger(extreme)).toBeGreaterThanOrEqual(4);
  });
});

describe("difficulty ladder — no profile is unplayable or physically broken", () => {
  it.each(allProfiles)("$name: the opening still fits the ball with real margin", ({ p }) => {
    // 1.5 diameters is the floor for "threadable"; Extremo sits at ~2.3.
    expect(gapInBallDiameters(p)).toBeGreaterThan(1.5);
  });

  it.each(allProfiles)("$name: the bounce stays inside the engine's safety rails", ({ p }) => {
    // Outside the rails the clamp silently overrides bounceForce, which would
    // make the slider stop meaning what its label says.
    const v = launchSpeed(p);
    expect(v).toBeGreaterThan(ENGINE_CONFIG.minBounceVelocity);
    expect(v).toBeLessThan(ENGINE_CONFIG.maxBounceVelocity);
  });

  it.each(allProfiles)("$name: the ball cannot tunnel through a platform in one step", ({ p }) => {
    // Independent of CCD — the ball must not travel further in one fixed
    // physics step than the band in which a contact is geometrically possible.
    const perStep = p.ballSpeed / 60;
    expect(perStep).toBeLessThan(COLLISION_BAND);
  });

  it.each(allProfiles)("$name: asks for no more reds than the ring can actually hold", ({ p }) => {
    // The hole plus its two guaranteed-safe flanking pads are never eligible
    // for danger — request more than what's left and the ceiling is a lie.
    const eligible = p.segmentsPerPlatform - (p.gapWidth + 2);
    expect(p.maxDangerSegments).toBeLessThanOrEqual(eligible);
  });

});

describe("difficulty ladder — the configured values actually reach the generator", () => {
  /** Applies a profile through the real override path the match uses, runs `fn`, then restores. */
  function withProfile<T>(p: Profile, fn: () => T): T {
    setActiveEngineConfig(p as unknown as Record<string, number>);
    try {
      return fn();
    } finally {
      setActiveEngineConfig(null);
    }
  }

  it("gapWidth reaches the generated rings as a real hole of exactly that width", () => {
    for (const { p } of presets) {
      withProfile(p, () => {
        expect(activeEngineConfig.holeWidthSegments).toBe(p.gapWidth);
        expect(activeEngineConfig.segmentsPerRing).toBe(p.segmentsPerPlatform);

        for (const ring of generateRings("gap-seed", 0, 30)) {
          expect(ring.segments).toHaveLength(p.segmentsPerPlatform);
          expect(ring.segments.filter((s) => s === "hole")).toHaveLength(p.gapWidth);
        }
      });
    }
  });

  it("protectedPlatforms really keeps the opening free of reds — and 0 really doesn't", () => {
    const easy = presets.find((x) => x.name === "very_easy")!.p;
    withProfile(easy, () => {
      const rings = generateRings("prot-seed", 0, easy.protectedPlatforms);
      for (const ring of rings) {
        expect(ring.segments).not.toContain("danger");
      }
    });

    const extreme = presets.find((x) => x.name === "extreme")!.p;
    withProfile(extreme, () => {
      // protectedPlatforms 0 → the very first platform can already be hostile.
      const anyDangerEarly = generateRings("prot-seed", 0, 3).some((r) => r.segments.includes("danger"));
      expect(anyDangerEarly).toBe(true);
    });
  });

  it("the first unprotected platform already carries most of the mode's ceiling", () => {
    // Regression guard for the flat ramp: with the old `1 + depth/6` opening,
    // Extremo's first platform showed 1 red instead of 4, so a ceiling of 7
    // was invisible for the ~24 platforms most runs never reach.
    const extreme = presets.find((x) => x.name === "extreme")!.p;
    withProfile(extreme, () => {
      const counts = ["a", "b", "c", "d", "e", "f", "g", "h"].map(
        (seed) => generateRings(seed, 0, 1)[0].segments.filter((s) => s === "danger").length
      );
      const peak = Math.max(...counts);
      expect(peak).toBeGreaterThanOrEqual(3);
      expect(peak).toBeLessThanOrEqual(extreme.maxDangerSegments);
    });
  });

  it.each(presets)("$name: a safe landing pad always flanks the opening", ({ p }) => {
    // Runs on EVERY preset, not just the tightest: the opening is carved with
    // `(holeStart + i) % n`, so it legitimately wraps the array boundary
    // (e.g. holes at indices 15 and 0 of a 16-segment ring). Any profile with
    // gapWidth >= 2 hits that case in practice, and a checker that assumes the
    // hole is contiguous in ARRAY order reads a hole segment as if it were the
    // flanking pad — reporting a blocked route that doesn't exist. Pinning
    // this to one gapWidth-1 profile would silently skip the wrapping path
    // entirely.
    withProfile(p, () => {
      for (const ring of generateRings("route-seed", 0, 120)) {
        const n = ring.segments.length;
        const holes = ring.segments.filter((s) => s === "hole").length;
        expect(holes).toBe(p.gapWidth);

        // True start = the hole whose predecessor is not itself a hole.
        const holeStart = ring.segments.findIndex(
          (s, i) => s === "hole" && ring.segments[(i - 1 + n) % n] !== "hole"
        );
        expect(holeStart).toBeGreaterThanOrEqual(0);

        // The run from there must be the WHOLE opening — proves it is one
        // contiguous arc in ring space, never two separate gaps.
        let width = 0;
        while (ring.segments[(holeStart + width) % n] === "hole") width++;
        expect(width).toBe(p.gapWidth);

        // Both landing pads flanking the opening must stay safe, or the ring
        // is reachable only by luck — the "never mathematically impossible"
        // contract the whole ladder rests on.
        expect(ring.segments[(holeStart - 1 + n) % n]).toBe("solid");
        expect(ring.segments[(holeStart + width) % n]).toBe("solid");
      }
    });
  });
});

describe("difficulty ladder — the three live modes sit on named rungs", () => {
  it("DEMO/NORMAL/HARD are exactly the easy/normal/hard presets", () => {
    // Keeps the admin panel honest: the mode a player is on always shows a
    // named preset instead of "Personalizado", and tuning a preset without
    // tuning its mode (or the reverse) shows up here instead of in production.
    const pairs: Array<[string, string]> = [
      ["DEMO", "easy"],
      ["NORMAL", "normal"],
      ["HARD", "hard"],
    ];
    for (const [mode, presetKey] of pairs) {
      const modeProfile = modes.find((m) => m.name === mode)!.p as unknown as Record<string, number>;
      const presetValues = DIFFICULTY_PRESETS.find((x) => x.key === presetKey)!.values as unknown as Record<string, number>;
      for (const [key, value] of Object.entries(presetValues)) {
        expect(`${mode}.${key}=${modeProfile[key]}`).toBe(`${mode}.${key}=${value}`);
      }
    }
  });
});
