// ─────────────────────────────────────────────
//  Direct stiffness solve pipeline for pin-jointed trusses (2D and 3D —
//  same code path; dimension only changes how many translational DOF each
//  element declares).
//
//  1. Element stiffness (EA/L) → global axes via direction cosines
//  2. Assemble global K through the DofMap
//  3. Apply boundary conditions: partition free/fixed DOF
//  4. Solve K_ff · u_f = F_f  (SVD — robust near indeterminacy, and the
//     singular-value ratio doubles as the mechanism detector)
//  5. Back-compute member axial forces, reactions, stresses
//  6. Failure checks: yield and Euler buckling safety factors
// ─────────────────────────────────────────────

import { Matrix, SingularValueDecomposition } from 'ml-matrix';
import { assembleGlobalK } from './assemble';
import { DofMap } from './dofMap';
import {
  elementGeometry,
  eulerBucklingLoad,
  posComponents,
  trussElementContribution,
  type ElementGeometry,
} from './element';
import {
  TrussError,
  type DofValue,
  type Load,
  type MemberFailure,
  type MemberForce,
  type MemberStress,
  type Support,
  type TrussElement,
  type TrussNode,
  type TrussSolution,
} from './types';

const MIN_LENGTH = 1e-9; // m — shorter members are treated as degenerate
const COND_LIMIT = 1e12; // σ_max/σ_min beyond this → mechanism (singular K_ff)

function validateInput(
  nodes: TrussNode[],
  elements: TrussElement[],
  supports: Support[],
  loads: Load[],
  nodeById: Map<number, TrussNode>,
): void {
  if (nodes.length === 0) throw new TrussError('invalid-input', 'truss has no nodes');
  if (elements.length === 0) throw new TrussError('invalid-input', 'truss has no elements');

  const dim = posComponents(nodes[0].pos).length;
  for (const n of nodes) {
    if (nodeById.has(n.id)) throw new TrussError('invalid-input', `duplicate node id ${n.id}`);
    if (posComponents(n.pos).length !== dim) {
      throw new TrussError('invalid-input', `node ${n.id} mixes 2D and 3D positions`);
    }
    nodeById.set(n.id, n);
  }

  const connected = new Set<number>();
  for (const el of elements) {
    const [i, j] = el.nodes;
    if (!nodeById.has(i) || !nodeById.has(j)) {
      throw new TrussError('invalid-input', `element ${el.id} references a missing node`);
    }
    if (i === j) {
      throw new TrussError('invalid-input', `element ${el.id} connects node ${i} to itself`);
    }
    if (!(el.E > 0) || !(el.A > 0) || !(el.I > 0) || !(el.sigmaYield > 0)) {
      throw new TrussError(
        'invalid-input',
        `element ${el.id} needs positive E, A, I and sigmaYield`,
      );
    }
    connected.add(i);
    connected.add(j);
  }
  for (const n of nodes) {
    if (!connected.has(n.id)) {
      throw new TrussError('invalid-input', `node ${n.id} is not connected to any element`);
    }
  }

  for (const s of supports) {
    if (!nodeById.has(s.node)) {
      throw new TrussError('invalid-input', `support references missing node ${s.node}`);
    }
    if (s.dofs.length === 0) {
      throw new TrussError('invalid-input', `support at node ${s.node} restrains no DOF`);
    }
  }
  for (const l of loads) {
    if (!nodeById.has(l.node)) {
      throw new TrussError('invalid-input', `load references missing node ${l.node}`);
    }
  }
}

/**
 * Solve a truss by the direct stiffness method.
 *
 * Node positions decide the dimension (Vec2 → 2D, Vec3 → 3D); the pipeline
 * is identical for both. Throws TrussError with code 'invalid-input' for
 * malformed input or 'mechanism' for unstable structures.
 */
