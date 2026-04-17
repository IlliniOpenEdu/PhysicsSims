import { useMemo } from 'react';
import { sampleEMFieldArrows } from '../../lib/waveEq/emWave';
import type { EMArrowSample, WaveParams } from '../../lib/waveEq/types';

type EMFieldArrowsProps = {
  time: number;
  params: WaveParams;
};

type ArrowGlyphProps = {
  origin: [number, number, number];
  direction: 'x' | 'negX' | 'y' | 'negY';
  length: number;
  color: string;
};

function ArrowGlyph({ origin, direction, length, color }: ArrowGlyphProps) {
  const safeLength = Math.max(0.02, length);
  if (safeLength < 0.04) {
    return null;
  }

  const shaftLength = safeLength * 0.72;
  const headLength = safeLength * 0.28;

  let rotation: [number, number, number] = [0, 0, 0];
  if (direction === 'x') rotation = [0, 0, -Math.PI / 2];
  if (direction === 'negX') rotation = [0, 0, Math.PI / 2];
  if (direction === 'negY') rotation = [0, 0, Math.PI];

  return (
    <group position={origin} rotation={rotation}>
      <mesh position={[0, shaftLength * 0.5, 0]}>
        <cylinderGeometry args={[0.026, 0.026, shaftLength, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.55} metalness={0.05} roughness={0.4} />
      </mesh>
      <mesh position={[0, shaftLength + headLength * 0.5, 0]}>
        <coneGeometry args={[0.07, headLength, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.72} metalness={0.05} roughness={0.35} />
      </mesh>
    </group>
  );
}

export function EMFieldArrows({ time, params }: EMFieldArrowsProps) {
  const arrows = useMemo<EMArrowSample[]>(() => sampleEMFieldArrows(time, params), [time, params]);
  const arrowScale = params.arrowScale ?? 0.9;

  return (
    <group>
      {arrows.map((sample) => {
        const eLength = Math.abs(sample.e) * arrowScale;
        const bLength = Math.abs(sample.b) * arrowScale;
        const eDirection: ArrowGlyphProps['direction'] = sample.e >= 0 ? 'x' : 'negX';
        const bDirection: ArrowGlyphProps['direction'] = sample.b >= 0 ? 'y' : 'negY';

        return (
          <group key={`em-arrow-${sample.z.toFixed(3)}`}>
            <ArrowGlyph origin={[0, 0, sample.z]} direction={eDirection} length={eLength} color="#f59e0b" />
            <ArrowGlyph origin={[0, 0, sample.z]} direction={bDirection} length={bLength} color="#22d3ee" />
          </group>
        );
      })}
    </group>
  );
}
