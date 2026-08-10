"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  RigidBody,
  CuboidCollider,
  useBeforePhysicsStep,
  type RapierRigidBody,
} from "@react-three/rapier";
import * as THREE from "three";
import { activeEngineConfig as CFG, RING_MID_RADIUS, getSegmentAngle } from "@/game-engine/config";
import type { EngineRuntime, RingData, TouchKind } from "@/game-engine/types";
import { ringRotation, ringVisible } from "@/game-engine/tower-state";

const quatScratch = new THREE.Quaternion();
const Y_AXIS = new THREE.Vector3(0, 1, 0);

type BodyEntry = { body: RapierRigidBody; ring: RingData; enabled: boolean };

/** Collider half-extents + segment angle for the CURRENT match's active config — see TowerPhysics's useMemo. */
interface ColliderGeometry {
  radialHalf: number;
  thickHalf: number;
  chordHalf: number;
  segmentAngle: number;
}

/**
 * One kinematic RigidBody per RING (not per behavior group). Perf audit
 * Prioridade 2: a ring with both solid and danger segments used to get TWO
 * separate RigidBody instances, each independently computing and applying
 * the exact same `ringRotation(runtime, ring, t)` value every physics
 * sub-step (rotation depends only on `ring`, never on segment kind) — a
 * provably redundant WASM call, not an approximation of one. Consolidating
 * to one body per ring removes that duplication and cuts the number of
 * kinematic bodies (and therefore setNextKinematicRotation calls) by up to
 * ~1/3 on rings that carry both kinds, with ZERO change to any collider:
 * every CuboidCollider below has the exact same args/position/rotation/
 * restitution/friction as before, computed by the exact same per-segment
 * formula — only the parent body changed. Touch-kind detection moves from
 * "which body fired onCollisionEnter" to "which individual collider fired
 * it" (each CuboidCollider carries its own onCollisionEnter — supported
 * directly by @react-three/rapier's ColliderOptions), so solid vs danger
 * are still told apart exactly as before, just per-collider instead of
 * per-body.
 *
 * Segment-level merging (representing a whole contiguous run as ONE bigger
 * collider, mirroring the renderer's merged-run geometry) was investigated
 * and deliberately NOT done: a flat box wide enough to span several segments
 * would either cut into the true wedge or miss its true edges (a straight
 * chord doesn't follow a wide arc — the same class of bug already found and
 * fixed once in tower-renderer.tsx), and a per-run TrimeshCollider/
 * ConvexHullCollider carries a real, undocumented risk of subtly different
 * contact/bounce response versus the well-tested CuboidCollider-per-segment
 * shape this game's collision behavior has already been validated against.
 * Bodies (not collider shapes) is the safe reduction available here.
 */
function RingBody({
  ring,
  geometry,
  register,
  touch,
}: {
  ring: RingData;
  geometry: ColliderGeometry;
  register: (key: string, entry: BodyEntry | null) => void;
  touch: (ringIndex: number, kind: TouchKind) => void;
}) {
  const solidSegments: number[] = [];
  const dangerSegments: number[] = [];
  for (let k = 0; k < ring.segments.length; k++) {
    const type = ring.segments[k];
    if (type === "solid") solidSegments.push(k);
    else if (type === "danger") dangerSegments.push(k);
  }
  if (solidSegments.length === 0 && dangerSegments.length === 0) return null;

  const { radialHalf, thickHalf, chordHalf, segmentAngle } = geometry;

  const renderColliders = (segments: number[], kind: TouchKind) =>
    segments.map((k) => {
      const a = k * segmentAngle;
      return (
        <CuboidCollider
          key={`${kind}:${k}`}
          args={[radialHalf, thickHalf, chordHalf]}
          position={[Math.cos(a) * RING_MID_RADIUS, -thickHalf, -Math.sin(a) * RING_MID_RADIUS]}
          rotation={[0, a, 0]}
          restitution={0}
          friction={0.05}
          onCollisionEnter={() => touch(ring.index, kind)}
        />
      );
    });

  return (
    <RigidBody
      type="kinematicPosition"
      position={[0, ring.y, 0]}
      colliders={false}
      ref={(body) => {
        register(String(ring.index), body ? { body, ring, enabled: true } : null);
      }}
    >
      {renderColliders(solidSegments, "solid")}
      {renderColliders(dangerSegments, "danger")}
    </RigidBody>
  );
}

