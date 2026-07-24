import {
  ATM_PRESSURE,
  CO2_H_GAS,
  CO2_H_LIQUID,
  CO2_H_SOLID,
  CO2_S_GAS,
  CO2_S_LIQUID,
  CO2_S_SOLID,
  CO2_T_CRIT,
  CO2_V_LIQUID,
  CO2_V_SOLID,
  R_GAS,
  WATER_H_GAS,
  WATER_H_LIQUID,
  WATER_H_SOLID,
  WATER_S_GAS,
  WATER_S_LIQUID,
  WATER_S_SOLID,
  WATER_T_CRIT,
  WATER_V_LIQUID,
  WATER_V_SOLID,
} from '../../utils/constants';

// ── Gibbs free energy as the phase selector (molar, n = 1 mol) ────────────────
//
// Each phase's Gibbs energy at fixed P is a straight line in T:
//   condensed:  G = H + V·(P − P₀) − T·S
//   ideal gas:  G = H − T·S + RT·ln(P/P₀) = H − T·(S − R·ln(P/P₀))
// i.e. G = α − T·σ with an effective entropy slope σ. The stable phase is the
// lowest line, and every phase boundary is just the intersection of two lines —
// so the G-vs-T crossings and the P–T diagram come from the same computation.

export type Phase = 'solid' | 'liquid' | 'gas';

export const PHASES: Phase[] = ['solid', 'liquid', 'gas'];

export const PHASE_COLORS: Record<Phase, string> = {
  solid: '#60a5fa',
  liquid: '#34d399',
  gas: '#f87171',
};

export const PHASE_LABELS: Record<Phase, string> = {
  solid: 'Solid',
  liquid: 'Liquid',
  gas: 'Gas',
};

export type TransitionKind = 'melting' | 'boiling' | 'sublimation';

export const TRANSITION_LABELS: Record<TransitionKind, string> = {
  melting: 'Melting',
  boiling: 'Boiling',
  sublimation: 'Sublimation',
};

export interface PhaseThermo {
  H: number; // J/mol
  S: number; // J/(mol·K)
  V: number; // m³/mol (ignored for the gas — ideal-gas volume term is used instead)
}

export interface Substance {
  id: string;
  name: string;
  formula: string;
  anomalous: boolean; // V_liquid < V_solid → negative fusion slope
  phases: Record<Phase, PhaseThermo>;
  Tcrit: number; // K
  // Display / slider ranges
  TMin: number;
  TMax: number;
  PMin: number; // Pa
  PMax: number; // Pa
  TDefault: number;
  PDefault: number;
}

const P0 = ATM_PRESSURE;

export const SUBSTANCES: Substance[] = [
  {
    id: 'water',
    name: 'Water',
    formula: 'H₂O',
    anomalous: true,
    phases: {
      solid: { H: WATER_H_SOLID, S: WATER_S_SOLID, V: WATER_V_SOLID },
      liquid: { H: WATER_H_LIQUID, S: WATER_S_LIQUID, V: WATER_V_LIQUID },
      gas: { H: WATER_H_GAS, S: WATER_S_GAS, V: 0 },
    },
    Tcrit: WATER_T_CRIT,
    TMin: 150,
    TMax: 750,
    PMin: 1e2,
    PMax: 1e8,
    TDefault: 298,
    PDefault: ATM_PRESSURE,
  },
  {
    id: 'co2',
    name: 'Carbon dioxide',
    formula: 'CO₂',
    anomalous: false,
    phases: {
      solid: { H: CO2_H_SOLID, S: CO2_S_SOLID, V: CO2_V_SOLID },
      liquid: { H: CO2_H_LIQUID, S: CO2_S_LIQUID, V: CO2_V_LIQUID },
      gas: { H: CO2_H_GAS, S: CO2_S_GAS, V: 0 },
    },
    Tcrit: CO2_T_CRIT,
    TMin: 130,
    TMax: 340,
    PMin: 1e3,
    PMax: 2e7,
    TDefault: 250,
    PDefault: ATM_PRESSURE,
  },
];

/** G_phase(T, P) = alpha − T·sigma. */
export function gibbsLine(
  sub: Substance,
  phase: Phase,
  P: number,
): { alpha: number; sigma: number } {
  const { H, S, V } = sub.phases[phase];
  if (phase === 'gas') return { alpha: H, sigma: S - R_GAS * Math.log(P / P0) };
  return { alpha: H + V * (P - P0), sigma: S };
}

export function gibbsEnergy(sub: Substance, phase: Phase, T: number, P: number): number {
  const { alpha, sigma } = gibbsLine(sub, phase, P);
  return alpha - T * sigma;
}

/** The phase with the lowest G at (T, P). */
export function stablePhase(sub: Substance, T: number, P: number): Phase {
  let best: Phase = 'solid';
  let bestG = Infinity;
  for (const phase of PHASES) {
    const G = gibbsEnergy(sub, phase, T, P);
    if (G < bestG) {
      bestG = G;
      best = phase;
    }
  }
  return best;
}

