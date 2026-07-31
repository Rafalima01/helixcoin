"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, type RootState } from "@react-three/fiber";
import { Physics, useBeforePhysicsStep } from "@react-three/rapier";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import type * as THREE from "three";
import type { RapierRigidBody } from "@react-three/rapier";
import { activeEngineConfig as CFG, setActiveEngineConfig } from "@/game-engine/config";
import {
  createRuntime,
  type EngineRuntime,
  type RingData,
  type TouchKind,
} from "@/game-engine/types";
import { generateRings } from "@/game-engine/generator";
import { AudioManager } from "@/game-engine/audio";
import {
  advanceRotation,
  clampFallSpeed,
  handleTouch,
  stepGameplay,
  type EngineCallbacks,
} from "@/game-engine/systems";
import { Ball } from "@/game-engine/components/ball";
import { TowerRenderer } from "@/game-engine/components/tower-renderer";
import { TowerPhysics } from "@/game-engine/components/tower-physics";
import { CameraRig } from "@/game-engine/components/camera-rig";
import { Particles } from "@/game-engine/components/particles";
import { useGameStore } from "@/store/game-store";

/** Must match the fixed `timeStep` passed to `<Physics>` below — shared so the two never drift apart. */
const PHYSICS_DT = 1 / 60;

/** Frame-loop host: gameplay bookkeeping + fall-speed clamp. */
function EngineSystems({
  runtime,
  callbacks,
  onNeedMoreRings,
}: {
  runtime: EngineRuntime;
  callbacks: EngineCallbacks;
  onNeedMoreRings: () => void;
}) {
  useFrame(() => {
    try {
      stepGameplay(runtime, callbacks);
    } catch (err) {
      if (process.env.NODE_ENV !== "production") console.error("gameplay step:", err);
    }
    const passes = useGameStore.getState().platformsPassed;
    if (passes > runtime.rings.length - CFG.extendWhenRemaining) {
      onNeedMoreRings();
    }
  });

  // Registered before TowerPhysics's useBeforePhysicsStep (this component
  // must mount first inside <Physics> — see the JSX below) so the kinematic
  // ring collider always rotates from THIS sub-step's runtime.time, never
  // last frame's. See advanceRotation()'s doc comment for why this matters.
  useBeforePhysicsStep(() => {
    try {
      advanceRotation(runtime, PHYSICS_DT);
    } catch (err) {
      if (process.env.NODE_ENV !== "production") console.error("rotation advance:", err);
    }
  });

  useBeforePhysicsStep(() => {
    try {
      clampFallSpeed(runtime);
    } catch (err) {
      if (process.env.NODE_ENV !== "production") console.error("fall clamp:", err);
    }
  });

  return null;
}

