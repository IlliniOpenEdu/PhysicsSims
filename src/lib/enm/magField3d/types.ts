// ─────────────────────────────────────────────
//  magField3d/types.ts
//  Shared types for the 3D Magnetic Field module
// ─────────────────────────────────────────────

import type { Vec3 } from '../../../utils/mathUtils';

export type MagMode = 'wire' | 'solenoid' | 'loop' | 'two-wire';

export type FieldDensity = 'low' | 'medium' | 'high';

/** A single traced field line: a polyline plus a 0..1 brightness value per point. */
export interface FieldLine {
  points: Vec3[];
  /** Normalized field magnitude (0..1) sampled at each point — drives colour/brightness. */
  strength: number[];
}

/** A current-carrying conductor segment used to draw direction arrows. */
export interface CurrentArrow {
  position: Vec3;
  /** Unit vector pointing along conventional current flow. */
  direction: Vec3;
}

export interface MagFieldParams {
  mode: MagMode;
  /** Current magnitude in amperes. */
  current: number;
  /** +1 or -1 — flips the right-hand-rule sense of the field. */
  direction: 1 | -1;
  // ── Solenoid only ──
  turns: number;
  coilRadiusCm: number;
  coilLengthCm: number;
  // ── Field-line sampling ──
  density: FieldDensity;
  // ── Two-wire only ──
  separationCm: number;
  /** When true the second wire carries current in the opposite direction (repulsion). */
  oppositeCurrent: boolean;
  // ── Test compass ──
  showCompass: boolean;
  compass: Vec3;
}
