import { R_GAS } from '../../utils/constants';
import { lerp } from '../../utils/mathUtils';

// ── Heat-engine cycle builder (ideal gas, n = 1 mol, analytic per process) ────
//
// A cycle is state 1 plus a ring of process legs. States 2…n−1 are set by each
// leg's one free endpoint value (its `target`); the LAST state is always solved
// from the intersection of the second-to-last leg's curve with the closing
// leg's constraint back to state 1, so a valid configuration always closes.

export type ProcessType = 'isochoric' | 'isobaric' | 'isothermal' | 'adiabatic';

export const PROCESS_TYPES: ProcessType[] = ['isochoric', 'isobaric', 'isothermal', 'adiabatic'];

export const PROCESS_LABELS: Record<ProcessType, string> = {
  isochoric: 'Isochoric (V const)',
  isobaric: 'Isobaric (P const)',
  isothermal: 'Isothermal (T const)',
  adiabatic: 'Adiabatic (Q = 0)',
};

export const PROCESS_COLORS: Record<ProcessType, string> = {
  isochoric: '#fbbf24',
  isobaric: '#38bdf8',
  isothermal: '#f87171',
  adiabatic: '#c084fc',
};

export interface LegConfig {
  type: ProcessType;
  /**
   * The leg's one free endpoint value: end volume (m³) for isobaric /
   * isothermal / adiabatic legs, end temperature (K) for isochoric legs.
   * Ignored on the last two legs (auto-solved / closing).
   */
  target?: number;
}

export interface EngineConfig {
  V1: number; // m³
  T1: number; // K
  legs: LegConfig[]; // ≥ 3, leg i runs state i+1 → next state, last leg closes to state 1
}

export interface EngineState {
  V: number; // m³
  P: number; // Pa
  T: number; // K
}

export interface EngineLeg {
  type: ProcessType;
  from: EngineState;
  to: EngineState;
  W: number; // J, work done BY the gas
  Q: number; // J, heat INTO the gas
  dU: number; // J
  pts: EngineState[]; // sampled polyline from → to
}

export interface EngineCycle {
  ok: boolean;
  error?: string;
  gamma: number;
  f: number; // degrees of freedom, f = 2/(γ−1)
  states: EngineState[];
  legs: EngineLeg[];
  Wnet: number;
  Qin: number; // Σ of positive-Q legs
  Qout: number; // Σ |negative-Q legs|
  dUsum: number; // should be ≈ 0 around a closed loop
  Tmin: number;
  Tmax: number;
  eta: number | null; // W_net/Q_in, null when the loop isn't a heat engine
  etaCarnot: number; // 1 − Tmin/Tmax for the same temperature extremes
}

export const MIN_LEGS = 3;
export const MAX_LEGS = 6;
const N_MOLES = 1;
const nR = N_MOLES * R_GAS;
const SAMPLES_PER_LEG = 48;

export const gammaToF = (gamma: number): number => 2 / (gamma - 1);

const isochoric = (t: ProcessType) => t === 'isochoric';

/** State reached from `s` along a leg of `type` with free endpoint `target`. */
function advance(s: EngineState, type: ProcessType, target: number, gamma: number): EngineState {
  let V: number;
  let T: number;
  switch (type) {
    case 'isochoric':
      V = s.V;
      T = target;
      break;
    case 'isobaric':
      V = target;
      T = (s.T * V) / s.V;
      break;
    case 'isothermal':
      V = target;
      T = s.T;
      break;
    default: // adiabatic: T·V^(γ−1) = const
      V = target;
      T = s.T * Math.pow(s.V / V, gamma - 1);
      break;
  }
  return { V, T, P: (nR * T) / V };
}

/**
 * Every process except isochoric traces T = A·V^a in the (V,T) plane:
 * isobaric a = 1, isothermal a = 0, adiabatic a = 1−γ. Isochoric is the
 * vertical line V = const.
 */
function curveThrough(
  type: ProcessType,
  s: EngineState,
  gamma: number,
): { V: number } | { A: number; a: number } {
  if (type === 'isochoric') return { V: s.V };
  const a = type === 'isobaric' ? 1 : type === 'isothermal' ? 0 : 1 - gamma;
  return { A: s.T / Math.pow(s.V, a), a };
}

/**
 * Solve the second-to-last state's endpoint: the intersection of the curve of
 * `prevType` through `prev` with the curve of the closing `closeType` through
 * state 1. Null when the curves are parallel (same process type twice).
 */
