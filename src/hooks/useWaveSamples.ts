import { useMemo, useRef } from 'react';
import { sampleElectromagneticWave } from '../lib/waveEq/emWave.ts';
import { sampleWavePoints } from '../lib/waveEq/sampling.ts';
import type { WaveMode, WaveParams } from '../lib/waveEq/types.ts';

export type WaveSamplesResult = {
  primaryPositions: Float32Array;
  secondaryPositions: Float32Array | null;
  revision: number;
};

const fillArrayFromWavePoints = (
  target: Float32Array,
  params: WaveParams,
  t: number,
  mode: Exclude<WaveMode, 'em'>,
): Float32Array => {
  const points = sampleWavePoints(t, params, mode);
  for (let i = 0; i < points.length; i += 1) {
    const idx = i * 3;
    const point = points[i];
    target[idx] = point.x;
    target[idx + 1] = point.y;
    target[idx + 2] = point.z ?? 0;
  }
  return target;
};

export function useWaveSamples(t: number, params: WaveParams, mode: WaveMode): WaveSamplesResult {
  const primaryRef = useRef<Float32Array>(new Float32Array(Math.max(2, params.samples) * 3));
  const secondaryRef = useRef<Float32Array>(new Float32Array(Math.max(2, params.samples) * 3));
  const revisionRef = useRef(0);

  const expectedLength = Math.max(2, params.samples) * 3;
  if (primaryRef.current.length !== expectedLength) {
    primaryRef.current = new Float32Array(expectedLength);
  }
  if (secondaryRef.current.length !== expectedLength) {
    secondaryRef.current = new Float32Array(expectedLength);
  }

  return useMemo(() => {
    revisionRef.current += 1;

    if (mode === 'em') {
      const emSamples = sampleElectromagneticWave(t, params);
      for (let i = 0; i < emSamples.length; i += 1) {
        const idx = i * 3;
        const sample = emSamples[i];

        primaryRef.current[idx] = sample.e;
        primaryRef.current[idx + 1] = 0;
        primaryRef.current[idx + 2] = sample.z;

        secondaryRef.current[idx] = 0;
        secondaryRef.current[idx + 1] = sample.b;
        secondaryRef.current[idx + 2] = sample.z;
      }
      return {
        primaryPositions: primaryRef.current,
        secondaryPositions: secondaryRef.current,
        revision: revisionRef.current,
      };
    }

    const resolvedMode = mode === 'standing' ? 'standing' : 'traveling';
    return {
      primaryPositions: fillArrayFromWavePoints(primaryRef.current, params, t, resolvedMode),
      secondaryPositions: null,
      revision: revisionRef.current,
    };
  }, [mode, params, t]);
}
