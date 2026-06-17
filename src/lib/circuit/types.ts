// Core data model for the Universal Circuit Builder.
//
// A schematic is a set of two-terminal (or one-terminal) components placed on an
// integer grid plus a set of ideal wires. Electrical nodes are derived from the
// geometry (coincident pins / wires) by the topology builder in `graph.ts`.

export type ComponentKind =
  | 'battery'
  | 'acsource'
  | 'resistor'
  | 'capacitor'
  | 'inductor'
  | 'switch'
  | 'ground'
  | 'voltmeter'
  | 'ammeter';

export type Rotation = 0 | 90 | 180 | 270;

export interface Point {
  x: number;
  y: number;
}

export interface CircuitComponent {
  id: string;
  kind: ComponentKind;
  /** Grid coordinate of the origin terminal (terminal A). */
  x: number;
  y: number;
  rotation: Rotation;
  /** Span in grid cells between terminal A and terminal B (default 2). */
  length: number;

  // Parameters — only the ones relevant to `kind` are used.
  voltage?: number; // battery EMF (V) or AC peak voltage (V)
  resistance?: number; // resistor value (Ω)
  capacitance?: number; // F
  inductance?: number; // H
  frequency?: number; // AC source frequency (Hz)
  phase?: number; // AC source phase (radians)
  internalResistance?: number; // battery / AC source series resistance (Ω)
  closed?: boolean; // switch state

  // Optional transient initial conditions (used by presets / reset).
  initialVoltage?: number; // capacitor initial voltage (V)
  initialCurrent?: number; // inductor initial current (A)
}

export interface Wire {
  id: string;
  a: Point;
  b: Point;
}

export interface CircuitSettings {
  /** When true, every wire is modelled as a small series resistor. */
  wireResistance: boolean;
  wireResistanceOhms: number;
}

export interface Schematic {
  components: CircuitComponent[];
  wires: Wire[];
  settings: CircuitSettings;
}

/** Per-component electrical solution for a single solver step. */
export interface ComponentResult {
  /** Voltage across the component (V+ − V−). */
  voltage: number;
  /** Current through the component, positive flowing from terminal A → B. */
  current: number;
  /** Instantaneous power (W). Positive = dissipating / storing. */
  power: number;
  /** Stored energy for capacitors/inductors (J). */
  energy?: number;
}

export interface SolveTotals {
  sourcePower: number; // net power delivered by all sources (W)
  dissipatedPower: number; // power lost in resistive elements (W)
  capacitorEnergy: number; // total stored electric-field energy (J)
  inductorEnergy: number; // total stored magnetic-field energy (J)
  sourceCurrentMagnitude: number; // sum |I| across sources (A)
  equivalentResistance: number | null; // seen by a single source, else null
}

export interface SolveResult {
  ok: boolean;
  message?: string;
  /** Node voltage by node index (ground node is 0 V). */
  nodeVoltages: number[];
  groundNode: number;
  nodeCount: number;
  /** Map from "x,y" pin key → node index. */
  nodeOfKey: Map<string, number>;
  /** Per-component results keyed by component id. */
  components: Map<string, ComponentResult>;
  totals: SolveTotals;
}

/** Mutable transient memory for reactive components, keyed by component id. */
export interface ReactiveState {
  capVoltage: Map<string, number>;
  capCurrent: Map<string, number>;
  indCurrent: Map<string, number>;
  indVoltage: Map<string, number>;
}

export const createReactiveState = (): ReactiveState => ({
  capVoltage: new Map(),
  capCurrent: new Map(),
  indCurrent: new Map(),
  indVoltage: new Map(),
});

// Parameter limits (used by the inspector + clamping).
export const LIMITS = {
  batteryVoltage: { min: 0.1, max: 1000 },
  acPeak: { min: 0.1, max: 1000 },
  acFrequency: { min: 0.01, max: 1_000_000 },
  resistance: { min: 0.1, max: 1_000_000 },
  capacitance: { min: 1e-9, max: 1 },
  inductance: { min: 1e-6, max: 100 },
  internalResistance: { min: 0, max: 1000 },
} as const;

export const DEFAULT_LENGTH = 2;

export function defaultParamsFor(kind: ComponentKind): Partial<CircuitComponent> {
  switch (kind) {
    case 'battery':
      return { voltage: 9, internalResistance: 0 };
    case 'acsource':
      return { voltage: 5, frequency: 60, phase: 0, internalResistance: 0 };
    case 'resistor':
      return { resistance: 100 };
    case 'capacitor':
      return { capacitance: 1e-5 };
    case 'inductor':
      return { inductance: 1e-2 };
    case 'switch':
      return { closed: true };
    case 'ground':
      return { length: 0 };
    case 'voltmeter':
      return {};
    case 'ammeter':
      return {};
    default:
      return {};
  }
}

export const COMPONENT_LABELS: Record<ComponentKind, string> = {
  battery: 'DC Battery',
  acsource: 'AC Source',
  resistor: 'Resistor',
  capacitor: 'Capacitor',
  inductor: 'Inductor',
  switch: 'Switch',
  ground: 'Ground',
  voltmeter: 'Voltmeter',
  ammeter: 'Ammeter',
};
