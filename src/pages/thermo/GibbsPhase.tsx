import { Link } from 'react-router-dom';
import { ConceptBox } from '../../components/system/ConceptBox';
import { SliderWithInput } from '../../components/system/SliderWithInput';
import { formatAuto, formatPressure, formatSI } from '../../utils/formatters';
import {
  fusionSlope,
  PHASE_COLORS,
  PHASE_LABELS,
  PHASES,
  SUBSTANCES,
  TRANSITION_LABELS,
} from '../../lib/thermo/gibbsPhase';
import { useGibbsPhase } from '../../hooks/thermo/useGibbsPhase';

const GT_CANVAS_W = 640;
const GT_CANVAS_H = 440;
const PT_CANVAS_W = 640;
const PT_CANVAS_H = 400;

const SLIDER_INPUT_CLASS =
  'w-16 rounded-md border border-white/10 bg-slate-950 px-2 py-1 text-right text-xs text-slate-100 outline-none focus:border-cyan-300';

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block h-0.5 w-4 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

export function GibbsPhase() {
  const {
    gtCanvasRef,
    ptCanvasRef,
    substance,
    setSubstanceId,
    diagram,
    T,
    setT,
    P,
    setP,
    readouts,
    boundaryInfo,
    tripleCheck,
  } = useGibbsPhase('water');

  const slope = fusionSlope(substance);
  const nearest = readouts.nearest;

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
              Gibbs Free Energy &amp; Phase Stability
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
              Each phase has G = H − TS, a straight line in temperature with slope −S. The stable
              phase is whichever line is lowest — and every phase boundary is just the point where
              two G-lines cross. Click a boundary on the P–T diagram to expose its
              Clausius–Clapeyron slope, then drag along it and watch dP/dT update. The same event
              is shown twice here: the crossing of two G-lines and the coexistence curve on the P–T
              plot.
            </p>
          </div>
        </header>

        <section className="grid items-start gap-5 lg:grid-cols-[1.55fr_0.85fr]">
          {/* Plots column */}
          <div className="space-y-5">
            {/* Hero: G vs T */}
            <div className="rounded-3xl border border-white/[0.08] bg-slate-900/55 p-5 shadow-2xl shadow-slate-950/40">
              <div className="mb-4 flex items-baseline justify-between">
                <h2 className="text-xl font-semibold text-white">
                  G vs T at {formatPressure(P)}
                </h2>
                <span className="text-xs text-slate-500">lowest line = stable phase</span>
              </div>
              <div className="overflow-hidden rounded-2xl border border-white/[0.07]">
                <canvas
                  ref={gtCanvasRef}
                  width={GT_CANVAS_W}
                  height={GT_CANVAS_H}
                  className="w-full cursor-ew-resize touch-none"
                  style={{ display: 'block' }}
                />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-[0.65rem] text-slate-500">
                {PHASES.map((phase) => (
                  <LegendSwatch
                    key={phase}
                    color={PHASE_COLORS[phase]}
                    label={`${PHASE_LABELS[phase]} · slope −S = −${formatSI(substance.phases[phase].S, 'J/(mol·K)', 4)}`}
                  />
                ))}
                <span className="ml-auto text-slate-600">drag horizontally to set T</span>
              </div>
            </div>

            {/* Companion: P–T phase diagram */}
            <div className="rounded-3xl border border-white/[0.08] bg-slate-900/55 p-5">
              <div className="mb-4 flex items-baseline justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">
                  P–T phase diagram
                </h2>
                <span className="text-xs text-slate-500">
                  click a boundary, triple point, or critical point
                </span>
              </div>
              <div className="overflow-hidden rounded-2xl border border-white/[0.07]">
                <canvas
                  ref={ptCanvasRef}
                  width={PT_CANVAS_W}
                  height={PT_CANVAS_H}
                  className="w-full cursor-crosshair touch-none"
                  style={{ display: 'block' }}
                />
              </div>
              <p className="mt-3 text-[0.65rem] text-slate-500">
                Drag the state point — the G-vs-T marker above stays in sync. Boundary slopes
                follow Clausius–Clapeyron dP/dT = ΔS/ΔV; this substance&apos;s fusion line has
                slope {formatSI(slope / 1e6, 'MPa/K', 3)}
                {substance.anomalous ? ' (negative — ice is less dense than the liquid).' : '.'}
              </p>
            </div>
          </div>

          {/* Readouts + controls */}
          <aside className="space-y-5">
            {/* Stable phase */}
            <div
              className="rounded-3xl border p-5"
              style={{
                borderColor: `${PHASE_COLORS[readouts.stable]}40`,
                backgroundColor: `${PHASE_COLORS[readouts.stable]}12`,
              }}
            >
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Stable phase of {substance.formula} at ({formatSI(T, 'K', 4)},{' '}
                {formatPressure(P)})
              </p>
              <p
                className="mt-2 text-3xl font-semibold"
                style={{ color: PHASE_COLORS[readouts.stable] }}
              >
                {PHASE_LABELS[readouts.stable]}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">
                {nearest
                  ? `${TRANSITION_LABELS[nearest.kind]} at ${formatSI(nearest.T, 'K', 4)} — ${formatSI(Math.abs(nearest.T - T), 'K', 3)} away at this pressure.`
                  : 'No phase boundary at this pressure within the plotted range.'}
              </p>
            </div>

            {/* Boundary analysis */}
            <div className="rounded-3xl border border-cyan-300/15 bg-cyan-300/[0.045] p-5">
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-100/85">
                Clausius–Clapeyron readout
              </h2>
              {boundaryInfo ? (
                <div className="mt-3 space-y-3 text-xs text-cyan-50/80">
                  <p className="leading-relaxed">
                    Selected boundary: {PHASE_LABELS[boundaryInfo.a]} ⇄ {PHASE_LABELS[boundaryInfo.b]}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-white/[0.08] bg-slate-950/45 p-3">
                      <div className="text-[0.62rem] uppercase tracking-[0.18em] text-slate-400">
                        dP/dT
                      </div>
                      <div className="mt-1 font-mono text-sm text-white">
                        {formatAuto(boundaryInfo.slope, 'Pa/K', 4)}
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/[0.08] bg-slate-950/45 p-3">
                      <div className="text-[0.62rem] uppercase tracking-[0.18em] text-slate-400">
                        Latent heat L
                      </div>
                      <div className="mt-1 font-mono text-sm text-white">
                        {formatAuto(boundaryInfo.L, 'J/mol', 4)}
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/[0.08] bg-slate-950/45 p-3">
                      <div className="text-[0.62rem] uppercase tracking-[0.18em] text-slate-400">
                        ΔS
                      </div>
                      <div className="mt-1 font-mono text-sm text-white">
                        {formatSI(boundaryInfo.dS, 'J/(mol·K)', 4)}
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/[0.08] bg-slate-950/45 p-3">
                      <div className="text-[0.62rem] uppercase tracking-[0.18em] text-slate-400">
                        ΔV
                      </div>
                      <div className="mt-1 font-mono text-sm text-white">
                        {formatAuto(boundaryInfo.dV, 'm³/mol', 4)}
                      </div>
                    </div>
                  </div>
                  <p className="leading-relaxed text-cyan-100/70">
                    The selected point sits at {formatSI(boundaryInfo.T, 'K', 4)} and{' '}
                    {formatPressure(boundaryInfo.P)}. The slope comes from
                    dP/dT = ΔS/ΔV, so vaporization bends strongly because ΔV changes with gas
                    expansion, while fusion stays nearly straight because its ΔV is tiny.
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-xs leading-relaxed text-cyan-100/70">
                  Click any coexistence curve to see the local slope, latent heat, entropy jump,
                  and molar-volume jump. Drag along the curve to watch the numbers update.
                </p>
              )}
            </div>

            {/* G readouts */}
            <div className="rounded-3xl border border-white/[0.08] bg-slate-900/55 p-5">
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">
                G = H − TS at current (T, P)
              </h2>
              <div className="mt-3 space-y-2">
                {PHASES.map((phase) => (
                  <div
                    key={phase}
                    className={`flex items-center justify-between rounded-xl border px-3 py-2 text-xs ${
                      readouts.stable === phase
                        ? 'border-white/20 bg-slate-950/70'
                        : 'border-white/[0.05] bg-slate-950/40'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: PHASE_COLORS[phase] }}
                      />
                      {PHASE_LABELS[phase]}
                      {readouts.stable === phase && (
                        <span className="text-[0.6rem] uppercase tracking-wide text-slate-400">
                          · lowest
                        </span>
                      )}
                    </span>
                    <span className="font-mono text-slate-100">
                      {formatSI(readouts.G[phase] / 1e3, 'kJ/mol', 4)}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[0.65rem] leading-relaxed text-slate-500">
                Triple point: {formatSI(diagram.TTriple, 'K', 4)} at{' '}
                {formatPressure(diagram.PTriple)} · Critical point: {formatSI(substance.Tcrit, 'K', 4)}{' '}
                at {formatPressure(diagram.PCrit)}
                {tripleCheck
                  ? ` · L_sub ≈ L_fus + L_vap = ${formatAuto(tripleCheck.LSub, 'J/mol', 4)} = ${formatAuto(tripleCheck.LFus, 'J/mol', 4)} + ${formatAuto(tripleCheck.LVap, 'J/mol', 4)}`
                  : ''}
              </p>
            </div>

            {/* Controls */}
            <div className="rounded-3xl border border-white/[0.08] bg-slate-900/55 p-5">
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">
                Controls
              </h2>

              <div className="mt-3">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Substance
                </p>
                <div className="mt-2 flex gap-1 rounded-xl border border-white/[0.06] bg-slate-950/45 p-1">
                  {SUBSTANCES.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSubstanceId(s.id)}
                      className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition ${
                        substance.id === s.id
                          ? 'bg-cyan-300/20 text-cyan-100'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {s.name} ({s.formula})
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[0.62rem] leading-snug text-slate-500">
                  {substance.anomalous
                    ? 'Water’s solid is less dense than its liquid — the fusion boundary tilts backwards.'
                    : 'A “normal” substance: its triple point sits above 1 atm, so it sublimates at ambient pressure.'}
                </p>
              </div>

              <div className="mt-4 space-y-3 rounded-xl border border-white/[0.06] bg-slate-950/45 p-3">
                <SliderWithInput
                  label="Temperature"
                  min={substance.TMin}
                  max={substance.TMax}
                  step={1}
                  value={T}
                  onChange={setT}
                  units="K"
                  inputClassName={SLIDER_INPUT_CLASS}
                  syncToUrl={false}
                />
                <SliderWithInput
                  label={`Pressure · ${formatPressure(P)}`}
                  min={Math.log10(substance.PMin)}
                  max={Math.log10(substance.PMax)}
                  step={0.01}
                  value={Math.log10(P)}
                  onChange={(v) => setP(Math.pow(10, v))}
                  units="log₁₀ Pa"
                  inputClassName={SLIDER_INPUT_CLASS}
                  syncToUrl={false}
                />
              </div>
            </div>

            {/* Relations */}
            <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.045] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200/80">
                Phase-selection relations
              </p>
              <p className="mt-3 font-mono text-xs leading-relaxed text-cyan-100/70">
                G = H − TS (per phase, lowest wins)
                <br />
                dG/dT = −S ⇒ gas line steepest
                <br />
                G_gas(P) = H − TS° + RT·ln(P/P₀)
                <br />
                boundary: G_a = G_b ⇒ dP/dT = ΔS/ΔV
                <br />
                triple point: G_s = G_l = G_g simultaneously
                <br />
                critical point: L_vap → 0, liquid and gas merge
              </p>
            </div>
          </aside>
        </section>

        <ConceptBox
          className="mt-6"
          heading="What to notice"
          items={[
            {
              title: 'A transition is a G-crossing',
              description:
                'Drag T through the marked crossing: the two G-lines swap which is lowest at the exact moment the state point crosses the boundary on the P–T diagram. Both plots show the same event — that equality G_a = G_b is the definition of the boundary.',
            },
            {
              title: 'Entropy sets the slopes, so entropy picks the winner',
              description:
                'Each line falls at rate −S, and S_gas > S_liquid > S_solid. The gas line is steepest, so it always wins at high T; the flat solid line wins at low T; the liquid can only win in a window in between — and below the triple-point pressure that window closes entirely.',
            },
            {
              title: 'Pressure moves the gas line the most',
              description:
                'Raising P adds RT·ln(P/P₀) to the gas (a big shift) but only V·ΔP to the condensed phases (tiny). That pushes the boiling crossing to higher T — which is exactly the Clausius–Clapeyron slope of the vaporization curve.',
            },
            {
              title: 'Water’s backwards fusion line',
              description:
                'Ice is less dense than liquid water (ΔV < 0), so dP/dT = ΔS/ΔV is negative: squeeze ice and it melts. Switch to CO₂ and the fusion boundary tilts the normal way — and its triple point above 1 atm means dry ice sublimates instead of melting.',
            },
          ]}
        />
      </div>
    </div>
  );
}
