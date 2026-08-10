"use client";

import { useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { activeEngineConfig as CFG } from "@/game-engine/config";
import { activeQualityTier } from "@/game-engine/quality";
import type { EngineRuntime } from "@/game-engine/types";
import { useGameStore } from "@/store/game-store";

export interface TelemetrySnapshot {
  fps: number;
  frameMs: number;
  drawCalls: number;
  triangles: number;
  colliders: number;
  ringBodies: number;
  ringsInMemory: number;
  ringsPruned: number;
  tier: string;
  dpr: number;
}

/**
 * Dev-only real-time telemetry for the perf audit's before/after comparison
 * (Prioridade "criar telemetria de desenvolvimento"). Two parts:
 *
 * - `TelemetryProbe` mounts INSIDE the Canvas (needs useThree/useFrame) and
 *   reports a throttled snapshot up via `onSample` — sampled twice a second,
 *   never every frame, so the act of measuring is never itself a meaningful
 *   part of what's being measured. Draw calls/triangles come straight from
 *   Three.js's own `renderer.info` (the real counters the engine already
 *   maintains), not a reimplementation.
 * - `DevTelemetryOverlay` is the plain HTML readout, rendered OUTSIDE the
 *   canvas by GameEngine, gated on `process.env.NODE_ENV !== "production"`
 *   so this never ships in a production bundle.
 *
 * Collider/ring-body counts are recomputed from the same
 * physicsBehind/physicsAhead window + segment kinds tower-physics.tsx uses
 * to build its RigidBodies — there's no separate registry to read from
 * outside that component, and recomputing a ~6-7-ring loop twice a second
 * is negligible next to the throttling window itself.
 */
export function TelemetryProbe({
  runtime,
  onSample,
}: {
  runtime: EngineRuntime;
  onSample: (s: TelemetrySnapshot) => void;
}) {
  const { gl } = useThree();
  const frames = useRef(0);
  const accMs = useRef(0);
  const lastReport = useRef(0);

  useFrame((_, dt) => {
    frames.current++;
    accMs.current += dt * 1000;
    const now = performance.now();
    if (now - lastReport.current < 500) return;

    const avgMs = frames.current > 0 ? accMs.current / frames.current : 0;
    frames.current = 0;
    accMs.current = 0;
    lastReport.current = now;

    const passes = useGameStore.getState().platformsPassed;
    const first = Math.max(0, passes - CFG.physicsBehind);
    const last = Math.min(runtime.rings.length - 1, passes + CFG.physicsAhead);
    let colliders = 0;
    let ringBodies = 0;
    let ringsInMemory = 0;
    for (let i = 0; i < runtime.rings.length; i++) {
      if (runtime.rings[i]) ringsInMemory++;
    }
    for (let i = first; i <= last; i++) {
      if (runtime.broken.has(i)) continue;
      const ring = runtime.rings[i];
      if (!ring) continue;
      let nonHole = 0;
      for (const s of ring.segments) if (s !== "hole") nonHole++;
      if (nonHole > 0) {
        ringBodies++;
        colliders += nonHole;
      }
    }

    const dprArr = gl.getPixelRatio();
    onSample({
      fps: avgMs > 0 ? Math.round(1000 / avgMs) : 0,
      frameMs: Math.round(avgMs * 10) / 10,
      drawCalls: gl.info.render.calls,
      triangles: gl.info.render.triangles,
      colliders,
      ringBodies,
      ringsInMemory,
      ringsPruned: runtime.prunedThrough + 1,
      tier: activeQualityTier,
      dpr: Math.round(dprArr * 100) / 100,
    });
  });

  return null;
}

/** Plain HTML readout — lives outside the Canvas, toggled with a small tap target so it doesn't block gameplay input. */
export function DevTelemetryOverlay({ snapshot }: { snapshot: TelemetrySnapshot | null }) {
  const [visible, setVisible] = useState(true);
  if (process.env.NODE_ENV === "production") return null;

  return (
    <div className="pointer-events-none absolute left-1.5 top-1.5 z-30 select-none">
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="pointer-events-auto mb-1 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[9px] text-white/70"
      >
        {visible ? "perf ▾" : "perf ▸"}
      </button>
      {visible && snapshot && (
        <div className="rounded-md bg-black/70 px-2 py-1.5 font-mono text-[10px] leading-tight text-white/90 tabular-nums">
          <div>fps {snapshot.fps} · {snapshot.frameMs}ms</div>
          <div>draws {snapshot.drawCalls} · tris {snapshot.triangles}</div>
          <div>colliders {snapshot.colliders} · bodies {snapshot.ringBodies}</div>
          <div>rings mem {snapshot.ringsInMemory} · pruned {snapshot.ringsPruned}</div>
          <div>tier {snapshot.tier} · dpr {snapshot.dpr}</div>
        </div>
      )}
    </div>
  );
}

/** Small hook so GameEngine doesn't have to manage the snapshot state itself. */
export function useTelemetrySnapshot() {
  const [snapshot, setSnapshot] = useState<TelemetrySnapshot | null>(null);
  const onSample = useRef((s: TelemetrySnapshot) => setSnapshot(s));
  useEffect(() => {
    onSample.current = (s: TelemetrySnapshot) => setSnapshot(s);
  });
  return { snapshot, onSample: (s: TelemetrySnapshot) => onSample.current(s) };
}
