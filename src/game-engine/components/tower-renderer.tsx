"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { activeEngineConfig as CFG, getSegmentAngle } from "@/game-engine/config";
import { activeQualitySettings as QUALITY } from "@/game-engine/quality";
import type { EngineRuntime, RingData, SegmentType } from "@/game-engine/types";
import { ringRotation, ringVisible } from "@/game-engine/tower-state";
import { useGameStore } from "@/store/game-store";

/**
 * Maximal contiguous runs of `kind` in `segments`, wrap-around aware (a run
 * can cross the array boundary, e.g. indices [11, 0, 1]). Each run is
 * returned once, as { start, len } in array-index space.
 */
function findRuns(segments: SegmentType[], kind: SegmentType): { start: number; len: number }[] {
  const n = segments.length;
  const visited = new Array<boolean>(n).fill(false);
  const runs: { start: number; len: number }[] = [];
  for (let i = 0; i < n; i++) {
    if (segments[i] !== kind || visited[i]) continue;
    let start = i;
    // Walk backward while the predecessor is still the same kind — finds the
    // true start of a run that wraps past index 0. Bounded by n since a ring
    // always has at least one "hole" segment, so this can never loop forever.
    while (segments[(start - 1 + n) % n] === kind) {
      start = (start - 1 + n) % n;
      if (start === i) break; // entire ring is this kind — degenerate, shouldn't happen
    }
    let len = 0;
    let idx = start;
    while (len < n && segments[idx] === kind) {
      visited[idx] = true;
      idx = (idx + 1) % n;
      len++;
    }
    runs.push({ start, len });
  }
  return runs;
}

/**
 * One merged, seam-free mesh geometry per ring per segment kind — every
 * contiguous run of same-kind segments becomes ONE shape inside a single
 * ExtrudeGeometry (THREE.ExtrudeGeometry accepts an array of shapes and
 * merges them into one BufferGeometry), so there is no mesh boundary at all
 * between two neighboring "solid" (or two neighboring "danger") segments —
 * only real holes (never rendered) create an actual gap. Runs are authored
 * at their ABSOLUTE angle in the ring's own unrotated local frame; the
 * per-ring rotation is applied once, on the whole mesh, at render time.
 */
function buildRunGeometry(ring: RingData, kind: "solid" | "danger"): THREE.BufferGeometry | null {
  const runs = findRuns(ring.segments, kind);
  if (runs.length === 0) return null;

  const segmentAngle = getSegmentAngle();
  const inner = CFG.ringInnerRadius;
  const outer = CFG.ringOuterRadius;
  const shapes = runs.map(({ start, len }) => {
    // tower-physics.tsx's CuboidCollider for segment k sits CENTERED at
    // world angle k*segmentAngle (position uses `a = k*segmentAngle`
    // directly, not the segment's leading edge) — the -0.5 below is what
    // makes segment k's visual span [( k-0.5)*segmentAngle, (k+0.5)*segmentAngle],
    // i.e. centered on that same angle, so the rendered wedge and its
    // collider always agree on where segment k actually is. Without this
    // offset the whole run is shifted by half a segment relative to
    // physics — the ball can visually clear a hole while a shifted
    // "solid"/"danger" collider is still there (or vice-versa).
    const a0 = (start - 0.5) * segmentAngle;
    const a1 = a0 + len * segmentAngle;
    const shape = new THREE.Shape();
    shape.absarc(0, 0, outer, a0, a1, false);
    shape.absarc(0, 0, inner, a1, a0, true);
    return shape;
  });

  const scaleY = kind === "danger" ? 1.12 : 1;
  const geo = new THREE.ExtrudeGeometry(shapes, {
    depth: CFG.ringThickness * scaleY,
    bevelEnabled: false,
    curveSegments: 6,
  });
  // Extrude grows along +Z; rotate so the platform lies in XZ, top face at y=0.
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -CFG.ringThickness * scaleY, 0);
  // Perf audit Prioridade 5: this merged multi-shape geometry needs an
  // explicit, correct bounding sphere before frustum culling can be trusted
  // (RingMesh below re-enables it) — computed once here, right after the
  // geometry's final transform, not left to whatever default a consumer
  // might assume.
  geo.computeBoundingSphere();
  return geo;
}

