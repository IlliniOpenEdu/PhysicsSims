import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { generateFieldLines } from '../../lib/enm/magField3d/field';
import type { MagFieldParams } from '../../lib/enm/magField3d/types';
import { Conductors } from './Conductors';
import { FieldLines } from './FieldLines';
import { TestCompass } from './TestCompass';

type MagFieldSceneProps = {
  params: MagFieldParams;
  animate: boolean;
};

function SceneContent({ params, animate }: MagFieldSceneProps) {
  // Field lines are pure geometry — recompute only when the inputs that shape them change.
  const lines = useMemo(
    () => generateFieldLines(params),
    [
      params.mode,
      params.direction,
      params.density,
      params.turns,
      params.coilRadiusCm,
      params.coilLengthCm,
      params.separationCm,
      params.oppositeCurrent,
    ],
  );

  return (
    <>
      <ambientLight intensity={0.45} />
      <directionalLight position={[8, 10, 12]} intensity={0.8} color="#bae6fd" />
      <pointLight position={[-10, -6, -8]} intensity={0.4} color="#a855f7" />

      {/* faint grid perpendicular to the conductor axis (z) */}
      <gridHelper args={[18, 18, '#1e293b', '#0f172a']} rotation={[Math.PI / 2, 0, 0]} />

      <Conductors params={params} />
      <FieldLines lines={lines} animate={animate} />
      {params.showCompass ? <TestCompass params={params} /> : null}

      <OrbitControls enablePan enableZoom minDistance={3} maxDistance={40} />
    </>
  );
}

export function MagFieldScene(props: MagFieldSceneProps) {
  return (
    <div className="relative h-full w-full">
      <Canvas
        camera={{ position: [7, 5.5, 8], fov: 50, far: 200 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: false }}
      >
        <color attach="background" args={['#030712']} />
        <fog attach="fog" args={['#030712', 22, 60]} />
        <SceneContent {...props} />
      </Canvas>
      <div className="pointer-events-none absolute bottom-3 left-3 rounded-md border border-cyan-300/20 bg-slate-950/70 px-2 py-1 text-[11px] text-cyan-100 backdrop-blur-sm">
        Drag to orbit · scroll to zoom · right-drag to pan
      </div>
    </div>
  );
}
