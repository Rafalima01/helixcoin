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
    expect(a.variant).toBe(b.variant);
  });
});
