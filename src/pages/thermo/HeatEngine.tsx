import { Link } from 'react-router-dom';
import { ConceptBox } from '../../components/system/ConceptBox';
import { SliderWithInput } from '../../components/system/SliderWithInput';
import { formatAuto, formatSI } from '../../utils/formatters';
import {
  ENGINE_PRESETS,
  MAX_LEGS,
  MIN_LEGS,
  PROCESS_COLORS,
  PROCESS_LABELS,
  PROCESS_TYPES,
  type EngineLeg,
  type ProcessType,
} from '../../lib/thermo/heatEngine';
import {
  T_MAX,
  T_MIN,
  V_MAX,
  V_MIN,
  useHeatEngine,
  type GasType,
} from '../../hooks/thermo/useHeatEngine';

const CANVAS_W = 640;
const CANVAS_H = 480;

const GAS_OPTIONS: { value: GasType; label: string }[] = [
  { value: 'monatomic', label: 'Monatomic · γ = 5/3' },
  { value: 'diatomic', label: 'Diatomic · γ = 7/5' },
];

const SLIDER_INPUT_CLASS =
  'w-16 rounded-md border border-white/10 bg-slate-950 px-2 py-1 text-right text-xs text-slate-100 outline-none focus:border-cyan-300';

const SHORT_PROCESS: Record<ProcessType, string> = {
  isochoric: 'Isochoric',
  isobaric: 'Isobaric',
  isothermal: 'Isothermal',
  adiabatic: 'Adiabatic',
};

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block h-0.5 w-4 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function SignedValue({ value }: { value: number }) {
  const tone = value > 1e-9 ? 'text-emerald-300' : value < -1e-9 ? 'text-rose-300' : 'text-slate-400';
  return <span className={`font-mono ${tone}`}>{formatAuto(value, 'J')}</span>;
}

function LegRow({ leg, index, count }: { leg: EngineLeg; index: number; count: number }) {
  return (
    <tr className="border-t border-white/[0.05]">
      <td className="py-2 pr-3 font-mono text-slate-400">
        {index + 1}→{((index + 1) % count) + 1}
      </td>
      <td className="py-2 pr-3">
        <span className="flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: PROCESS_COLORS[leg.type] }}
          />
          {SHORT_PROCESS[leg.type]}
        </span>
      </td>
      <td className="py-2 pr-3 text-right"><SignedValue value={leg.W} /></td>
      <td className="py-2 pr-3 text-right"><SignedValue value={leg.Q} /></td>
      <td className="py-2 text-right"><SignedValue value={leg.dU} /></td>
    </tr>
  );
}

function EfficiencyBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const width = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-slate-400">{label}</span>
        <span className="font-mono text-slate-100">{formatSI(value * 100, '%', 3)}</span>
      </div>
      <div className="mt-1 h-2 rounded-full bg-slate-800">
        <div className="h-2 rounded-full" style={{ width: `${width}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

export function HeatEngine() {
  const {
    canvasRef,
    isPlaying,
    togglePlay,
    resetDot,
    gasType,
    setGasType,
    config,
    cycle,
    presetId,
    loadPreset,
    setV1,
    setT1,
    setLegTarget,
    setLegType,
    addLeg,
    removeLeg,
  } = useHeatEngine('otto');

  const n = config.legs.length;
  const typesInUse = PROCESS_TYPES.filter((t) => config.legs.some((l) => l.type === t));
  // Scale both η bars against the Carnot ceiling so "real < ideal" reads at a glance
  const barMax = cycle.ok ? Math.max(cycle.etaCarnot, cycle.eta ?? 0) : 1;

  return (
    <div className="min-h-screen bg-[#020617] px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-sky-500 hover:text-sky-100"
          >
            ← Dashboard
          </Link>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.32em] text-cyan-300/70">
            Thermodynamics Lab
          </p>
          <div className="mt-3">
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Heat Engine Builder
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
              Build real engine cycles: Otto, Diesel, Stirling, Brayton — from ideal-gas process
              legs, then compare each engine&apos;s efficiency against the Carnot bound for the same
              temperature extremes. Drag the numbered state points or use the sliders to reshape
              the loop.
            </p>
          </div>
        </header>

        <section className="grid items-start gap-5 lg:grid-cols-[1.55fr_0.85fr]">
          {/* Hero P–V diagram + results column */}
          <div className="space-y-5">
            <div className="rounded-3xl border border-white/[0.08] bg-slate-900/55 p-5 shadow-2xl shadow-slate-950/40">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white">P–V Diagram</h2>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={resetDot}
                    className="rounded-full border border-slate-700 bg-slate-900 px-4 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-slate-400 hover:text-slate-100"
                  >
                    ↺ Restart at state 1
                  </button>
                  <button
                    type="button"
                    onClick={togglePlay}
                    className="rounded-full border border-slate-700 bg-slate-900 px-4 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-sky-500 hover:text-sky-100"
                  >
                    {isPlaying ? '⏸ Pause' : '▶ Play'}
                  </button>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-white/[0.07]">
                <canvas
                  ref={canvasRef}
                  width={CANVAS_W}
                  height={CANVAS_H}
                  className="w-full touch-none"
                  style={{ display: 'block' }}
                />
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-4 text-[0.65rem] text-slate-500">
                {typesInUse.map((t) => (
                  <LegendSwatch key={t} color={PROCESS_COLORS[t]} label={PROCESS_LABELS[t]} />
                ))}
                <span className="ml-auto text-slate-600">
                  shaded area = net work · drag numbered states
                </span>
              </div>

              {!cycle.ok && (
                <p className="mt-3 rounded-xl border border-rose-400/25 bg-rose-500/10 px-4 py-2 text-xs text-rose-200">
                  {cycle.error}
                </p>
              )}
            </div>

            {/* Per-leg energy accounting */}
            <div className="rounded-3xl border border-white/[0.08] bg-slate-900/55 p-5">
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">
                Per-leg energy accounting
              </h2>
              {cycle.ok ? (
                <>
                  <table className="mt-3 w-full text-xs">
                    <thead>
                      <tr className="text-[0.65rem] uppercase tracking-[0.14em] text-slate-500">
                        <th className="pb-2 pr-3 text-left font-semibold">Leg</th>
                        <th className="pb-2 pr-3 text-left font-semibold">Process</th>
                        <th className="pb-2 pr-3 text-right font-semibold">W by gas</th>
                        <th className="pb-2 pr-3 text-right font-semibold">Q in</th>
                        <th className="pb-2 text-right font-semibold">ΔU</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cycle.legs.map((leg, i) => (
                        <LegRow key={i} leg={leg} index={i} count={n} />
                      ))}
                      <tr className="border-t border-white/[0.12] font-semibold">
                        <td className="py-2 pr-3 text-slate-300" colSpan={2}>
                          Cycle totals
                        </td>
                        <td className="py-2 pr-3 text-right"><SignedValue value={cycle.Wnet} /></td>
                        <td className="py-2 pr-3 text-right">
                          <span className="font-mono text-slate-200">
                            {formatAuto(cycle.Qin - cycle.Qout, 'J')}
                          </span>
                        </td>
                        <td className="py-2 text-right"><SignedValue value={cycle.dUsum} /></td>
                      </tr>
                    </tbody>
                  </table>
                  <div className="mt-3 grid gap-2 text-xs text-slate-400 sm:grid-cols-3">
                    <p>
                      Q_in ={' '}
                      <span className="font-mono text-emerald-300">{formatAuto(cycle.Qin, 'J')}</span>
                    </p>
                    <p>
                      Q_out ={' '}
                      <span className="font-mono text-rose-300">{formatAuto(cycle.Qout, 'J')}</span>
                    </p>
                    <p>
                      ΣΔU ={' '}
                      <span className="font-mono text-slate-200">{formatAuto(cycle.dUsum, 'J')}</span>{' '}
                      (≈ 0 around a loop)
                    </p>
                  </div>
                </>
              ) : (
                <p className="mt-3 text-xs text-slate-500">Close the loop to see the accounting.</p>
              )}
            </div>

            {/* Efficiency vs the Carnot bound — the Lecture 7 payoff */}
            <div className="rounded-3xl border border-cyan-300/15 bg-cyan-300/[0.045] p-5">
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200/80">
                Efficiency vs the Carnot bound
              </h2>
              {cycle.ok ? (
                <>
                  <div className="mt-4 space-y-3">
                    <EfficiencyBar
                      label="η = W_net / Q_in (this cycle)"
                      value={cycle.eta ?? 0}
                      max={barMax}
                      color="#34d399"
                    />
                    <EfficiencyBar
                      label={`η_Carnot = 1 − T_min/T_max (${formatSI(cycle.Tmin, 'K', 3)} … ${formatSI(cycle.Tmax, 'K', 3)})`}
                      value={cycle.etaCarnot}
                      max={barMax}
                      color="#22d3ee"
                    />
                  </div>
                  <p className="mt-4 text-xs leading-relaxed text-cyan-100/75">
                    {cycle.eta === null ? (
                      'W_net ≤ 0 — this loop runs counterclockwise (a refrigerator, not an engine). Reverse the traversal direction to get net work out.'
                    ) : (
                      <>
                        This cycle converts{' '}
                        <span className="font-mono text-emerald-300">
                          {formatSI(cycle.eta * 100, '%', 3)}
                        </span>{' '}
                        of its heat input into work — that&apos;s{' '}
                        <span className="font-mono text-cyan-200">
                          {formatSI((cycle.eta / cycle.etaCarnot) * 100, '%', 3)}
                        </span>{' '}
                        of the Carnot ceiling for the same temperature extremes. No cycle operating
                        between {formatSI(cycle.Tmin, 'K', 3)} and {formatSI(cycle.Tmax, 'K', 3)} can
                        beat {formatSI(cycle.etaCarnot * 100, '%', 3)}.
                      </>
                    )}
                  </p>
                </>
              ) : (
                <p className="mt-3 text-xs text-cyan-100/60">Close the loop to compare efficiencies.</p>
              )}
            </div>
          </div>

          {/* Controls */}
          <aside className="space-y-5">
            <div className="rounded-3xl border border-white/[0.08] bg-slate-900/55 p-5">
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">
                Cycle presets
              </h2>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {ENGINE_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => loadPreset(p.id)}
                    className={`rounded-xl border px-3 py-2 text-left transition ${
                      presetId === p.id
                        ? 'border-cyan-300/40 bg-cyan-300/10'
                        : 'border-white/[0.06] bg-slate-950/45 hover:border-slate-500'
                    }`}
                  >
                    <span className="block text-xs font-semibold text-slate-100">{p.name}</span>
                    <span className="mt-0.5 block text-[0.62rem] leading-snug text-slate-500">
                      {p.blurb}
                    </span>
                  </button>
                ))}
              </div>

              {/* Gas type segmented control — reshapes every adiabat and Q live */}
              <div className="mt-4">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Gas type
                </p>
                <div className="mt-2 flex gap-1 rounded-xl border border-white/[0.06] bg-slate-950/45 p-1">
                  {GAS_OPTIONS.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setGasType(value)}
                      className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition ${
                        gasType === value
                          ? 'bg-cyan-300/20 text-cyan-100'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* State 1 */}
              <div className="mt-4 space-y-3 rounded-xl border border-white/[0.06] bg-slate-950/45 p-3">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  State 1
                </p>
                <SliderWithInput
                  label="V₁"
                  min={V_MIN * 1e3}
                  max={V_MAX * 1e3}
                  step={0.1}
                  value={config.V1 * 1e3}
                  onChange={(v) => setV1(v / 1e3)}
                  units="L"
                  inputClassName={SLIDER_INPUT_CLASS}
                  syncToUrl={false}
                />
                <SliderWithInput
                  label="T₁"
                  min={T_MIN}
                  max={T_MAX}
                  step={10}
                  value={config.T1}
                  onChange={setT1}
                  units="K"
                  inputClassName={SLIDER_INPUT_CLASS}
                  syncToUrl={false}
                />
              </div>
            </div>

            {/* Leg editor */}
            <div className="rounded-3xl border border-white/[0.08] bg-slate-900/55 p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">
                  Process legs
                </h2>
                <button
                  type="button"
                  onClick={addLeg}
                  disabled={n >= MAX_LEGS}
                  className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:border-emerald-400 hover:text-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  + Add leg
                </button>
              </div>

              <div className="mt-3 space-y-3">
                {config.legs.map((leg, i) => {
                  const prevType = config.legs[(i - 1 + n) % n].type;
                  const nextType = config.legs[(i + 1) % n].type;
                  const hasTarget = i <= n - 3;
                  const isIsochoric = leg.type === 'isochoric';
                  return (
                    <div
                      key={i}
                      className="rounded-xl border border-white/[0.06] bg-slate-950/45 p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                          <span
                            className="inline-block h-2 w-2 rounded-full"
                            style={{ backgroundColor: PROCESS_COLORS[leg.type] }}
                          />
                          Leg {i + 1}: state {i + 1} → {((i + 1) % n) + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeLeg(i)}
                          disabled={n <= MIN_LEGS}
                          className="rounded-full px-2 text-xs text-slate-500 transition hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-30"
                          aria-label={`Remove leg ${i + 1}`}
                        >
                          ✕
                        </button>
                      </div>
                      <select
                        value={leg.type}
                        onChange={(e) => setLegType(i, e.target.value as ProcessType)}
                        className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-cyan-300"
                      >
                        {PROCESS_TYPES.map((t) => (
                          <option key={t} value={t} disabled={t === prevType || t === nextType}>
                            {PROCESS_LABELS[t]}
                            {t === prevType || t === nextType ? ' — used by a neighbor' : ''}
                          </option>
                        ))}
                      </select>
                      {hasTarget ? (
                        <div className="mt-2">
                          {isIsochoric ? (
                            <SliderWithInput
                              label={`End T (state ${((i + 1) % n) + 1})`}
                              min={T_MIN}
                              max={T_MAX}
                              step={10}
                              value={leg.target ?? config.T1}
                              onChange={(v) => setLegTarget(i, v)}
                              units="K"
                              inputClassName={SLIDER_INPUT_CLASS}
                              syncToUrl={false}
                            />
                          ) : (
                            <SliderWithInput
                              label={`End V (state ${((i + 1) % n) + 1})`}
                              min={V_MIN * 1e3}
                              max={V_MAX * 1e3}
                              step={0.1}
                              value={(leg.target ?? config.V1) * 1e3}
                              onChange={(v) => setLegTarget(i, v / 1e3)}
                              units="L"
                              inputClassName={SLIDER_INPUT_CLASS}
                              syncToUrl={false}
                            />
                          )}
                        </div>
                      ) : (
                        <p className="mt-2 text-[0.65rem] leading-snug text-slate-500">
                          {i === n - 2
                            ? `End state auto-solved so leg ${n} can close the loop.`
                            : 'Closes the loop back to state 1.'}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Process relations */}
            <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.045] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200/80">
                Per-process relations (n = 1 mol, f = {Math.round(cycle.f)})
              </p>
              <p className="mt-3 font-mono text-xs leading-relaxed text-cyan-100/70">
                isochoric: W = 0, Q = ΔU = (f/2)R·ΔT
                <br />
                isobaric: W = P·ΔV, Q = (f/2 + 1)R·ΔT
                <br />
                isothermal: ΔU = 0, W = Q = RT·ln(V₂/V₁)
                <br />
                adiabatic: Q = 0, W = −ΔU, PV^γ const
              </p>
            </div>
          </aside>
        </section>

        <ConceptBox
          className="mt-6"
          heading="What to notice"
          items={[
            {
              title: 'Every real cycle falls short of Carnot',
              description:
                'Load Otto, note its η, then check the Carnot bar for the same T_min…T_max. Heat added while the gas temperature is below T_max (isochoric or isobaric legs) is used less efficiently than heat added isothermally at the top — only the Carnot preset closes the gap to 100% of the bound.',
            },
            {
              title: 'The enclosed area is the net work',
              description:
                'W_net = ∮P dV, the shaded loop area. Raise the compression ratio or peak temperature and watch the loop fatten together with W_net in the totals row. ΣΔU stays ≈ 0 — internal energy is a state function.',
            },
            {
              title: 'Q_in counts only the heat-absorbing legs',
              description:
                'Efficiency is W_net divided by the heat you paid for: η = W_net / ΣQ(>0). That is why Stirling (without a regenerator) sits below Carnot even though both operate between the same two isotherms — its isochoric reheat leg costs extra Q_in.',
            },
            {
              title: 'γ reshapes the adiabats live',
              description:
                'Toggle monatomic → diatomic: adiabats follow P ∝ 1/V^γ, so the smaller γ of a diatomic gas flattens them toward the isotherms. Otto efficiency η = 1 − r^(1−γ) drops accordingly — same hardware, different working gas.',
            },
          ]}
        />
      </div>
    </div>
  );
}
