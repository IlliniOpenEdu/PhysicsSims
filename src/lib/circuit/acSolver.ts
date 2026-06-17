// AC steady-state (phasor) analysis using complex Modified Nodal Analysis.
//
// All AC sources are taken at angular frequency ω with their peak amplitude and
// phase. DC batteries are treated as AC shorts (their AC component is zero), so
// this is single-frequency superposition for the AC excitation.

import type { CircuitComponent, Schematic } from './types';
import { componentTerminals, pinKey } from './geometry';
import { buildTopology } from './graph';
import type { Complex } from './linalg';
import { cAbs, cArg, cMul, cPolar, cSub, cx, solveComplex } from './linalg';

const GMIN = 1e-9;
const METER_R = 1e-6;

export interface AcComponentResult {
  voltageMag: number;
  voltagePhase: number;
  currentMag: number;
  currentPhase: number;
  impedance: number; // |Z|
}

export interface AcResult {
  ok: boolean;
  message?: string;
  nodePhasors: Complex[];
  groundNode: number;
  components: Map<string, AcComponentResult>;
}

interface AcVSource {
  comp: CircuitComponent;
  nodePlus: number;
  nodeMinus: number;
  phasor: Complex;
  currentIndex: number;
}

/** Solve the network at a single angular frequency. */
export function solveAc(schematic: Schematic, omega: number): AcResult {
  const topo = buildTopology(schematic);
  const { nodeOfKey, nodeCount, groundNode } = topo;
  if (nodeCount === 0) {
    return { ok: false, message: 'No nodes', nodePhasors: [], groundNode: 0, components: new Map() };
  }

  const nidx = (node: number): number => {
    if (node === groundNode) return -1;
    return node < groundNode ? node : node - 1;
  };
  const numNodeUnknowns = nodeCount - 1;

  const terminalNode = (c: CircuitComponent, idx: number): number => {
    const t = componentTerminals(c)[idx];
    return nodeOfKey.get(pinKey(t.x, t.y)) ?? groundNode;
  };

  const vsources: AcVSource[] = [];
  for (const c of schematic.components) {
    if (c.kind === 'acsource') {
      vsources.push({
        comp: c,
        nodePlus: terminalNode(c, 0),
        nodeMinus: terminalNode(c, 1),
        phasor: cPolar(c.voltage ?? 0, c.phase ?? 0),
        currentIndex: vsources.length,
      });
    } else if (c.kind === 'battery') {
      // DC source is an AC short.
      vsources.push({
        comp: c,
        nodePlus: terminalNode(c, 0),
        nodeMinus: terminalNode(c, 1),
        phasor: cx(0, 0),
        currentIndex: vsources.length,
      });
    }
  }

  const size = numNodeUnknowns + vsources.length;
  if (size === 0) {
    return { ok: false, message: 'No unknowns', nodePhasors: [], groundNode, components: new Map() };
  }

  const A: Complex[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => cx(0, 0)),
  );

  const stampY = (na: number, nb: number, y: Complex) => {
    const a = nidx(na);
    const b = nidx(nb);
    if (a >= 0) A[a][a] = { re: A[a][a].re + y.re, im: A[a][a].im + y.im };
    if (b >= 0) A[b][b] = { re: A[b][b].re + y.re, im: A[b][b].im + y.im };
    if (a >= 0 && b >= 0) {
      A[a][b] = { re: A[a][b].re - y.re, im: A[a][b].im - y.im };
      A[b][a] = { re: A[b][a].re - y.re, im: A[b][a].im - y.im };
    }
  };

  for (let node = 0; node < nodeCount; node += 1) {
    const i = nidx(node);
    if (i >= 0) A[i][i] = { re: A[i][i].re + GMIN, im: A[i][i].im };
  }

  for (const c of schematic.components) {
    if (c.kind === 'resistor') {
      stampY(terminalNode(c, 0), terminalNode(c, 1), cx(1 / Math.max(c.resistance ?? 1, 1e-9), 0));
    } else if (c.kind === 'capacitor') {
      stampY(terminalNode(c, 0), terminalNode(c, 1), cx(0, omega * Math.max(c.capacitance ?? 1e-12, 1e-15)));
    } else if (c.kind === 'inductor') {
      const l = Math.max(c.inductance ?? 1e-6, 1e-12);
      // Y = 1/(jωL) = -j/(ωL); guard ω→0.
      const denom = omega * l;
      const y = denom > 1e-12 ? cx(0, -1 / denom) : cx(1e9, 0);
      stampY(terminalNode(c, 0), terminalNode(c, 1), y);
    } else if (c.kind === 'ammeter') {
      stampY(terminalNode(c, 0), terminalNode(c, 1), cx(1 / METER_R, 0));
    }
  }

  if (schematic.settings.wireResistance) {
    const rw = Math.max(schematic.settings.wireResistanceOhms, 1e-6);
    for (const w of schematic.wires) {
      const na = nodeOfKey.get(pinKey(w.a.x, w.a.y)) ?? groundNode;
      const nb = nodeOfKey.get(pinKey(w.b.x, w.b.y)) ?? groundNode;
      stampY(na, nb, cx(1 / rw, 0));
    }
  }

  const b: Complex[] = Array.from({ length: size }, () => cx(0, 0));
  for (const s of vsources) {
    const k = numNodeUnknowns + s.currentIndex;
    const a = nidx(s.nodePlus);
    const m = nidx(s.nodeMinus);
    if (a >= 0) {
      A[a][k] = { re: A[a][k].re + 1, im: A[a][k].im };
      A[k][a] = { re: A[k][a].re + 1, im: A[k][a].im };
    }
    if (m >= 0) {
      A[m][k] = { re: A[m][k].re - 1, im: A[m][k].im };
      A[k][m] = { re: A[k][m].re - 1, im: A[k][m].im };
    }
    b[k] = s.phasor;
  }

  const x = solveComplex(A, b);
  if (!x) {
    return { ok: false, message: 'Singular AC system', nodePhasors: [], groundNode, components: new Map() };
  }

  const nodePhasors: Complex[] = new Array(nodeCount);
  for (let node = 0; node < nodeCount; node += 1) {
    const i = nidx(node);
    nodePhasors[node] = i >= 0 ? x[i] : cx(0, 0);
  }

  const components = new Map<string, AcComponentResult>();
  const phasorV = (na: number, nb: number) => cSub(nodePhasors[na], nodePhasors[nb]);

  for (const c of schematic.components) {
    if (c.kind === 'resistor' || c.kind === 'capacitor' || c.kind === 'inductor' || c.kind === 'ammeter') {
      const v = phasorV(terminalNode(c, 0), terminalNode(c, 1));
      let y: Complex;
      if (c.kind === 'resistor') y = cx(1 / Math.max(c.resistance ?? 1, 1e-9), 0);
      else if (c.kind === 'capacitor') y = cx(0, omega * Math.max(c.capacitance ?? 1e-12, 1e-15));
      else if (c.kind === 'inductor') {
        const denom = omega * Math.max(c.inductance ?? 1e-6, 1e-12);
        y = denom > 1e-12 ? cx(0, -1 / denom) : cx(1e9, 0);
      } else y = cx(1 / METER_R, 0);
      const i = cMul(v, y);
      const iMag = cAbs(i);
      components.set(c.id, {
        voltageMag: cAbs(v),
        voltagePhase: cArg(v),
        currentMag: iMag,
        currentPhase: cArg(i),
        impedance: iMag > 1e-15 ? cAbs(v) / iMag : Infinity,
      });
    } else if (c.kind === 'acsource' || c.kind === 'battery') {
      const entry = vsources.find((s) => s.comp.id === c.id);
      if (!entry) continue;
      const current = x[numNodeUnknowns + entry.currentIndex];
      const v = phasorV(entry.nodePlus, entry.nodeMinus);
      const iMag = cAbs(current);
      components.set(c.id, {
        voltageMag: cAbs(v),
        voltagePhase: cArg(v),
        currentMag: iMag,
        currentPhase: cArg(current),
        impedance: iMag > 1e-15 ? cAbs(v) / iMag : Infinity,
      });
    }
  }

  return { ok: true, nodePhasors, groundNode, components };
}

