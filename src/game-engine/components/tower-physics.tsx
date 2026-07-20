"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  RigidBody,
  CuboidCollider,
  useBeforePhysicsStep,
  type RapierRigidBody,
} from "@react-three/rapier";
import * as THREE from "three";
import { ENGINE_CONFIG as CFG, RING_MID_RADIUS, SEGMENT_ANGLE } from "@/game-engine/config";
import type { EngineRuntime, RingData, TouchKind } from "@/game-engine/types";
import { ringRotation, ringVisible } from "@/game-engine/tower-state";

const RADIAL_HALF = (CFG.ringOuterRadius - CFG.ringInnerRadius) / 2;
const THICK_HALF = CFG.ringThickness / 2;
// Chord slightly overlaps neighbours so there are no phantom gaps at segment seams.
const CHORD_HALF = RING_MID_RADIUS * Math.tan(SEGMENT_ANGLE / 2) * 1.08;

const quatScratch = new THREE.Quaternion();
const Y_AXIS = new THREE.Vector3(0, 1, 0);

type BodyEntry = { body: RapierRigidBody; ring: RingData; enabled: boolean };

/**
 * One kinematic RigidBody per behavior group (solid / danger / bonus) per ring.
 * Bodies live only inside a small window around the ball; rotation is written
 * every physics step from the exact same math the renderer uses.
 */
function RingBody({
  ring,
  kind,
  register,
  touch,
}: {
  ring: RingData;
  kind: TouchKind;
  register: (key: string, entry: BodyEntry | null) => void;
  touch: (ringIndex: number, kind: TouchKind) => void;
}) {
  const key = `${ring.index}:${kind}`;
  const segments: number[] = [];
  for (let k = 0; k < ring.segments.length; k++) {
    const type = ring.segments[k];
    if (kind === "solid" && type === "solid") segments.push(k);
    else if (kind === "danger" && type === "danger") segments.push(k);
    else if (kind === "bonus" && type === "bonus") segments.push(k);
  }
  if (segments.length === 0) return null;

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
        const a = k * SEGMENT_ANGLE;
        return (
          <CuboidCollider
            key={k}
            args={[RADIAL_HALF, THICK_HALF, CHORD_HALF]}
            position={[Math.cos(a) * RING_MID_RADIUS, -THICK_HALF, Math.sin(a) * RING_MID_RADIUS]}
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
            <RingBody ring={ring} kind="solid" register={register} touch={touch} />
            <RingBody ring={ring} kind="danger" register={register} touch={touch} />
            <RingBody ring={ring} kind="bonus" register={register} touch={touch} />
          </group>
        )
      )}
    </>
  );
}
