import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ConceptBox } from '../../components/system/ConceptBox';
import { CircuitCanvas } from '../../components/circuit/CircuitCanvas';
import type { CanvasTool } from '../../components/circuit/CircuitCanvas';
import { Toolbox } from '../../components/circuit/Toolbox';
import { Inspector } from '../../components/circuit/Inspector';
import { Oscilloscope } from '../../components/circuit/Oscilloscope';
import { AnalysisPanel } from '../../components/circuit/AnalysisPanel';
import { FrequencyAnalysis } from '../../components/circuit/FrequencyAnalysis';
import { useCircuitEngine } from '../../hooks/circuit/useCircuitEngine';
import { PRESETS, emptySchematic } from '../../lib/circuit/presets';
import { deserializeSchematic, serializeSchematic } from '../../lib/circuit/serialize';

const STORAGE_KEY = 'ucb-saved-circuit';

export function UniversalCircuitBuilder() {
  const engine = useCircuitEngine(PRESETS[0].build());
  const [tool, setTool] = useState<CanvasTool>('select');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showVoltageColor, setShowVoltageColor] = useState(true);
  const [showCurrentFlow, setShowCurrentFlow] = useState(true);
  const [bottomTab, setBottomTab] = useState<'scope' | 'frequency'>('scope');
  const [presetId, setPresetId] = useState(PRESETS[0].id);
  const [notice, setNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const flash = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(null), 2200);
  };

  const applyPreset = (id: string) => {
    const preset = PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setPresetId(id);
    setSelectedId(null);
    setTool('select');
    engine.loadSchematic(preset.build());
    engine.setRunning(true);
  };

  const handleSave = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, serializeSchematic(engine.schematic));
      flash('Circuit saved to this browser.');
    } catch {
      flash('Could not save (storage blocked).');
    }
  };

  const handleLoad = () => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        flash('No saved circuit found.');
        return;
      }
      const parsed = deserializeSchematic(raw);
      if (parsed) {
        engine.loadSchematic(parsed);
        setSelectedId(null);
        flash('Saved circuit loaded.');
      } else flash('Saved data was invalid.');
    } catch {
      flash('Could not load circuit.');
    }
  };

  const handleExport = () => {
    const blob = new Blob([serializeSchematic(engine.schematic)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'circuit.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = deserializeSchematic(String(reader.result));
      if (parsed) {
        engine.loadSchematic(parsed);
        setSelectedId(null);
        flash('Circuit imported.');
      } else flash('Invalid circuit file.');
    };
    reader.readAsText(file);
  };

  const toggleBtn = (active: boolean) =>
    `rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
      active
        ? 'border-sky-400 bg-sky-500/15 text-sky-100'
        : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'
    }`;

  return (
    <div className="mx-auto flex min-h-screen max-w-[110rem] flex-col px-4 py-6 text-slate-100">
      {/* Header */}
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">
            Electricity &amp; Magnetism
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
            Universal Circuit Builder
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-300">
            Build arbitrary circuits and solve them in real time with Modified Nodal Analysis —
            Ohm&apos;s law, Kirchhoff&apos;s laws, transient RC/RL/RLC dynamics, and AC steady-state
            all obeyed exactly.
          </p>
        </div>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-emerald-500 hover:text-emerald-100"
        >
          <span>←</span> All simulations
        </Link>
      </header>

      {/* Control bar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={engine.toggleRunning} className={toggleBtn(engine.running)}>
          {engine.running ? '⏸ Pause' : '▶ Run'}
        </button>
        <button
          type="button"
          onClick={() => {
            engine.reset();
            engine.clearTraces();
          }}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-slate-500"
        >
          ↺ Reset
        </button>

        <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-2 py-1">
          <span className="text-[0.65rem] text-slate-400">Speed</span>
          <input
            type="range"
            min={-3}
            max={0.7}
            step={0.01}
            value={Math.log10(engine.timeScale)}
            onChange={(e) => engine.setTimeScale(10 ** Number(e.target.value))}
            className="h-1 w-28 cursor-pointer appearance-none rounded-full bg-slate-800 accent-sky-400 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-sky-400"
          />
          <span className="w-14 text-right text-[0.65rem] text-slate-300">
            {engine.timeScale >= 1 ? `${engine.timeScale.toFixed(2)}×` : `${engine.timeScale.toExponential(1)}×`}
          </span>
        </div>

        <button type="button" onClick={() => setShowVoltageColor((v) => !v)} className={toggleBtn(showVoltageColor)}>
          Voltage colors
        </button>
        <button type="button" onClick={() => setShowCurrentFlow((v) => !v)} className={toggleBtn(showCurrentFlow)}>
          Current flow
        </button>
        <button
          type="button"
          onClick={() => engine.setSettings({ wireResistance: !engine.schematic.settings.wireResistance })}
          className={toggleBtn(engine.schematic.settings.wireResistance)}
        >
          Wire resistance
        </button>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <select
            value={presetId}
            onChange={(e) => applyPreset(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-sky-400"
          >
            {PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => { engine.loadSchematic(emptySchematic()); setSelectedId(null); }} className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 hover:border-slate-500">
            Clear
          </button>
          <button type="button" onClick={handleSave} className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 hover:border-slate-500">
            Save
          </button>
          <button type="button" onClick={handleLoad} className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 hover:border-slate-500">
            Load
          </button>
          <button type="button" onClick={handleExport} className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 hover:border-slate-500">
            Export
          </button>
          <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 hover:border-slate-500">
            Import
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImport(file);
              e.target.value = '';
            }}
          />
        </div>
      </div>

      {notice && (
        <div className="mb-2 rounded-lg border border-sky-700/50 bg-sky-900/30 px-3 py-1.5 text-xs text-sky-100">
          {notice}
        </div>
      )}

      {/* Workspace */}
      <div className="grid gap-3 lg:grid-cols-[180px_minmax(0,1fr)_300px]">
        <aside className="rounded-2xl border border-slate-800 bg-slate-900/50">
          <Toolbox tool={tool} setTool={setTool} />
        </aside>

        <section className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
          <div className="aspect-[1200/760] w-full">
            <CircuitCanvas
              engine={engine}
              tool={tool}
              setTool={setTool}
              selectedId={selectedId}
              setSelectedId={setSelectedId}
              showVoltageColor={showVoltageColor}
              showCurrentFlow={showCurrentFlow}
            />
          </div>
          <div className="pointer-events-none absolute bottom-2 left-2 rounded-md bg-slate-900/80 px-2 py-1 text-[0.62rem] text-slate-400">
            Click two points to place · drag empty space to box-select (right-click deletes selection) · drag pins to wire · Shift/middle-drag to pan · scroll to zoom · R rotates · Del removes
          </div>
        </section>

        <aside className="rounded-2xl border border-slate-800 bg-slate-900/50">
          <Inspector engine={engine} selectedId={selectedId} />
        </aside>
      </div>

      {/* Bottom panels */}
      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
          <AnalysisPanel engine={engine} />
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
          <div className="mb-3 flex gap-2">
            <button type="button" onClick={() => setBottomTab('scope')} className={toggleBtn(bottomTab === 'scope')}>
              Oscilloscope
            </button>
            <button type="button" onClick={() => setBottomTab('frequency')} className={toggleBtn(bottomTab === 'frequency')}>
              Frequency sweep
            </button>
          </div>
          {bottomTab === 'scope' ? <Oscilloscope engine={engine} /> : <FrequencyAnalysis engine={engine} />}
        </div>
      </div>

      <div className="mt-4">
        <ConceptBox
          heading="How the solver works"
          items={[
            {
              title: 'Modified Nodal Analysis',
              description:
                'Every node gets a Kirchhoff current-law equation and every ideal source adds a branch-current unknown. The resulting linear system is solved exactly each step, so KCL, KVL, and Ohm\u2019s law all hold simultaneously.',
            },
            {
              title: 'Companion models',
              description:
                'Capacitors (Q = CV) and inductors (V = L dI/dt) are integrated with the trapezoidal rule, letting RC, RL, and RLC transients evolve with the correct time constants τ = RC and τ = L/R.',
            },
            {
              title: 'AC steady state',
              description:
                'Switch to the frequency sweep to solve the same network with complex impedances: Xc = 1/(ωC), Xl = ωL, Z = √(R² + (Xl − Xc)²), revealing resonance peaks.',
            },
            {
              title: 'Conservation laws',
              description:
                'Power delivered by sources equals power dissipated in resistors plus the rate of change of energy stored in capacitor and inductor fields — charge and energy are conserved throughout.',
            },
          ]}
        />
      </div>
    </div>
  );
}
