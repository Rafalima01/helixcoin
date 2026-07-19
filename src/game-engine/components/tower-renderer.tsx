"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ENGINE_CONFIG as CFG, SEGMENT_ANGLE } from "@/game-engine/config";
import type { EngineRuntime } from "@/game-engine/types";
import { ringRotation, ringVisible } from "@/game-engine/tower-state";
import { useGameStore } from "@/store/game-store";

/** Extruded annular-sector geometry, authored centered on the +X axis. */
function createSegmentGeometry(scaleY = 1): THREE.BufferGeometry {
  const half = (SEGMENT_ANGLE / 2) * CFG.segmentGapFactor;
  const inner = CFG.ringInnerRadius;
  const outer = CFG.ringOuterRadius;
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outer, -half, half, false);
  shape.absarc(0, 0, inner, half, -half, true);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: CFG.ringThickness * scaleY,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 1,
    curveSegments: 6,
  });
  // Extrude grows along +Z; rotate so the platform lies in XZ, top face at y=0.
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -CFG.ringThickness * scaleY, 0);
  return geo;
}

const dummy = new THREE.Object3D();
const colorScratch = new THREE.Color();
const paletteColors = CFG.colors.palette.map((c) => new THREE.Color(c));
const variantColors = {
  fragile: new THREE.Color(CFG.colors.fragile),
  ice: new THREE.Color(CFG.colors.ice),
  boost: new THREE.Color(CFG.colors.boost),
};

export function TowerRenderer({ runtime }: { runtime: EngineRuntime }) {
  const baseRef = useRef<THREE.InstancedMesh>(null);
  const dangerRef = useRef<THREE.InstancedMesh>(null);
  const bonusRef = useRef<THREE.InstancedMesh>(null);
  const columnRef = useRef<THREE.Mesh>(null);

  const baseGeo = useMemo(() => createSegmentGeometry(), []);
  const dangerGeo = useMemo(() => createSegmentGeometry(1.12), []);

  const baseMat = useMemo(
    () => new THREE.MeshStandardMaterial({ metalness: 0.35, roughness: 0.42 }),
    []
  );
  const dangerMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: CFG.colors.danger,
        emissive: CFG.colors.danger,
        emissiveIntensity: 0.85,
        metalness: 0.2,
        roughness: 0.35,
      }),
    []
  );
  const bonusMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: CFG.colors.bonus,
        emissive: CFG.colors.bonus,
        emissiveIntensity: 0.9,
        metalness: 0.55,
        roughness: 0.25,
      }),
    []
  );

  useEffect(() => {
    return () => {
      baseGeo.dispose();
      dangerGeo.dispose();
      baseMat.dispose();
      dangerMat.dispose();
      bonusMat.dispose();
    };
  }, [baseGeo, dangerGeo, baseMat, dangerMat, bonusMat]);

  useFrame(() => {
    const base = baseRef.current;
    const danger = dangerRef.current;
    const bonus = bonusRef.current;
    if (!base || !danger || !bonus) return;

    const t = runtime.time;
    const body = runtime.ballRef.current;
    const ballY = body && body.isValid() ? body.translation().y : CFG.ballSpawnY;
    const passes = useGameStore.getState().platformsPassed;

    const first = Math.max(0, passes - CFG.renderBehind);
    const last = Math.min(runtime.rings.length - 1, passes + CFG.renderAhead);

    let nBase = 0;
    let nDanger = 0;
    let nBonus = 0;

    for (let i = first; i <= last; i++) {
      const ring = runtime.rings[i];
      if (!ring) continue;
      if (!ringVisible(runtime, ring, t, ballY)) continue;

      const rot = ringRotation(runtime, ring, t);
      const consumedBonus = runtime.consumedBonus.has(ring.index);

      for (let k = 0; k < ring.segments.length; k++) {
        const type = ring.segments[k];
        if (type === "hole") continue;

        dummy.position.set(0, ring.y, 0);
        dummy.rotation.set(0, -(rot + k * SEGMENT_ANGLE), 0);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();

        if (type === "danger") {
          if (nDanger < CFG.maxInstances) {
            danger.setMatrixAt(nDanger, dummy.matrix);
            nDanger++;
          }
        } else if (type === "bonus" && !consumedBonus) {
          if (nBonus < CFG.maxInstances) {
            bonus.setMatrixAt(nBonus, dummy.matrix);
            nBonus++;
          }
        } else if (nBase < CFG.maxInstances) {
          base.setMatrixAt(nBase, dummy.matrix);
          if (ring.variant === "normal") {
            colorScratch.copy(paletteColors[ring.colorIndex]);
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
    bonus.count = nBonus;
    base.instanceMatrix.needsUpdate = true;
    danger.instanceMatrix.needsUpdate = true;
    bonus.instanceMatrix.needsUpdate = true;
    if (base.instanceColor) base.instanceColor.needsUpdate = true;

    // Endless central column follows the ball.
    if (columnRef.current) columnRef.current.position.y = ballY;
  });

  return (
    <group>
      <instancedMesh ref={baseRef} args={[baseGeo, baseMat, CFG.maxInstances]} frustumCulled={false} />
      <instancedMesh ref={dangerRef} args={[dangerGeo, dangerMat, CFG.maxInstances]} frustumCulled={false} />
      <instancedMesh ref={bonusRef} args={[baseGeo, bonusMat, CFG.maxInstances]} frustumCulled={false} />

      <mesh ref={columnRef}>
        <cylinderGeometry args={[CFG.columnRadius, CFG.columnRadius, 64, 24]} />
        <meshStandardMaterial
          color="#1A1228"
          emissive="#8B5CF6"
          emissiveIntensity={0.08}
          metalness={0.6}
          roughness={0.35}
        />
      </mesh>
    </group>
  );
}
