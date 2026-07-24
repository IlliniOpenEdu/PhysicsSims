import { describe, expect, it } from 'vitest';
import { ATM_PRESSURE } from '../../../utils/constants';
import {
  analyzeBoundary,
  boundaryPressureRange,
  boundaryTemperature,
  BOUNDARY_KINDS,
  BOUNDARY_PHASES,
  computePhaseDiagram,
  fusionSlope,
  gibbsEnergy,
  nearestTransition,
  stablePhase,
  SUBSTANCES,
  transitionsAtPressure,
  triplePointCheck,
  type Phase,
  type Substance,
} from '../gibbsPhase';

const water = SUBSTANCES.find((s) => s.id === 'water')!;
const co2 = SUBSTANCES.find((s) => s.id === 'co2')!;

describe('gibbsPhase', () => {
  it('orders entropies S_gas > S_liquid > S_solid — the whole point', () => {
    for (const sub of SUBSTANCES) {
      expect(sub.phases.gas.S).toBeGreaterThan(sub.phases.liquid.S);
      expect(sub.phases.liquid.S).toBeGreaterThan(sub.phases.solid.S);
    }
  });

  it('water melts at ≈273 K and boils at ≈373 K at 1 atm', () => {
    const Tm = boundaryTemperature(water, 'solid', 'liquid', ATM_PRESSURE)!;
    const Tb = boundaryTemperature(water, 'liquid', 'gas', ATM_PRESSURE)!;
    expect(Tm).toBeGreaterThan(272.5);
    expect(Tm).toBeLessThan(274);
    expect(Tb).toBeGreaterThan(372);
    expect(Tb).toBeLessThan(374.5);
  });

  it('CO₂ sublimates at ≈195 K at 1 atm (no liquid below its triple pressure)', () => {
    const Ts = boundaryTemperature(co2, 'solid', 'gas', ATM_PRESSURE)!;
    expect(Ts).toBeGreaterThan(192);
    expect(Ts).toBeLessThan(197);
    // Liquid CO₂ is never the stable phase at ambient pressure
    for (let T = co2.TMin; T <= co2.TMax; T += 2) {
      expect(stablePhase(co2, T, ATM_PRESSURE)).not.toBe('liquid');
    }
  });

  it('boundaries are exactly where the two G-lines cross', () => {
    for (const sub of SUBSTANCES) {
      const pairs: [Phase, Phase][] = [
        ['solid', 'liquid'],
        ['liquid', 'gas'],
        ['solid', 'gas'],
      ];
      for (const [a, b] of pairs) {
        for (const P of [sub.PMin, sub.PDefault, sub.PMax]) {
          const T = boundaryTemperature(sub, a, b, P);
          if (T === null) continue;
          const Ga = gibbsEnergy(sub, a, T, P);
          const Gb = gibbsEnergy(sub, b, T, P);
          expect(Math.abs(Ga - Gb)).toBeLessThan(1e-6 * Math.max(1, Math.abs(Ga)));
        }
      }
    }
  });

  it('fusion slope: negative for water (anomalous), positive for CO₂', () => {
    expect(fusionSlope(water)).toBeLessThan(0);
    expect(fusionSlope(co2)).toBeGreaterThan(0);
    // The melting temperature moves accordingly with pressure
    const TmLow = boundaryTemperature(water, 'solid', 'liquid', ATM_PRESSURE)!;
    const TmHigh = boundaryTemperature(water, 'solid', 'liquid', 1e7)!;
    expect(TmHigh).toBeLessThan(TmLow);
    const cLow = boundaryTemperature(co2, 'solid', 'liquid', 1e6)!;
    const cHigh = boundaryTemperature(co2, 'solid', 'liquid', 1e7)!;
    expect(cHigh).toBeGreaterThan(cLow);
  });

  it('finds realistic triple and critical points', () => {
    const w = computePhaseDiagram(water);
    expect(w.TTriple).toBeGreaterThan(272);
    expect(w.TTriple).toBeLessThan(274.5);
    expect(w.PTriple).toBeGreaterThan(300); // real: 611 Pa
    expect(w.PTriple).toBeLessThan(2000);
    expect(w.PCrit).toBeGreaterThan(1.5e7); // real: 22.1 MPa
    expect(w.PCrit).toBeLessThan(4e7);

    const c = computePhaseDiagram(co2);
    expect(c.TTriple).toBeGreaterThan(215); // real: 216.6 K
    expect(c.TTriple).toBeLessThan(219);
    expect(c.PTriple).toBeGreaterThan(3e5); // real: 5.2 bar
    expect(c.PTriple).toBeLessThan(8e5);
    expect(c.PCrit).toBeGreaterThan(5e6); // real: 7.38 MPa
    expect(c.PCrit).toBeLessThan(1.1e7);
  });

  it('stable phase flips exactly at each boundary', () => {
    const check = (sub: Substance, P: number) => {
      const diagram = computePhaseDiagram(sub);
      for (const t of transitionsAtPressure(sub, diagram, P)) {
        const below = stablePhase(sub, t.T - 0.5, P);
        const above = stablePhase(sub, t.T + 0.5, P);
        expect(below).not.toBe(above);
        if (t.kind === 'melting') expect([below, above]).toEqual(['solid', 'liquid']);
        if (t.kind === 'boiling') expect([below, above]).toEqual(['liquid', 'gas']);
        if (t.kind === 'sublimation') expect([below, above]).toEqual(['solid', 'gas']);
      }
    };
    check(water, ATM_PRESSURE); // melting + boiling
    check(water, 200); // below triple: sublimation only
    check(co2, ATM_PRESSURE); // below CO₂'s triple: sublimation only
    check(co2, 2e6); // above triple: melting + boiling
  });

  it('everyday sanity: liquid water at room conditions, CO₂ gas', () => {
    expect(stablePhase(water, 298, ATM_PRESSURE)).toBe('liquid');
    expect(stablePhase(water, 250, ATM_PRESSURE)).toBe('solid');
    expect(stablePhase(water, 400, ATM_PRESSURE)).toBe('gas');
    expect(stablePhase(co2, 298, ATM_PRESSURE)).toBe('gas');
    expect(stablePhase(co2, 150, ATM_PRESSURE)).toBe('solid');
  });

  it('nearestTransition picks the closest crossing', () => {
    const diagram = computePhaseDiagram(water);
    const transitions = transitionsAtPressure(water, diagram, ATM_PRESSURE);
    expect(nearestTransition(transitions, 280)!.kind).toBe('melting');
    expect(nearestTransition(transitions, 360)!.kind).toBe('boiling');
  });
});