/** One ring's worth of mesh for one segment kind — geometry built once (memoized per ring instance) and reused every frame; only rotation/visibility change per frame. */
function RingMesh({
  ring,
  kind,
  runtime,
  material,
}: {
  ring: RingData;
  kind: "solid" | "danger";
  runtime: EngineRuntime;
  material: THREE.Material;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `ring` is stable for the lifetime of this component (never mutated post-generation); `kind` never changes across renders of a given instance.
  const geometry = useMemo(() => buildRunGeometry(ring, kind), []);

  useEffect(() => {
    return () => {
      geometry?.dispose();
    };
  }, [geometry]);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const t = runtime.time;
    const body = runtime.ballRef.current;
    const ballY = body && body.isValid() ? body.translation().y : CFG.ballSpawnY;
    mesh.visible = ringVisible(runtime, ring, t, ballY);
    if (mesh.visible) mesh.rotation.y = ringRotation(runtime, ring, t);
  });

  if (!geometry) return null;
  // frustumCulled intentionally left at its Three.js default (true) — the
  // geometry now carries a correct, explicitly computed bounding sphere
  // (buildRunGeometry above), so off-screen rings/segments outside the
  // camera frustum are skipped for free. Verified in the browser across
  // portrait/landscape and while the tower rotates that no ring inside the
  // render window ever disappears prematurely (see perf-audit report).
  return <mesh ref={meshRef} geometry={geometry} material={material} position={[0, ring.y, 0]} />;
}

export function TowerRenderer({ runtime }: { runtime: EngineRuntime }) {
  const columnRef = useRef<THREE.Mesh>(null);
  const passes = useGameStore((s) => s.platformsPassed);

  // Minimalist pass: flat MeshLambertMaterial (diffuse-only, no PBR/specular/
  // metalness/roughness compute) instead of MeshStandardMaterial — much
  // cheaper per-pixel, still takes a hint of shading from the scene's single
  // directional light so the tower doesn't read as a completely flat 2D
  // cutout. Danger platforms are solid red — no emissive/glow.
  const baseMat = useMemo(() => new THREE.MeshLambertMaterial({ color: CFG.colors.platform }), []);
  const dangerMat = useMemo(() => new THREE.MeshLambertMaterial({ color: CFG.colors.danger }), []);

  useEffect(() => {
    return () => {
      baseMat.dispose();
      dangerMat.dispose();
    };
  }, [baseMat, dangerMat]);

  useFrame(() => {
    // Endless central column follows the ball.
    const body = runtime.ballRef.current;
    const ballY = body && body.isValid() ? body.translation().y : CFG.ballSpawnY;
    if (columnRef.current) columnRef.current.position.y = ballY;
  });

  // Purely a visual lookahead window (Prioridade 4 do audit de performance) —
  // deliberately NOT CFG.physicsAhead/physicsBehind, which stay fixed and
  // untouched by quality tier: how many rings are simulated never changes,
  // only how many are drawn for the player to see coming.
  const first = Math.max(0, passes - QUALITY.renderBehind);
  const last = Math.min(runtime.rings.length - 1, passes + QUALITY.renderAhead);
  const windowRings: RingData[] = [];
  for (let i = first; i <= last; i++) {
    const ring = runtime.rings[i];
    if (ring) windowRings.push(ring);
  }

  return (
    <group>
      {windowRings.map((ring) => (
        <group key={ring.index}>
          <RingMesh ring={ring} kind="solid" runtime={runtime} material={baseMat} />
          <RingMesh ring={ring} kind="danger" runtime={runtime} material={dangerMat} />
        </group>
      ))}

      <mesh ref={columnRef}>
        <cylinderGeometry args={[CFG.columnRadius, CFG.columnRadius, 64, QUALITY.columnRadialSegments]} />
        <meshLambertMaterial color="#1A1228" />
      </mesh>
    </group>
  );
}
