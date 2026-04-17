import { Line, Text } from '@react-three/drei';
import type { WaveMode } from '../../lib/waveEq/types';

type WaveAxesProps = {
  mode: WaveMode;
};

const EM_AXIS_LEN = 46;
const DEFAULT_AXIS_LEN = 12;

export function WaveAxes({ mode }: WaveAxesProps) {
  const axisLength = mode === 'em' ? EM_AXIS_LEN : DEFAULT_AXIS_LEN;

  return (
    <group>
      <Line points={[[-axisLength, 0, 0], [axisLength, 0, 0]]} color="#475569" lineWidth={1} />
      <Line points={[[0, -axisLength * 0.2, 0], [0, axisLength * 0.2, 0]]} color="#475569" lineWidth={1} />
      <Line points={[[0, 0, -axisLength], [0, 0, axisLength]]} color="#64748b" lineWidth={1.3} />

      {mode === 'em' ? (
        <>
          <Text position={[axisLength + 1, 0.35, 0]} fontSize={0.5} color="#fbbf24" anchorX="left">
            Electric field (x)
          </Text>
          <Text position={[0.35, axisLength * 0.2 + 0.8, 0]} fontSize={0.5} color="#67e8f9" anchorX="left">
            Magnetic field (y)
          </Text>
          <Text position={[0.5, 0.35, axisLength + 1.2]} fontSize={0.5} color="#e2e8f0" anchorX="left">
            Propagation (z)
          </Text>
        </>
      ) : (
        <>
          <Text position={[axisLength + 0.7, 0.2, 0]} fontSize={0.35} color="#93c5fd" anchorX="left">
            position (x)
          </Text>
          <Text position={[0.25, 3.8, 0]} fontSize={0.35} color="#7dd3fc" anchorX="left">
            amplitude (y)
          </Text>
          <Text position={[0.3, 0.2, 6.4]} fontSize={0.32} color="#475569" anchorX="left">
            depth (z)
          </Text>
        </>
      )}
    </group>
  );
}