describe('Clausius–Clapeyron boundary analysis (Lecture 9)', () => {
  it('dP/dT = ΔS/ΔV matches the tangent of the drawn boundary', () => {
    // Numeric derivative of T(P) along each curve, inverted to dP/dT
    for (const sub of SUBSTANCES) {
      const diagram = computePhaseDiagram(sub);
      for (const kind of BOUNDARY_KINDS) {
        const { PLo, PHi } = boundaryPressureRange(sub, diagram, kind);
        const P = Math.sqrt(PLo * PHi); // mid-branch (log scale)
        const info = analyzeBoundary(sub, kind, P)!;
        const [a, b] = BOUNDARY_PHASES[kind];
        const h = P * 1e-6;
        const Tp = boundaryTemperature(sub, a, b, P + h)!;
        const Tm = boundaryTemperature(sub, a, b, P - h)!;
        const numericSlope = (2 * h) / (Tp - Tm);
        expect(info.slope / numericSlope).toBeCloseTo(1, 3);
      }
    }
  });

  it('confirms L_sub = L_fus + L_vap at the triple point', () => {
    for (const sub of SUBSTANCES) {
      const check = triplePointCheck(sub, computePhaseDiagram(sub))!;
      expect(check.LSub).toBeCloseTo(check.LFus + check.LVap, 6);
      expect(check.LFus).toBeGreaterThan(0);
      expect(check.LVap).toBeGreaterThan(0);
    }
  });

  it('sublimation is steeper than vaporization at the triple point', () => {
    for (const sub of SUBSTANCES) {
      const check = triplePointCheck(sub, computePhaseDiagram(sub))!;
      expect(check.slopeSub).toBeGreaterThan(check.slopeVap);
      expect(check.slopeVap).toBeGreaterThan(0);
    }
  });

  it('vaporization slope grows dramatically along the curve; fusion barely moves', () => {
    for (const sub of SUBSTANCES) {
      const diagram = computePhaseDiagram(sub);
      const vapRange = boundaryPressureRange(sub, diagram, 'vaporization');
      const vLow = analyzeBoundary(sub, 'vaporization', vapRange.PLo * 1.05)!;
      const vHigh = analyzeBoundary(sub, 'vaporization', vapRange.PHi * 0.95)!;
      expect(vHigh.slope / vLow.slope).toBeGreaterThan(5); // visibly curved

      const fusRange = boundaryPressureRange(sub, diagram, 'fusion');
      const fLow = analyzeBoundary(sub, 'fusion', fusRange.PLo * 1.05)!;
      const fHigh = analyzeBoundary(sub, 'fusion', fusRange.PHi * 0.95)!;
      expect(fHigh.slope / fLow.slope).toBeCloseTo(1, 6); // nearly straight
      expect(fLow.slope).toBeCloseTo(fusionSlope(sub), 6);
    }
  });

  it('ΔV across vaporization dwarfs ΔV across fusion', () => {
    for (const sub of SUBSTANCES) {
      const diagram = computePhaseDiagram(sub);
      const vap = analyzeBoundary(sub, 'vaporization', diagram.PTriple * 2)!;
      const fus = analyzeBoundary(sub, 'fusion', diagram.PTriple * 2)!;
      expect(Math.abs(vap.dV)).toBeGreaterThan(100 * Math.abs(fus.dV));
    }
  });

  it('latent heat signs and phase pairs are correct', () => {
    for (const sub of SUBSTANCES) {
      const diagram = computePhaseDiagram(sub);
      for (const kind of BOUNDARY_KINDS) {
        const { PLo, PHi } = boundaryPressureRange(sub, diagram, kind);
        const info = analyzeBoundary(sub, kind, Math.sqrt(PLo * PHi))!;
        expect(info.L).toBeGreaterThan(0); // heat is absorbed going a → b
        expect(info.dS).toBeGreaterThan(0); // entropy increases toward b
        expect([info.a, info.b]).toEqual(BOUNDARY_PHASES[kind]);
      }
    }
  });
});
