import { Html } from '@react-three/drei';
import { sampleProbeValue } from '../../lib/waveEq/sampling';
import type { WaveMode, WaveParams } from '../../lib/waveEq/types';

type WaveProbeProps = {
  x: number;
  t: number;
  params: WaveParams;
  mode: WaveMode;
  visible: boolean;
};

export function WaveProbe({ x, t, params, mode, visible }: WaveProbeProps) {
  if (!visible || mode === 'em') {
    return null;
  }

  const y = sampleProbeValue(x, t, params, mode);

  return (
    <group position={[x, y, 0]}>
      <mesh>
        <sphereGeometry args={[0.14, 16, 16]} />
        <meshStandardMaterial color="#f8fafc" emissive="#67e8f9" emissiveIntensity={0.9} />
      </mesh>
      <Html distanceFactor={8} center>
        <div className="rounded-md border border-cyan-300/30 bg-slate-950/80 px-2 py-1 text-[11px] text-cyan-100 shadow-lg shadow-cyan-500/15 backdrop-blur-sm">
          y={y.toFixed(3)}
        </div>
      </Html>
    </group>
  );
}
