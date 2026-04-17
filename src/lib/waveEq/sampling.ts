import type { SamplePoint, WaveMode, WaveParams } from './types.ts';
import { getStandingWaveY, getTravelingWaveY } from './wave.ts';

const getStep = (params: WaveParams): number => {
  const sampleCount = Math.max(2, params.samples);
  return (params.domainEnd - params.domainStart) / (sampleCount - 1);
};

export function sampleProbeValue(x: number, t: number, params: WaveParams, mode: WaveMode): number {
  if (mode === 'standing') {
    return getStandingWaveY(x, t, params);
  }

  if (mode === 'em') {
    return getTravelingWaveY(x, t, params);
  }

  return getTravelingWaveY(x, t, params);
}

export function sampleWavePoints(t: number, params: WaveParams, mode: WaveMode): SamplePoint[] {
  const sampleCount = Math.max(2, params.samples);
  const step = getStep(params);
  const points: SamplePoint[] = new Array(sampleCount);

  for (let i = 0; i < sampleCount; i += 1) {
    const x = params.domainStart + i * step;
    const y = sampleProbeValue(x, t, params, mode);
    points[i] = { x, y, z: 0 };
  }

  return points;
}
