"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Physics, useBeforePhysicsStep } from "@react-three/rapier";
import type { RapierRigidBody } from "@react-three/rapier";
import { activeEngineConfig as CFG, setActiveEngineConfig } from "@/game-engine/config";
import { activeQualitySettings as QUALITY, initQuality } from "@/game-engine/quality";
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
  pruneOldRings,
  stepGameplay,
  type EngineCallbacks,
} from "@/game-engine/systems";
import { Ball } from "@/game-engine/components/ball";
import { TowerRenderer } from "@/game-engine/components/tower-renderer";
import { TowerPhysics } from "@/game-engine/components/tower-physics";
import { CameraRig } from "@/game-engine/components/camera-rig";
import { Particles } from "@/game-engine/components/particles";
import {
  DevTelemetryOverlay,
  TelemetryProbe,
  useTelemetrySnapshot,
} from "@/game-engine/components/dev-telemetry";
import { useGameStore } from "@/store/game-store";

/** Must match the fixed `timeStep` passed to `<Physics>` below — shared so the two never drift apart. */
const PHYSICS_DT = 1 / 60;

/** Frame-loop host: gameplay bookkeeping + fall-speed clamp. */
function EngineSystems({
  runtime,
  onNeedMoreRings,
}: {
  runtime: EngineRuntime;
  onNeedMoreRings: () => void;
}) {
  useFrame(() => {
    try {
      stepGameplay(runtime);
    } catch (err) {
      if (process.env.NODE_ENV !== "production") console.error("gameplay step:", err);
    }
    try {
      pruneOldRings(runtime);
    } catch (err) {
      if (process.env.NODE_ENV !== "production") console.error("ring pruning:", err);
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

  // Same "call every render, cheap/idempotent" pattern as setActiveEngineConfig
  // above — see quality.ts's initQuality doc comment: only the FIRST call this
  // browser session actually detects/samples anything; every later match
  // mount just re-confirms the already-active tier. `qualityVersion` exists
  // purely to force one re-render if the async frame-time sample (fired once,
  // ~2.5s into the first match) refines the tier after this component's
  // first paint — dpr/antialias/renderAhead/etc. are read fresh from the
  // `QUALITY` live binding below, not from React state.
  const [, setQualityVersion] = useState(0);
  initQuality(() => setQualityVersion((v) => v + 1));
  const telemetry = useTelemetrySnapshot();

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
      if (runtime.broken.has(i)) continue;
      const ring = rings[i];
      if (ring) out.push(ring);
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
    // CFG.rotationSpeed is the single per-difficulty multiplier over how
    // fast the tower responds to input (see config.ts's doc comment) —
    // applied here to the drag-to-angle conversion, and to the fling cap
    // below so the momentum ceiling scales with it too. Still entirely
    // dt-driven (dtMs is a real elapsed-time measurement, not a frame
    // count), so this stays exactly as FPS-independent as before.
    const delta = Math.max(
      -CFG.maxDragDelta,
      Math.min(CFG.maxDragDelta, dx * CFG.dragSensitivity * CFG.rotationSpeed)
    );
    r.target += delta;
    // Smoothed fling velocity in rad/s for momentum after release, capped so
    // the kinematic tower never spins at solver-breaking speeds.
    const instant = delta / (dtMs / 1000);
    const flingCap = CFG.maxFlingSpeed * CFG.rotationSpeed;
    r.velPs = Math.max(-flingCap, Math.min(flingCap, r.velPs * 0.7 + instant * 0.3));
    r.lastX = e.clientX;
    r.lastT = nowMs;
  };
  const endDrag = () => {
    runtime.rot.dragging = false;
  };

  // ---- Mount gate: wait for the container's first real (non-zero) layout
  // size before mounting <Canvas> ----
  //
  // Perf audit Prioridade 10: this used to ALSO manually mirror `gl.setSize`
  // and the camera's aspect ratio on every observed resize — fully
  // redundant with the Canvas's own `resize={{scroll:false, debounce:0}}`
  // prop below, which already drives R3F's built-in ResizeObserver-based
  // sizing of the canvas + camera. Two mechanisms doing the identical job
  // meant real double work on every orientation change/resize (exactly the
  // moment a tablet is likely to be mid-rotation). Only the "gate the first
  // mount" part earns its keep — R3F's own resize handling does the rest.
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setSize({ width: rect.width, height: rect.height });
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 touch-none cursor-grab active:cursor-grabbing"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      style={{
        backgroundImage: "url(/game-sky-background.webp)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {size && (
        <Canvas
          // Perf audit Prioridade 3/7/8: dpr and antialias come from the
          // active quality tier (src/game-engine/quality.ts) instead of a
          // fixed [1, 1.75]/true for every device. `dpr` is read reactively
          // by R3F on every re-render of this component (Canvas watches the
          // prop), so a mid-session tier refinement applies live; `gl.antialias`
          // is a WebGL-context-creation-time flag and can only take effect
          // from the NEXT match's fresh context onward (this Canvas fully
          // remounts per match — see play-screen.tsx's key={seed}).
          dpr={QUALITY.dpr}
          gl={{ antialias: QUALITY.antialias, powerPreference: "high-performance", alpha: true }}
          camera={{
            fov: CFG.cameraFov,
            position: [CFG.cameraDistance, CFG.ballSpawnY + CFG.cameraOffsetY, 0],
          }}
          resize={{ scroll: false, debounce: 0 }}
          style={{ width: "100%", height: "100%", display: "block" }}
        >
          {/* No <color attach="background">: the WebGL context clears to transparent
              (gl alpha:true above) so the CSS background-image on the container div
              — the real photo asset — shows through everywhere nothing is drawn.
              Fog color sampled from the photo's own sky-blue so distant tower/ring
              segments fade toward a color consistent with the backdrop instead of an
              unrelated flat tone. */}
          <fog attach="fog" args={["#1793F2", 9, 24]} />

          {/* Minimalist pass: one ambient + one directional light — just enough
              for MeshLambertMaterial to read as solid 3D shapes, not flat cutouts.
              Removed: 2 colored point lights + the ball's own dynamic point light
              (pure decoration, now moot since nothing uses specular/PBR), Bloom +
              Vignette post-processing (an extra full-scene render pass, the single
              most expensive cosmetic effect in the old pipeline). The particle
              pool (components/particles.tsx) IS mounted below — reused for the
              ball's smoke trail (ball.tsx) as well as the pre-existing bounce/
              death/goal bursts (systems.ts), one shared InstancedMesh for all of
              them. */}
          <ambientLight intensity={0.7} color="#ffffff" />
          <directionalLight position={[4, 8, 4]} intensity={0.9} color="#ffffff" />

          <Suspense fallback={null}>
            <Physics gravity={[0, CFG.gravity, 0]} paused={paused} timeStep={PHYSICS_DT}>
              {/* Must mount before TowerPhysics — see EngineSystems's useBeforePhysicsStep comment. */}
              <EngineSystems runtime={runtime} onNeedMoreRings={handleNeedMoreRings} />
              <Ball runtime={runtime} />
              <TowerPhysics runtime={runtime} windowRings={windowRings} touch={touch} />
            </Physics>
          </Suspense>

          <TowerRenderer runtime={runtime} />
          <Particles />
          <CameraRig runtime={runtime} />
          {process.env.NODE_ENV !== "production" && (
            <TelemetryProbe runtime={runtime} onSample={telemetry.onSample} />
          )}
        </Canvas>
      )}

      {process.env.NODE_ENV !== "production" && <DevTelemetryOverlay snapshot={telemetry.snapshot} />}

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
