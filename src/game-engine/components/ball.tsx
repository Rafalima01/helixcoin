"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RigidBody, BallCollider, type RapierRigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { activeEngineConfig as CFG } from "@/game-engine/config";
import { activeQualitySettings as QUALITY } from "@/game-engine/quality";
import type { EngineRuntime } from "@/game-engine/types";
import { ringVisible } from "@/game-engine/tower-state";
import { useGameStore } from "@/store/game-store";
import { particleBus } from "@/game-engine/components/particles";

const idleColor = new THREE.Color(CFG.colors.ballIdle);
const fireColor = new THREE.Color(CFG.colors.ballFire);

/**
 * The ball is a real dynamic body: gravity pulls it, contacts stop it, and the
 * bounce impulse is applied through the physics engine on contact events.
 * Translations are locked to Y (Helix towers rotate around the ball), which
 * makes the simulation unconditionally stable — no lateral jitter possible.
 */
export function Ball({ runtime }: { runtime: EngineRuntime }) {
  const bodyRef = useRef<RapierRigidBody>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshLambertMaterial>(null);
  const shadowRef = useRef<THREE.Mesh>(null);
  const fireLerp = useRef(0);
  const smokeTimer = useRef(0);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    const body = bodyRef.current;
    const mesh = meshRef.current;
    if (!body || !mesh || !body.isValid()) return;

    // Fire mode visual: solid color swap only — no emissive/light, kept as a
    // simple flat color lerp for player feedback.
    const fire = useGameStore.getState().fireMode;
    fireLerp.current += ((fire ? 1 : 0) - fireLerp.current) * Math.min(1, dt * 8);
    const t = fireLerp.current;
    if (matRef.current) {
      matRef.current.color.lerpColors(idleColor, fireColor, t);
    }

    // Smoke trail: a couple of tiny, quick-fading puffs per second while the
    // ball is actually falling — reuses the shared particle pool
    // (components/particles.tsx) that already backs the bounce/death/goal
    // bursts instead of a dedicated system. Throttled by a timer (not one
    // spawn per frame) to keep this to a handful of instances at any time,
    // regardless of frame rate.
    const vy = body.linvel().y;
    if (useGameStore.getState().status === "playing" && vy < -0.5) {
      smokeTimer.current += dt;
      if (smokeTimer.current >= 0.09) {
        smokeTimer.current = 0;
        const pos = body.translation();
        particleBus.spawnBurst(pos.x, pos.y, pos.z, CFG.colors.trailSmoke, {
          count: 1,
          speed: 0.08,
          upward: 0.05,
          size: 0.05,
          ttl: 0.3,
          gravity: 0,
        });
      }
    } else {
      smokeTimer.current = 0;
    }

    // Dynamic blob shadow projected on the next platform below.
    const shadow = shadowRef.current;
    if (shadow) {
      const y = body.translation().y;
      let idx = Math.max(0, Math.ceil(-y / CFG.ringSpacing));
      let found = false;
      for (let i = idx; i < idx + 5 && i < runtime.rings.length; i++) {
        const ring = runtime.rings[i];
        if (!ring) break;
        if (ringVisible(runtime, ring, runtime.time, y)) {
          idx = i;
          found = true;
          break;
        }
      }
      if (found) {
        const ringY = -idx * CFG.ringSpacing;
        const dist = Math.max(0, y - ringY);
        shadow.visible = dist < CFG.ringSpacing * 2.5;
        shadow.position.set(CFG.ballOrbitRadius, ringY + 0.012, 0);
        const spread = 1 + dist * 0.35;
        shadow.scale.setScalar(spread);
        (shadow.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.4 - dist * 0.09);
      } else {
        shadow.visible = false;
      }
    }
  });

  return (
    <>
      <RigidBody
        ref={(body) => {
          bodyRef.current = body;
          runtime.ballRef.current = body;
        }}
        colliders={false}
        position={[CFG.ballOrbitRadius, CFG.ballSpawnY, 0]}
        enabledTranslations={[false, true, false]}
        enabledRotations={[false, false, false]}
        ccd
        canSleep={false}
      >
        {/* Physics radius is fixed regardless of tier — only the visual mesh below (sphereGeometry segments) scales down on low-end tiers. */}
        <BallCollider args={[CFG.ballRadius]} restitution={0} friction={0.05} />
        <mesh ref={meshRef}>
          <sphereGeometry args={[CFG.ballRadius, QUALITY.ballSegments, QUALITY.ballSegments]} />
          <meshLambertMaterial ref={matRef} color={CFG.colors.ballIdle} />
        </mesh>
      </RigidBody>

      {/* Cheap dynamic shadow — a fading disc that tracks the ring below. */}
      <mesh ref={shadowRef} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
        <circleGeometry args={[CFG.ballRadius * 1.5, 20]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.4} depthWrite={false} />
      </mesh>
    </>
  );
}
