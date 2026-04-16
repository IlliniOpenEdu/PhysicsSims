import { SliderWithInput } from '../SliderWithInput';
import type { ColliderControls, ParticleType } from '../../lib/collider/types';

type ControlPanelProps = {
  controls: ColliderControls;
  onChange: <K extends keyof ColliderControls>(key: K, value: ColliderControls[K]) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onReset: () => void;
};

export function ControlPanel({ controls, onChange, isPlaying, onTogglePlay, onReset }: ControlPanelProps) {
  return (
    <div className="space-y-4 rounded-2xl border border-slate-700/70 bg-slate-900/80 p-4 backdrop-blur-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">Controls</p>

      <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-700/70 bg-slate-950/70 p-2 text-[0.68rem] uppercase tracking-[0.1em] text-slate-300">
        <div className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-2 py-1.5 text-cyan-100">
          Energy {Math.round(controls.beamEnergy)}
        </div>
        <div className="rounded-lg border border-blue-400/30 bg-blue-500/10 px-2 py-1.5 text-blue-100">
          Field {controls.magneticField.toFixed(1)}T
        </div>
      </div>

      <SliderWithInput
        label="Beam Energy"
        min={5}
        max={100}
        step={1}
        value={controls.beamEnergy}
        onChange={(value) => onChange('beamEnergy', value)}
        units="GeV"
        description="Raises packet speed, glow, and collision intensity."
        syncToUrl={false}
      />

      <SliderWithInput
        label="Magnetic Field"
        min={1}
        max={10}
        step={0.1}
        value={controls.magneticField}
        onChange={(value) => onChange('magneticField', value)}
        units="T"
        description="Stronger field improves confinement and magnet activity."
        syncToUrl={false}
      />

      <div className="space-y-2">
        <label className="text-xs font-medium text-slate-300">Particle Type</label>
        <select
          value={controls.particleType}
          onChange={(e) => onChange('particleType', e.target.value as ParticleType)}
          className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100"
        >
          <option value="proton">Proton</option>
          <option value="electron">Electron</option>
          <option value="ion">Ion</option>
        </select>
      </div>

      <SliderWithInput
        label="Number of Bunches"
        min={2}
        max={24}
        step={1}
        value={controls.bunchCount}
        onChange={(value) => onChange('bunchCount', Math.round(value))}
        description="Packets per beam direction (performance-safe range)."
        syncToUrl={false}
      />

      <SliderWithInput
        label="Detector Sensitivity"
        min={0}
        max={1}
        step={0.01}
        value={controls.detectorSensitivity}
        onChange={(value) => onChange('detectorSensitivity', value)}
        description="Higher sensitivity reveals richer collision tracks."
        syncToUrl={false}
      />

      <SliderWithInput
        label="Tunnel Glow"
        min={0}
        max={1}
        step={0.01}
        value={controls.tunnelGlow}
        onChange={(value) => onChange('tunnelGlow', value)}
        description="Visual intensity for tunnel reflections and ambient glow."
        syncToUrl={false}
      />

      <button
        onClick={() => onChange('collisionsEnabled', !controls.collisionsEnabled)}
        className={`w-full rounded-lg border px-3 py-2 text-sm font-semibold transition ${
          controls.collisionsEnabled
            ? 'border-emerald-300/70 bg-emerald-400/20 text-emerald-100 shadow-[0_0_18px_rgba(16,185,129,0.25)]'
            : 'border-slate-600 bg-slate-800 text-slate-200'
        }`}
      >
        Collisions: {controls.collisionsEnabled ? 'Enabled' : 'Disabled'}
      </button>

      <p className={`text-xs ${controls.collisionsEnabled ? 'text-emerald-300' : 'text-slate-400'}`}>
        {controls.collisionsEnabled
          ? 'Detector triggers are live. Impact events appear only during bunch overlap.'
          : 'Collision engine paused. Beams keep circulating without impact events.'}
      </p>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={onTogglePlay}
          className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
            isPlaying ? 'bg-rose-600 text-white hover:bg-rose-500' : 'bg-emerald-600 text-white hover:bg-emerald-500'
          }`}
        >
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <button
          onClick={onReset}
          className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-700"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
