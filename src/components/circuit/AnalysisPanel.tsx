import type { CircuitEngine } from '../../hooks/circuit/useCircuitEngine';
import { withUnit } from '../../lib/circuit/format';

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-2.5">
      <p className="text-[0.6rem] uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-0.5 text-base font-semibold ${accent}`}>{value}</p>
    </div>
  );
}

export function AnalysisPanel({ engine }: { engine: CircuitEngine }) {
  const { result } = engine;
  const t = result.totals;
  const sources = engine.schematic.components.filter(
    (c) => c.kind === 'battery' || c.kind === 'acsource',
  );

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-sky-300">Real-time analysis</h3>
      {!result.ok && <p className="text-xs text-amber-300">{result.message}</p>}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat label="Total source current" value={withUnit(t.sourceCurrentMagnitude, 'A')} accent="text-emerald-300" />
        <Stat label="Source power" value={withUnit(t.sourcePower, 'W')} accent="text-amber-300" />
        <Stat label="Dissipated power" value={withUnit(t.dissipatedPower, 'W')} accent="text-orange-300" />
        <Stat
          label="Equivalent resistance"
          value={t.equivalentResistance != null ? withUnit(t.equivalentResistance, 'Ω') : '—'}
          accent="text-sky-300"
        />
        <Stat label="Capacitor energy" value={withUnit(t.capacitorEnergy, 'J')} accent="text-cyan-300" />
        <Stat label="Inductor energy" value={withUnit(t.inductorEnergy, 'J')} accent="text-violet-300" />
      </div>

      {sources.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
          <p className="mb-2 text-[0.65rem] uppercase tracking-wider text-slate-400">Sources</p>
          <div className="space-y-1.5">
            {sources.map((s) => {
              const r = result.components.get(s.id);
              return (
                <div key={s.id} className="flex items-center justify-between text-xs">
                  <span className="text-slate-300">{s.kind === 'battery' ? 'DC battery' : 'AC source'}</span>
                  <span className="text-slate-400">
                    V = {r ? withUnit(r.voltage, 'V') : '—'} · I = {r ? withUnit(r.current, 'A') : '—'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-[0.7rem] text-slate-400">
        <p className="font-medium text-slate-300">Energy conservation check</p>
        <p className="mt-1">
          P<sub>source</sub> = {withUnit(t.sourcePower, 'W')} ≈ P<sub>dissipated</sub> +
          dE<sub>stored</sub>/dt. Stored field energy ={' '}
          {withUnit(t.capacitorEnergy + t.inductorEnergy, 'J')}.
        </p>
      </div>
    </div>
  );
}
