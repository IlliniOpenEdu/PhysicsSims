import { Link } from 'react-router-dom';
import { ConceptBox } from '../../components/ConceptBox';
import { SliderWithInput } from '../../components/SliderWithInput';
import { formatAuto, formatSI } from '../../utils/formatters';
import { clamp } from '../../utils/mathUtils';
import { useKineticTheory } from '../../hooks/thermo/useKineticTheory';

const BOX_W = 620;
const BOX_H = 540;
const HIST_W = 300;
const HIST_H = 480;

function ReadoutCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-slate-950/55 p-4">
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">{detail}</p>
    </div>
  );
}

export function KineticTheory() {
  const {
    boxCanvasRef,
    histCanvasRef,
    isPlaying,
    togglePlay,
    reseed,
    temperature,
    setTemperature,
    nParticles,
    setNParticles,
    massU,
    setMassU,
    readout,
  } = useKineticTheory(300, 200, 4);

  // Gauge: measured pressure relative to the ideal-gas prediction; ideal sits at the center tick
  const gaugeFrac =
    readout.pIdeal > 0 ? clamp((readout.pMeasured / readout.pIdeal) * 50, 0, 100) : 0;

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
              Kinetic Theory of Gases
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
              A 2D ideal gas, honestly simulated: elastic collisions redistribute energy into the
              Maxwell–Boltzmann distribution, and pressure emerges from individual wall impacts —
              nothing is computed from a formula behind your back.
            </p>
          </div>
        </header>

        <section className="grid items-start gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.7fr)_minmax(0,0.85fr)]">
          {/* Speed distribution — tall companion */}
          <div className="order-2 rounded-3xl border border-white/[0.08] bg-slate-900/55 p-5 shadow-2xl shadow-slate-950/40 lg:order-1">
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">
              Speed Distribution
            </h2>
            <div className="mt-4 overflow-hidden rounded-2xl border border-white/[0.07]">
              <canvas
                ref={histCanvasRef}
                width={HIST_W}
                height={HIST_H}
                className="w-full"
                style={{ display: 'block' }}
              />
            </div>
            <p className="mt-3 text-xs leading-relaxed text-slate-500">
              Live speed histogram, re-binned every frame. The thin line is the theoretical
              Maxwell–Boltzmann curve at the set temperature — watch the noisy bars hug it tighter
              as N grows.
            </p>
          </div>

          {/* Particle box — the hero */}
          <div className="order-1 rounded-3xl border border-white/[0.08] bg-slate-900/55 p-5 shadow-2xl shadow-slate-950/40 lg:order-2">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">Particle Box</h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={reseed}
                  className="rounded-full border border-slate-700 bg-slate-900 px-4 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-slate-400 hover:text-slate-100"
                >
                  ↺ Reseed
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
                ref={boxCanvasRef}
                width={BOX_W}
                height={BOX_H}
                className="w-full"
                style={{ display: 'block' }}
              />
            </div>

            {/* Speed color legend */}
            <div className="mt-3 flex items-center gap-3 text-[0.65rem] text-slate-500">
              <span>slow</span>
              <span
                className="h-1.5 flex-1 rounded-full"
                style={{
                  background:
                    'linear-gradient(to right, hsl(187,90%,55%), hsl(112,90%,59%), hsl(38,90%,63%))',
                }}
              />
              <span>fast</span>
              <span className="ml-3 text-slate-600">amber flashes = wall impacts</span>
            </div>

            {/* Controls — right under the action for tight feedback */}
            <div className="mt-4 space-y-3 rounded-xl border border-white/[0.06] bg-slate-950/45 p-3">
              <SliderWithInput
                label="Temperature"
                min={50}
                max={1500}
                step={10}
                value={temperature}
                onChange={setTemperature}
                units="K"
                inputClassName="w-16 rounded-md border border-white/10 bg-slate-950 px-2 py-1 text-right text-xs text-slate-100 outline-none focus:border-cyan-300"
                queryKey="t"
                syncToUrl={true}
              />
              <SliderWithInput
                label="Particles (N)"
                min={20}
                max={400}
                step={5}
                value={nParticles}
                onChange={setNParticles}
                description="More particles → smoother histogram and steadier pressure. Law of large numbers, live."
                inputClassName="w-16 rounded-md border border-white/10 bg-slate-950 px-2 py-1 text-right text-xs text-slate-100 outline-none focus:border-cyan-300"
                queryKey="n"
                syncToUrl={true}
              />
              <SliderWithInput
                label="Particle mass"
                min={1}
                max={40}
                step={1}
                value={massU}
                onChange={setMassU}
                units="u"
                description="Heavier gas at the same T: same kinetic energy, visibly slower speeds."
                inputClassName="w-16 rounded-md border border-white/10 bg-slate-950 px-2 py-1 text-right text-xs text-slate-100 outline-none focus:border-cyan-300"
                queryKey="m"
                syncToUrl={true}
              />
            </div>
          </div>

          {/* Pressure gauge + stat rail */}
          <aside className="order-3 space-y-4">
            <div className="rounded-3xl border border-white/[0.08] bg-slate-900/55 p-5">
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">
                Pressure
              </h2>
              <p className="mt-3 text-lg font-semibold text-white">
                {formatAuto(readout.pMeasured, 'N/m')}
              </p>
              {/* Gauge bar — ideal-gas prediction sits at the center tick */}
              <div className="relative mt-3 h-2.5 overflow-hidden rounded-full bg-slate-950/70">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${gaugeFrac}%`,
                    background: 'linear-gradient(to right, hsl(187,90%,50%), hsl(38,90%,55%))',
                  }}
                />
                <div className="absolute inset-y-0 left-1/2 w-px bg-slate-400/70" />
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                Measured from wall impulse: P = Σ|Δp| / (Δt · wall length). The tick marks the
                ideal-gas prediction N·k_B·T/A = {formatAuto(readout.pIdeal, 'N/m')} — the bar
                jitters around it because pressure here really is just collisions.
              </p>
            </div>

            <div className="grid gap-3">
              <ReadoutCard
                label="T measured vs set"
                value={`${formatSI(readout.tMeasured, 'K', 4)} / ${formatSI(readout.tSet, 'K', 4)}`}
                detail="Measured from m⟨v²⟩/(2k_B). Matching the slider shows the sim is self-consistent."
              />
              <ReadoutCard
                label="Mean speed ⟨v⟩"
                value={formatSI(readout.vMean, 'm/s', 4)}
                detail="Average of |v| over all particles, measured live."
              />
              <ReadoutCard
                label="RMS speed v_rms"
                value={formatSI(readout.vRms, 'm/s', 4)}
                detail="√⟨v²⟩ — the speed that carries the kinetic energy. In 2D: √(2k_BT/m)."
              />
              <ReadoutCard
                label="Most probable speed v_p"
                value={formatSI(readout.vMp, 'm/s', 4)}
                detail="Peak of the 2D M-B distribution: √(k_BT/m), from the measured T. v_p < ⟨v⟩ < v_rms."
              />
            </div>

            {/* Equation box */}
            <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.045] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200/80">
                Kinetic theory in 2D
              </p>
              <p className="mt-3 font-mono text-sm text-cyan-50">P·A = N·k_B·T</p>
              <p className="mt-2 font-mono text-xs leading-relaxed text-cyan-100/70">
                {`T = m⟨v²⟩ / (2k_B) = ${formatSI(readout.tMeasured, 'K', 4)}`}
                <br />
                {`P = Σ|Δp| / (Δt·L) = ${formatAuto(readout.pMeasured, 'N/m')}`}
                <br />
                {`N·k_B·T/A = ${formatAuto(readout.pIdeal, 'N/m')}`}
              </p>
            </div>
          </aside>
        </section>

        <ConceptBox
          className="mt-6"
          heading="What to notice"
          items={[
            {
              title: 'Pressure is nothing but collisions',
              description:
                'Every amber flash deposits momentum 2m|v⊥| on the wall. Summing those impulses per unit time and wall length gives the pressure — and it lands on N·k_BT/A without that formula ever entering the simulation.',
            },
            {
              title: 'The distribution assembles itself',
              description:
                'Particle–particle collisions constantly trade energy, yet the speed histogram always relaxes onto the same Maxwell–Boltzmann shape. Hit Reseed and watch it re-form; raise N and watch it smooth out.',
            },
            {
              title: 'Temperature is energy, not speed',
              description:
                'Slide the mass up at fixed T: particles slow down, the histogram squeezes left, but measured T and pressure stay put. ⟨½mv²⟩ is what T measures — heavy-slow and light-fast can be equally hot.',
            },
            {
              title: 'Fluctuations shrink with N',
              description:
                'At N = 20 the pressure gauge lurches and the histogram is ragged; at N = 400 both settle down. Real gases have ~10²³ particles, which is why macroscopic pressure feels perfectly steady.',
            },
          ]}
        />
      </div>
    </div>
  );
}
