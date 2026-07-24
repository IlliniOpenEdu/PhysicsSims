// ─────────────────────────────────────────────
//  Rigid-body restraint analysis.
//  Whether a structure can undergo rigid-body motion depends on which DOF
//  the supports restrain and where those restraints sit — never on support
//  labels. Each restrained (node, axis) pair contributes one row
//  u·e = t·e + ω·(r × e) to a restraint matrix whose rank must equal the
//  number of rigid-body modes (3 in 2D, 6 in 3D). Rank deficiency means
//  some translation/rotation is unrestrained even when the support *count*
//  looks fine — a 2D-style pin + roller in 3D still yaws about the
//  vertical axis and rolls about the line through its supports.
// ─────────────────────────────────────────────

import { Matrix, SingularValueDecomposition } from 'ml-matrix';
import { posComponents } from './element';
import type { DofKind, Support, TrussNode } from './types';

export interface RestraintAnalysis {
  /** Rigid-body modes the supports must restrain: 3 in 2D, 6 in 3D. */
  required: number;
  /** Independent rigid-body modes the supports actually restrain. */
  restrainedRank: number;
  sufficient: boolean;
  /** Names of the unrestrained modes (dominant component of each). */
  freeModes: string[];
}

const AXIS_INDEX: Partial<Record<DofKind, number>> = { tx: 0, ty: 1, tz: 2 };

const MODE_NAMES_2D = ['translation x', 'translation y', 'in-plane rotation'];
const MODE_NAMES_3D = [
  'translation x',
  'translation y',
  'translation z',
  'rotation about x',
  'rotation about y (yaw)',
  'rotation about z',
];

/**
 * Rank-check the restrained translational DOF against the rigid-body modes
 * of the node set. Only counts DOF the supports explicitly restrain — a
 * label like "roller" carries no implicit lateral stiffness here.
 */
export function analyzeRestraints(nodes: TrussNode[], supports: Support[]): RestraintAnalysis {
  const dim = nodes.length > 0 ? posComponents(nodes[0].pos).length : 2;
  const nModes = dim === 3 ? 6 : 3;
  const names = dim === 3 ? MODE_NAMES_3D : MODE_NAMES_2D;

  // Normalize geometry (centroid origin, unit span) so the rank tolerance
  // is independent of the model's units and extent.
  const centroid = [0, 0, 0];
  for (const n of nodes) {
    const p = posComponents(n.pos);
    for (let d = 0; d < dim; d++) centroid[d] += p[d] / nodes.length;
  }
  const pos = new Map<number, number[]>();
  let scale = 0;
  for (const n of nodes) {
    const p = posComponents(n.pos).map((v, d) => v - centroid[d]);
    pos.set(n.id, p);
    scale = Math.max(scale, Math.hypot(...p));
  }
  if (scale === 0) scale = 1;

  // One row per restrained translational axis: [e | r × e] (2D keeps only
  // the z-component of r × e).
  const rows: number[][] = [];
  for (const s of supports) {
    const p = pos.get(s.node);
    if (!p) continue;
    const r = [p[0] / scale, p[1] / scale, (p[2] ?? 0) / scale];
    for (const dof of s.dofs) {
      const a = AXIS_INDEX[dof];
      if (a === undefined || a >= dim) continue;
      const e = [0, 0, 0];
      e[a] = 1;
      const rxe = [
        r[1] * e[2] - r[2] * e[1],
        r[2] * e[0] - r[0] * e[2],
        r[0] * e[1] - r[1] * e[0],
      ];
      rows.push(dim === 3 ? [e[0], e[1], e[2], rxe[0], rxe[1], rxe[2]] : [e[0], e[1], rxe[2]]);
    }
  }

  if (rows.length === 0) {
    return { required: nModes, restrainedRank: 0, sufficient: false, freeModes: [...names] };
  }

  // Rank and null space via the tiny nModes×nModes Gram matrix RᵀR —
  // singular vectors with ~zero singular value are the free modes.
  const R = new Matrix(rows);
  const G = R.transpose().mmul(R);
  const svd = new SingularValueDecomposition(G, { autoTranspose: false });
  const sv = svd.diagonal;
  const tol = Math.max(sv[0] * 1e-9, 1e-12);
  let rank = 0;
  for (const s of sv) if (s > tol) rank++;

  const freeModes: string[] = [];
  if (rank < nModes) {
    const V = svd.rightSingularVectors;
    const used = new Set<number>();
    for (let k = rank; k < nModes; k++) {
      // Name each null-space mode by its largest not-yet-claimed component.
      const order = [...Array(nModes).keys()].sort(
        (a, b) => Math.abs(V.get(b, k)) - Math.abs(V.get(a, k)),
      );
      const pick = order.find((i) => !used.has(i)) ?? order[0];
      used.add(pick);
      freeModes.push(names[pick]);
    }
  }

  return { required: nModes, restrainedRank: rank, sufficient: rank >= nModes, freeModes };
}