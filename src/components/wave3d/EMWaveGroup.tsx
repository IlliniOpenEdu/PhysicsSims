import { useMemo } from 'react';
import { sampleElectromagneticWave } from '../../lib/waveEq/emWave';
import type { WaveParams } from '../../lib/waveEq/types';
import { EMFieldArrows } from './EMFieldArrows';
import { EMWaveLine } from './EMWaveLine';
import { WaveLine } from './WaveLine';

type EMWaveGroupProps = {
  time: number;
  params: WaveParams;
  showArrows: boolean;
};

export function EMWaveGroup({ time, params, showArrows }: EMWaveGroupProps) {
  const samples = useMemo(() => sampleElectromagneticWave(time, params), [time, params]);

  const axisPositions = useMemo(() => {
    const positions = new Float32Array(6);
    positions[0] = 0;
    positions[1] = 0;
    positions[2] = params.domainStart;
    positions[3] = 0;
    positions[4] = 0;
    positions[5] = params.domainEnd;
    return positions;
  }, [params.domainEnd, params.domainStart]);

  return (
    <group>
      <WaveLine positions={axisPositions} color="#94a3b8" opacity={0.65} lineWidth={1.4} />
      <EMWaveLine samples={samples} kind="electric" />
      <EMWaveLine samples={samples} kind="magnetic" />
      {showArrows ? <EMFieldArrows time={time} params={params} /> : null}
    </group>
  );
}