export interface SweepPoint {
  freq: number;
  impedance: number;
  currentMag: number;
  phase: number;
}

export interface SweepResult {
  points: SweepPoint[];
  resonanceFreq: number | null;
}

/**
 * Logarithmic frequency sweep of the impedance / current seen by the first AC
 * source. Resonance is detected as the current-magnitude peak.
 */
export function frequencySweep(
  schematic: Schematic,
  fMin: number,
  fMax: number,
  steps = 160,
): SweepResult {
  const source = schematic.components.find((c) => c.kind === 'acsource');
  const points: SweepPoint[] = [];
  if (!source) return { points, resonanceFreq: null };

  const logMin = Math.log10(Math.max(fMin, 1e-3));
  const logMax = Math.log10(Math.max(fMax, fMin * 1.0001));
  let bestCurrent = -Infinity;
  let resonanceFreq: number | null = null;

  for (let s = 0; s <= steps; s += 1) {
    const freq = 10 ** (logMin + ((logMax - logMin) * s) / steps);
    const omega = 2 * Math.PI * freq;
    const res = solveAc(schematic, omega);
    const comp = res.components.get(source.id);
    if (!comp) continue;
    const point: SweepPoint = {
      freq,
      impedance: comp.impedance,
      currentMag: comp.currentMag,
      phase: comp.currentPhase,
    };
    points.push(point);
    if (comp.currentMag > bestCurrent) {
      bestCurrent = comp.currentMag;
      resonanceFreq = freq;
    }
  }

  return { points, resonanceFreq };
}
