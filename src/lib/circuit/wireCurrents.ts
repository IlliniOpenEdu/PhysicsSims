// Estimate the current carried by each ideal wire for visualization.
//
// Ideal wires merge nodes, so MNA never assigns them an individual current.
// We recover a physically consistent distribution by treating each wire (and
// each closed switch) as a unit-conductance edge and enforcing KCL at every
// grid coordinate using the known component terminal currents as injections.
// Solving the resulting graph Laplacian gives node "potentials" whose
// differences are the edge currents — exact at every junction, with the
// equal-resistance assumption only splitting current among redundant parallel
// wires.

import type { Schematic, SolveResult } from './types';
import { componentTerminals, pinKey } from './geometry';
import { solveReal } from './linalg';

const MAX_VERTICES = 600; // perf guard for very large drawings

interface Edge {
  wireId: string | null;
  a: number; // vertex index
  b: number;
}

export function computeWireCurrents(
  schematic: Schematic,
  result: SolveResult,
): Map<string, number> {
  const out = new Map<string, number>();
  if (!result.ok || schematic.wires.length === 0) return out;

  const vIndex = new Map<string, number>();
  const groundKeys = new Set<string>();
  const addVertex = (key: string): number => {
    let idx = vIndex.get(key);
    if (idx === undefined) {
      idx = vIndex.size;
      vIndex.set(key, idx);
    }
    return idx;
  };

  const edges: Edge[] = [];
  for (const w of schematic.wires) {
    const a = addVertex(pinKey(w.a.x, w.a.y));
    const b = addVertex(pinKey(w.b.x, w.b.y));
    if (a !== b) edges.push({ wireId: w.id, a, b });
  }
  for (const c of schematic.components) {
    if (c.kind === 'switch' && c.closed) {
      const t = componentTerminals(c);
      if (t.length === 2) {
        const a = addVertex(pinKey(t[0].x, t[0].y));
        const b = addVertex(pinKey(t[1].x, t[1].y));
        if (a !== b) edges.push({ wireId: null, a, b });
      }
    }
    if (c.kind === 'ground') groundKeys.add(pinKey(c.x, c.y));
  }

  const n = vIndex.size;
  if (n === 0 || n > MAX_VERTICES) return out;

  // Injection at each vertex: current flowing OUT of a component INTO the wire
  // network. The solver defines component current positive from terminal A→B,
  // so current exits at B (+I) and is drawn at A (−I).
  const injection = new Array<number>(n).fill(0);
  for (const c of schematic.components) {
    if (c.kind === 'switch' || c.kind === 'ground') continue;
    const res = result.components.get(c.id);
    if (!res) continue;
    const terms = componentTerminals(c);
    if (terms.length < 2) continue;
    const ka = vIndex.get(pinKey(terms[0].x, terms[0].y));
    const kb = vIndex.get(pinKey(terms[1].x, terms[1].y));
    if (ka !== undefined) injection[ka] -= res.current;
    if (kb !== undefined) injection[kb] += res.current;
  }

  // Group vertices into connected sub-graphs (electrical nodes).
  const parent = new Array<number>(n);
  for (let i = 0; i < n; i += 1) parent[i] = i;
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  const union = (x: number, y: number) => {
    const rx = find(x);
    const ry = find(y);
    if (rx !== ry) parent[rx] = ry;
  };
  for (const e of edges) union(e.a, e.b);

  const groundVertices = new Set<number>();
  for (const key of groundKeys) {
    const idx = vIndex.get(key);
    if (idx !== undefined) groundVertices.add(idx);
  }

  // Per sub-graph: build a reduced Laplacian (dropping one reference vertex)
  // and solve L·φ = injection.
  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i += 1) {
    const root = find(i);
    let arr = groups.get(root);
    if (!arr) {
      arr = [];
      groups.set(root, arr);
    }
    arr.push(i);
  }

  const phi = new Array<number>(n).fill(0);

  for (const [, vertices] of groups) {
    if (vertices.length < 2) continue;
    // Choose a reference vertex (prefer a ground coordinate).
    let ref = vertices.find((v) => groundVertices.has(v));
    if (ref === undefined) ref = vertices[0];

    // Local indexing excluding the reference vertex.
    const local = new Map<number, number>();
    for (const v of vertices) {
      if (v === ref) continue;
      local.set(v, local.size);
    }
    const m = local.size;
    if (m === 0) continue;

    const A: number[][] = Array.from({ length: m }, () => new Array<number>(m).fill(0));
    const bVec = new Array<number>(m).fill(0);
    for (const v of vertices) {
      if (v === ref) continue;
      bVec[local.get(v)!] = injection[v];
    }
    for (const e of edges) {
      if (find(e.a) !== find(e.b)) continue;
      if (find(e.a) !== find(vertices[0])) continue; // edge belongs to this group
      const la = e.a === ref ? -1 : local.get(e.a)!;
      const lb = e.b === ref ? -1 : local.get(e.b)!;
      if (la >= 0) A[la][la] += 1;
      if (lb >= 0) A[lb][lb] += 1;
      if (la >= 0 && lb >= 0) {
        A[la][lb] -= 1;
        A[lb][la] -= 1;
      }
    }

    const sol = solveReal(A, bVec);
    if (!sol) continue;
    for (const [v, li] of local) phi[v] = sol[li];
  }

  // Edge current (a→b) = φ_a − φ_b.
  for (const e of edges) {
    if (e.wireId === null) continue;
    out.set(e.wireId, phi[e.a] - phi[e.b]);
  }
  return out;
}