/**
 * Temperature where G_a = G_b at pressure P — the intersection of the two
 * lines. Null when the lines are parallel or cross at an unphysical T ≤ 0.
 */
export function boundaryTemperature(
  sub: Substance,
  a: Phase,
  b: Phase,
  P: number,
): number | null {
  const la = gibbsLine(sub, a, P);
  const lb = gibbsLine(sub, b, P);
  const dSigma = lb.sigma - la.sigma;
  if (Math.abs(dSigma) < 1e-12) return null;
  const T = (lb.alpha - la.alpha) / dSigma;
  return Number.isFinite(T) && T > 0 ? T : null;
}

/** Clausius–Clapeyron slope dP/dT = ΔS/ΔV of the fusion boundary (Pa/K). */
export function fusionSlope(sub: Substance): number {
  const dS = sub.phases.liquid.S - sub.phases.solid.S;
  const dV = sub.phases.liquid.V - sub.phases.solid.V;
  return dS / dV;
}

// ── Phase diagram (P–T plane) ─────────────────────────────────────────────────

export interface BoundaryPoint {
  T: number;
  P: number;
}

export interface PhaseDiagram {
  TTriple: number;
  PTriple: number;
  PCrit: number; // pressure on the vaporization curve at T = Tcrit
  sublimation: BoundaryPoint[]; // P from PMin up to the triple point
  vaporization: BoundaryPoint[]; // triple point → critical point
  fusion: BoundaryPoint[]; // triple point → PMax
}

/** Bisection over log₁₀(P) of a monotone function. */
function bisectLogP(f: (P: number) => number, PLo: number, PHi: number): number | null {
  let lo = Math.log10(PLo);
  let hi = Math.log10(PHi);
  let fLo = f(Math.pow(10, lo));
  const fHi = f(Math.pow(10, hi));
  if (!Number.isFinite(fLo) || !Number.isFinite(fHi) || fLo * fHi > 0) return null;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    const fMid = f(Math.pow(10, mid));
    if (fLo * fMid <= 0) hi = mid;
    else {
      lo = mid;
      fLo = fMid;
    }
  }
  return Math.pow(10, (lo + hi) / 2);
}

const CURVE_SAMPLES = 64;

function sampleBoundary(
  sub: Substance,
  a: Phase,
  b: Phase,
  PLo: number,
  PHi: number,
): BoundaryPoint[] {
  const pts: BoundaryPoint[] = [];
  const logLo = Math.log10(PLo);
  const logHi = Math.log10(PHi);
  for (let i = 0; i <= CURVE_SAMPLES; i++) {
    const P = Math.pow(10, logLo + ((logHi - logLo) * i) / CURVE_SAMPLES);
    const T = boundaryTemperature(sub, a, b, P);
    if (T !== null) pts.push({ T, P });
  }
  return pts;
}

export function computePhaseDiagram(sub: Substance): PhaseDiagram {
  // Triple point: where the solid–liquid and solid–gas boundaries meet
  const PTriple =
    bisectLogP(
      (P) => {
        const Tsl = boundaryTemperature(sub, 'solid', 'liquid', P);
        const Tsg = boundaryTemperature(sub, 'solid', 'gas', P);
        return Tsl !== null && Tsg !== null ? Tsl - Tsg : NaN;
      },
      1,
      1e8, // above ~10⁸ Pa the condensed-phase V·ΔP terms leave the model's validity
    ) ?? sub.PDefault;
  const TTriple = boundaryTemperature(sub, 'solid', 'liquid', PTriple) ?? sub.TDefault;

  // Critical point: the vaporization curve ends at T = Tcrit
  const PCrit =
    bisectLogP((P) => (boundaryTemperature(sub, 'liquid', 'gas', P) ?? Infinity) - sub.Tcrit, PTriple, 1e8) ??
    sub.PMax;

  return {
    TTriple,
    PTriple,
    PCrit,
    sublimation: sampleBoundary(sub, 'solid', 'gas', sub.PMin, PTriple),
    vaporization: sampleBoundary(sub, 'liquid', 'gas', PTriple, Math.min(PCrit, sub.PMax)),
    fusion: sampleBoundary(sub, 'solid', 'liquid', PTriple, sub.PMax),
  };
}

// ── Clausius–Clapeyron boundary analysis (Lecture 9) ──────────────────────────

export type BoundaryKind = 'fusion' | 'vaporization' | 'sublimation';

export const BOUNDARY_KINDS: BoundaryKind[] = ['sublimation', 'vaporization', 'fusion'];

export const BOUNDARY_LABELS: Record<BoundaryKind, string> = {
  fusion: 'Fusion (melting)',
  vaporization: 'Vaporization (boiling)',
  sublimation: 'Sublimation',
};

/** Phases each boundary separates, ordered low-entropy → high-entropy. */
export const BOUNDARY_PHASES: Record<BoundaryKind, [Phase, Phase]> = {
  fusion: ['solid', 'liquid'],
  vaporization: ['liquid', 'gas'],
  sublimation: ['solid', 'gas'],
};