export function TowerPhysics({
  runtime,
  windowRings,
  touch,
}: {
  runtime: EngineRuntime;
  windowRings: RingData[];
  touch: (ringIndex: number, kind: TouchKind) => void;
}) {
  const bodiesRef = useRef(new Map<string, BodyEntry>());
  const alive = useRef(true);

  // Computed once per match (TowerPhysics remounts with the rest of
  // GameEngine's tree on every new seed) — segmentAngle depends on the
  // active config's segmentsPerRing, which is now per-mode configurable,
  // so this must NOT be a module-scope constant (it would go stale the
  // moment a later match used a different value).
  const geometry = useMemo<ColliderGeometry>(() => {
    const segmentAngle = getSegmentAngle();
    return {
      radialHalf: (CFG.ringOuterRadius - CFG.ringInnerRadius) / 2,
      thickHalf: CFG.ringThickness / 2,
      // Chord slightly overlaps neighbours so there are no phantom gaps at segment seams.
      chordHalf: RING_MID_RADIUS * Math.tan(segmentAngle / 2) * 1.08,
      segmentAngle,
    };
  }, []);

  useEffect(() => {
    alive.current = true;
    const bodies = bodiesRef.current;
    return () => {
      // Engine is unmounting (match swap) — never touch bodies again.
      alive.current = false;
      bodies.clear();
    };
  }, []);

  const register = useCallback((key: string, entry: BodyEntry | null) => {
    if (entry) bodiesRef.current.set(key, entry);
    else bodiesRef.current.delete(key);
  }, []);

  // Drive kinematic rotation from the shared tower-state math every step.
  // Wrapped in try/catch: an exception thrown across the wasm boundary would
  // leave the Rapier world in a poisoned (unusable) state.
  useBeforePhysicsStep(() => {
    if (!alive.current) return;
    try {
      const t = runtime.time;
      const body = runtime.ballRef.current;
      const ballY = body && body.isValid() ? body.translation().y : CFG.ballSpawnY;

      for (const [key, entry] of bodiesRef.current) {
        // A body can be torn down (window shift / ring break / match swap)
        // between React's ref cleanup and this step — writing to it panics
        // and poisons the wasm world. Each entry is guarded individually so
        // one bad body can never take the others down with it.
        try {
          if (!entry.body.isValid()) continue;
          const rot = ringRotation(runtime, entry.ring, t);
          if (!Number.isFinite(rot)) continue;
          const visible = ringVisible(runtime, entry.ring, t, ballY);
          // Blinking rings phase out by disabling their colliders entirely.
          if (visible !== entry.enabled) {
            entry.body.setEnabled(visible);
            entry.enabled = visible;
          }
          if (!visible) continue;
          quatScratch.setFromAxisAngle(Y_AXIS, rot);
          entry.body.setNextKinematicRotation(quatScratch);
        } catch (err) {
          bodiesRef.current.delete(key);
          if (process.env.NODE_ENV !== "production") console.error("ring body dropped:", err);
        }
      }
    } catch (err) {
      if (process.env.NODE_ENV !== "production") console.error("tower-physics step:", err);
    }
  });

  return (
    <>
      {windowRings.map((ring) =>
        runtime.broken.has(ring.index) ? null : (
          <RingBody key={ring.index} ring={ring} geometry={geometry} register={register} touch={touch} />
        )
      )}
    </>
  );
}
