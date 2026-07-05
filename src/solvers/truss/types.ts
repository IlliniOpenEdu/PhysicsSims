// ─────────────────────────────────────────────
//  Truss solver — public types
//  Pure TS, no React. DOF-general: elements declare which DOF they
//  contribute per node, so beam/frame elements (rotational DOF) can be
//  added later without touching the assembler or solve pipeline.
// ─────────────────────────────────────────────

import type { Vec2, Vec3 } from '../../utils/mathUtils';

/**
 * A degree of freedom at a node. Truss elements request only translations
 * (tx/ty in 2D, tx/ty/tz in 3D); rotational kinds are reserved for future
 * beam/frame elements.
 */
export type DofKind = 'tx' | 'ty' | 'tz' | 'rx' | 'ry' | 'rz';

export interface TrussNode {
  id: number;
  /** Vec2 → 2D problem, Vec3 → 3D. All nodes must share dimensionality. */
  pos: Vec2 | Vec3;
}

export interface TrussElement {
  id: number;
  /** [i, j] node ids (not array indices). */
  nodes: [number, number];
  /** Young's modulus (Pa). */
  E: number;
  /** Cross-sectional area (m²). */
  A: number;
  /** Second moment of area (m⁴) — used for Euler buckling. */
  I: number;
  /** Yield strength (Pa) — used for the yield failure check. */
  sigmaYield: number;
}

export interface Support {
  node: number;
  /** Restrained DOF, e.g. 2D pin = ['tx','ty'], vertical roller = ['ty']. */
  dofs: DofKind[];
}

export interface Load {
  node: number;
  dof: DofKind;
  /** Force component (N), sign follows the axis. */
  value: number;
}

// ── Results ──────────────────────────────────

export interface DofValue {
  node: number;
  dof: DofKind;
  value: number;
}

export type AxialState = 'tension' | 'compression' | 'zero';

export interface MemberForce {
  element: number;
  /** Undeformed length (m). */
  length: number;
  /** Axial force (N) — tension positive, compression negative. */
  axial: number;
  state: AxialState;
}

export interface MemberStress {
  element: number;
  /** Axial stress (Pa), same sign convention as the force. */
  stress: number;
}

export type FailureMode = 'yield' | 'buckling';

export interface MemberFailure {
  element: number;
  /** σ_yield / |σ| — Infinity when unstressed. */
  yieldSF: number;
  /** P_cr / |P| for compression members (P_cr = π²EI/L²); Infinity otherwise. */
  bucklingSF: number;
  /** Governing safety factor = min(yieldSF, bucklingSF). */
  safetyFactor: number;
  /** true when safetyFactor < 1. */
  fails: boolean;
  /** Governing mode when the member fails, else null. */
  mode: FailureMode | null;
}

export interface TrussSolution {
  /** Every active DOF (restrained DOF report 0). Displacements in m. */
  displacements: DofValue[];
  memberForces: MemberForce[];
  /** Reaction forces (N) at restrained DOF only. */
  reactions: DofValue[];
  stresses: MemberStress[];
  failures: MemberFailure[];
}

// ── Errors ───────────────────────────────────

export type TrussErrorCode = 'invalid-input' | 'mechanism';

/** Thrown by solveTruss for malformed input or unstable (mechanism) structures. */
export class TrussError extends Error {
  readonly code: TrussErrorCode;

  constructor(code: TrussErrorCode, message: string) {
    super(message);
    this.name = 'TrussError';
    this.code = code;
  }
}
