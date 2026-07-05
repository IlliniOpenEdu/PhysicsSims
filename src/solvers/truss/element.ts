// ─────────────────────────────────────────────
//  Truss (axial bar) element
//  Local stiffness EA/L, rotated to global axes via direction cosines:
//    k_e = (EA/L) · [ ccᵀ  −ccᵀ ]
//                   [ −ccᵀ  ccᵀ ]
//  The element exposes only { dofs, k } to the assembler, so elements with
//  different DOF sets (beams, frames) can share the same pipeline.
// ─────────────────────────────────────────────

import { vec2, vec3, type Vec2, type Vec3 } from '../../utils/mathUtils';
import type { DofKind, TrussElement } from './types';

const TRANSLATION_BY_AXIS: readonly DofKind[] = ['tx', 'ty', 'tz'];

export const isVec3 = (p: Vec2 | Vec3): p is Vec3 => 'z' in p;

export const posComponents = (p: Vec2 | Vec3): number[] =>
  isVec3(p) ? [p.x, p.y, p.z] : [p.x, p.y];

/** Second moment of area of a solid round bar of area A: I = A²/(4π). */
export const solidRoundI = (A: number): number => (A * A) / (4 * Math.PI);

/** Euler buckling load, pinned-pinned (k = 1): P_cr = π²EI/L². */
export const eulerBucklingLoad = (E: number, I: number, L: number): number =>
  (Math.PI * Math.PI * E * I) / (L * L);

export interface ElementGeometry {
  /** Undeformed length (m). */
  length: number;
  /** Direction cosines i→j; 2 components in 2D, 3 in 3D. */
  cosines: number[];
}

export function elementGeometry(pi: Vec2 | Vec3, pj: Vec2 | Vec3): ElementGeometry {
  const length =
    isVec3(pi) && isVec3(pj) ? vec3.dist(pi, pj) : vec2.dist(pi as Vec2, pj as Vec2);
  const a = posComponents(pi);
  const b = posComponents(pj);
  const cosines = a.map((v, d) => (b[d] - v) / length);
  return { length, cosines };
}

/** One DOF an element touches, in local stiffness-matrix order. */
export interface ElementDof {
  node: number;
  dof: DofKind;
}

/** An element's contribution to the global system. */
export interface ElementContribution {
  /** DOF in the order of k's rows/columns. */
  dofs: ElementDof[];
  /** Stiffness in global axes, n×n where n = dofs.length. */
  k: number[][];
}

export function trussElementContribution(
  el: TrussElement,
  geom: ElementGeometry,
): ElementContribution {
  const { length, cosines: c } = geom;
  const dim = c.length;

  const dofs: ElementDof[] = [];
  for (const node of el.nodes) {
    for (let d = 0; d < dim; d++) dofs.push({ node, dof: TRANSLATION_BY_AXIS[d] });
  }

  const n = 2 * dim;
  const k: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  const EA_L = (el.E * el.A) / length;
  for (let a = 0; a < dim; a++) {
    for (let b = 0; b < dim; b++) {
      const kab = EA_L * c[a] * c[b];
      k[a][b] += kab;
      k[dim + a][dim + b] += kab;
      k[a][dim + b] -= kab;
      k[dim + a][b] -= kab;
    }
  }
  return { dofs, k };
}
