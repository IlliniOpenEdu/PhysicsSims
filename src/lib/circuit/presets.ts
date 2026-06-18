import type { CircuitComponent, ComponentKind, Rotation, Schematic, Wire } from './types';

let counter = 0;
const uid = (prefix: string) => `${prefix}-${(counter += 1)}`;

function comp(
  kind: ComponentKind,
  x: number,
  y: number,
  rotation: Rotation,
  length: number,
  params: Partial<CircuitComponent> = {},
): CircuitComponent {
  return { id: uid(kind), kind, x, y, rotation, length, ...params };
}

function wire(ax: number, ay: number, bx: number, by: number): Wire {
  return { id: uid('wire'), a: { x: ax, y: ay }, b: { x: bx, y: by } };
}

const defaultSettings = () => ({ wireResistance: false, wireResistanceOhms: 0.01 });

/**
 * Rectangular loop helper: a source on the left edge and a stack of `parts`
 * placed in series along the top, with the right + bottom completed by wires.
 */
function buildSeriesLoop(
  source: CircuitComponent,
  parts: { kind: ComponentKind; params?: Partial<CircuitComponent> }[],
): Schematic {
  // Geometry: left edge x=4 from y=10 (bottom) to y=4 (top).
  const top = 4;
  const bottom = 10;
  const left = 4;
  const segLen = 4;
  const components: CircuitComponent[] = [];
  const wires: Wire[] = [];

  // Source occupies the left edge (origin top = +).
  components.push({ ...source, x: left, y: top, rotation: 90, length: bottom - top });

  // Series parts along the top rail.
  let cursorX = left;
  for (const part of parts) {
    components.push(comp(part.kind, cursorX, top, 0, segLen, part.params));
    cursorX += segLen;
  }
  const rightX = cursorX;

  // Right edge down and bottom rail back to source bottom + ground.
  wires.push(wire(rightX, top, rightX, bottom));
  wires.push(wire(rightX, bottom, left, bottom));
  components.push(comp('ground', left, bottom, 0, 0));

  return { components, wires, settings: defaultSettings() };
}

function buildParallel(
  source: CircuitComponent,
  branches: { kind: ComponentKind; params?: Partial<CircuitComponent> }[],
): Schematic {
  const top = 4;
  const bottom = 10;
  const left = 4;
  const components: CircuitComponent[] = [];
  const wires: Wire[] = [];

  components.push({ ...source, x: left, y: top, rotation: 90, length: bottom - top });

  // Junction x-positions along the rails: source edge + one per branch.
  const xs = [left];
  let x = left + 4;
  for (const branch of branches) {
    components.push(comp(branch.kind, x, top, 90, bottom - top, branch.params));
    xs.push(x);
    x += 4;
  }
  // Segment the top and bottom rails so every junction lands on a wire endpoint.
  for (let i = 0; i < xs.length - 1; i += 1) {
    wires.push(wire(xs[i], top, xs[i + 1], top));
    wires.push(wire(xs[i], bottom, xs[i + 1], bottom));
  }
  components.push(comp('ground', left, bottom, 0, 0));

  return { components, wires, settings: defaultSettings() };
}

export interface PresetDef {
  id: string;
  name: string;
  description: string;
  mode: 'dc' | 'ac';
  build: () => Schematic;
}