function solveClosingState(
  prev: EngineState,
  prevType: ProcessType,
  closeType: ProcessType,
  first: EngineState,
  gamma: number,
): EngineState | null {
  if (prevType === closeType) return null;
  const c1 = curveThrough(prevType, prev, gamma);
  const c2 = curveThrough(closeType, first, gamma);

  let V: number;
  let T: number;
  if ('V' in c1) {
    V = c1.V;
    T = (c2 as { A: number; a: number }).A * Math.pow(V, (c2 as { A: number; a: number }).a);
  } else if ('V' in c2) {
    V = c2.V;
    T = c1.A * Math.pow(V, c1.a);
  } else {
    // A1·V^a1 = A2·V^a2  →  V = (A2/A1)^(1/(a1−a2))
    V = Math.pow(c2.A / c1.A, 1 / (c1.a - c2.a));
    T = c1.A * Math.pow(V, c1.a);
  }
  if (!Number.isFinite(V) || !Number.isFinite(T) || V <= 0 || T <= 0) return null;
  return { V, T, P: (nR * T) / V };
}

/** Point at fraction t ∈ [0,1] along a leg. Volume interpolated logarithmically. */
export function samplePoint(
  from: EngineState,
  to: EngineState,
  type: ProcessType,
  gamma: number,
  t: number,
): EngineState {
  let V: number;
  let T: number;
  switch (type) {
    case 'isochoric':
      V = from.V;
      T = lerp(from.T, to.T, t);
      break;
    case 'isobaric':
      V = lerp(from.V, to.V, t);
      T = (from.T * V) / from.V;
      break;
    case 'isothermal':
      V = from.V * Math.pow(to.V / from.V, t);
      T = from.T;
      break;
    default: // adiabatic
      V = from.V * Math.pow(to.V / from.V, t);
      T = from.T * Math.pow(from.V / V, gamma - 1);
      break;
  }
  return { V, T, P: (nR * T) / V };
}

/** First-law bookkeeping for one leg (analytic, W = work done by the gas). */
function legQuantities(
  from: EngineState,
  to: EngineState,
  type: ProcessType,
  f: number,
): { W: number; Q: number; dU: number } {
  const Cv = (f / 2) * nR;
  const dU = Cv * (to.T - from.T);
  switch (type) {
    case 'isochoric':
      return { W: 0, Q: dU, dU };
    case 'isobaric':
      return { W: from.P * (to.V - from.V), Q: dU + from.P * (to.V - from.V), dU };
    case 'isothermal':
      return { W: nR * from.T * Math.log(to.V / from.V), Q: nR * from.T * Math.log(to.V / from.V), dU: 0 };
    default: // adiabatic
      return { W: -dU, Q: 0, dU };
  }
}

function invalidCycle(gamma: number, f: number, error: string): EngineCycle {
  return {
    ok: false, error, gamma, f, states: [], legs: [],
    Wnet: 0, Qin: 0, Qout: 0, dUsum: 0, Tmin: 0, Tmax: 0, eta: null, etaCarnot: 0,
  };
}

export function computeEngineCycle(config: EngineConfig, gamma: number): EngineCycle {
  const f = gammaToF(gamma);
  const n = config.legs.length;
  if (n < MIN_LEGS) return invalidCycle(gamma, f, `A cycle needs at least ${MIN_LEGS} legs.`);

  for (let i = 0; i < n; i++) {
    if (config.legs[i].type === config.legs[(i + 1) % n].type) {
      return invalidCycle(
        gamma, f,
        `Legs ${i + 1} and ${((i + 1) % n) + 1} are both ${config.legs[i].type} — consecutive legs need different process types.`,
      );
    }
  }

  // States 1 … n−1 from the free targets, state n from the closing constraint
  const states: EngineState[] = [
    { V: config.V1, T: config.T1, P: (nR * config.T1) / config.V1 },
  ];
  for (let i = 0; i < n - 2; i++) {
    const { type, target } = config.legs[i];
    if (target === undefined || !Number.isFinite(target) || target <= 0) {
      return invalidCycle(gamma, f, `Leg ${i + 1} is missing its ${isochoric(type) ? 'temperature' : 'volume'} target.`);
    }
    states.push(advance(states[i], type, target, gamma));
  }
  const closing = solveClosingState(
    states[n - 2],
    config.legs[n - 2].type,
    config.legs[n - 1].type,
    states[0],
    gamma,
  );
  if (!closing) return invalidCycle(gamma, f, 'The loop cannot close with these process types.');
  states.push(closing);

  const legs: EngineLeg[] = config.legs.map((leg, i) => {
    const from = states[i];
    const to = states[(i + 1) % n];
    const pts: EngineState[] = [];
    for (let k = 0; k <= SAMPLES_PER_LEG; k++) {
      pts.push(samplePoint(from, to, leg.type, gamma, k / SAMPLES_PER_LEG));
    }
    return { type: leg.type, from, to, ...legQuantities(from, to, leg.type, f), pts };
  });

  let Wnet = 0, Qin = 0, Qout = 0, dUsum = 0;
  for (const leg of legs) {
    Wnet += leg.W;
    dUsum += leg.dU;
    if (leg.Q >= 0) Qin += leg.Q;
    else Qout += -leg.Q;
  }

  // T extremes always sit at the corners: T is monotonic along every leg type.
  let Tmin = Infinity, Tmax = -Infinity;
  for (const s of states) {
    if (s.T < Tmin) Tmin = s.T;
    if (s.T > Tmax) Tmax = s.T;
  }

  const etaCarnot = 1 - Tmin / Tmax;
  const eta = Wnet > 0 && Qin > 0 ? Wnet / Qin : null;

  return { ok: true, gamma, f, states, legs, Wnet, Qin, Qout, dUsum, Tmin, Tmax, eta, etaCarnot };
}