export function GameEngine({
  seed,
  engineParams,
  onDeath,
}: {
  seed: string;
  /** Server-issued mode profile for this match (src/modules/game-config) — the engine's only source of truth for the overridable knobs (see config.ts's setActiveEngineConfig doc comment). */
  engineParams?: Record<string, number | boolean>;
  onDeath: (platformsPassed: number) => void;
}) {
  // Must run synchronously, before the useState initializer below (which
  // calls generateRings and therefore reads CFG.initialRings) — an effect
  // would fire too late. Safe to call on every render: idempotent for the
  // same engineParams, and this component fully remounts per match (see
  // play-screen.tsx's key={seed}), so it only ever runs against this
  // match's own params.
  setActiveEngineConfig(engineParams);

  const [rings, setRings] = useState<RingData[]>(() => generateRings(seed, 0, CFG.initialRings));
  const [physicsVersion, setPhysicsVersion] = useState(0);
  const ballRef = useRef<RapierRigidBody | null>(null);
  const runtime = useMemo(() => createRuntime(ballRef), []);
  runtime.rings = rings;

  const status = useGameStore((s) => s.status);
  const passes = useGameStore((s) => s.platformsPassed);
  const fireMode = useGameStore((s) => s.fireMode);
  const paused = status !== "playing";

  const callbacks = useMemo<EngineCallbacks>(
    () => ({
      bumpPhysicsVersion: () => setPhysicsVersion((v) => v + 1),
      onDeath,
    }),
    [onDeath]
  );

  const touch = useCallback(
    (ringIndex: number, kind: TouchKind) => {
      // Collision handlers are invoked from the Rapier event drain — an
      // exception thrown here would poison the wasm world. Never let one out.
      try {
        handleTouch(runtime, callbacks, ringIndex, kind);
      } catch (err) {
        if (process.env.NODE_ENV !== "production") console.error("touch handler:", err);
      }
    },
    [runtime, callbacks]
  );

  const handleNeedMoreRings = useCallback(() => {
    setRings((prev) => [...prev, ...generateRings(seed, prev.length, CFG.extendBatch)]);
  }, [seed]);

  // Only rings near the ball are simulated; the version bump drops broken ones.
  const windowRings = useMemo(() => {
    void physicsVersion;
    const first = Math.max(0, passes - CFG.physicsBehind);
    const last = Math.min(rings.length - 1, passes + CFG.physicsAhead);
    const out: RingData[] = [];
    for (let i = first; i <= last; i++) {
      if (!runtime.broken.has(i)) out.push(rings[i]);
    }
    return out;
  }, [rings, passes, physicsVersion, runtime]);

  // Victory fanfare when a cashout resolves.
  useEffect(() => {
    if (status === "won") AudioManager.cashout();
  }, [status]);

  // Dev-only inspection handle.
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as Record<string, unknown>).__HELIJUMP__ = {
        runtime,
        getState: useGameStore.getState,
      };
    }
  }, [runtime]);

  // ---- Input: drag rotates the tower (mouse + touch via pointer events) ----
  const onPointerDown = (e: React.PointerEvent) => {
    AudioManager.init();
    const r = runtime.rot;
    r.dragging = true;
    r.lastX = e.clientX;
    r.lastT = performance.now();
    r.velPs = 0;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const r = runtime.rot;
    if (!r.dragging) return;
    const nowMs = performance.now();
    const dx = e.clientX - r.lastX;
    const dtMs = Math.max(8, nowMs - r.lastT);
    const delta = Math.max(-CFG.maxDragDelta, Math.min(CFG.maxDragDelta, dx * CFG.dragSensitivity));
    r.target += delta;
    // Smoothed fling velocity in rad/s for momentum after release, capped so
    // the kinematic tower never spins at solver-breaking speeds.
    const instant = delta / (dtMs / 1000);
    r.velPs = Math.max(
      -CFG.maxFlingSpeed,
      Math.min(CFG.maxFlingSpeed, r.velPs * 0.7 + instant * 0.3)
    );
    r.lastX = e.clientX;
    r.lastT = nowMs;
  };
  const endDrag = () => {
    runtime.rot.dragging = false;
  };

  // ---- Defensive resize mirroring (embedding contexts) ----
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const glRef = useRef<RootState["gl"] | null>(null);
  const cameraRef = useRef<RootState["camera"] | null>(null);

  const applySize = useCallback((width: number, height: number) => {
    const gl = glRef.current;
    const camera = cameraRef.current;
    if (!gl || !camera || width <= 0 || height <= 0) return;
    gl.setSize(width, height, true);
    if ("aspect" in camera) {
      (camera as THREE.PerspectiveCamera).aspect = width / height;
      camera.updateProjectionMatrix();
    }
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setSize({ width: rect.width, height: rect.height });
        applySize(rect.width, rect.height);
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [applySize]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 touch-none cursor-grab active:cursor-grabbing"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {size && (
        <Canvas
          dpr={[1, 1.75]}
          gl={{ antialias: true, powerPreference: "high-performance" }}
          camera={{
            fov: CFG.cameraFov,
            position: [CFG.cameraDistance, CFG.ballSpawnY + CFG.cameraOffsetY, 0],
          }}
          resize={{ scroll: false, debounce: 0 }}
          style={{ width: "100%", height: "100%", display: "block" }}
          onCreated={(state) => {
            glRef.current = state.gl;
            cameraRef.current = state.camera;
            applySize(size.width, size.height);
          }}
        >
          <color attach="background" args={["#0B0815"]} />
          <fog attach="fog" args={["#0B0815", 9, 24]} />

          <ambientLight intensity={0.55} color="#a78bfa" />
          <directionalLight position={[4, 8, 4]} intensity={1.2} color="#ffffff" />
          <pointLight position={[-4, -2, 3]} intensity={8} color="#FF4FAE" distance={10} />
          <pointLight position={[3, -6, -2]} intensity={6} color="#16F2A5" distance={10} />

          <Suspense fallback={null}>
            <Physics gravity={[0, CFG.gravity, 0]} paused={paused} timeStep={PHYSICS_DT}>
              {/* Must mount before TowerPhysics — see EngineSystems's useBeforePhysicsStep comment. */}
              <EngineSystems
                runtime={runtime}
                callbacks={callbacks}
                onNeedMoreRings={handleNeedMoreRings}
              />
              <Ball runtime={runtime} />
              <TowerPhysics runtime={runtime} windowRings={windowRings} touch={touch} />
            </Physics>
          </Suspense>

          <TowerRenderer runtime={runtime} />
          <Particles />
          <CameraRig runtime={runtime} />

          <EffectComposer multisampling={0}>
            <Bloom intensity={0.65} luminanceThreshold={0.25} luminanceSmoothing={0.4} mipmapBlur />
            <Vignette eskil={false} offset={0.15} darkness={0.9} />
          </EffectComposer>
        </Canvas>
      )}

      {/* Fire mode heat vignette */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 transition-opacity duration-500"
        style={{
          opacity: fireMode ? 1 : 0,
          background:
            "radial-gradient(ellipse at center, transparent 55%, rgba(255,110,40,0.28) 100%)",
        }}
      />
    </div>
  );
}
