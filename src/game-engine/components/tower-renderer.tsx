"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { activeEngineConfig as CFG, getSegmentAngle } from "@/game-engine/config";
import type { EngineRuntime } from "@/game-engine/types";
import { ringRotation, ringVisible } from "@/game-engine/tower-state";
import { useGameStore } from "@/store/game-store";

/** Extruded annular-sector geometry, authored centered on the +X axis. */
function createSegmentGeometry(scaleY = 1): THREE.BufferGeometry {
  const half = (getSegmentAngle() / 2) * CFG.segmentGapFactor;
  const inner = CFG.ringInnerRadius;
  const outer = CFG.ringOuterRadius;
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outer, -half, half, false);
  shape.absarc(0, 0, inner, half, -half, true);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: CFG.ringThickness * scaleY,
    bevelEnabled: false,
    curveSegments: 6,
  });
  // Extrude grows along +Z; rotate so the platform lies in XZ, top face at y=0.
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -CFG.ringThickness * scaleY, 0);
  return geo;
}

const dummy = new THREE.Object3D();
const colorScratch = new THREE.Color();
const platformColor = new THREE.Color(CFG.colors.platform);
const variantColors = {
  fragile: new THREE.Color(CFG.colors.fragile),
  ice: new THREE.Color(CFG.colors.ice),
  boost: new THREE.Color(CFG.colors.boost),
};

export function TowerRenderer({ runtime }: { runtime: EngineRuntime }) {
  const baseRef = useRef<THREE.InstancedMesh>(null);
  const dangerRef = useRef<THREE.InstancedMesh>(null);
  const columnRef = useRef<THREE.Mesh>(null);

  const baseGeo = useMemo(() => createSegmentGeometry(), []);
  const dangerGeo = useMemo(() => createSegmentGeometry(1.12), []);

  // Minimalist pass: flat MeshLambertMaterial (diffuse-only, no PBR/specular/
  // metalness/roughness compute) instead of MeshStandardMaterial — much
  // cheaper per-pixel, still takes a hint of shading from the scene's single
  // directional light so the tower doesn't read as a completely flat 2D
  // cutout. Danger platforms are solid red now — no emissive/glow.
  const baseMat = useMemo(() => new THREE.MeshLambertMaterial({ color: "#ffffff" }), []);
  const dangerMat = useMemo(() => new THREE.MeshLambertMaterial({ color: CFG.colors.danger }), []);

  useEffect(() => {
    return () => {
      baseGeo.dispose();
      dangerGeo.dispose();
      baseMat.dispose();
      dangerMat.dispose();
    };
  }, [baseGeo, dangerGeo, baseMat, dangerMat]);

  useFrame(() => {
    const base = baseRef.current;
    const danger = dangerRef.current;
    if (!base || !danger) return;

    const t = runtime.time;
    const body = runtime.ballRef.current;
    const ballY = body && body.isValid() ? body.translation().y : CFG.ballSpawnY;
    const passes = useGameStore.getState().platformsPassed;

    const first = Math.max(0, passes - CFG.renderBehind);
    const last = Math.min(runtime.rings.length - 1, passes + CFG.renderAhead);
    const segmentAngle = getSegmentAngle();

    let nBase = 0;
    let nDanger = 0;

    for (let i = first; i <= last; i++) {
      const ring = runtime.rings[i];
      if (!ring) continue;
      if (!ringVisible(runtime, ring, t, ballY)) continue;

      const rot = ringRotation(runtime, ring, t);

      for (let k = 0; k < ring.segments.length; k++) {
        const type = ring.segments[k];
        if (type === "hole") continue;

        dummy.position.set(0, ring.y, 0);
        dummy.rotation.set(0, -(rot + k * segmentAngle), 0);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();

        if (type === "danger") {
          if (nDanger < CFG.maxInstances) {
            danger.setMatrixAt(nDanger, dummy.matrix);
            nDanger++;
          }
        } else if (nBase < CFG.maxInstances) {
          base.setMatrixAt(nBase, dummy.matrix);
          if (ring.variant === "normal") {
            colorScratch.copy(platformColor);
          } else {
            colorScratch.copy(variantColors[ring.variant]);
          }
          base.setColorAt(nBase, colorScratch);
          nBase++;
        }
      }
    }

    base.count = nBase;
    danger.count = nDanger;
    base.instanceMatrix.needsUpdate = true;
    danger.instanceMatrix.needsUpdate = true;
    if (base.instanceColor) base.instanceColor.needsUpdate = true;

    // Endless central column follows the ball.
    if (columnRef.current) columnRef.current.position.y = ballY;
  });

  return (
    <group>
      <instancedMesh
        ref={baseRef}
        args={[baseGeo, baseMat, CFG.maxInstances]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={dangerRef}
        args={[dangerGeo, dangerMat, CFG.maxInstances]}
        frustumCulled={false}
      />

      <mesh ref={columnRef}>
        <cylinderGeometry args={[CFG.columnRadius, CFG.columnRadius, 64, 24]} />
        <meshLambertMaterial color="#1A1228" />
      </mesh>
    </group>
  );
}
