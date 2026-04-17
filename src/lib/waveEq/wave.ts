import type { WaveParams } from './types.ts';

const TAU = Math.PI * 2;

export function getWaveNumber(lambda: number): number {
  return lambda === 0 ? 0 : TAU / lambda;
}

export function getAngularFrequency(f: number): number {
  return TAU * f;
}

export function getTravelingWaveY(x: number, t: number, params: WaveParams): number {
  const k = getWaveNumber(params.wavelength);
  const omega = getAngularFrequency(params.frequency);
  return params.amplitude * Math.sin(k * x - omega * t + params.phase);
}

export function getStandingWaveY(x: number, t: number, params: WaveParams): number {
  const k = getWaveNumber(params.wavelength);
  const omega = getAngularFrequency(params.frequency);
  return 2 * params.amplitude * Math.sin(k * x) * Math.cos(omega * t + params.phase);
}
