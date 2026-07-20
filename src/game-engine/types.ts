import type { RefObject } from "react";
import type { RapierRigidBody } from "@react-three/rapier";

/** What occupies one angular segment of a ring. */
export type SegmentType = "hole" | "solid" | "danger" | "bonus";

/** Surface behavior applied to a ring's solid segments. */
export type RingVariant = "normal" | "fragile" | "ice" | "boost";

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
  variant: RingVariant;
  motion: RingMotion;
  colorIndex: number;
}

/** Groups of colliders inside one ring body, identified by behavior on touch. */
export type TouchKind = "solid" | "danger" | "bonus";

/**
 * Mutable per-match runtime shared by systems, physics and renderer.
 * Lives in refs — never triggers React re-renders on the hot path.
 */
export interface EngineRuntime {
  ballRef: RefObject<RapierRigidBody | null>;
  rings: RingData[];
  time: number;
  rot: {
    target: number;
    current: number;
    velPs: number; // radians/second momentum after release
    dragging: boolean;
    lastX: number;
    lastT: number;
  };
  broken: Set<number>;
  consumedBonus: Set<number>;
  pendingBreaks: { ring: number; at: number }[];
  lastBounceAt: number;
  lastMovedAt: number; // watchdog: last time |vy| was healthy
  lastVy: number; // vertical velocity entering the current physics step (impact speed)
  boostUntil: number;
  boostApplied: boolean;
  fireBreaksLeft: number;
  trauma: number;
  dead: boolean;
  goalCelebrated: boolean;
}

export function createRuntime(ballRef: RefObject<RapierRigidBody | null>): EngineRuntime {
  return {
    ballRef,
    rings: [],
    time: 0,
    rot: { target: 0, current: 0, velPs: 0, dragging: false, lastX: 0, lastT: 0 },
    broken: new Set(),
    consumedBonus: new Set(),
    pendingBreaks: [],
    lastBounceAt: -1,
    lastMovedAt: 0,
    lastVy: 0,
    boostUntil: -1,
    boostApplied: false,
    fireBreaksLeft: 0,
    trauma: 0,
    dead: false,
    goalCelebrated: false,
  };
}
