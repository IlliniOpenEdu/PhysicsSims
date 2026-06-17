import { describe, expect, it } from 'vitest';
import { solveStep } from '../solver';
import { solveAc } from '../acSolver';
import { computeWireCurrents } from '../wireCurrents';
import { createReactiveState } from '../types';
import type { CircuitComponent, Schematic, Wire } from '../types';

let n = 0;
const comp = (
  kind: CircuitComponent['kind'],
  x: number,
  y: number,
  rotation: 0 | 90 | 180 | 270,
  length: number,
  params: Partial<CircuitComponent> = {},
): CircuitComponent => ({ id: `${kind}-${(n += 1)}`, kind, x, y, rotation, length, ...params });
const wire = (ax: number, ay: number, bx: number, by: number): Wire => ({
  id: `w-${(n += 1)}`,
  a: { x: ax, y: ay },
  b: { x: bx, y: by },
});
const settings = { wireResistance: false, wireResistanceOhms: 0.01 };

function dc(s: Schematic) {
  return solveStep(s, createReactiveState(), { dt: 1e-4, time: 0 });
}

describe('MNA solver — Ohm / Kirchhoff', () => {
  it('single resistor obeys Ohm law', () => {
    // Battery (4,4)+ -> (4,10)-, resistor (4,4)->(8,4), wires close loop.
    const s: Schematic = {
      components: [
        comp('battery', 4, 4, 90, 6, { voltage: 10 }),
        comp('resistor', 4, 4, 0, 4, { resistance: 100 }),
        comp('ground', 4, 10, 0, 0),
      ],
      wires: [wire(8, 4, 8, 10), wire(8, 10, 4, 10)],
      settings,
    };
    const r = dc(s);
    expect(r.ok).toBe(true);
    const res = r.components.get(s.components[1].id)!;
    expect(Math.abs(res.current - 0.1)).toBeLessThan(1e-4); // I = V/R = 0.1 A
    expect(Math.abs(res.power - 1)).toBeLessThan(1e-3); // P = 1 W
  });

  it('series resistors share current and divide voltage', () => {
    const s: Schematic = {
      components: [
        comp('battery', 4, 4, 90, 6, { voltage: 12 }),
        comp('resistor', 4, 4, 0, 4, { resistance: 100 }),
        comp('resistor', 8, 4, 0, 4, { resistance: 200 }),
        comp('ground', 4, 10, 0, 0),
      ],
      wires: [wire(12, 4, 12, 10), wire(12, 10, 4, 10)],
      settings,
    };
    const r = dc(s);
    const i1 = r.components.get(s.components[1].id)!.current;
    const i2 = r.components.get(s.components[2].id)!.current;
    expect(Math.abs(i1 - i2)).toBeLessThan(1e-4); // same current
    expect(Math.abs(i1 - 12 / 300)).toBeLessThan(1e-4); // 0.04 A
    const v1 = r.components.get(s.components[1].id)!.voltage;
    const v2 = r.components.get(s.components[2].id)!.voltage;
    expect(Math.abs(v1 + v2 - 12)).toBeLessThan(1e-3); // KVL
  });

  it('parallel resistors add currents', () => {
    const s: Schematic = {
      components: [
        comp('battery', 4, 4, 90, 6, { voltage: 6 }),
        comp('resistor', 8, 4, 90, 6, { resistance: 100 }),
        comp('resistor', 12, 4, 90, 6, { resistance: 300 }),
        comp('ground', 4, 10, 0, 0),
      ],
      wires: [
        wire(4, 4, 8, 4),
        wire(8, 4, 12, 4),
        wire(4, 10, 8, 10),
        wire(8, 10, 12, 10),
      ],
      settings,
    };
    const r = dc(s);
    const i1 = r.components.get(s.components[1].id)!.current;
    const i2 = r.components.get(s.components[2].id)!.current;
    expect(Math.abs(Math.abs(i1) - 0.06)).toBeLessThan(1e-3); // 6/100
    expect(Math.abs(Math.abs(i2) - 0.02)).toBeLessThan(1e-3); // 6/300
  });
});

describe('Wire current distribution', () => {
  it('series-loop wires carry the loop current', () => {
    const s: Schematic = {
      components: [
        comp('battery', 4, 4, 90, 6, { voltage: 10 }),
        comp('resistor', 4, 4, 0, 4, { resistance: 100 }),
        comp('ground', 4, 10, 0, 0),
      ],
      wires: [wire(8, 4, 8, 10), wire(8, 10, 4, 10)],
      settings,
    };
    const r = dc(s);
    const currents = computeWireCurrents(s, r);
    for (const w of s.wires) {
      expect(Math.abs(Math.abs(currents.get(w.id)!) - 0.1)).toBeLessThan(1e-4);
    }
  });
});

describe('Transient RC charging', () => {
  it('reaches ~63% of source after one time constant', () => {
    const R = 1000;
    const C = 1e-4;
    const V = 5;
    const s: Schematic = {
      components: [
        comp('battery', 4, 4, 90, 6, { voltage: V }),
        comp('resistor', 4, 4, 0, 4, { resistance: R }),
        comp('capacitor', 8, 4, 90, 6, { capacitance: C }),
        comp('ground', 4, 10, 0, 0),
      ],
      wires: [wire(8, 4, 8, 4), wire(8, 10, 4, 10)],
      settings,
    };
    const cap = s.components[2];
    const state = createReactiveState();
    const tau = R * C; // 0.1 s
    const dt = 1e-4;
    const steps = Math.round(tau / dt);
    let res = solveStep(s, state, { dt, time: 0 });
    for (let i = 0; i < steps; i += 1) {
      res = solveStep(s, state, { dt, time: (i + 1) * dt });
    }
    const vc = res.components.get(cap.id)!.voltage;
    expect(Math.abs(vc - V * (1 - Math.exp(-1)))).toBeLessThan(0.05); // ~3.16 V
  });
});

describe('AC reactance', () => {
  it('capacitor reactance Xc = 1/(wC)', () => {
    const C = 1e-4;
    const f = 60;
    const s: Schematic = {
      components: [
        comp('acsource', 4, 4, 90, 6, { voltage: 10, frequency: f, phase: 0 }),
        comp('capacitor', 4, 4, 0, 4, { capacitance: C }),
        comp('ground', 4, 10, 0, 0),
      ],
      wires: [wire(8, 4, 8, 10), wire(8, 10, 4, 10)],
      settings,
    };
    const omega = 2 * Math.PI * f;
    const r = solveAc(s, omega);
    const cap = r.components.get(s.components[1].id)!;
    const expectedXc = 1 / (omega * C);
    expect(Math.abs(cap.impedance - expectedXc) / expectedXc).toBeLessThan(0.02);
  });
});
