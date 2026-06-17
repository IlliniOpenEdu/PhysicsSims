// Modified Nodal Analysis (MNA) for DC operating points and transient stepping.
//
// Companion models (trapezoidal integration) are used for capacitors and
// inductors so no extra unknowns are needed for reactive parts. Ideal sources
// add one current unknown each. A small conductance to ground (GMIN) on every
// node guarantees a non-singular system and handles floating sub-networks.

import type {
  CircuitComponent,
  ComponentResult,
  ReactiveState,
  Schematic,
  SolveResult,
  SolveTotals,
} from './types';
import { componentTerminals, pinKey } from './geometry';
import { buildTopology } from './graph';
import { solveReal } from './linalg';

const GMIN = 1e-9; // S, node-to-ground leakage (SPICE-style)
const METER_RESISTANCE = 1e-6; // Ω, ideal ammeter
const IDEAL_SOURCE_R = 1e-9; // threshold below which a source is treated as ideal

interface VSourceEntry {
  comp: CircuitComponent;
  nodePlus: number;
  nodeMinus: number;
  value: number; // instantaneous EMF
  /** Index into the current-unknown block. */
  currentIndex: number;
}

export interface TransientOptions {
  dt: number;
  time: number;
}

function emptyResult(message: string): SolveResult {
  return {
    ok: false,
    message,
    nodeVoltages: [],
    groundNode: 0,
    nodeCount: 0,
    nodeOfKey: new Map(),
    components: new Map(),
    totals: {
      sourcePower: 0,
      dissipatedPower: 0,
      capacitorEnergy: 0,
      inductorEnergy: 0,
      sourceCurrentMagnitude: 0,
      equivalentResistance: null,
    },
  };
}

function instantaneousSourceValue(c: CircuitComponent, time: number): number {
  if (c.kind === 'battery') return c.voltage ?? 0;
  if (c.kind === 'acsource') {
    const peak = c.voltage ?? 0;
    const omega = 2 * Math.PI * (c.frequency ?? 0);
    return peak * Math.sin(omega * time + (c.phase ?? 0));
  }
  return 0;
}

/**
 * Solve the circuit for a single instant. When `transient` is provided the
 * reactive companion models advance `state` in place; otherwise reactive
 * components use their stored DC behaviour (open caps, shorted inductors are
 * approximated by the existing state).
 */
