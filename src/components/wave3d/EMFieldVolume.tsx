import { useMemo } from 'react';
import { Edges } from '@react-three/drei';
import { EMVolumeArrows } from './EMVolumeArrows';
import { useEMFieldVolume } from '../../hooks/useEMFieldVolume';
import type { WaveParams } from '../../lib/waveEq/types.ts';

type EMFieldVolumeProps = {
  time: number;
  params: WaveParams;
};

export function EMFieldVolume({ time, params }: EMFieldVolumeProps) {
  const samples = useEMFieldVolume(time, params);
  const volumeXSpan = params.volumeXSpan ?? 8;
  const volumeYSpan = params.volumeYSpan ?? 8;
  const volumeZSpan = params.volumeZSpan ?? 40;

  const outlineColor = useMemo(() => '#38bdf8', []);

  return (
    <group>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[volumeXSpan, volumeYSpan, volumeZSpan]} />
        <meshBasicMaterial color="#0f172a" transparent opacity={0.05} wireframe={false} />
        <Edges scale={1.002} threshold={15} color={outlineColor} />
      </mesh>
      <EMVolumeArrows samples={samples} params={params} />
    </group>
  );
}
