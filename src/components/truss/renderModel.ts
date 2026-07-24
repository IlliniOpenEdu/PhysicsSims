// ─────────────────────────────────────────────
//  Presentation view-model over a TrussSolution.
//  Pure lookup/aggregation for rendering — no structural math here;
//  everything physical comes straight from the solver output.
// ─────────────────────────────────────────────

import type { MemberFailure, MemberForce, TrussSolution } from '../../hooks/truss/solvers/truss/index';
import { formatAuto, formatSI, toSigFigs } from '../../utils/formatters';
import { clamp } from '../../utils/mathUtils';

export interface NodeVec {
  x: number;
  y: number;
  z: number;
}

export interface SolutionView {
  forceByMember: Map<number, MemberForce>;
  failureByMember: Map<number, MemberFailure>;
  stressByMember: Map<number, number>;
  dispByNode: Map<number, NodeVec>;
  reactionByNode: Map<number, NodeVec>;
  maxAbsForce: number;
  maxDeflection: number;
  failedCount: number;
  minSF: number;
  governingMember: number | null;
  governingMode: 'yield' | 'buckling' | null;
}

export function buildSolutionView(sol: TrussSolution): SolutionView {
  const forceByMember = new Map<number, MemberForce>();
  let maxAbsForce = 0;
  for (const f of sol.memberForces) {
    forceByMember.set(f.element, f);
    maxAbsForce = Math.max(maxAbsForce, Math.abs(f.axial));
  }

  const failureByMember = new Map<number, MemberFailure>();
  let failedCount = 0;
  let minSF = Infinity;
  let governingMember: number | null = null;
  let governingMode: 'yield' | 'buckling' | null = null;
  for (const f of sol.failures) {
    failureByMember.set(f.element, f);
    if (f.fails) failedCount++;
    if (f.safetyFactor < minSF) {
      minSF = f.safetyFactor;
      governingMember = f.element;
      governingMode = f.yieldSF <= f.bucklingSF ? 'yield' : 'buckling';
    }
  }

  const stressByMember = new Map<number, number>();
  for (const s of sol.stresses) stressByMember.set(s.element, s.stress);

  const dispByNode = new Map<number, NodeVec>();
  for (const d of sol.displacements) {
    const v = dispByNode.get(d.node) ?? { x: 0, y: 0, z: 0 };
    if (d.dof === 'tx') v.x = d.value;
    else if (d.dof === 'ty') v.y = d.value;
    else if (d.dof === 'tz') v.z = d.value;
    dispByNode.set(d.node, v);
  }

  const reactionByNode = new Map<number, NodeVec>();
  for (const r of sol.reactions) {
    const v = reactionByNode.get(r.node) ?? { x: 0, y: 0, z: 0 };
    if (r.dof === 'tx') v.x = r.value;
    else if (r.dof === 'ty') v.y = r.value;
    else if (r.dof === 'tz') v.z = r.value;
    reactionByNode.set(r.node, v);
  }

  let maxDeflection = 0;
  for (const v of dispByNode.values()) {
    maxDeflection = Math.max(maxDeflection, Math.hypot(v.x, v.y, v.z));
  }

  return {
    forceByMember,
    failureByMember,
    stressByMember,
    dispByNode,
    reactionByNode,
    maxAbsForce,
    maxDeflection,
    failedCount,
    minSF,
    governingMember,
    governingMode,
  };
}

// ── Member color coding ──────────────────────
// Tension → sky, compression → orange, failed/near-failure → rose.
// Intensity follows |force| relative to the largest force in the structure.

const TENSION: [number, number, number] = [56, 189, 248]; // sky-400
const COMPRESSION: [number, number, number] = [251, 146, 60]; // orange-400
const FAILED: [number, number, number] = [244, 63, 94]; // rose-500
const NEUTRAL: [number, number, number] = [100, 116, 139]; // slate-500

const mix = (
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];

/** 0..1 visual weight of a member: |force| relative to the structure max. */
export function memberIntensity(view: SolutionView | null, memberId: number): number {
  if (!view || view.maxAbsForce === 0) return 0;
  const f = view.forceByMember.get(memberId);
  return f ? Math.abs(f.axial) / view.maxAbsForce : 0;
}

/** CSS color for a member given the solved state. */
export function memberColor(view: SolutionView | null, memberId: number): string {
  if (!view) return 'rgb(100,116,139)';
  const force = view.forceByMember.get(memberId);
  const failure = view.failureByMember.get(memberId);
  if (failure?.fails) return `rgb(${FAILED.join(',')})`;

  let c: [number, number, number];
  if (!force || force.state === 'zero') {
    c = NEUTRAL;
  } else {
    const base = force.state === 'tension' ? TENSION : COMPRESSION;
    const t = memberIntensity(view, memberId);
    c = mix(NEUTRAL, base, 0.3 + 0.7 * t);
  }
  // Near failure (SF < 1.6): blend toward rose so trouble reads before it breaks
  if (failure && failure.safetyFactor < 1.6) {
    c = mix(c, FAILED, clamp((1.6 - failure.safetyFactor) / 0.6, 0, 1) * 0.8);
  }
  return `rgb(${c.join(',')})`;
}

// ── Readout formatting (formatters.ts everywhere, no raw toFixed) ────────────

export const fmtForce = (newtons: number): string => formatSI(newtons / 1e3, 'kN', 3);
export const fmtStress = (pa: number): string => formatSI(pa / 1e6, 'MPa', 3);
export const fmtLength = (m: number): string => formatSI(m, 'm', 3);
export const fmtDeflection = (m: number): string => formatAuto(m * 1e3, 'mm', 3);
export const fmtSF = (sf: number): string => (sf === Infinity ? '∞' : String(toSigFigs(sf, 3)));