/** Molar volume at (T, P): ideal-gas RT/P for the gas, constant V otherwise. */
export function molarVolume(sub: Substance, phase: Phase, T: number, P: number): number {
  return phase === 'gas' ? (R_GAS * T) / P : sub.phases[phase].V;
}

export interface BoundaryAnalysis {
  kind: BoundaryKind;
  a: Phase; // low-entropy side
  b: Phase; // high-entropy side
  T: number; // K — transition temperature at this pressure
  P: number; // Pa
  dS: number; // J/(mol·K) — S_b − S_a across the boundary (gas: effective S at P)
  dV: number; // m³/mol — V_b − V_a (gas volume is RT/P: huge and T-dependent)
  L: number; // J/mol — latent heat, L = T·ΔS
  slope: number; // Pa/K — Clausius–Clapeyron dP/dT = ΔS/ΔV = L/(T·ΔV)
}

/**
 * Everything Clausius–Clapeyron says about a boundary at pressure P. Because
 * dG_a = dG_b along the coexistence curve, dP/dT = ΔS/ΔV is exactly the
 * tangent slope of the boundary as drawn — the gas's RT/P molar volume is what
 * makes the vaporization slope change along the curve, while the fusion
 * boundary's tiny constant ΔV keeps it nearly straight.
 */
export function analyzeBoundary(
  sub: Substance,
  kind: BoundaryKind,
  P: number,
): BoundaryAnalysis | null {
  const [a, b] = BOUNDARY_PHASES[kind];
  const T = boundaryTemperature(sub, a, b, P);
  if (T === null) return null;
  const dS = gibbsLine(sub, b, P).sigma - gibbsLine(sub, a, P).sigma;
  const dV = molarVolume(sub, b, T, P) - molarVolume(sub, a, T, P);
  if (Math.abs(dV) < 1e-30) return null;
  return { kind, a, b, T, P, dS, dV, L: T * dS, slope: dS / dV };
}

/** Pressure span of a boundary branch as drawn on the P–T diagram. */
export function boundaryPressureRange(
  sub: Substance,
  diagram: PhaseDiagram,
  kind: BoundaryKind,
): { PLo: number; PHi: number } {
  switch (kind) {
    case 'sublimation':
      return { PLo: sub.PMin, PHi: diagram.PTriple };
    case 'vaporization':
      return { PLo: diagram.PTriple, PHi: Math.min(diagram.PCrit, sub.PMax) };
    default:
      return { PLo: diagram.PTriple, PHi: sub.PMax };
  }
}

export interface TriplePointCheck {
  LFus: number; // J/mol at the triple point
  LVap: number;
  LSub: number; // = LFus + LVap — Hess's law at three-phase coexistence
  slopeVap: number; // Pa/K at the triple point
  slopeSub: number; // steeper, because L_sub > L_vap with nearly the same ΔV
}

/** The L_sub = L_fus + L_vap consistency check where all three boundaries meet. */
export function triplePointCheck(sub: Substance, diagram: PhaseDiagram): TriplePointCheck | null {
  const fus = analyzeBoundary(sub, 'fusion', diagram.PTriple);
  const vap = analyzeBoundary(sub, 'vaporization', diagram.PTriple);
  const subl = analyzeBoundary(sub, 'sublimation', diagram.PTriple);
  if (!fus || !vap || !subl) return null;
  return {
    LFus: fus.L,
    LVap: vap.L,
    LSub: subl.L,
    slopeVap: vap.slope,
    slopeSub: subl.slope,
  };
}

// ── Transitions at the current pressure (for markers + readouts) ─────────────

export interface Transition {
  kind: TransitionKind;
  T: number;
}

/**
 * The G-line crossings that are real transitions at pressure P: below the
 * triple pressure only sublimation (the liquid line is never lowest); above it
 * melting, plus boiling while P stays below the critical pressure.
 */
export function transitionsAtPressure(
  sub: Substance,
  diagram: PhaseDiagram,
  P: number,
): Transition[] {
  const out: Transition[] = [];
  if (P < diagram.PTriple) {
    const T = boundaryTemperature(sub, 'solid', 'gas', P);
    if (T !== null) out.push({ kind: 'sublimation', T });
  } else {
    const Tm = boundaryTemperature(sub, 'solid', 'liquid', P);
    if (Tm !== null) out.push({ kind: 'melting', T: Tm });
    if (P < diagram.PCrit) {
      const Tb = boundaryTemperature(sub, 'liquid', 'gas', P);
      if (Tb !== null) out.push({ kind: 'boiling', T: Tb });
    }
  }
  return out;
}

export function nearestTransition(transitions: Transition[], T: number): Transition | null {
  let best: Transition | null = null;
  for (const t of transitions) {
    if (best === null || Math.abs(t.T - T) < Math.abs(best.T - T)) best = t;
  }
  return best;
}
