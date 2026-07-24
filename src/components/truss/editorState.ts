// ─────────────────────────────────────────────
//  Truss editor state model + the bridge to the Phase 1 solver.
//  Pure TS (no React) so presets and the solve bridge are testable headless.
//  All structural math lives in src/solvers/truss — this file only shapes
//  editor data into solver input and catches solver errors for the UI.
// ─────────────────────────────────────────────

import {
  TrussError,
  analyzeRestraints,
  solveTruss,
  type Load,
  type Support,
  type TrussElement,
  type TrussErrorCode,
  type TrussNode,
  type TrussSolution,
} from '../../hooks/truss/solvers/truss/index';
import { supportDofs, type SupportKind, type SupportRestraint } from './supports';

export type { SupportKind, SupportRestraint } from './supports';

export type ViewMode = '2d' | '3d';
export type Tool = 'select' | 'add-node' | 'member' | 'delete';

export interface EditorNode {
  id: number;
  x: number;
  y: number;
  z: number; // used only in 3D mode
  support: SupportKind;
  /** Restrained axes when support === 'custom'; ignored for named kinds. */
  restraint?: SupportRestraint;
  /** Point load components (N). */
  load: { fx: number; fy: number; fz: number };
}

export interface EditorMember {
  id: number;
  i: number;
  j: number;
  /** Section preset id, or 'custom' once any value is hand-edited. */
  sectionId: string;
  E: number; // Pa
  A: number; // m²
  I: number; // m⁴
  sigmaYield: number; // Pa
}

export type Selection = { kind: 'node' | 'member'; id: number } | null;

export type SolveState =
  | {
      kind: 'ok';
      solution: TrussSolution;
      /** Node ids that took part in the solve (connected to ≥1 member). */
      solvedNodeIds: Set<number>;
      /** True when a planar structure in 3D mode had z auto-restrained. */
      planarZRestrained: boolean;
      /** Non-null when the supports cannot stop every rigid-body motion. */
      restraintWarning: string | null;
    }
  | { kind: 'error'; code: TrussErrorCode; message: string; restraintWarning: string | null }
  | { kind: 'empty' };

const PLANAR_EPS = 1e-9;

/**
 * Shape editor state into solver input and run solveTruss.
 * Unconnected nodes are excluded (they are sketch marks, not structure).
 * In 3D mode a fully planar (z = 0) structure gets tz restrained at every
 * node — the standard out-of-plane assumption — otherwise any 2D truss
 * viewed in 3D would trivially be an out-of-plane mechanism.
 */
export function solveEditorState(
  mode: ViewMode,
  nodes: EditorNode[],
  members: EditorMember[],
): SolveState {
  if (members.length === 0) return { kind: 'empty' };

  const connected = new Set<number>();
  for (const m of members) {
    connected.add(m.i);
    connected.add(m.j);
  }
  const active = nodes.filter((n) => connected.has(n.id));
  if (active.length === 0) return { kind: 'empty' };

  const is3d = mode === '3d';
  const planar = is3d && active.every((n) => Math.abs(n.z) < PLANAR_EPS);

  const tNodes: TrussNode[] = active.map((n) => ({
    id: n.id,
    pos: is3d ? { x: n.x, y: n.y, z: n.z } : { x: n.x, y: n.y },
  }));

  const elements: TrussElement[] = members.map((m) => ({
    id: m.id,
    nodes: [m.i, m.j],
    E: m.E,
    A: m.A,
    I: m.I,
    sigmaYield: m.sigmaYield,
  }));

  // Boundary conditions come from the shared resolver — restrained axes
  // only, never support labels.
  const supports: Support[] = [];
  for (const n of active) {
    const dofs = supportDofs(n.support, n.restraint, is3d);
    if (planar && !dofs.includes('tz')) dofs.push('tz');
    if (dofs.length > 0) supports.push({ node: n.id, dofs });
  }

  // Rigid-body check on the resolved DOF: counts of pins/rollers say
  // nothing about 3D stability — a 2D-style pin + roller still yaws.
  const restraint = analyzeRestraints(tNodes, supports);
  const restraintWarning = restraint.sufficient
    ? null
    : `Supports restrain ${restraint.restrainedRank} of ${restraint.required} rigid-body motions — unrestrained: ${restraint.freeModes.join(', ')}. ` +
      (is3d
        ? 'A 2D-style pin + roller cannot hold a 3D structure — fix more axes (e.g. a custom support restraining x or z) or add supports.'
        : 'Add supports or restrain more axes.');

  const loads: Load[] = [];
  for (const n of active) {
    if (n.load.fx !== 0) loads.push({ node: n.id, dof: 'tx', value: n.load.fx });
    if (n.load.fy !== 0) loads.push({ node: n.id, dof: 'ty', value: n.load.fy });
    if (is3d && n.load.fz !== 0) loads.push({ node: n.id, dof: 'tz', value: n.load.fz });
  }

  try {
    return {
      kind: 'ok',
      solution: solveTruss(tNodes, elements, supports, loads),
      solvedNodeIds: connected,
      planarZRestrained: planar,
      restraintWarning,
    };
  } catch (e) {
    if (e instanceof TrussError) {
      return { kind: 'error', code: e.code, message: e.message, restraintWarning };
    }
    throw e;
  }
}

/** Bounding-box diagonal of the structure — used to scale glyphs/ghost. */
export function structureSpan(nodes: EditorNode[], mode: ViewMode): number {
  if (nodes.length < 2) return 1;
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity,
    minZ = Infinity,
    maxZ = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x);
    maxX = Math.max(maxX, n.x);
    minY = Math.min(minY, n.y);
    maxY = Math.max(maxY, n.y);
    minZ = Math.min(minZ, n.z);
    maxZ = Math.max(maxZ, n.z);
  }
  const dz = mode === '3d' ? maxZ - minZ : 0;
  return Math.max(Math.hypot(maxX - minX, maxY - minY, dz), 0.5);
}
