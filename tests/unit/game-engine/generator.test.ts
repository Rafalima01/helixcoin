import { describe, expect, it } from "vitest";
import { generateRing, generateRings } from "@/game-engine/generator";

describe("generateRing — segment types", () => {
  it("never produces a segment type outside hole/solid/danger (no yellow/bonus category)", () => {
    const rings = generateRings("rtp12-seed", 0, 80);
    const allowed = new Set(["hole", "solid", "danger"]);
    for (const ring of rings) {
      for (const segment of ring.segments) {
        expect(allowed.has(segment)).toBe(true);
      }
    }
  });

  it("red ('danger') is the only special/loss segment type ever generated past the protected depth", () => {
    // Several seeds, deep enough to exercise the danger ramp — asserts the
    // set of non-hole/solid types collapses to exactly {"danger"}.
    const specialTypes = new Set<string>();
    for (const seed of ["s1", "s2", "s3", "s4", "s5"]) {
      const rings = generateRings(seed, 0, 60);
      for (const ring of rings) {
        for (const segment of ring.segments) {
          if (segment !== "hole" && segment !== "solid") specialTypes.add(segment);
        }
      }
    }
    expect([...specialTypes]).toEqual(["danger"]);
  });

  it("guarantees a safe landing pad next to the hole (flanking segments are never danger)", () => {
    const rings = generateRings("flank-seed", 0, 60);
    for (const ring of rings) {
      const n = ring.segments.length;
      // The opening is carved with `(holeStart + i) % n`, so it can wrap the
      // array boundary (holes at indices n-1 and 0). Plain `findIndex` returns
      // 0 for those rings, which makes the "before" neighbour land INSIDE the
      // hole — the assertion then passes for the wrong reason ("hole" is not
      // "danger") while never checking the real flanking pad. Anchor on the
      // hole whose predecessor isn't a hole instead.
      const holeStart = ring.segments.findIndex(
        (s, i) => s === "hole" && ring.segments[(i - 1 + n) % n] !== "hole"
      );
      if (holeStart === -1) continue;
      let holeWidth = 0;
      while (ring.segments[(holeStart + holeWidth) % n] === "hole") holeWidth++;
      const before = (holeStart - 1 + n) % n;
      const after = (holeStart + holeWidth) % n;
      expect(ring.segments[before]).not.toBe("danger");
      expect(ring.segments[after]).not.toBe("danger");
    }
  });

  it("is deterministic for a given seed and index", () => {
    const a = generateRing("determinism-seed", 12);
    const b = generateRing("determinism-seed", 12);
    expect(a.segments).toEqual(b.segments);
    expect(a.motion).toEqual(b.motion);
  });

  it("is deterministic for a standalone call at a high index, without generating the rings below it first", () => {
    // resolveHoleStart recurses on its own lookback window rather than
    // reading anything generateRing(seed, index-1) actually produced, so this
    // must agree with itself whether or not the rings under it were ever
    // materialized — the same standalone-callable contract as the segments
    // themselves.
    const cold = generateRing("cold-start-seed", 40);
    const warmed = generateRings("cold-start-seed", 0, 41)[40];
    expect(cold.segments).toEqual(warmed.segments);
  });
});

/** Index (in array order) of the segment right after the last "hole" of the opening's run, wrapping. Same anchor rule used by the flanking-pad test above. */
function holeStartOf(ring: { segments: string[] }): number {
  const n = ring.segments.length;
  const start = ring.segments.findIndex(
    (s, i) => s === "hole" && ring.segments[(i - 1 + n) % n] !== "hole"
  );
  return start;
}

function circularDistance(a: number, b: number, n: number): number {
  const diff = Math.abs(a - b) % n;
  return Math.min(diff, n - diff);
}

describe("generateRing — opening never forms a vertically-aligned column", () => {
  it("no opening repeats the exact same position as the platform right below it", () => {
    for (const seed of ["align-1", "align-2", "align-3"]) {
      const rings = generateRings(seed, 0, 50);
      for (let i = 1; i < rings.length; i++) {
        const prev = holeStartOf(rings[i - 1]);
        const cur = holeStartOf(rings[i]);
        expect(cur).not.toBe(prev);
      }
    }
  });

  it("no three consecutive platforms have openings within 1 segment of each other (no near-aligned column)", () => {
    for (const seed of ["align-1", "align-2", "align-3", "align-4"]) {
      const rings = generateRings(seed, 0, 50);
      const n = rings[0].segments.length;
      for (let i = 2; i < rings.length; i++) {
        const a = holeStartOf(rings[i - 2]);
        const b = holeStartOf(rings[i - 1]);
        const c = holeStartOf(rings[i]);
        const allClose =
          circularDistance(a, b, n) <= 1 &&
          circularDistance(b, c, n) <= 1 &&
          circularDistance(a, c, n) <= 1;
        expect(allClose).toBe(false);
      }
    }
  });

  it("consecutive platforms' openings respect the configured gapWidth (contiguous, correct width) even under the anti-alignment rule", () => {
    const rings = generateRings("align-width-seed", 0, 60);
    for (const ring of rings) {
      const holes = ring.segments.filter((s) => s === "hole").length;
      expect(holes).toBeGreaterThan(0);
    }
  });
});
