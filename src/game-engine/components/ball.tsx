"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Trail } from "@react-three/drei";
import { RigidBody, BallCollider, type RapierRigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { ENGINE_CONFIG as CFG } from "@/game-engine/config";
import type { EngineRuntime } from "@/game-engine/types";
import { ringVisible } from "@/game-engine/tower-state";
import { useGameStore } from "@/store/game-store";

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
  const matRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const shadowRef = useRef<THREE.Mesh>(null);
  const fireLerp = useRef(0);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    const body = bodyRef.current;
    const mesh = meshRef.current;
    if (!body || !mesh || !body.isValid()) return;

    // Fire mode visual blend (color + emissive + light).
    const fire = useGameStore.getState().fireMode;
    fireLerp.current += ((fire ? 1 : 0) - fireLerp.current) * Math.min(1, dt * 8);
    const t = fireLerp.current;
    if (matRef.current) {
      matRef.current.color.lerpColors(idleColor, fireColor, t);
      matRef.current.emissive.lerpColors(idleColor, fireColor, t);
      matRef.current.emissiveIntensity = 0.25 + t * 1.6;
    }
    if (lightRef.current) {
      lightRef.current.intensity = 2 + t * 14;
      lightRef.current.color.lerpColors(idleColor, fireColor, Math.min(1, t * 1.5));
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
        (shadow.material as THREE.MeshBasicMaterial).opacity =
          Math.max(0, 0.4 - dist * 0.09);
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
        <BallCollider args={[CFG.ballRadius]} restitution={0} friction={0.05} />
        <Trail
          width={1.9}
          length={5}
          decay={2.2}
          color={CFG.colors.trailIdle}
          attenuation={(w) => w * w}
        >
          <mesh ref={meshRef} castShadow>
            <sphereGeometry args={[CFG.ballRadius, 32, 32]} />
            <meshPhysicalMaterial
              ref={matRef}
              color={CFG.colors.ballIdle}
              emissive={CFG.colors.ballIdle}
              emissiveIntensity={0.25}
              metalness={0.35}
              roughness={0.18}
              clearcoat={1}
              clearcoatRoughness={0.12}
            />
          </mesh>
        </Trail>
        <pointLight ref={lightRef} intensity={2} distance={4.5} color="#ffffff" />
      </RigidBody>

      {/* Cheap dynamic shadow — a fading disc that tracks the ring below. */}
      <mesh ref={shadowRef} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
        <circleGeometry args={[CFG.ballRadius * 1.5, 20]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.4} depthWrite={false} />
      </mesh>
    </>
  );
}
