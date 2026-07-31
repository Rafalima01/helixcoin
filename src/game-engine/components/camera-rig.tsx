"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { activeEngineConfig as CFG } from "@/game-engine/config";
import type { EngineRuntime } from "@/game-engine/types";

const radial = new THREE.Vector3();
const lookTarget = new THREE.Vector3();

// Three.js's PerspectiveCamera FOV is always vertical, so visible world
// height at a given distance is already aspect-independent — only visible
// WIDTH shrinks as aspect narrows. Below this fraction of the half-frustum
// width, the tower's fixed world-space outer radius would consume too much
// of the screen (the "espremida nas bordas" complaint on phone portrait
// viewports), so the camera dollies back just enough to keep it under this
// fraction — the same fixed FOV/pitch, just farther away.
const HALF_FRUSTUM_FILL = 0.8;
const HALF_FOV_TAN = Math.tan((CFG.cameraFov * Math.PI) / 360);
const MIN_HALF_WIDTH = CFG.ringOuterRadius / HALF_FRUSTUM_FILL;
// Guards only truly extreme/degenerate aspects (e.g. a mid-resize glitch
// frame) — ordinary phone portrait aspects stay well under this.
const MAX_DISTANCE_SCALE = 2.2;
// Flat ~8% pull-back on top of the aspect-adaptive distance below — approved
// framing/angle/lookAt/FOV are otherwise untouched; this only scales the
// radial (X/Z) distance, uniformly at every aspect.
const DISTANCE_BOOST = 1.08;

/** Aspect-adaptive radial camera distance — unchanged (== CFG.cameraDistance) whenever that distance already keeps the tower under HALF_FRUSTUM_FILL, i.e. at desktop/landscape aspects. */
function framingDistance(aspect: number): number {
  if (!Number.isFinite(aspect) || aspect <= 0) return CFG.cameraDistance * DISTANCE_BOOST;
  const required = MIN_HALF_WIDTH / (HALF_FOV_TAN * aspect);
  const base = Math.min(CFG.cameraDistance * MAX_DISTANCE_SCALE, Math.max(CFG.cameraDistance, required));
  return base * DISTANCE_BOOST;
}

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

    const distance = framingDistance((camera as THREE.PerspectiveCamera).aspect);
    const targetX = radial.x * distance;
    const targetZ = radial.z * distance;
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
