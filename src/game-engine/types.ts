import type { RefObject } from "react";
import type { RapierRigidBody } from "@react-three/rapier";

/** What occupies one angular segment of a ring. "danger" (red) is the only loss zone — everything else is safe. */
export type SegmentType = "hole" | "solid" | "danger";

/** How the ring moves on its own, independent of tower rotation. */
export type RingMotion =
  | { kind: "static" }
  | { kind: "oscillating"; amplitude: number; speed: number; phase: number }
  | { kind: "spinning"; speed: number }
  | { kind: "blinking"; period: number; duty: number; phase: number };

export interface RingData {
  index: number;
  y: number;
  baseRotation: number;
  segments: SegmentType[];
  motion: RingMotion;
}

/** Groups of colliders inside one ring body, identified by behavior on touch. */
export type TouchKind = "solid" | "danger";

/**
 * Mutable per-match runtime shared by systems, physics and renderer.
 * Lives in refs — never triggers React re-renders on the hot path.
 */
export interface EngineRuntime {
  ballRef: RefObject<RapierRigidBody | null>;
  /**
   * Sparse on purpose: entries far enough behind the ball get freed by
   * pruneOldRings() (systems.ts) via `delete rings[i]`, which leaves a hole
   * (`undefined`) at that index WITHOUT shrinking `.length` or shifting any
   * other index — every consumer indexes this array by absolute ring
   * number (`rings[ringIndex]`), so index positions must never move. Every
   * consumer already null-checks before use (see the perf audit's
   * Prioridade 6 consumer sweep) for exactly this reason.
   */
  rings: (RingData | undefined)[];
  /** Highest ring index pruneOldRings() has already freed through — lets it resume instead of rescanning from 0 every call. -1 = nothing pruned yet. */
  prunedThrough: number;
  time: number;
  rot: {
    target: number;
    current: number;
    velPs: number; // radians/second momentum after release
    dragging: boolean;
    lastX: number;
    lastT: number;
  };
  /** Rings with no active collider and hidden from render — smashed (fire) AND rings the ball has already passed (see stepGameplay). */
  broken: Set<number>;
  lastBounceAt: number;
  lastMovedAt: number; // watchdog: last time |vy| was healthy
  lastVy: number; // vertical velocity entering the current physics step (impact speed)
  fireBreaksLeft: number;
  trauma: number;
  dead: boolean;
  goalCelebrated: boolean;
}

export function createRuntime(ballRef: RefObject<RapierRigidBody | null>): EngineRuntime {
  return {
    ballRef,
    rings: [],
    prunedThrough: -1,
    time: 0,
    rot: { target: 0, current: 0, velPs: 0, dragging: false, lastX: 0, lastT: 0 },
    broken: new Set(),
    lastBounceAt: -1,
    lastMovedAt: 0,
    lastVy: 0,
    fireBreaksLeft: 0,
    trauma: 0,
    dead: false,
    goalCelebrated: false,
  };
}
