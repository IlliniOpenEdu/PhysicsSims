import { useMemo, useState } from 'react';
import type { CircuitEngine } from '../../hooks/circuit/useCircuitEngine';
import { frequencySweep } from '../../lib/circuit/acSolver';
import { withUnit } from '../../lib/circuit/format';

const W = 720;
const H = 220;
const PAD = 40;

type Metric = 'impedance' | 'current';

export function FrequencyAnalysis({ engine }: { engine: CircuitEngine }) {
  const [fMin, setFMin] = useState(1);
  const [fMax, setFMax] = useState(100000);
  const [metric, setMetric] = useState<Metric>('current');

  const hasAc = engine.schematic.components.some((c) => c.kind === 'acsource');

  const sweep = useMemo(
    () => frequencySweep(engine.schematic, fMin, fMax, 180),
    [engine.schematic, fMin, fMax],
  );

  const plot = useMemo(() => {
    const points = sweep.points.filter((p) => Number.isFinite(p.impedance) && Number.isFinite(p.currentMag));
    if (points.length < 2) return null;
    const logFMin = Math.log10(Math.max(fMin, 1e-3));
    const logFMax = Math.log10(Math.max(fMax, fMin * 1.001));
    const values = points.map((p) => (metric === 'impedance' ? p.impedance : p.currentMag));
    let yMin = Math.min(...values);
    let yMax = Math.max(...values);
    if (yMin === yMax) {
      yMin = yMin * 0.9 - 1e-9;
      yMax = yMax * 1.1 + 1e-9;
    }
    const mapX = (f: number) => PAD + ((Math.log10(f) - logFMin) / (logFMax - logFMin)) * (W - PAD * 2);
    const mapY = (v: number) => H - PAD - ((v - yMin) / Math.max(yMax - yMin, 1e-12)) * (H - PAD * 2);
    const path = points.map((p) => `${mapX(p.freq).toFixed(1)},${mapY(metric === 'impedance' ? p.impedance : p.currentMag).toFixed(1)}`).join(' ');
    return { path, mapX, yMin, yMax };
  }, [sweep, metric, fMin, fMax]);

  if (!hasAc) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-400">
        Add an AC source to run a frequency sweep and find resonance peaks.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-sky-300">Frequency analysis (AC sweep)</h3>
        <div className="flex gap-1">
          {(['current', 'impedance'] as Metric[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMetric(m)}
              className={`rounded-md border px-2 py-1 text-xs transition ${metric === m ? 'border-sky-400 bg-sky-500/20 text-sky-100' : 'border-slate-700 bg-slate-900 text-slate-300'}`}
            >
              {m === 'current' ? '|I| response' : '|Z| response'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-slate-300">
        <label className="flex items-center gap-2">
          f<sub>min</sub>
          <input
            type="number"
            value={fMin}
            min={0.1}
            onChange={(e) => setFMin(Math.max(0.1, Number(e.target.value) || 0.1))}
            className="w-24 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-right outline-none focus:border-sky-400"
          />
          Hz
        </label>
        <label className="flex items-center gap-2">
          f<sub>max</sub>
          <input
            type="number"
            value={fMax}
            onChange={(e) => setFMax(Math.max(fMin * 2, Number(e.target.value) || fMin * 2))}
            className="w-28 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-right outline-none focus:border-sky-400"
          />
          Hz
        </label>
        {sweep.resonanceFreq != null && (
          <span className="rounded-md border border-amber-700/60 bg-amber-900/30 px-2 py-1 text-amber-200">
            Resonance ≈ {withUnit(sweep.resonanceFreq, 'Hz')}
          </span>
        )}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-xl border border-slate-800 bg-slate-950">
        {Array.from({ length: 6 }, (_, i) => {
          const x = PAD + (i * (W - PAD * 2)) / 5;
          return <line key={`fx${i}`} x1={x} y1={PAD} x2={x} y2={H - PAD} stroke="rgba(148,163,184,0.08)" />;
        })}
        {plot && sweep.resonanceFreq != null && (
          <line
            x1={plot.mapX(sweep.resonanceFreq)}
            y1={PAD}
            x2={plot.mapX(sweep.resonanceFreq)}
            y2={H - PAD}
            stroke="rgba(251,191,36,0.6)"
            strokeDasharray="4 3"
          />
        )}
        {plot && <polyline points={plot.path} fill="none" stroke="#38bdf8" strokeWidth={2} />}
        <text x={PAD} y={16} fontSize={10} fill="#94a3b8">
          {plot ? withUnit(plot.yMax, metric === 'impedance' ? 'Ω' : 'A') : ''}
        </text>
        <text x={W - PAD - 60} y={H - 10} fontSize={10} fill="#94a3b8">
          freq (log)
        </text>
      </svg>
    </div>
  );
}
