// ─────────────────────────────────────────────
//  Import/export serialization for the truss editor model.
//  Pure TS (no React): serialize → JSON text, parse → validated model or a
//  human-readable error, summarize → the facts the preview box displays.
//  No structural math here — the preview solve check goes through the same
//  solveEditorState bridge as the live editor.
// ─────────────────────────────────────────────

import { snapNearZero } from '../../utils/mathUtils';
import type { EditorMember, EditorNode, SupportKind, SupportRestraint, ViewMode } from './editorState';
import { CUSTOM_SECTION_ID, findSection } from './sections';
import { SUPPORT_KINDS } from './supports';

export const TRUSS_FILE_FORMAT = 'physics-sims/truss';
export const TRUSS_FILE_VERSION = 1;

export interface TrussModel {
  mode: ViewMode;
  nodes: EditorNode[];
  members: EditorMember[];
}

export type ParseResult = { ok: true; model: TrussModel } | { ok: false; error: string };

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Serialize the current editor model to pretty-printed JSON. */
export function serializeTruss(
  mode: ViewMode,
  nodes: EditorNode[],
  members: EditorMember[],
): string {
  return JSON.stringify(
    {
      format: TRUSS_FILE_FORMAT,
      version: TRUSS_FILE_VERSION,
      mode,
      nodes: nodes.map((n) => ({
        id: n.id,
        // snap near-zero residue (e.g. from trig or 3D drags) before export
        x: snapNearZero(n.x),
        y: snapNearZero(n.y),
        z: snapNearZero(n.z),
        support: n.support,
        ...(n.support === 'custom'
          ? {
              restraint: {
                ux: !!n.restraint?.ux,
                uy: !!n.restraint?.uy,
                uz: !!n.restraint?.uz,
              },
            }
          : {}),
        load: {
          fx: snapNearZero(n.load.fx),
          fy: snapNearZero(n.load.fy),
          fz: snapNearZero(n.load.fz),
        },
      })),
      members: members.map((m) => ({
        id: m.id,
        i: m.i,
        j: m.j,
        sectionId: m.sectionId,
        E: m.E,
        A: m.A,
        I: m.I,
        sigmaYield: m.sigmaYield,
      })),
    },
    null,
    2,
  );
}

/**
 * Parse and validate truss JSON. Lenient about optional fields (z, support,
 * load, ids default sensibly) but strict about anything that would make the
 * solver misbehave: broken references, non-finite numbers, non-positive
 * section properties, duplicate ids.
 */
