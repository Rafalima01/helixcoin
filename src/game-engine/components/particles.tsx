"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const POOL_SIZE = 320;

interface Particle {
  alive: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  ttl: number;
  size: number;
  r: number;
  g: number;
  b: number;
  gravity: number;
}

/**
 * Pre-allocated particle pool rendered through a single InstancedMesh.
 * `spawnBurst` never allocates — it recycles slots from the pool.
 */
class ParticleBus {
  pool: Particle[] = Array.from({ length: POOL_SIZE }, () => ({
    alive: false,
    x: 0, y: 0, z: 0,
    vx: 0, vy: 0, vz: 0,
    life: 0, ttl: 1, size: 0.05,
    r: 1, g: 1, b: 1,
    gravity: -6,
  }));
  private cursor = 0;
  private color = new THREE.Color();

  spawnBurst(
    x: number,
    y: number,
    z: number,
    colorHex: string,
    opts: { count?: number; speed?: number; upward?: number; size?: number; ttl?: number; gravity?: number } = {}
  ) {
    const { count = 14, speed = 2.6, upward = 1.6, size = 0.055, ttl = 0.55, gravity = -7 } = opts;
    this.color.set(colorHex);
    for (let i = 0; i < count; i++) {
      const p = this.pool[this.cursor];
      this.cursor = (this.cursor + 1) % POOL_SIZE;
      const angle = Math.random() * Math.PI * 2;
      const radial = (0.3 + Math.random() * 0.7) * speed;
      p.alive = true;
      p.x = x; p.y = y; p.z = z;
      p.vx = Math.cos(angle) * radial;
      p.vz = Math.sin(angle) * radial;
      p.vy = upward * (0.4 + Math.random() * 0.9);
      p.life = 0;
      p.ttl = ttl * (0.7 + Math.random() * 0.6);
      p.size = size * (0.7 + Math.random() * 0.8);
      p.r = this.color.r; p.g = this.color.g; p.b = this.color.b;
      p.gravity = gravity;
    }
  }

  clear() {
    for (const p of this.pool) p.alive = false;
  }
}

export const particleBus = new ParticleBus();

const dummy = new THREE.Object3D();
const colorScratch = new THREE.Color();

export function Particles() {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const geometry = useMemo(() => new THREE.SphereGeometry(1, 6, 6), []);
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    []
  );

  useEffect(() => {
    particleBus.clear();
    return () => {
      particleBus.clear();
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  useFrame((_, rawDt) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dt = Math.min(rawDt, 1 / 30);
    let n = 0;
    for (const p of particleBus.pool) {
      if (!p.alive) continue;
      p.life += dt;
      if (p.life >= p.ttl) {
        p.alive = false;
        continue;
      }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const fade = 1 - p.life / p.ttl;
      dummy.position.set(p.x, p.y, p.z);
      dummy.scale.setScalar(p.size * fade);
      dummy.updateMatrix();
      mesh.setMatrixAt(n, dummy.matrix);
      colorScratch.setRGB(p.r, p.g, p.b);
      mesh.setColorAt(n, colorScratch);
      n++;
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, POOL_SIZE]}
      frustumCulled={false}
    />
  );
}
