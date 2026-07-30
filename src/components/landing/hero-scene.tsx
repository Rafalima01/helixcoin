"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import { Trail } from "@react-three/drei";
import * as THREE from "three";
import { Particles, particleBus } from "@/game-engine/components/particles";

/**
 * Decorative-only render for the landing/auth hero — NOT a reduced GameEngine.
 * It borrows the game's geometry technique, palette and particle system, but
 * is its own composition with no EngineRuntime, no Rapier physics, no
 * match/bet lifecycle: the tower shape, ball and camera all move on simple
 * idle loops (useFrame + sine), never gravity or collision.
 *
 * `particleBus` (from the game engine) is a module-level singleton — sharing
 * it here is safe only because this scene and a live match (GameEngine, only
 * mounted on /play) never render in the same tab at once.
 *
 * Tune these constants — not the JSX below — to match a visual reference.
 */
const PALETTE = ["#8B5CF6", "#FF4FAE", "#16F2A5"] as const;
const GOLD = "#F0A83C";
const BALL_IDLE = "#FFFFFF";

const RING_COUNT = 5;
const RING_SPACING = 1.35;
const RING_INNER_RADIUS = 1.05;
const RING_OUTER_RADIUS = 2.35;
const RING_THICKNESS = 0.3;
const RING_ARC_FRACTION = 0.72; // fraction of a full circle each platform covers — the rest is the "hole"
const COLUMN_RADIUS = 0.5;

const BALL_RADIUS = 0.22;
const BALL_ORBIT_RADIUS = 1.7;
const BALL_BOB_AMPLITUDE = 0.35;
const BALL_BOB_SPEED = 0.6;

const CAMERA_DISTANCE = 6.4;
const CAMERA_HEIGHT = 1.6;
const CAMERA_ORBIT_SPEED = 0.05; // radians/sec
const CAMERA_ORBIT_ARC = 0.5; // max radians of swing either side of center
const CAMERA_FOV = 42;

const PARTICLE_INTERVAL = 0.9; // seconds between ambient bursts
const BLOOM_INTENSITY = 0.8;

/** Same extruded annular-sector technique as the game's TowerRenderer, own parameters — not exported there, so re-authored here. */
function segmentGeometry(fraction: number, thickness: number): THREE.BufferGeometry {
  const half = Math.PI * fraction;
  const shape = new THREE.Shape();
  shape.absarc(0, 0, RING_OUTER_RADIUS, -half, half, false);
  shape.absarc(0, 0, RING_INNER_RADIUS, half, -half, true);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 1,
    curveSegments: 10,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -thickness, 0);
  return geo;
}

function Tower() {
  const ringGeo = useMemo(() => segmentGeometry(RING_ARC_FRACTION, RING_THICKNESS), []);
  const columnGeo = useMemo(
    () => new THREE.CylinderGeometry(COLUMN_RADIUS, COLUMN_RADIUS, RING_COUNT * RING_SPACING + 2, 32),
    []
  );
  useEffect(() => () => {
    ringGeo.dispose();
    columnGeo.dispose();
  }, [ringGeo, columnGeo]);

  const ringRefs = useRef<(THREE.Group | null)[]>([]);

  useFrame((_, dt) => {
    ringRefs.current.forEach((g, i) => {
      if (!g) return;
      const dir = i % 2 === 0 ? 1 : -1;
      g.rotation.y += dir * (0.08 + i * 0.012) * dt;
    });
  });

  return (
    <group>
      <mesh geometry={columnGeo} position={[0, -((RING_COUNT * RING_SPACING) / 2) + 1, 0]}>
        <meshStandardMaterial color="#1A1228" emissive="#8B5CF6" emissiveIntensity={0.18} metalness={0.6} roughness={0.35} />
      </mesh>
      {Array.from({ length: RING_COUNT }).map((_, i) => (
        <group
          key={i}
          ref={(el) => {
            ringRefs.current[i] = el;
          }}
          position={[0, -i * RING_SPACING, 0]}
        >
          <mesh geometry={ringGeo} rotation={[0, (i * Math.PI) / 3, 0]}>
            <meshStandardMaterial
              color={PALETTE[i % PALETTE.length]}
              emissive={PALETTE[i % PALETTE.length]}
              emissiveIntensity={0.15}
              metalness={0.4}
              roughness={0.35}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function IdleBall() {
  const meshRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    const y = Math.sin(clock.elapsedTime * BALL_BOB_SPEED) * BALL_BOB_AMPLITUDE + 0.4;
    meshRef.current?.position.set(BALL_ORBIT_RADIUS, y, 0);
    lightRef.current?.position.set(BALL_ORBIT_RADIUS, y, 0);
  });

  return (
    <>
      <Trail width={2.2} length={5} decay={2} color={GOLD} attenuation={(w) => w * w}>
        <mesh ref={meshRef}>
          <sphereGeometry args={[BALL_RADIUS, 32, 32]} />
          <meshPhysicalMaterial
            color={BALL_IDLE}
            emissive={GOLD}
            emissiveIntensity={0.35}
            metalness={0.4}
            roughness={0.15}
            clearcoat={1}
            clearcoatRoughness={0.1}
          />
        </mesh>
      </Trail>
      <pointLight ref={lightRef} intensity={3} distance={5} color={GOLD} />
    </>
  );
}

function AmbientParticles() {
  const acc = useRef(0);
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < PARTICLE_INTERVAL) return;
    acc.current = 0;
    particleBus.spawnBurst(BALL_ORBIT_RADIUS, 0.4, 0, GOLD, {
      count: 5,
      speed: 0.5,
      upward: 0.6,
      size: 0.05,
      ttl: 1.6,
      gravity: -0.4,
    });
  });
  return <Particles />;
}

function DynamicLights() {
  const goldLight = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    const pulse = 0.75 + Math.sin(clock.elapsedTime * 0.7) * 0.25;
    if (goldLight.current) goldLight.current.intensity = 4 * pulse;
  });
  return (
    <>
      <ambientLight intensity={0.5} color="#a78bfa" />
      <directionalLight position={[4, 6, 4]} intensity={1} color="#ffffff" />
      <pointLight ref={goldLight} position={[-2, 1, 3]} intensity={4} color={GOLD} distance={9} />
      <pointLight position={[3, -3, -2]} intensity={3} color="#FF4FAE" distance={9} />
    </>
  );
}

function IdleCamera() {
  useFrame(({ camera, clock }) => {
    const angle = Math.sin(clock.elapsedTime * CAMERA_ORBIT_SPEED) * CAMERA_ORBIT_ARC;
    camera.position.set(Math.sin(angle) * CAMERA_DISTANCE, CAMERA_HEIGHT, Math.cos(angle) * CAMERA_DISTANCE);
    camera.lookAt(0, -0.3, 0);
  });
  return null;
}

export default function HeroScene({ className }: { className?: string }) {
  return (
    <div className={className}>
      <Canvas
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
        camera={{ fov: CAMERA_FOV, position: [0, CAMERA_HEIGHT, CAMERA_DISTANCE] }}
        style={{ width: "100%", height: "100%", display: "block" }}
      >
        <DynamicLights />
        <Tower />
        <IdleBall />
        <AmbientParticles />
        <IdleCamera />
        <EffectComposer multisampling={0}>
          <Bloom intensity={BLOOM_INTENSITY} luminanceThreshold={0.25} luminanceSmoothing={0.4} mipmapBlur />
          <Vignette eskil={false} offset={0.2} darkness={0.75} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
