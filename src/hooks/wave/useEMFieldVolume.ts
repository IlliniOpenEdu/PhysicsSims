import { useMemo } from 'react';
import type { WaveParams } from '../../lib/enm/waveEq/types.ts';
import { sampleEMFieldVolume } from '../../lib/enm/waveEq/volumeSampling.ts';

export function useEMFieldVolume(time: number, params: WaveParams) {
  const samples = useMemo(() => sampleEMFieldVolume(time, params), [params, time]);

  return samples;
}