export function solveTruss(
  nodes: TrussNode[],
  elements: TrussElement[],
  supports: Support[],
  loads: Load[],
): TrussSolution {
  const nodeById = new Map<number, TrussNode>();
  validateInput(nodes, elements, supports, loads, nodeById);

  // 1. Element geometry + stiffness contributions
  const geometries: ElementGeometry[] = elements.map((el) => {
    const geom = elementGeometry(nodeById.get(el.nodes[0])!.pos, nodeById.get(el.nodes[1])!.pos);
    if (geom.length < MIN_LENGTH) {
      throw new TrussError('invalid-input', `element ${el.id} has zero length`);
    }
    return geom;
  });
  const contributions = elements.map((el, i) => trussElementContribution(el, geometries[i]));

  // 2. Assemble global K (DofMap is populated here from element declarations)
  const dofMap = new DofMap();
  const K = assembleGlobalK(contributions, dofMap);
  const nDof = dofMap.size;

  // Load vector — a load on a DOF no element stiffens is unresisted
  const F = new Array<number>(nDof).fill(0);
  for (const l of loads) {
    const gi = dofMap.index(l.node, l.dof);
    if (gi === undefined) {
      throw new TrussError('invalid-input', `load targets inactive DOF ${l.dof} at node ${l.node}`);
    }
    F[gi] += l.value;
  }

  // 3. Boundary conditions: partition free/fixed
  const fixedSet = new Set<number>();
  for (const s of supports) {
    for (const dof of s.dofs) {
      const gi = dofMap.index(s.node, dof);
      if (gi === undefined) {
        throw new TrussError(
          'invalid-input',
          `support restrains inactive DOF ${dof} at node ${s.node}`,
        );
      }
      fixedSet.add(gi);
    }
  }
  const free: number[] = [];
  for (let i = 0; i < nDof; i++) if (!fixedSet.has(i)) free.push(i);

  // 4. Solve K_ff · u_f = F_f
  const u = new Array<number>(nDof).fill(0);
  if (free.length > 0) {
    const Kff = new Matrix(free.map((r) => free.map((c) => K[r][c])));
    const svd = new SingularValueDecomposition(Kff, { autoTranspose: false });
    const sv = svd.diagonal;
    const sMax = Math.max(...sv);
    const sMin = Math.min(...sv);
    if (!(sMax > 0) || sMax / Math.max(sMin, Number.MIN_VALUE) > COND_LIMIT) {
      throw new TrussError(
        'mechanism',
        'structure is a mechanism — stiffness matrix is singular; add members or supports',
      );
    }
    const uf = svd.solve(Matrix.columnVector(free.map((r) => F[r]))).to1DArray();
    free.forEach((gi, k) => {
      u[gi] = uf[k];
    });
  }

  // 5. Back-compute: member forces, stresses, reactions
  const axials = elements.map((el, i) => {
    const { length, cosines } = geometries[i];
    const dim = cosines.length;
    const kinds = ['tx', 'ty', 'tz'] as const;
    let elong = 0;
    for (let d = 0; d < dim; d++) {
      const ui = u[dofMap.index(el.nodes[0], kinds[d])!];
      const uj = u[dofMap.index(el.nodes[1], kinds[d])!];
      elong += cosines[d] * (uj - ui);
    }
    return ((el.E * el.A) / length) * elong; // tension positive
  });

  let maxAbsAxial = 0;
  for (const a of axials) maxAbsAxial = Math.max(maxAbsAxial, Math.abs(a));
  const zeroTol = 1e-9 * Math.max(maxAbsAxial, 1);

  // Snap numerical residue to exact zero: a value ~1e12 times smaller than
  // the largest in its category is solver noise, not a result.
  for (let i = 0; i < axials.length; i++) {
    if (Math.abs(axials[i]) <= zeroTol) axials[i] = 0;
  }

  const memberForces: MemberForce[] = elements.map((el, i) => ({
    element: el.id,
    length: geometries[i].length,
    axial: axials[i],
    state: axials[i] > zeroTol ? 'tension' : axials[i] < -zeroTol ? 'compression' : 'zero',
  }));

  const stresses: MemberStress[] = elements.map((el, i) => ({
    element: el.id,
    stress: axials[i] / el.A,
  }));

  const reactions: DofValue[] = [];
  for (const gi of [...fixedSet].sort((a, b) => a - b)) {
    let r = -F[gi];
    for (let c = 0; c < nDof; c++) r += K[gi][c] * u[c];
    const { node, dof } = dofMap.at(gi);
    reactions.push({ node, dof, value: r });
  }
  let maxAbsReaction = 0;
  for (const r of reactions) maxAbsReaction = Math.max(maxAbsReaction, Math.abs(r.value));
  const reactionTol = 1e-9 * Math.max(maxAbsReaction, 1);
  for (const r of reactions) {
    if (Math.abs(r.value) <= reactionTol) r.value = 0;
  }

  let maxAbsU = 0;
  for (const v of u) maxAbsU = Math.max(maxAbsU, Math.abs(v));
  const dispTol = 1e-9 * maxAbsU;
  const displacements: DofValue[] = [];
  for (let gi = 0; gi < nDof; gi++) {
    const { node, dof } = dofMap.at(gi);
    displacements.push({ node, dof, value: Math.abs(u[gi]) <= dispTol ? 0 : u[gi] });
  }

  // 6. Failure checks: yield and Euler buckling
  const failures: MemberFailure[] = elements.map((el, i) => {
    const stress = stresses[i].stress;
    const yieldSF = stress === 0 ? Infinity : el.sigmaYield / Math.abs(stress);
    const inCompression = axials[i] < -zeroTol;
    const bucklingSF = inCompression
      ? eulerBucklingLoad(el.E, el.I, geometries[i].length) / Math.abs(axials[i])
      : Infinity;
    const safetyFactor = Math.min(yieldSF, bucklingSF);
    const fails = safetyFactor < 1;
    return {
      element: el.id,
      yieldSF,
      bucklingSF,
      safetyFactor,
      fails,
      mode: fails ? (yieldSF <= bucklingSF ? 'yield' : 'buckling') : null,
    };
  });

  return { displacements, memberForces, reactions, stresses, failures };
}
