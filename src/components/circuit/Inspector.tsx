import { useState } from 'react';
import type { CircuitComponent } from '../../lib/circuit/types';
import { COMPONENT_LABELS, LIMITS } from '../../lib/circuit/types';
import { parseEng, withUnit } from '../../lib/circuit/format';
import type { CircuitEngine, ProbeSignal } from '../../hooks/circuit/useCircuitEngine';

function LogField({
  label,
  value,
  min,
  max,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const safeValue = Math.min(max, Math.max(min, value || min));
  const logMin = Math.log10(min <= 0 ? 1e-12 : min);
  const logMax = Math.log10(max);
  const sliderPos = ((Math.log10(Math.max(safeValue, 1e-12)) - logMin) / (logMax - logMin)) * 1000;

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-slate-300">{label}</span>
        <span className="text-[0.7rem] text-slate-400">{withUnit(value, unit)}</span>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={0}
          max={1000}
          step={1}
          value={Number.isFinite(sliderPos) ? sliderPos : 0}
          onChange={(e) => {
            const pos = Number(e.target.value) / 1000;
            const next = 10 ** (logMin + pos * (logMax - logMin));
            onChange(Number(next.toPrecision(4)));
          }}
          className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-slate-800 accent-sky-400 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-sky-400"
        />
        <input
          type="text"
          value={draft ?? withUnit(value, unit)}
          onFocus={() => setDraft(String(value))}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            if (draft !== null) {
              const parsed = parseEng(draft.replace(unit, '').trim());
              if (parsed !== null) onChange(Math.min(max, Math.max(min, parsed)));
            }
            setDraft(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          className="w-24 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-right text-xs text-slate-100 outline-none focus:border-sky-400"
        />
      </div>
    </div>
  );
}

function Readout({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-2">
      <p className="text-[0.6rem] uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-0.5 text-sm font-semibold ${accent}`}>{value}</p>
    </div>
  );
}

const SIGNALS: { signal: ProbeSignal; label: string }[] = [
  { signal: 'voltage', label: 'V(t)' },
  { signal: 'current', label: 'I(t)' },
  { signal: 'power', label: 'P(t)' },
  { signal: 'energy', label: 'E(t)' },
];

export function Inspector({
  engine,
  selectedId,
}: {
  engine: CircuitEngine;
  selectedId: string | null;
}) {
  const comp = engine.schematic.components.find((c) => c.id === selectedId) ?? null;
  const res = selectedId ? engine.result.components.get(selectedId) : undefined;

  if (!comp) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-slate-500">
        <p className="text-2xl">⊕</p>
        <p>Select a component to inspect and edit it.</p>
        <p className="text-xs text-slate-600">
          Tip: press <kbd className="rounded bg-slate-800 px-1">R</kbd> to rotate,{' '}
          <kbd className="rounded bg-slate-800 px-1">Del</kbd> to remove.
        </p>
      </div>
    );
  }

  const update = (patch: Partial<CircuitComponent>) => engine.updateComponent(comp.id, patch);

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[0.6rem] uppercase tracking-[0.2em] text-sky-400">Inspector</p>
          <h3 className="text-sm font-semibold text-slate-100">{COMPONENT_LABELS[comp.kind]}</h3>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => engine.rotateComponent(comp.id, 90)}
            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 hover:border-sky-500"
          >
            Rotate
          </button>
          <button
            type="button"
            onClick={() => engine.removeComponent(comp.id)}
            className="rounded-md border border-rose-800 bg-rose-950/40 px-2 py-1 text-xs text-rose-200 hover:border-rose-500"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Parameters */}
      <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
        {comp.kind === 'battery' && (
          <>
            <LogField label="EMF" value={comp.voltage ?? 9} min={LIMITS.batteryVoltage.min} max={LIMITS.batteryVoltage.max} unit="V" onChange={(v) => update({ voltage: v })} />
            <LogField label="Internal resistance" value={comp.internalResistance ?? 0.001} min={0.001} max={LIMITS.internalResistance.max} unit="Ω" onChange={(v) => update({ internalResistance: v < 0.0011 ? 0 : v })} />
          </>
        )}
        {comp.kind === 'acsource' && (
          <>
            <LogField label="Peak voltage" value={comp.voltage ?? 5} min={LIMITS.acPeak.min} max={LIMITS.acPeak.max} unit="V" onChange={(v) => update({ voltage: v })} />
            <p className="text-[0.7rem] text-slate-400">RMS = {withUnit((comp.voltage ?? 0) / Math.SQRT2, 'V')}</p>
            <LogField label="Frequency" value={comp.frequency ?? 60} min={LIMITS.acFrequency.min} max={LIMITS.acFrequency.max} unit="Hz" onChange={(v) => update({ frequency: v })} />
            <div className="space-y-1">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-slate-300">Phase</span>
                <span className="text-[0.7rem] text-slate-400">{(((comp.phase ?? 0) * 180) / Math.PI).toFixed(0)}°</span>
              </div>
              <input
                type="range"
                min={-180}
                max={180}
                step={1}
                value={((comp.phase ?? 0) * 180) / Math.PI}
                onChange={(e) => update({ phase: (Number(e.target.value) * Math.PI) / 180 })}
                className="h-1 w-full cursor-pointer appearance-none rounded-full bg-slate-800 accent-sky-400 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-sky-400"
              />
            </div>
          </>
        )}
        {comp.kind === 'resistor' && (
          <LogField label="Resistance" value={comp.resistance ?? 100} min={LIMITS.resistance.min} max={LIMITS.resistance.max} unit="Ω" onChange={(v) => update({ resistance: v })} />
        )}
        {comp.kind === 'capacitor' && (
          <>
            <LogField label="Capacitance" value={comp.capacitance ?? 1e-5} min={LIMITS.capacitance.min} max={LIMITS.capacitance.max} unit="F" onChange={(v) => update({ capacitance: v })} />
            <LogField label="Initial voltage" value={Math.max(comp.initialVoltage ?? 0.0001, 0.0001)} min={0.0001} max={1000} unit="V" onChange={(v) => update({ initialVoltage: v < 0.00011 ? 0 : v })} />
          </>
        )}
        {comp.kind === 'inductor' && (
          <LogField label="Inductance" value={comp.inductance ?? 1e-2} min={LIMITS.inductance.min} max={LIMITS.inductance.max} unit="H" onChange={(v) => update({ inductance: v })} />
        )}
        {comp.kind === 'switch' && (
          <button
            type="button"
            onClick={() => update({ closed: !comp.closed })}
            className={`w-full rounded-lg border px-3 py-2 text-sm font-medium transition ${comp.closed ? 'border-emerald-500 bg-emerald-500/15 text-emerald-200' : 'border-slate-600 bg-slate-900 text-slate-300'}`}
          >
            Switch is {comp.closed ? 'CLOSED' : 'OPEN'} — click to toggle
          </button>
        )}
        {(comp.kind === 'ground' || comp.kind === 'voltmeter' || comp.kind === 'ammeter') && (
          <p className="text-xs text-slate-400">
            {comp.kind === 'ground'
              ? 'Reference node fixed at 0 V.'
              : comp.kind === 'voltmeter'
                ? 'Ideal voltmeter (infinite resistance).'
                : 'Ideal ammeter (zero resistance).'}
          </p>
        )}
      </div>

      {/* Live readouts */}
      <div className="grid grid-cols-2 gap-2">
        <Readout label="Voltage" value={res ? withUnit(res.voltage, 'V') : '—'} accent="text-cyan-300" />
        <Readout label="Current" value={res ? withUnit(res.current, 'A') : '—'} accent="text-emerald-300" />
        <Readout label="Power" value={res ? withUnit(res.power, 'W') : '—'} accent="text-amber-300" />
        <Readout label="Energy" value={res?.energy != null ? withUnit(res.energy, 'J') : '—'} accent="text-violet-300" />
      </div>

      {/* Scope probes */}
      {comp.kind !== 'ground' && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
          <p className="mb-2 text-[0.65rem] uppercase tracking-wider text-slate-400">Plot on oscilloscope</p>
          <div className="flex flex-wrap gap-1.5">
            {SIGNALS.map((s) => {
              const active = engine.probes.some((p) => p.componentId === comp.id && p.signal === s.signal);
              return (
                <button
                  key={s.signal}
                  type="button"
                  onClick={() => {
                    const existing = engine.probes.find((p) => p.componentId === comp.id && p.signal === s.signal);
                    if (existing) engine.removeProbe(existing.id);
                    else engine.addProbe(comp.id, s.signal);
                  }}
                  className={`rounded-md border px-2 py-1 text-xs transition ${active ? 'border-sky-400 bg-sky-500/20 text-sky-100' : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'}`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
