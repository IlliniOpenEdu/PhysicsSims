import type { EMDisplayMode, NavigationMode, WaveMode, WaveParams } from '../../lib/waveEq/types';
import { SliderWithInput } from '../SliderWithInput';

type WavePreset = {
  label: string;
  mode: WaveMode;
  values: Partial<WaveParams>;
};

const PRESETS: WavePreset[] = [
  {
    label: 'Traveling',
    mode: 'traveling',
    values: { amplitude: 1, wavelength: 4, frequency: 0.5, phase: 0, domainStart: -10, domainEnd: 10, samples: 320 },
  },
  {
    label: 'Standing',
    mode: 'standing',
    values: { amplitude: 1, wavelength: 5.5, frequency: 0.45, phase: 0, domainStart: -10, domainEnd: 10, samples: 320 },
  },
  {
    label: 'EM textbook',
    mode: 'em',
    values: {
      amplitude: 1,
      eAmplitude: 1.2,
      bAmplitude: 0.8,
      wavelength: 8,
      frequency: 0.35,
      phase: 0,
      domainStart: -40,
      domainEnd: 40,
      samples: 900,
      arrowSpacing: 1.2,
      arrowScale: 0.9,
      showFieldArrows: true,
      volumeShowElectric: true,
      volumeShowMagnetic: true,
    },
  },
  {
    label: 'EM volume',
    mode: 'em',
    values: {
      amplitude: 1,
      eAmplitude: 1.1,
      bAmplitude: 0.8,
      wavelength: 10,
      frequency: 0.25,
      phase: 0,
      domainStart: -22,
      domainEnd: 22,
      samples: 720,
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
    },
  },
  {
    label: 'EM dense volume',
    mode: 'em',
    values: {
      amplitude: 1,
      eAmplitude: 1.15,
      bAmplitude: 0.82,
      wavelength: 9,
      frequency: 0.33,
      phase: 0,
      domainStart: -24,
      domainEnd: 24,
      samples: 760,
      volumeXCount: 7,
      volumeYCount: 7,
      volumeZCount: 24,
      volumeXSpan: 10,
      volumeYSpan: 10,
      volumeZSpan: 48,
      volumeArrowScale: 0.78,
      volumeShowElectric: true,
      volumeShowMagnetic: true,
      volumeSkipNearZero: true,
      volumeMinMagnitude: 0.06,
    },
  },
  {
    label: 'EM wide volume',
    mode: 'em',
    values: {
      amplitude: 1,
      eAmplitude: 1.05,
      bAmplitude: 0.75,
      wavelength: 12,
      frequency: 0.22,
      phase: 0,
      domainStart: -30,
      domainEnd: 30,
      samples: 840,
      volumeXCount: 5,
      volumeYCount: 5,
      volumeZCount: 28,
      volumeXSpan: 12,
      volumeYSpan: 12,
      volumeZSpan: 64,
      volumeArrowScale: 0.8,
      volumeShowElectric: true,
      volumeShowMagnetic: true,
      volumeSkipNearZero: true,
      volumeMinMagnitude: 0.08,
    },
  },
  {
    label: 'EM long λ',
    mode: 'em',
    values: {
      amplitude: 1,
      eAmplitude: 1.1,
      bAmplitude: 0.7,
      wavelength: 14,
      frequency: 0.2,
      phase: 0,
      domainStart: -48,
      domainEnd: 48,
      samples: 1000,
      arrowSpacing: 1.35,
      arrowScale: 0.95,
      showFieldArrows: true,
    },
  },
  {
    label: 'EM dense arrows',
    mode: 'em',
    values: {
      amplitude: 1,
      eAmplitude: 1.2,
      bAmplitude: 0.85,
      wavelength: 9,
      frequency: 0.4,
      phase: 0,
      domainStart: -40,
      domainEnd: 40,
      samples: 950,
      arrowSpacing: 0.95,
      arrowScale: 0.85,
      showFieldArrows: true,
    },
  },
];

type WaveControlsProps = {
  mode: WaveMode;
  params: WaveParams;
  navMode: NavigationMode;
  emDisplayMode: EMDisplayMode;
  currentTime: number;
  isPlaying: boolean;
  playbackSpeed: number;
  probeX: number;
  showProbe: boolean;
  onModeChange: (mode: WaveMode) => void;
  onEMDisplayModeChange: (mode: EMDisplayMode) => void;
  onNavModeChange: (mode: NavigationMode) => void;
  onParamPatch: (patch: Partial<WaveParams>) => void;
  onTimeChange: (time: number) => void;
  onTogglePlay: () => void;
  onReset: () => void;
  onPlaybackSpeedChange: (speed: number) => void;
  onProbeXChange: (x: number) => void;
  onShowProbeChange: (next: boolean) => void;
  onApplyPreset: (mode: WaveMode, values: Partial<WaveParams>) => void;
};

