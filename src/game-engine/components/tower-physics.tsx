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
 * One kinematic RigidBody per behavior group (solid / danger) per ring.
 * Bodies live only inside a small window around the ball; rotation is written
 * every physics step from the exact same math the renderer uses.
 */
function RingBody({
  ring,
  kind,
  geometry,
  register,
  touch,
}: {
  ring: RingData;
  kind: TouchKind;
  geometry: ColliderGeometry;
  register: (key: string, entry: BodyEntry | null) => void;
  touch: (ringIndex: number, kind: TouchKind) => void;
}) {
  const key = `${ring.index}:${kind}`;
  const segments: number[] = [];
  for (let k = 0; k < ring.segments.length; k++) {
    const type = ring.segments[k];
    if (kind === "solid" && type === "solid") segments.push(k);
    else if (kind === "danger" && type === "danger") segments.push(k);
  }
  if (segments.length === 0) return null;

  const { radialHalf, thickHalf, chordHalf, segmentAngle } = geometry;

  return (
    <RigidBody
      type="kinematicPosition"
      position={[0, ring.y, 0]}
      colliders={false}
      ref={(body) => {
        register(key, body ? { body, ring, enabled: true } : null);
      }}
      onCollisionEnter={() => touch(ring.index, kind)}
    >
      {segments.map((k) => {
        const a = k * segmentAngle;
        return (
          <CuboidCollider
            key={k}
            args={[radialHalf, thickHalf, chordHalf]}
            position={[Math.cos(a) * RING_MID_RADIUS, -thickHalf, Math.sin(a) * RING_MID_RADIUS]}
            rotation={[0, -a, 0]}
            restitution={0}
            friction={0.05}
          />
        );
      })}
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
          quatScratch.setFromAxisAngle(Y_AXIS, -rot);
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
          <group key={ring.index}>
            <RingBody ring={ring} kind="solid" geometry={geometry} register={register} touch={touch} />
            <RingBody ring={ring} kind="danger" geometry={geometry} register={register} touch={touch} />
          </group>
        )
      )}
    </>
  );
}