export const PRESETS: PresetDef[] = [
  {
    id: 'single-resistor',
    name: 'Single Resistor',
    description: '9 V battery driving one 100 Ω resistor.',
    mode: 'dc',
    build: () =>
      buildSeriesLoop(comp('battery', 0, 0, 90, 6, { voltage: 9, internalResistance: 0 }), [
        { kind: 'resistor', params: { resistance: 100 } },
      ]),
  },
  {
    id: 'series-resistors',
    name: 'Series Resistors',
    description: 'Three resistors in series — voltages add, current is shared.',
    mode: 'dc',
    build: () =>
      buildSeriesLoop(comp('battery', 0, 0, 90, 6, { voltage: 12 }), [
        { kind: 'resistor', params: { resistance: 100 } },
        { kind: 'resistor', params: { resistance: 220 } },
        { kind: 'resistor', params: { resistance: 330 } },
      ]),
  },
  {
    id: 'parallel-resistors',
    name: 'Parallel Resistors',
    description: 'Two resistors in parallel across one source.',
    mode: 'dc',
    build: () =>
      buildParallel(comp('battery', 0, 0, 90, 6, { voltage: 9 }), [
        { kind: 'resistor', params: { resistance: 220 } },
        { kind: 'resistor', params: { resistance: 470 } },
      ]),
  },
  {
    id: 'voltage-divider',
    name: 'Voltage Divider',
    description: 'Two series resistors tap a fraction of the source voltage.',
    mode: 'dc',
    build: () =>
      buildSeriesLoop(comp('battery', 0, 0, 90, 6, { voltage: 10 }), [
        { kind: 'resistor', params: { resistance: 1000 } },
        { kind: 'resistor', params: { resistance: 1000 } },
      ]),
  },
  {
    id: 'rc-charge',
    name: 'RC Charging Circuit',
    description: 'Resistor charges a capacitor — watch Vc rise toward the source.',
    mode: 'dc',
    build: () =>
      buildSeriesLoop(comp('battery', 0, 0, 90, 6, { voltage: 5 }), [
        { kind: 'resistor', params: { resistance: 1000 } },
        { kind: 'capacitor', params: { capacitance: 1e-4 } },
      ]),
  },
  {
    id: 'rc-discharge',
    name: 'RC Discharge Circuit',
    description: 'A capacitor pre-charged to 5 V discharges through a resistor.',
    mode: 'dc',
    build: () => {
      // Closed loop: charged capacitor + resistor, no source.
      const top = 4;
      const bottom = 10;
      const left = 4;
      const components: CircuitComponent[] = [
        comp('capacitor', left, top, 90, bottom - top, { capacitance: 1e-4, initialVoltage: 5 }),
        comp('resistor', left + 6, top, 90, bottom - top, { resistance: 1500 }),
        comp('ground', left, bottom, 0, 0),
      ];
      const wires: Wire[] = [wire(left, top, left + 6, top), wire(left, bottom, left + 6, bottom)];
      return { components, wires, settings: defaultSettings() };
    },
  },
  {
    id: 'rl-circuit',
    name: 'RL Circuit',
    description: 'Inductor current builds up with time constant τ = L/R.',
    mode: 'dc',
    build: () =>
      buildSeriesLoop(comp('battery', 0, 0, 90, 6, { voltage: 5 }), [
        { kind: 'resistor', params: { resistance: 10 } },
        { kind: 'inductor', params: { inductance: 0.5 } },
      ]),
  },
  {
    id: 'rlc-resonance',
    name: 'RLC Resonance Circuit',
    description: 'Series RLC — energy sloshes between the capacitor and inductor.',
    mode: 'dc',
    build: () =>
      buildSeriesLoop(comp('battery', 0, 0, 90, 6, { voltage: 5 }), [
        { kind: 'resistor', params: { resistance: 5 } },
        { kind: 'inductor', params: { inductance: 0.1 } },
        { kind: 'capacitor', params: { capacitance: 1e-5 } },
      ]),
  },
  {
    id: 'ac-resistor',
    name: 'AC Source + Resistor',
    description: 'Resistor on an AC source — current is in phase with voltage.',
    mode: 'ac',
    build: () =>
      buildSeriesLoop(comp('acsource', 0, 0, 90, 6, { voltage: 10, frequency: 60, phase: 0 }), [
        { kind: 'resistor', params: { resistance: 100 } },
      ]),
  },
  {
    id: 'ac-capacitor',
    name: 'AC Source + Capacitor',
    description: 'Capacitive reactance Xc = 1/(ωC); current leads voltage by 90°.',
    mode: 'ac',
    build: () =>
      buildSeriesLoop(comp('acsource', 0, 0, 90, 6, { voltage: 10, frequency: 60 }), [
        { kind: 'resistor', params: { resistance: 10 } },
        { kind: 'capacitor', params: { capacitance: 1e-4 } },
      ]),
  },
  {
    id: 'ac-inductor',
    name: 'AC Source + Inductor',
    description: 'Inductive reactance Xl = ωL; current lags voltage by 90°.',
    mode: 'ac',
    build: () =>
      buildSeriesLoop(comp('acsource', 0, 0, 90, 6, { voltage: 10, frequency: 60 }), [
        { kind: 'resistor', params: { resistance: 10 } },
        { kind: 'inductor', params: { inductance: 0.05 } },
      ]),
  },
  {
    id: 'ac-rlc',
    name: 'AC RLC Network',
    description: 'Series RLC driven by AC — sweep frequency to find resonance.',
    mode: 'ac',
    build: () =>
      buildSeriesLoop(comp('acsource', 0, 0, 90, 6, { voltage: 10, frequency: 160 }), [
        { kind: 'resistor', params: { resistance: 20 } },
        { kind: 'inductor', params: { inductance: 0.1 } },
        { kind: 'capacitor', params: { capacitance: 1e-5 } },
      ]),
  },
  {
    id: 'capacitive-divider',
    name: 'Capacitive Voltage Divider',
    description: 'Two capacitors split AC voltage based on capacitive reactance.',
    mode: 'ac',
    build: () =>
      buildSeriesLoop(comp('acsource', 0, 0, 90, 6, {
        voltage: 10,
        frequency: 1000,
      }), [
        { kind: 'capacitor', params: { capacitance: 1e-6 } },
        { kind: 'capacitor', params: { capacitance: 2e-6 } },
      ]),
  },
  {
    id: 'inductive-divider',
    name: 'Inductive Voltage Divider',
    description: 'Two inductors split AC voltage based on inductive reactance.',
    mode: 'ac',
    build: () =>
      buildSeriesLoop(comp('acsource', 0, 0, 90, 6, {
        voltage: 10,
        frequency: 1000,
      }), [
        { kind: 'inductor', params: { inductance: 0.05 } },
        { kind: 'inductor', params: { inductance: 0.1 } },
      ]),
  },
];

export function emptySchematic(): Schematic {
  return { components: [], wires: [], settings: defaultSettings() };
}