export function WaveControls({
  mode,
  params,
  navMode,
  emDisplayMode,
  currentTime,
  isPlaying,
  playbackSpeed,
  probeX,
  showProbe,
  onModeChange,
  onEMDisplayModeChange,
  onNavModeChange,
  onParamPatch,
  onTimeChange,
  onTogglePlay,
  onReset,
  onPlaybackSpeedChange,
  onProbeXChange,
  onShowProbeChange,
  onApplyPreset,
}: WaveControlsProps) {
  const isEM = mode === 'em';
  const isVolume = isEM && emDisplayMode === 'volume';

  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/70 p-4 shadow-2xl shadow-cyan-950/20 backdrop-blur-md">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onTogglePlay}
          className="rounded-md border border-cyan-300/40 bg-cyan-400/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-400/20"
        >
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <button
          type="button"
          onClick={onReset}
          className="rounded-md border border-slate-500/40 bg-slate-800/70 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700"
        >
          Reset
        </button>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">Mode</p>
        <div className="grid grid-cols-3 gap-2">
          {(['traveling', 'standing', 'em'] as WaveMode[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onModeChange(item)}
              className={`rounded-md border px-2 py-1.5 text-xs font-semibold transition ${
                mode === item
                  ? 'border-cyan-300/70 bg-cyan-400/20 text-cyan-100'
                  : 'border-slate-700 bg-slate-800/80 text-slate-300 hover:border-slate-500'
              }`}
            >
              {item === 'em' ? 'EM' : item}
            </button>
          ))}
        </div>
      </div>

      {isEM ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">EM display</p>
          <div className="grid grid-cols-2 gap-2">
            {(['textbook', 'volume'] as EMDisplayMode[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => onEMDisplayModeChange(item)}
                className={`rounded-md border px-2 py-1.5 text-xs font-semibold transition ${
                  emDisplayMode === item
                    ? 'border-cyan-300/70 bg-cyan-400/20 text-cyan-100'
                    : 'border-slate-700 bg-slate-800/80 text-slate-300 hover:border-slate-500'
                }`}
              >
                {item === 'textbook' ? 'Textbook' : 'Volume'}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">Navigation</p>
        <div className="grid grid-cols-2 gap-2">
          {(['orbit', 'fly'] as NavigationMode[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onNavModeChange(item)}
              className={`rounded-md border px-2 py-1.5 text-xs font-semibold transition ${
                navMode === item
                  ? 'border-cyan-300/70 bg-cyan-400/20 text-cyan-100'
                  : 'border-slate-700 bg-slate-800/80 text-slate-300 hover:border-slate-500'
              }`}
            >
              {item === 'fly' ? 'Fly (WASD)' : 'Orbit'}
            </button>
          ))}
        </div>
      </div>

      <SliderWithInput label="Time" min={0} max={60} step={0.01} value={currentTime} onChange={onTimeChange} syncToUrl={false} />
      <SliderWithInput
        label="Playback speed"
        min={0.1}
        max={3}
        step={0.05}
        value={playbackSpeed}
        onChange={onPlaybackSpeedChange}
        syncToUrl={false}
      />

      <div className="h-px bg-white/10" />

      {!isEM ? (
        <SliderWithInput
          label="Amplitude"
          min={0.1}
          max={3}
          step={0.01}
          value={params.amplitude}
          onChange={(value) => onParamPatch({ amplitude: value })}
          syncToUrl={false}
        />
      ) : null}

      {isEM ? (
        <>
          <SliderWithInput
            label="Electric amplitude"
            min={0.1}
            max={3}
            step={0.01}
            value={params.eAmplitude ?? params.amplitude}
            onChange={(value) => onParamPatch({ eAmplitude: value })}
            syncToUrl={false}
          />
          <SliderWithInput
            label="Magnetic amplitude"
            min={0.1}
            max={3}
            step={0.01}
            value={params.bAmplitude ?? params.amplitude * 0.7}
            onChange={(value) => onParamPatch({ bAmplitude: value })}
            syncToUrl={false}
          />
        </>
      ) : null}

      <SliderWithInput
        label={isEM ? 'Propagation wavelength' : 'Wavelength'}
        min={1}
        max={18}
        step={0.01}
        value={params.wavelength}
        onChange={(value) => onParamPatch({ wavelength: value })}
        syncToUrl={false}
      />
      <SliderWithInput
        label="Frequency"
        min={0.05}
        max={2}
        step={0.01}
        value={params.frequency}
        onChange={(value) => onParamPatch({ frequency: value })}
        syncToUrl={false}
      />
      <SliderWithInput
        label="Phase"
        min={-Math.PI}
        max={Math.PI}
        step={0.01}
        value={params.phase}
        onChange={(value) => onParamPatch({ phase: value })}
        syncToUrl={false}
      />

      {isEM && !isVolume ? (
        <>
          <div className="h-px bg-white/10" />
          <SliderWithInput
            label="Arrow spacing"
            min={0.5}
            max={2}
            step={0.05}
            value={params.arrowSpacing ?? 1.2}
            onChange={(value) => onParamPatch({ arrowSpacing: value })}
            syncToUrl={false}
          />
          <SliderWithInput
            label="Arrow scale"
            min={0.25}
            max={1.6}
            step={0.05}
            value={params.arrowScale ?? 0.9}
            onChange={(value) => onParamPatch({ arrowScale: value })}
            syncToUrl={false}
          />
          <label className="flex items-center justify-between rounded-md border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs text-slate-200">
            <span>Show field arrows</span>
            <input
              type="checkbox"
              checked={params.showFieldArrows ?? true}
              onChange={(event) => onParamPatch({ showFieldArrows: event.target.checked })}
            />
          </label>
        </>
      ) : !isEM ? (
        <>
          <div className="h-px bg-white/10" />
          <label className="flex items-center justify-between rounded-md border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs text-slate-200">
            <span>Show probe</span>
            <input
              type="checkbox"
              checked={showProbe}
              onChange={(event) => onShowProbeChange(event.target.checked)}
            />
          </label>
          <SliderWithInput
            label="Probe x"
            min={params.domainStart}
            max={params.domainEnd}
            step={0.01}
            value={probeX}
            onChange={onProbeXChange}
            syncToUrl={false}
          />
        </>
      ) : (
        <>
          <div className="h-px bg-white/10" />
          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center justify-between rounded-md border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs text-slate-200">
              <span>Electric field</span>
              <input
                type="checkbox"
                checked={params.volumeShowElectric ?? true}
                onChange={(event) => onParamPatch({ volumeShowElectric: event.target.checked })}
              />
            </label>
            <label className="flex items-center justify-between rounded-md border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs text-slate-200">
              <span>Magnetic field</span>
              <input
                type="checkbox"
                checked={params.volumeShowMagnetic ?? true}
                onChange={(event) => onParamPatch({ volumeShowMagnetic: event.target.checked })}
              />
            </label>
          </div>
          <SliderWithInput
            label="X density"
            min={2}
            max={11}
            step={1}
            value={params.volumeXCount ?? 5}
            onChange={(value) => onParamPatch({ volumeXCount: Math.round(value) })}
            syncToUrl={false}
          />
          <SliderWithInput
            label="Y density"
            min={2}
            max={11}
            step={1}
            value={params.volumeYCount ?? 5}
            onChange={(value) => onParamPatch({ volumeYCount: Math.round(value) })}
            syncToUrl={false}
          />
          <SliderWithInput
            label="Z density"
            min={4}
            max={30}
            step={1}
            value={params.volumeZCount ?? 20}
            onChange={(value) => onParamPatch({ volumeZCount: Math.round(value) })}
            syncToUrl={false}
          />
          <SliderWithInput
            label="X span"
            min={4}
            max={20}
            step={0.5}
            value={params.volumeXSpan ?? 8}
            onChange={(value) => onParamPatch({ volumeXSpan: value })}
            syncToUrl={false}
          />
          <SliderWithInput
            label="Y span"
            min={4}
            max={20}
            step={0.5}
            value={params.volumeYSpan ?? 8}
            onChange={(value) => onParamPatch({ volumeYSpan: value })}
            syncToUrl={false}
          />
          <SliderWithInput
            label="Z span"
            min={20}
            max={80}
            step={1}
            value={params.volumeZSpan ?? 40}
            onChange={(value) => onParamPatch({ volumeZSpan: value })}
            syncToUrl={false}
          />
          <SliderWithInput
            label="Arrow scale"
            min={0.2}
            max={1.5}
            step={0.05}
            value={params.volumeArrowScale ?? 0.85}
            onChange={(value) => onParamPatch({ volumeArrowScale: value })}
            syncToUrl={false}
          />
          <label className="flex items-center justify-between rounded-md border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs text-slate-200">
            <span>Hide near-zero arrows</span>
            <input
              type="checkbox"
              checked={params.volumeSkipNearZero ?? true}
              onChange={(event) => onParamPatch({ volumeSkipNearZero: event.target.checked })}
            />
          </label>
          <SliderWithInput
            label="Min magnitude"
            min={0}
            max={0.4}
            step={0.01}
            value={params.volumeMinMagnitude ?? 0.08}
            onChange={(value) => onParamPatch({ volumeMinMagnitude: value })}
            syncToUrl={false}
          />
        </>
      )}

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">Presets</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => onApplyPreset(preset.mode, preset.values)}
              className="rounded-md border border-slate-700 bg-slate-800/60 px-2 py-1.5 text-[11px] font-semibold text-slate-200 transition hover:border-cyan-300/40 hover:text-cyan-100"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
