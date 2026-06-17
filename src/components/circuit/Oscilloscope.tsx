import { useMemo } from 'react';
import type { CircuitEngine } from '../../hooks/circuit/useCircuitEngine';
import { COMPONENT_LABELS } from '../../lib/circuit/types';
import { withUnit } from '../../lib/circuit/format';

const W = 720;
const H = 240;
const PAD = 34;

const UNIT: Record<string, string> = { voltage: 'V', current: 'A', power: 'W', energy: 'J' };

export function Oscilloscope({ engine }: { engine: CircuitEngine }) {
  const { probes, traces, time } = engine;

  const view = useMemo(() => {
    let yMin = Infinity;
    let yMax = -Infinity;
    let tMax = time;
    let tMin = 0;
    const window = 6; // seconds visible
    tMin = Math.max(0, time - window);
    for (const p of probes) {
      const buf = traces.get(p.id);
      if (!buf) continue;
      for (const pt of buf) {
        if (pt.t < tMin) continue;
        if (pt.value < yMin) yMin = pt.value;
        if (pt.value > yMax) yMax = pt.value;
      }
    }
    if (!Number.isFinite(yMin)) {
      yMin = -1;
      yMax = 1;
    }
    if (yMin === yMax) {
      yMin -= 1;
      yMax += 1;
    }
    const pad = (yMax - yMin) * 0.12;
    yMin -= pad;
    yMax += pad;
    const span = Math.max(tMax - tMin, 1e-3);
    const ySpan = Math.max(yMax - yMin, 1e-9);
    const mapX = (t: number) => PAD + ((t - tMin) / span) * (W - PAD * 2);
    const mapY = (v: number) => H - PAD - ((v - yMin) / ySpan) * (H - PAD * 2);
    return { tMin, tMax, yMin, yMax, mapX, mapY };
  }, [probes, traces, time]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-sky-300">Oscilloscope</h3>
        <div className="flex flex-wrap gap-2">
          {probes.length === 0 && <span className="text-xs text-slate-500">Add traces from the inspector.</span>}
          {probes.map((p) => {
            const comp = engine.schematic.components.find((c) => c.id === p.componentId);
            return (
              <span key={p.id} className="inline-flex items-center gap-1.5 rounded-md border border-slate-800 bg-slate-900/70 px-2 py-0.5 text-[0.65rem] text-slate-300">
                <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
                {comp ? COMPONENT_LABELS[comp.kind] : '?'} · {p.signal}
                <button type="button" onClick={() => engine.removeProbe(p.id)} className="ml-1 text-slate-500 hover:text-rose-300">
                  ×
                </button>
              </span>
            );
          })}
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-xl border border-slate-800 bg-slate-950">
        {Array.from({ length: 7 }, (_, i) => {
          const x = PAD + (i * (W - PAD * 2)) / 6;
          return <line key={`gx${i}`} x1={x} y1={PAD} x2={x} y2={H - PAD} stroke="rgba(148,163,184,0.08)" />;
        })}
        {Array.from({ length: 5 }, (_, i) => {
          const y = PAD + (i * (H - PAD * 2)) / 4;
          return <line key={`gy${i}`} x1={PAD} y1={y} x2={W - PAD} y2={y} stroke="rgba(148,163,184,0.08)" />;
        })}
        {view.yMin <= 0 && view.yMax >= 0 && (
          <line x1={PAD} y1={view.mapY(0)} x2={W - PAD} y2={view.mapY(0)} stroke="rgba(148,163,184,0.35)" strokeDasharray="3 3" />
        )}

        {probes.map((p) => {
          const buf = traces.get(p.id);
          if (!buf || buf.length < 2) return null;
          const pts = buf
            .filter((pt) => pt.t >= view.tMin - 0.01)
            .map((pt) => `${view.mapX(pt.t).toFixed(1)},${view.mapY(pt.value).toFixed(1)}`)
            .join(' ');
          return <polyline key={p.id} points={pts} fill="none" stroke={p.color} strokeWidth={1.8} strokeLinejoin="round" />;
        })}

        <text x={PAD} y={16} fontSize={10} fill="#94a3b8">
          {withUnit(view.yMax, '')}
        </text>
        <text x={PAD} y={H - 8} fontSize={10} fill="#94a3b8">
          {withUnit(view.yMin, '')}
        </text>
        <text x={W - PAD - 70} y={H - 8} fontSize={10} fill="#94a3b8">
          t = {time.toFixed(3)} s
        </text>
      </svg>
      <p className="text-[0.62rem] text-slate-500">
        Y axis auto-scales; mixed-unit traces share the axis. Units:{' '}
        {probes.map((p) => UNIT[p.signal]).filter((v, i, a) => a.indexOf(v) === i).join(', ') || '—'}
      </p>
    </div>
  );
}