// ── Presets (Lecture 7 cycles) ────────────────────────────────────────────────

export interface EnginePreset {
  id: string;
  name: string;
  blurb: string;
  config: EngineConfig;
}

const V_REF = 0.01; // m³ (10 L) — reference volume at state 1, matches Carnot module

export const ENGINE_PRESETS: EnginePreset[] = [
  {
    id: 'otto',
    name: 'Otto',
    blurb: 'Gasoline engine — 2 adiabatic + 2 isochoric',
    config: {
      V1: V_REF,
      T1: 300,
      legs: [
        { type: 'adiabatic', target: V_REF / 8 }, // compression, r = 8
        { type: 'isochoric', target: 1800 }, // spark: heat in at top dead center
        { type: 'adiabatic' }, // power stroke (end solved from closure)
        { type: 'isochoric' }, // exhaust heat rejection closes the loop
      ],
    },
  },
  {
    id: 'diesel',
    name: 'Diesel',
    blurb: 'Compression ignition — isobaric heat-in',
    config: {
      V1: V_REF,
      T1: 300,
      legs: [
        { type: 'adiabatic', target: V_REF / 15 }, // compression, r = 15
        { type: 'isobaric', target: (2 * V_REF) / 15 }, // fuel burns at constant P (cutoff 2)
        { type: 'adiabatic' },
        { type: 'isochoric' },
      ],
    },
  },
  {
    id: 'stirling',
    name: 'Stirling',
    blurb: '2 isothermal + 2 isochoric',
    config: {
      V1: V_REF,
      T1: 600,
      legs: [
        { type: 'isothermal', target: 3 * V_REF }, // expansion at T_hot
        { type: 'isochoric', target: 300 }, // cool to T_cold
        { type: 'isothermal' }, // compression at T_cold
        { type: 'isochoric' },
      ],
    },
  },
  {
    id: 'brayton',
    name: 'Brayton',
    blurb: 'Jet / gas turbine — 2 adiabatic + 2 isobaric',
    config: {
      V1: V_REF,
      T1: 300,
      legs: [
        { type: 'adiabatic', target: V_REF / 6 }, // compressor
        { type: 'isobaric', target: 0.003 }, // combustor heat addition
        { type: 'adiabatic' }, // turbine
        { type: 'isobaric' }, // exhaust at ambient pressure
      ],
    },
  },
  {
    id: 'carnot',
    name: 'Carnot',
    blurb: 'The reference bound — 2 isothermal + 2 adiabatic',
    config: {
      V1: V_REF,
      T1: 600,
      legs: [
        { type: 'isothermal', target: 2 * V_REF }, // expansion at T_hot
        { type: 'adiabatic', target: 0.0566 }, // expand until T = T_cold
        { type: 'isothermal' },
        { type: 'adiabatic' },
      ],
    },
  },
  {
    id: 'custom',
    name: 'Custom',
    blurb: 'Rectangle starter — add and edit legs freely',
    config: {
      V1: V_REF,
      T1: 600,
      legs: [
        { type: 'isobaric', target: 2 * V_REF },
        { type: 'isochoric', target: 500 },
        { type: 'isobaric' },
        { type: 'isochoric' },
      ],
    },
  },
];
