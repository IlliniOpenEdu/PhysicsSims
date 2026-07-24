import { describe, expect, it } from 'vitest';
import {
  computeEngineCycle,
  ENGINE_PRESETS,
  type EngineCycle,
  type EngineState,
  type ProcessType,
} from '../heatEngine';

const GAMMA_MONO = 5 / 3;
const GAMMA_DI = 7 / 5;
const GAMMAS = [GAMMA_MONO, GAMMA_DI];

function preset(id: string) {
  const p = ENGINE_PRESETS.find((p) => p.id === id);
  if (!p) throw new Error(`no preset ${id}`);
  return p.config;
}

/** The conserved quantity along a process — equal at both ends of a valid leg. */
function invariant(type: ProcessType, s: EngineState, gamma: number): number {
  switch (type) {
    case 'isochoric':
      return s.V;
    case 'isobaric':
      return s.P;
    case 'isothermal':
      return s.T;
    default:
      return s.T * Math.pow(s.V, gamma - 1);
  }
}

function expectClosed(cycle: EngineCycle) {
  expect(cycle.ok).toBe(true);
  const n = cycle.legs.length;
  for (let i = 0; i < n; i++) {
    const leg = cycle.legs[i];
    const a = invariant(leg.type, leg.from, cycle.gamma);
    const b = invariant(leg.type, leg.to, cycle.gamma);
    expect(b / a).toBeCloseTo(1, 9);
    // legs chain: leg i ends where leg i+1 starts
    const next = cycle.legs[(i + 1) % n];
    expect(leg.to.V).toBeCloseTo(next.from.V, 12);
    expect(leg.to.T).toBeCloseTo(next.from.T, 9);
  }
}

describe('computeEngineCycle', () => {
  it('closes every preset loop and conserves internal energy (ΣΔU ≈ 0)', () => {
    for (const p of ENGINE_PRESETS) {
      for (const gamma of GAMMAS) {
        const cycle = computeEngineCycle(p.config, gamma);
        expectClosed(cycle);
        expect(Math.abs(cycle.dUsum)).toBeLessThan(1e-6 * Math.max(1, cycle.Qin));
        // First law around the loop: W_net = Q_in − Q_out
        expect(cycle.Wnet).toBeCloseTo(cycle.Qin - cycle.Qout, 6);
      }
    }
  });

  it('every preset runs as an engine with η below the Carnot bound', () => {
    for (const p of ENGINE_PRESETS) {
      for (const gamma of GAMMAS) {
        const cycle = computeEngineCycle(p.config, gamma);
        expect(cycle.eta).not.toBeNull();
        expect(cycle.eta!).toBeGreaterThan(0);
        expect(cycle.eta!).toBeLessThanOrEqual(cycle.etaCarnot + 1e-12);
      }
    }
  });

  it('reproduces the Otto efficiency formula η = 1 − r^(1−γ)', () => {
    for (const gamma of GAMMAS) {
      const cycle = computeEngineCycle(preset('otto'), gamma);
      const r = 8; // compression ratio baked into the preset
      expect(cycle.eta!).toBeCloseTo(1 - Math.pow(r, 1 - gamma), 9);
    }
  });

  it('Carnot preset hits the Carnot bound exactly; others fall short', () => {
    for (const gamma of GAMMAS) {
      const carnot = computeEngineCycle(preset('carnot'), gamma);
      expect(carnot.eta!).toBeCloseTo(carnot.etaCarnot, 9);
      for (const id of ['otto', 'diesel', 'stirling', 'brayton']) {
        const cycle = computeEngineCycle(preset(id), gamma);
        expect(cycle.eta!).toBeLessThan(cycle.etaCarnot);
      }
    }
  });

  it('applies the analytic per-process relations (W, Q, ΔU)', () => {
    const cycle = computeEngineCycle(preset('stirling'), GAMMA_MONO);
    for (const leg of cycle.legs) {
      if (leg.type === 'isothermal') {
        expect(leg.dU).toBe(0);
        expect(leg.W).toBeCloseTo(leg.Q, 9);
      } else {
        // isochoric legs of the Stirling cycle
        expect(leg.W).toBe(0);
        expect(leg.Q).toBeCloseTo(leg.dU, 9);
      }
    }
    const brayton = computeEngineCycle(preset('brayton'), GAMMA_DI);
    for (const leg of brayton.legs) {
      if (leg.type === 'adiabatic') {
        expect(leg.Q).toBe(0);
        expect(leg.W).toBeCloseTo(-leg.dU, 9);
      } else {
        expect(leg.W).toBeCloseTo(leg.from.P * (leg.to.V - leg.from.V), 6);
      }
    }
  });

  it('rejects consecutive legs of the same process type', () => {
    const cycle = computeEngineCycle(
      {
        V1: 0.01,
        T1: 300,
        legs: [
          { type: 'isothermal', target: 0.02 },
          { type: 'isothermal', target: 0.03 },
          { type: 'isochoric' },
        ],
      },
      GAMMA_MONO,
    );
    expect(cycle.ok).toBe(false);
    expect(cycle.error).toMatch(/consecutive/i);
  });

  it('supports 3-leg cycles', () => {
    const cycle = computeEngineCycle(
      {
        V1: 0.01,
        T1: 600,
        legs: [{ type: 'isothermal', target: 0.03 }, { type: 'isochoric' }, { type: 'adiabatic' }],
      },
      GAMMA_MONO,
    );
    expectClosed(cycle);
    expect(cycle.states).toHaveLength(3);
  });
});
