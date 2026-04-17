import { useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useWaveSamples } from '../../hooks/useWaveSamples';
import type { EMDisplayMode, NavigationMode, WaveMode, WaveParams } from '../../lib/waveEq/types';
import { EMFieldVolume } from './EMFieldVolume';
import { EMWaveGroup } from './EMWaveGroup';
import { WaveAxes } from './WaveAxes';
import { WaveCameraController } from './WaveCameraController';
import { WaveGrid } from './WaveGrid';
import { WaveLine } from './WaveLine';
import { WaveProbe } from './WaveProbe';

type WaveSceneProps = {
  mode: WaveMode;
  params: WaveParams;
  currentTime: number;
  probeX: number;
  showProbe: boolean;
  navMode: NavigationMode;
  emDisplayMode: EMDisplayMode;
};

function WaveSceneContent({ mode, params, currentTime, probeX, showProbe, navMode, emDisplayMode }: WaveSceneProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const samplingMode: WaveMode = mode === 'em' ? 'traveling' : mode;
  const { primaryPositions, revision } = useWaveSamples(currentTime, params, samplingMode);

  const isVolumeMode = mode === 'em' && emDisplayMode === 'volume';

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 12, 8]} intensity={0.75} color="#93c5fd" />
      <pointLight position={[-9, 4, -14]} intensity={0.5} color="#f472b6" />

      <WaveGrid mode={mode} emDisplayMode={emDisplayMode} />
      <WaveAxes mode={mode} />

      {mode === 'em' ? (
        isVolumeMode ? (
          <EMFieldVolume time={currentTime} params={params} />
        ) : (
          <EMWaveGroup time={currentTime} params={params} showArrows={params.showFieldArrows ?? true} />
        )
      ) : (
        <>
          <WaveLine positions={primaryPositions} color="#22d3ee" opacity={0.95} lineWidth={2} updateVersion={revision} />
          <WaveLine positions={primaryPositions} color="#67e8f9" opacity={0.24} lineWidth={3} updateVersion={revision} />
          <WaveProbe x={probeX} t={currentTime} params={params} mode={mode} visible={showProbe} />
        </>
      )}

      <OrbitControls
        ref={controlsRef}
        enabled={navMode === 'orbit'}
        enablePan
        enableZoom
        maxDistance={isVolumeMode ? 220 : mode === 'em' ? 140 : 38}
        minDistance={isVolumeMode ? 10 : mode === 'em' ? 4 : 7}
        minPolarAngle={0.2}
        maxPolarAngle={Math.PI - 0.2}
      />
      <WaveCameraController navMode={navMode} controlsRef={controlsRef} moveSpeed={isVolumeMode ? 9 : 6} />
    </>
  );
}

export function WaveScene(props: WaveSceneProps) {
  const initialCamera = props.mode === 'em'
    ? props.emDisplayMode === 'volume'
      ? { position: [16, 11, 48] as [number, number, number], fov: 50, far: 500 }
      : { position: [10, 6, 14] as [number, number, number], fov: 52, far: 220 }
    : { position: [10, 5, 12] as [number, number, number], fov: 46 };

  return (
    <div className="relative h-full w-full rounded-2xl border border-cyan-400/15 bg-slate-950/80">
      <Canvas camera={initialCamera} dpr={[1, 2]} gl={{ antialias: true, alpha: false }}>
        <color attach="background" args={['#020617']} />
        <fog attach="fog" args={['#020617', 30, props.emDisplayMode === 'volume' ? 260 : 200]} />
        <WaveSceneContent {...props} />
      </Canvas>
      {props.navMode === 'fly' ? (
        <div className="pointer-events-none absolute bottom-3 left-3 rounded-md border border-cyan-300/20 bg-slate-950/70 px-2 py-1 text-[11px] text-cyan-100 backdrop-blur-sm">
          Fly mode: hold right mouse + WASD, Q/E, Shift
        </div>
      ) : null}
    </div>
  );
}
