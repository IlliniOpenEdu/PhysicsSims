import { Link } from 'react-router-dom';
import { ConceptBox } from '../../components/system/ConceptBox';
import { SliderWithInput } from '../../components/system/SliderWithInput';
import { formatSI } from '../../utils/formatters';
import {
  type GasType,
  GAMMA_BY_GAS,
  RATIO_MAX,
  RATIO_MIN,
  T_COLD_MAX,
  T_COLD_MIN,
  T_HOT_MAX,
  T_HOT_MIN,
  useCarnotCycle,
} from '../../hooks/thermo/useCarnotCycle';

const CANVAS_W = 460;
const CANVAS_H = 420;

const GAS_OPTIONS: { value: GasType; label: string }[] = [
  { value: 'monatomic', label: 'Monatomic · γ = 5/3' },
  { value: 'diatomic', label: 'Diatomic · γ = 7/5' },
];

function ReadoutCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-slate-950/55 p-4">
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">{detail}</p>
    </div>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block h-0.5 w-4 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

export function CarnotCycle() {
  const {
    pvCanvasRef,
    tsCanvasRef,
    isPlaying,
    togglePlay,
    resetDot,
    Th,
    setTh,
    Tc,
    setTc,
    ratio,
    setRatio,
    gasType,
    setGasType,
    cycle,
  } = useCarnotCycle(600, 300, 3, 'monatomic');

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
              Carnot Cycle
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
              One mole of ideal gas traces the four reversible legs of a Carnot engine. Watch the
              same cycle on paired P–V and T–S diagrams — the moving points are phase-locked, so
              every corner on one plot lines up with its twin on the other.
            </p>
          </div>
        </header>

        <section className="grid items-start gap-5 lg:grid-cols-[1.55fr_0.85fr]">
          {/* Diagrams + readouts column */}
          <div className="space-y-5">
            <div className="rounded-3xl border border-white/[0.08] bg-slate-900/55 p-5 shadow-2xl shadow-slate-950/40">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white">Cycle Diagrams</h2>
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

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="mb-2 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    P–V diagram
                  </p>
                  <div className="overflow-hidden rounded-2xl border border-white/[0.07]">
                    <canvas
                      ref={pvCanvasRef}
                      width={CANVAS_W}
                      height={CANVAS_H}
                      className="w-full"
                      style={{ display: 'block' }}
                    />
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    T–S diagram
                  </p>
                  <div className="overflow-hidden rounded-2xl border border-white/[0.07]">
                    <canvas
                      ref={tsCanvasRef}
                      width={CANVAS_W}
                      height={CANVAS_H}
                      className="w-full"
                      style={{ display: 'block' }}
                    />
                  </div>
                </div>
              </div>

              {/* Leg color legend */}
              <div className="mt-3 flex flex-wrap items-center gap-4 text-[0.65rem] text-slate-500">
                <LegendSwatch color="#f87171" label="isothermal at T_hot (1→2)" />
                <LegendSwatch color="#c084fc" label="adiabatic (2→3, 4→1)" />
                <LegendSwatch color="#38bdf8" label="isothermal at T_cold (3→4)" />
                <span className="ml-auto text-slate-600">shaded area = net work per cycle</span>
              </div>
            </div>

            {/* Readout cards */}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <ReadoutCard
                label="Efficiency  η = 1 − T_c/T_h"
                value={formatSI(cycle.eta * 100, '%', 3)}
                detail="Depends only on the reservoir temperatures — no engine can beat it."
              />
              <ReadoutCard
                label="Heat absorbed  Q_h"
                value={formatSI(cycle.Qh, 'J')}
                detail="Taken in from the hot reservoir during isothermal expansion (1→2)."
              />
              <ReadoutCard
                label="Heat rejected  Q_c"
                value={formatSI(cycle.Qc, 'J')}
                detail="Dumped to the cold reservoir during isothermal compression (3→4)."
              />
              <ReadoutCard
                label="Net work  W = Q_h − Q_c"
                value={formatSI(cycle.Wnet, 'J')}
                detail="Work output per cycle — the area enclosed by both loops."
              />
              <ReadoutCard
                label="Entropy width  ΔS"
                value={formatSI(cycle.dS, 'J/K')}
                detail="ΔS = Q_h/T_h = Q_c/T_c. The T–S loop is a rectangle of this width."
              />
              <ReadoutCard
                label="Area check"
                value={`${formatSI(cycle.areaPV, 'J')} / ${formatSI(cycle.areaTS, 'J')}`}
                detail="Enclosed P–V area / enclosed T–S area — both should match W above."
              />
            </div>
          </div>

          {/* Controls */}
          <aside className="space-y-5">
            <div className="rounded-3xl border border-white/[0.08] bg-slate-900/55 p-5">
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">
                Controls
              </h2>

              <div className="mt-4 space-y-3 rounded-xl border border-white/[0.06] bg-slate-950/45 p-3">
                <SliderWithInput
                  label="T hot"
                  min={T_HOT_MIN}
                  max={T_HOT_MAX}
                  step={10}
                  value={Th}
                  onChange={setTh}
                  units="K"
                  inputClassName="w-16 rounded-md border border-white/10 bg-slate-950 px-2 py-1 text-right text-xs text-slate-100 outline-none focus:border-cyan-300"
                  queryKey="th"
                  syncToUrl={true}
                />
                <SliderWithInput
                  label="T cold"
                  min={T_COLD_MIN}
                  max={T_COLD_MAX}
                  step={10}
                  value={Tc}
                  onChange={setTc}
                  units="K"
                  description="Clamped below T hot — a Carnot engine needs two distinct reservoirs."
                  inputClassName="w-16 rounded-md border border-white/10 bg-slate-950 px-2 py-1 text-right text-xs text-slate-100 outline-none focus:border-cyan-300"
                  queryKey="tc"
                  syncToUrl={true}
                />
                <SliderWithInput
                  label="Compression ratio V₂/V₁"
                  min={RATIO_MIN}
                  max={RATIO_MAX}
                  step={0.1}
                  value={ratio}
                  onChange={setRatio}
                  inputClassName="w-16 rounded-md border border-white/10 bg-slate-950 px-2 py-1 text-right text-xs text-slate-100 outline-none focus:border-cyan-300"
                  queryKey="r"
                  syncToUrl={true}
                />
              </div>

              {/* Gas type segmented control */}
              <div className="mt-3">
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
            </div>

            {/* Equation box */}
            <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.045] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200/80">
                Carnot relations (n = 1 mol)
              </p>
              <p className="mt-3 font-mono text-sm text-cyan-50">η = 1 − T_c/T_h</p>
              <p className="mt-2 font-mono text-xs leading-relaxed text-cyan-100/70">
                {`Q_h = nRT_h·ln(V₂/V₁) = ${formatSI(cycle.Qh, 'J')}`}
                <br />
                {`Q_c = nRT_c·ln(V₃/V₄) = ${formatSI(cycle.Qc, 'J')}`}
                <br />
                {`ΔS  = nR·ln(V₂/V₁)   = ${formatSI(cycle.dS, 'J/K')}`}
                <br />
                {`γ   = ${GAMMA_BY_GAS[gasType] === 5 / 3 ? '5/3' : '7/5'},  η = ${formatSI(cycle.eta * 100, '%', 3)}`}
              </p>
            </div>
          </aside>
        </section>

        <ConceptBox
          className="mt-6"
          heading="What to notice"
          items={[
            {
              title: 'Enclosed area is the net work',
              description:
                'On the P–V diagram, W = ∮P dV; on the T–S diagram, W = ∮T dS (since Q_net = W for a cycle). Both shaded areas equal Q_h − Q_c — check them against the readout.',
            },
            {
              title: 'The T–S loop is a rectangle',
              description:
                'Isothermal legs are horizontal (constant T) and reversible adiabatic legs are vertical (constant S, since ΔS = Q/T = 0). Width ΔS times height T_h − T_c gives the work directly.',
            },
            {
              title: 'Efficiency depends only on temperatures',
              description:
                'Change the compression ratio or γ and η stays put — only Q_h, Q_c, and W scale. Widen the temperature gap and η climbs toward (but never reaches) 1.',
            },
            {
              title: 'Adiabats are steeper than isotherms',
              description:
                'Isotherms follow P ∝ 1/V while adiabats follow P ∝ 1/V^γ with γ > 1. Toggle monatomic vs diatomic: the smaller γ of a diatomic gas makes its adiabats hug the isotherms more closely.',
            },
          ]}
        />
      </div>
    </div>
  );
}
