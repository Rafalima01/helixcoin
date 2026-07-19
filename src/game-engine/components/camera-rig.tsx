"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ENGINE_CONFIG as CFG } from "@/game-engine/config";
import type { EngineRuntime } from "@/game-engine/types";

const radial = new THREE.Vector3();
const lookTarget = new THREE.Vector3();

/**
 * Helix Jump camera: the ball is the anchor of the frame, ALWAYS at the exact
 * horizontal center of the screen — the tower is what appears to move.
 *
 * - The camera position is recomputed every frame along the ball's radial
 *   axis (tower center → ball → camera). Because camera, ball and column are
 *   collinear with the ball in front, the central column can never sit
 *   between camera and ball, for any tower rotation, 0–360°.
 * - All three axes (X, Y, Z) follow the ball with framerate-independent
 *   exponential smoothing; the vertical lag is additionally hard-clamped so
 *   fast falls can never push the ball off-frame.
 * - The look target sits slightly below the ball: the ball reads at
 *   center-upper screen and the upcoming platforms, holes and danger zones
 *   fill the space below it — gameplay first, not realism.
 */
export function CameraRig({ runtime }: { runtime: EngineRuntime }) {
  const smooth = useRef<THREE.Vector3 | null>(null);

  useFrame(({ camera }, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    const body = runtime.ballRef.current;
    const bp =
      body && body.isValid()
        ? body.translation()
        : { x: CFG.ballOrbitRadius, y: CFG.ballSpawnY, z: 0 };

    // Radial direction of the ball around the tower axis (fallback +X).
    radial.set(bp.x, 0, bp.z);
    if (radial.lengthSq() < 1e-6) radial.set(1, 0, 0);
    radial.normalize();

    const targetX = radial.x * CFG.cameraDistance;
    const targetZ = radial.z * CFG.cameraDistance;
    const targetY = bp.y + CFG.cameraOffsetY;

    if (smooth.current === null) {
      smooth.current = new THREE.Vector3(targetX, targetY, targetZ);
    } else {
      const k = 1 - Math.exp(-CFG.cameraDamping * dt);
      const s = smooth.current;
      s.x += (targetX - s.x) * k;
      s.y += (targetY - s.y) * k;
      s.z += (targetZ - s.z) * k;
      // Never let vertical lag push the ball off-frame, up or down.
      if (s.y > targetY + CFG.cameraMaxLag) s.y = targetY + CFG.cameraMaxLag;
      if (s.y < targetY - CFG.cameraMaxLag) s.y = targetY - CFG.cameraMaxLag;
    }

    // Trauma shake: squared falloff, sampled with incommensurate frequencies.
    runtime.trauma = Math.max(0, runtime.trauma - CFG.shakeDecay * dt);
    const shake = runtime.trauma * runtime.trauma * CFG.shakeMagnitude;
    const t = runtime.time;
    const sx = shake * Math.sin(t * 47.3);
    const sy = shake * Math.sin(t * 39.1 + 2.1);

    const s = smooth.current;
    camera.position.set(s.x + sx, s.y + sy, s.z);
    // Aim at the ball's own axis so it stays dead-center horizontally.
    lookTarget.set(bp.x, bp.y - CFG.cameraLookDown + sy * 0.5, bp.z);
    camera.lookAt(lookTarget);
  });

  return null;
}