export function solveStep(
  schematic: Schematic,
  state: ReactiveState,
  transient: TransientOptions,
): SolveResult {
  const topo = buildTopology(schematic);
  const { nodeOfKey, nodeCount, groundNode } = topo;

  if (nodeCount === 0) return emptyResult('Place components to begin.');

  const dt = Math.max(transient.dt, 1e-12);

  // Matrix index for each node: ground is removed (reference). Non-ground
  // nodes are compacted into 0..(nodeCount-2).
  const nidx = (node: number): number => {
    if (node === groundNode) return -1;
    return node < groundNode ? node : node - 1;
  };
  const numNodeUnknowns = nodeCount - 1;

  // Identify ideal voltage sources (need a current unknown).
  const vsources: VSourceEntry[] = [];
  const terminalNode = (c: CircuitComponent, idx: number): number => {
    const terminals = componentTerminals(c);
    const t = terminals[idx];
    return nodeOfKey.get(pinKey(t.x, t.y)) ?? groundNode;
  };

  for (const c of schematic.components) {
    if (c.kind === 'battery' || c.kind === 'acsource') {
      const rint = c.internalResistance ?? 0;
      if (rint <= IDEAL_SOURCE_R) {
        vsources.push({
          comp: c,
          nodePlus: terminalNode(c, 0),
          nodeMinus: terminalNode(c, 1),
          value: instantaneousSourceValue(c, transient.time),
          currentIndex: vsources.length,
        });
      }
    }
  }

  const size = numNodeUnknowns + vsources.length;
  if (size === 0) return emptyResult('Add a reference and a source.');

  const A: number[][] = Array.from({ length: size }, () => new Array<number>(size).fill(0));
  const z = new Array<number>(size).fill(0);

  const stampConductance = (na: number, nb: number, g: number) => {
    const a = nidx(na);
    const b = nidx(nb);
    if (a >= 0) A[a][a] += g;
    if (b >= 0) A[b][b] += g;
    if (a >= 0 && b >= 0) {
      A[a][b] -= g;
      A[b][a] -= g;
    }
  };

  const stampCurrentSource = (na: number, nb: number, current: number) => {
    // Current injected into na, drawn from nb.
    const a = nidx(na);
    const b = nidx(nb);
    if (a >= 0) z[a] += current;
    if (b >= 0) z[b] -= current;
  };

  const stampVSource = (entry: VSourceEntry) => {
    const k = numNodeUnknowns + entry.currentIndex;
    const a = nidx(entry.nodePlus);
    const b = nidx(entry.nodeMinus);
    if (a >= 0) {
      A[a][k] += 1;
      A[k][a] += 1;
    }
    if (b >= 0) {
      A[b][k] -= 1;
      A[k][b] -= 1;
    }
    z[k] += entry.value;
  };

  // GMIN to ground on every node.
  for (let node = 0; node < nodeCount; node += 1) {
    const i = nidx(node);
    if (i >= 0) A[i][i] += GMIN;
  }

  // History terms computed for reactive devices so we can recover currents.
  interface CapStamp {
    comp: CircuitComponent;
    na: number;
    nb: number;
    geq: number;
    ihist: number;
  }
  interface IndStamp {
    comp: CircuitComponent;
    na: number;
    nb: number;
    geq: number;
    ihist: number;
  }
  const capStamps: CapStamp[] = [];
  const indStamps: IndStamp[] = [];

  for (const c of schematic.components) {
    switch (c.kind) {
      case 'resistor': {
        const r = Math.max(c.resistance ?? 1, 1e-9);
        stampConductance(terminalNode(c, 0), terminalNode(c, 1), 1 / r);
        break;
      }
      case 'battery':
      case 'acsource': {
        const rint = c.internalResistance ?? 0;
        if (rint > IDEAL_SOURCE_R) {
          // Norton equivalent for a real source.
          const g = 1 / rint;
          const v = instantaneousSourceValue(c, transient.time);
          stampConductance(terminalNode(c, 0), terminalNode(c, 1), g);
          stampCurrentSource(terminalNode(c, 0), terminalNode(c, 1), v * g);
        }
        break;
      }
      case 'capacitor': {
        const cap = Math.max(c.capacitance ?? 1e-12, 1e-15);
        const vPrev = state.capVoltage.get(c.id) ?? 0;
        const iPrev = state.capCurrent.get(c.id) ?? 0;
        const geq = (2 * cap) / dt;
        const ihist = geq * vPrev + iPrev;
        stampConductance(terminalNode(c, 0), terminalNode(c, 1), geq);
        stampCurrentSource(terminalNode(c, 0), terminalNode(c, 1), ihist);
        capStamps.push({ comp: c, na: terminalNode(c, 0), nb: terminalNode(c, 1), geq, ihist });
        break;
      }
      case 'inductor': {
        const ind = Math.max(c.inductance ?? 1e-6, 1e-12);
        const iPrev = state.indCurrent.get(c.id) ?? 0;
        const vPrev = state.indVoltage.get(c.id) ?? 0;
        const geq = dt / (2 * ind);
        const ihist = iPrev + geq * vPrev;
        stampConductance(terminalNode(c, 0), terminalNode(c, 1), geq);
        stampCurrentSource(terminalNode(c, 0), terminalNode(c, 1), -ihist);
        indStamps.push({ comp: c, na: terminalNode(c, 0), nb: terminalNode(c, 1), geq, ihist });
        break;
      }
      case 'ammeter': {
        stampConductance(terminalNode(c, 0), terminalNode(c, 1), 1 / METER_RESISTANCE);
        break;
      }
      case 'switch': {
        // Closed switches are merged in the topology; open switches are open.
        break;
      }
      case 'voltmeter':
      case 'ground':
      default:
        break;
    }
  }

  // Wire resistance elements (when enabled).
  if (schematic.settings.wireResistance) {
    const rw = Math.max(schematic.settings.wireResistanceOhms, 1e-6);
    for (const w of schematic.wires) {
      const na = nodeOfKey.get(pinKey(w.a.x, w.a.y)) ?? groundNode;
      const nb = nodeOfKey.get(pinKey(w.b.x, w.b.y)) ?? groundNode;
      stampConductance(na, nb, 1 / rw);
    }
  }

  for (const entry of vsources) stampVSource(entry);

  const x = solveReal(A, z);
  if (!x) return emptyResult('Singular system — check for shorts or floating parts.');

  // Recover node voltages (ground = 0).
  const nodeVoltages = new Array<number>(nodeCount).fill(0);
  for (let node = 0; node < nodeCount; node += 1) {
    const i = nidx(node);
    nodeVoltages[node] = i >= 0 ? x[i] : 0;
  }
  const nodeV = (node: number) => nodeVoltages[node];

  const components = new Map<string, ComponentResult>();
  let dissipatedPower = 0;
  let capacitorEnergy = 0;
  let inductorEnergy = 0;
  let sourcePower = 0;
  let sourceCurrentMagnitude = 0;

  // Resistors / wires.
  for (const c of schematic.components) {
    if (c.kind === 'resistor') {
      const r = Math.max(c.resistance ?? 1, 1e-9);
      const v = nodeV(terminalNode(c, 0)) - nodeV(terminalNode(c, 1));
      const i = v / r;
      const p = v * i;
      dissipatedPower += p;
      components.set(c.id, { voltage: v, current: i, power: p });
    } else if (c.kind === 'ammeter') {
      const v = nodeV(terminalNode(c, 0)) - nodeV(terminalNode(c, 1));
      const i = v / METER_RESISTANCE;
      components.set(c.id, { voltage: v, current: i, power: 0 });
    } else if (c.kind === 'voltmeter') {
      const v = nodeV(terminalNode(c, 0)) - nodeV(terminalNode(c, 1));
      components.set(c.id, { voltage: v, current: 0, power: 0 });
    } else if (c.kind === 'switch') {
      const v = nodeV(terminalNode(c, 0)) - nodeV(terminalNode(c, 1));
      components.set(c.id, { voltage: v, current: 0, power: 0 });
    } else if (c.kind === 'ground') {
      components.set(c.id, { voltage: 0, current: 0, power: 0 });
    }
  }

  // Capacitor currents + state update.
  for (const s of capStamps) {
    const v = nodeV(s.na) - nodeV(s.nb);
    const i = s.geq * v - s.ihist;
    const cap = Math.max(s.comp.capacitance ?? 1e-12, 1e-15);
    const energy = 0.5 * cap * v * v;
    capacitorEnergy += energy;
    components.set(s.comp.id, { voltage: v, current: i, power: v * i, energy });
    state.capVoltage.set(s.comp.id, v);
    state.capCurrent.set(s.comp.id, i);
  }

  // Inductor currents + state update.
  for (const s of indStamps) {
    const v = nodeV(s.na) - nodeV(s.nb);
    const i = s.geq * v + s.ihist;
    const ind = Math.max(s.comp.inductance ?? 1e-6, 1e-12);
    const energy = 0.5 * ind * i * i;
    inductorEnergy += energy;
    components.set(s.comp.id, { voltage: v, current: i, power: v * i, energy });
    state.indCurrent.set(s.comp.id, i);
    state.indVoltage.set(s.comp.id, v);
  }

  // Ideal source currents from the unknown block.
  for (const entry of vsources) {
    const current = x[numNodeUnknowns + entry.currentIndex];
    const v = nodeV(entry.nodePlus) - nodeV(entry.nodeMinus);
    // Current unknown is defined flowing from + into the source; power
    // delivered to the circuit is V·I with this sign convention.
    const delivered = v * current;
    sourcePower += delivered;
    sourceCurrentMagnitude += Math.abs(current);
    components.set(entry.comp.id, { voltage: v, current, power: delivered });
  }

  // Real (Norton) sources.
  for (const c of schematic.components) {
    if ((c.kind === 'battery' || c.kind === 'acsource') && (c.internalResistance ?? 0) > IDEAL_SOURCE_R) {
      const rint = c.internalResistance ?? 0;
      const emf = instantaneousSourceValue(c, transient.time);
      const vt = nodeV(terminalNode(c, 0)) - nodeV(terminalNode(c, 1));
      const current = (emf - vt) / rint; // out of + terminal
      const delivered = vt * current;
      sourcePower += delivered;
      sourceCurrentMagnitude += Math.abs(current);
      // Internal resistor dissipation.
      dissipatedPower += current * current * rint;
      components.set(c.id, { voltage: vt, current, power: delivered });
    }
  }

  const totals: SolveTotals = {
    sourcePower,
    dissipatedPower,
    capacitorEnergy,
    inductorEnergy,
    sourceCurrentMagnitude,
    equivalentResistance: computeEquivalentResistance(schematic, components),
  };

  return {
    ok: true,
    nodeVoltages,
    groundNode,
    nodeCount,
    nodeOfKey,
    components,
    totals,
  };
}

function computeEquivalentResistance(
  schematic: Schematic,
  components: Map<string, ComponentResult>,
): number | null {
  const sources = schematic.components.filter(
    (c) => c.kind === 'battery' || c.kind === 'acsource',
  );
  if (sources.length !== 1) return null;
  const res = components.get(sources[0].id);
  if (!res || Math.abs(res.current) < 1e-12) return null;
  return Math.abs(res.voltage / res.current);
}