export function parseTrussFile(text: string): ParseResult {
  const err = (error: string): ParseResult => ({ ok: false, error });

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return err('not valid JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return err('expected a JSON object at the top level');
  }
  const obj = raw as Record<string, unknown>;

  if (obj.format !== undefined && obj.format !== TRUSS_FILE_FORMAT) {
    return err(`unrecognized format "${String(obj.format)}" — expected "${TRUSS_FILE_FORMAT}"`);
  }
  if (obj.version !== undefined && obj.version !== TRUSS_FILE_VERSION) {
    return err(`unsupported file version ${String(obj.version)}`);
  }

  let mode: ViewMode;
  if (obj.mode === undefined || obj.mode === '2d') mode = '2d';
  else if (obj.mode === '3d') mode = '3d';
  else return err(`"mode" must be "2d" or "3d", got ${JSON.stringify(obj.mode)}`);

  if (!Array.isArray(obj.nodes)) return err('"nodes" must be an array');
  if (!Array.isArray(obj.members)) return err('"members" must be an array');

  const nodes: EditorNode[] = [];
  const nodeIds = new Set<number>();
  for (let k = 0; k < obj.nodes.length; k++) {
    const n = obj.nodes[k] as Record<string, unknown>;
    if (typeof n !== 'object' || n === null) return err(`nodes[${k}] must be an object`);
    const id = n.id === undefined ? k : n.id;
    if (!isNum(id)) return err(`nodes[${k}]: "id" must be a number`);
    if (nodeIds.has(id)) return err(`nodes[${k}]: duplicate node id ${id}`);
    if (!isNum(n.x) || !isNum(n.y)) {
      return err(`nodes[${k}]: "x" and "y" must be finite numbers`);
    }
    if (n.z !== undefined && !isNum(n.z)) return err(`nodes[${k}]: "z" must be a number`);
    const support = n.support === undefined ? 'none' : n.support;
    if (!SUPPORT_KINDS.includes(support as SupportKind)) {
      return err(`nodes[${k}]: "support" must be one of ${SUPPORT_KINDS.join(', ')}`);
    }
    let restraint: SupportRestraint | undefined;
    if (n.restraint !== undefined) {
      if (typeof n.restraint !== 'object' || n.restraint === null) {
        return err(`nodes[${k}]: "restraint" must be an object of ux/uy/uz booleans`);
      }
      const r = n.restraint as Record<string, unknown>;
      restraint = { ux: r.ux === true, uy: r.uy === true, uz: r.uz === true };
    }
    const rawLoad = (n.load ?? {}) as Record<string, unknown>;
    if (typeof rawLoad !== 'object' || rawLoad === null) {
      return err(`nodes[${k}]: "load" must be an object`);
    }
    const load = { fx: rawLoad.fx ?? 0, fy: rawLoad.fy ?? 0, fz: rawLoad.fz ?? 0 };
    if (!isNum(load.fx) || !isNum(load.fy) || !isNum(load.fz)) {
      return err(`nodes[${k}]: load components must be finite numbers`);
    }
    nodeIds.add(id);
    nodes.push({
      id,
      x: n.x,
      y: n.y,
      z: n.z === undefined ? 0 : n.z,
      support: support as SupportKind,
      ...(restraint ? { restraint } : {}),
      load: { fx: load.fx, fy: load.fy, fz: load.fz },
    });
  }

  const members: EditorMember[] = [];
  const memberIds = new Set<number>();
  for (let k = 0; k < obj.members.length; k++) {
    const m = obj.members[k] as Record<string, unknown>;
    if (typeof m !== 'object' || m === null) return err(`members[${k}] must be an object`);
    const id = m.id === undefined ? k : m.id;
    if (!isNum(id)) return err(`members[${k}]: "id" must be a number`);
    if (memberIds.has(id)) return err(`members[${k}]: duplicate member id ${id}`);
    if (!isNum(m.i) || !isNum(m.j)) {
      return err(`members[${k}]: "i" and "j" must be node ids`);
    }
    if (!nodeIds.has(m.i)) return err(`members[${k}]: node ${m.i} does not exist`);
    if (!nodeIds.has(m.j)) return err(`members[${k}]: node ${m.j} does not exist`);
    if (m.i === m.j) return err(`members[${k}]: connects node ${m.i} to itself`);
    for (const key of ['E', 'A', 'I', 'sigmaYield'] as const) {
      const v = m[key];
      if (!isNum(v) || v <= 0) {
        return err(`members[${k}]: "${key}" must be a positive number`);
      }
    }
    const sectionId =
      typeof m.sectionId === 'string' && findSection(m.sectionId)
        ? m.sectionId
        : CUSTOM_SECTION_ID;
    memberIds.add(id);
    members.push({
      id,
      i: m.i as number,
      j: m.j as number,
      sectionId,
      E: m.E as number,
      A: m.A as number,
      I: m.I as number,
      sigmaYield: m.sigmaYield as number,
    });
  }

  return { ok: true, model: { mode, nodes, members } };
}

export interface TrussSummary {
  mode: ViewMode;
  nodeCount: number;
  memberCount: number;
  pins: number;
  rollers: number;
  customs: number;
  loadedNodes: number;
  /** Sum of point-load magnitudes (N). */
  totalLoad: number;
  /** Distinct section labels used by the members. */
  sections: string[];
}

/** The facts the preview box shows: what is in this model, at a glance. */
export function summarizeTruss(model: TrussModel): TrussSummary {
  let pins = 0;
  let rollers = 0;
  let customs = 0;
  let loadedNodes = 0;
  let totalLoad = 0;
  for (const n of model.nodes) {
    if (n.support === 'pin') pins++;
    else if (n.support === 'roller') rollers++;
    else if (n.support === 'custom') customs++;
    const mag = Math.hypot(n.load.fx, n.load.fy, n.load.fz);
    if (mag > 0) {
      loadedNodes++;
      totalLoad += mag;
    }
  }
  const sections = new Set<string>();
  for (const m of model.members) {
    sections.add(findSection(m.sectionId)?.label ?? 'custom section');
  }
  return {
    mode: model.mode,
    nodeCount: model.nodes.length,
    memberCount: model.members.length,
    pins,
    rollers,
    customs,
    loadedNodes,
    totalLoad,
    sections: [...sections],
  };
}