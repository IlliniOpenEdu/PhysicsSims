import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { WaveControls, WaveScene } from '../../components/wave3d';
import { useWaveClock } from '../../hooks/useWaveTime';
import type { EMDisplayMode, NavigationMode, WaveMode, WaveParams } from '../../lib/waveEq/types';

const DEFAULT_EM_PARAMS: WaveParams = {
  amplitude: 1,
  eAmplitude: 1.2,
  bAmplitude: 0.8,
  wavelength: 8,
  frequency: 0.35,
  phase: 0,
  samples: 900,
  domainStart: -40,
  domainEnd: 40,
  arrowSpacing: 1.2,
  arrowScale: 0.9,
  showFieldArrows: true,
  volumeXCount: 5,
  volumeYCount: 5,
  volumeZCount: 22,
  volumeXSpan: 8,
  volumeYSpan: 8,
  volumeZSpan: 44,
  volumeArrowScale: 0.85,
  volumeShowElectric: true,
  volumeShowMagnetic: true,
  volumeSkipNearZero: true,
  volumeMinMagnitude: 0.08,
  showProbe: false,
  probeX: 0,
};

const CLASSIC_PARAMS: Record<'traveling' | 'standing', WaveParams> = {
  traveling: {
    amplitude: 1,
    wavelength: 4,
    frequency: 0.5,
    phase: 0,
    samples: 320,
    domainStart: -10,
    domainEnd: 10,
    showProbe: true,
    probeX: 0,
  },
  standing: {
    amplitude: 1,
    wavelength: 5,
    frequency: 0.45,
    phase: 0,
    samples: 320,
    domainStart: -10,
    domainEnd: 10,
    showProbe: true,
    probeX: 0,
  },
};

function mergeParamsForMode(mode: WaveMode, prev: WaveParams): WaveParams {
  if (mode === 'em') {
    return { ...prev, ...DEFAULT_EM_PARAMS };
  }

  const base = CLASSIC_PARAMS[mode];
  return {
    ...prev,
    ...base,
    showFieldArrows: false,
  };
}

function WaveEquation3D() {
  const [mode, setMode] = useState<WaveMode>('em');
  const [emDisplayMode, setEMDisplayMode] = useState<EMDisplayMode>('volume');
  const [params, setParams] = useState<WaveParams>(DEFAULT_EM_PARAMS);
  const [probeX, setProbeX] = useState(0);
  const [showProbe, setShowProbe] = useState(false);
  const [navMode, setNavMode] = useState<NavigationMode>('fly');

  const {
    currentTime,
    isPlaying,
    playbackSpeed,
    setTime,
    setPlaybackSpeed,
    togglePlay,
    reset,
  } = useWaveClock(0);

  const modeLabel = useMemo(() => {
    if (mode === 'standing') return 'Standing Wave';
    if (mode === 'traveling') return 'Traveling Wave';
    return emDisplayMode === 'volume' ? 'Electromagnetic Wave Volume' : 'Electromagnetic Wave Textbook';
  }, [emDisplayMode, mode]);

  const onModeChange = (nextMode: WaveMode) => {
    setMode(nextMode);
    setParams((prev) => mergeParamsForMode(nextMode, prev));
    if (nextMode === 'em') {
      setShowProbe(false);
      if (emDisplayMode === 'volume') {
        setNavMode('fly');
      } else {
        setNavMode('orbit');
      }
    } else {
      setNavMode('orbit');
    }
  };

  const onEMDisplayModeChange = (nextDisplayMode: EMDisplayMode) => {
    setEMDisplayMode(nextDisplayMode);
    if (nextDisplayMode === 'volume') {
      setNavMode('fly');
    } else {
      setNavMode('orbit');
    }
  };

  const onParamPatch = (patch: Partial<WaveParams>) => {
    setParams((prev) => ({ ...prev, ...patch }));
  };

  const onApplyPreset = (nextMode: WaveMode, values: Partial<WaveParams>) => {
    setMode(nextMode);
    setParams((prev) => ({ ...mergeParamsForMode(nextMode, prev), ...values }));
    if (nextMode === 'em') {
      setShowProbe(false);
      const isVolumePreset =
        values.volumeXCount !== undefined ||
        values.volumeYCount !== undefined ||
        values.volumeZCount !== undefined ||
        values.volumeArrowScale !== undefined ||
        values.volumeXSpan !== undefined ||
        values.volumeYSpan !== undefined ||
        values.volumeZSpan !== undefined;

      if (isVolumePreset) {
        setEMDisplayMode('volume');
        setNavMode('fly');
      } else {
        setEMDisplayMode('textbook');
        setNavMode('orbit');
      }
    }
  };

  return (
    <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col overflow-hidden px-4 py-8 text-slate-100">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-20 top-0 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-fuchsia-500/15 blur-3xl" />
      </div>

      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">ENM Module</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">Wave Equation 3D</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">
            Electromagnetic wave field rendering with perpendicular E and B components, long-range propagation, and WASD fly controls in volume mode.
          </p>
        </div>
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-cyan-500 hover:text-cyan-100"
        >
          <span className="text-sm">←</span>
          Back home
        </Link>
      </header>

      <section className="mb-4 flex items-center justify-between rounded-xl border border-cyan-300/15 bg-slate-900/70 px-4 py-3 text-xs backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-2.5 w-2.5 rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.8)]" />
          <span className="font-semibold uppercase tracking-[0.12em] text-cyan-100">{modeLabel}</span>
        </div>
        <div className="flex items-center gap-4 text-slate-300">
          <span>Samples: {params.samples}</span>
          <span>Domain: [{params.domainStart}, {params.domainEnd}]</span>
          <span>Nav: {navMode === 'fly' ? 'Fly' : 'Orbit'}</span>
        </div>
      </section>

      <section className="grid flex-1 grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-h-[33rem] overflow-hidden rounded-2xl border border-white/10 bg-slate-950/80 shadow-2xl shadow-cyan-950/20">
          <WaveScene
            mode={mode}
            params={params}
            currentTime={currentTime}
            probeX={probeX}
            showProbe={showProbe}
            navMode={navMode}
            emDisplayMode={emDisplayMode}
          />
        </div>

        <WaveControls
          mode={mode}
          params={params}
          navMode={navMode}
          emDisplayMode={emDisplayMode}
          currentTime={currentTime}
          isPlaying={isPlaying}
          playbackSpeed={playbackSpeed}
          probeX={probeX}
          showProbe={showProbe}
          onModeChange={onModeChange}
          onEMDisplayModeChange={onEMDisplayModeChange}
          onNavModeChange={setNavMode}
          onParamPatch={onParamPatch}
          onTimeChange={setTime}
          onTogglePlay={togglePlay}
          onReset={reset}
          onPlaybackSpeedChange={setPlaybackSpeed}
          onProbeXChange={setProbeX}
          onShowProbeChange={setShowProbe}
          onApplyPreset={onApplyPreset}
        />
      </section>
    </div>
  );
}

export { WaveEquation3D };
