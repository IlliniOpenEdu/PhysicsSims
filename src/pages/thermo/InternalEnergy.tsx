import { Link } from 'react-router-dom';
import { ConceptBox } from '../../components/system/ConceptBox';
import { SliderWithInput } from '../../components/system/SliderWithInput';
import { K_BOLTZMANN } from '../../utils/constants';
import { formatSci, formatSI } from '../../utils/formatters';
import { useInternalEnergy } from '../../hooks/thermo/useInternalEnergy';

const N = 80;
const CANVAS_W = 600;
const CANVAS_H = 420;

function ReadoutCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-slate-950/55 p-4">
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">{detail}</p>
    </div>
  );
}

export function InternalEnergy() {
  const { canvasRef, isPlaying, togglePlay, temperature, setTemperature, readout } =
    useInternalEnergy(300);

  return (
    <div className="min-h-screen bg-[#030507] px-4 py-10 text-slate-100">
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
              Internal Energy of an Ideal Gas
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
              {N} monatomic ideal-gas particles bouncing elastically in a box. Speeds follow a
              Maxwell–Boltzmann distribution. Raise the temperature and watch the kinetic energy
              redistribute in real time.
            </p>
          </div>
        </header>

        <section className="grid gap-5 lg:grid-cols-[1.5fr_0.9fr]">
          {/* Canvas panel */}
          <div className="rounded-3xl border border-white/[0.08] bg-slate-900/55 p-5 shadow-2xl shadow-slate-950/40">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">Particle Simulation</h2>
              <button
                type="button"
                onClick={togglePlay}
                className="rounded-full border border-slate-700 bg-slate-900 px-4 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-sky-500 hover:text-sky-100"
              >
                {isPlaying ? '⏸ Pause' : '▶ Play'}
              </button>
            </div>

            <div className="overflow-hidden rounded-2xl border border-white/[0.07]">
              <canvas
                ref={canvasRef}
                width={CANVAS_W}
                height={CANVAS_H}
                className="w-full"
                style={{ display: 'block' }}
              />
            </div>

            {/* Speed legend */}
            <div className="mt-3 flex flex-wrap items-center gap-4 text-[0.65rem] text-slate-500">
              {[
                { color: 'bg-blue-500',    label: 'slow' },
                { color: 'bg-cyan-400',    label: 'medium' },
                { color: 'bg-emerald-400', label: 'fast' },
                { color: 'bg-orange-400',  label: 'faster' },
                { color: 'bg-red-500',     label: 'very fast' },
              ].map(({ color, label }) => (
                <span key={label} className="flex items-center gap-1.5">
                  <span className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} />
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* Controls + readout */}
          <aside className="space-y-5">
            <div className="rounded-3xl border border-white/[0.08] bg-slate-900/55 p-5">
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">Controls</h2>
              <div className="mt-4 rounded-xl border border-white/[0.06] bg-slate-950/45 p-3">
                <SliderWithInput
                  label="Temperature"
                  min={50}
                  max={1500}
                  step={10}
                  value={temperature}
                  onChange={setTemperature}
                  units="K"
                  syncToUrl={true}
                  inputClassName="w-20 rounded-md border border-white/10 bg-slate-950 px-2 py-1 text-right text-xs text-slate-100 outline-none focus:border-cyan-300"
                  queryKey="temperature"
                />
              </div>
            </div>

            <div className="grid gap-3">
              <ReadoutCard
                label="Temperature"
                value={formatSI(readout.temperature, 'K', 4)}
                detail="All particle velocities rescale with √T when you move the slider."
              />
              <ReadoutCard
                label="Avg KE per particle"
                value={`${formatSci(readout.avgKE, 3)} J`}
                detail="= ³⁄₂ k_B T for a monatomic ideal gas (3 translational DoF)."
              />
              <ReadoutCard
                label="Total internal energy U"
                value={`${formatSci(readout.totalU, 3)} J`}
                detail={`= N · ³⁄₂ k_B T  (N = ${N} particles)`}
              />
            </div>

            {/* Equation box */}
            <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.045] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200/80">
                Equipartition theorem
              </p>
              <p className="mt-3 font-mono text-sm text-cyan-50">U = N · (f/2) · k_B · T</p>
              <p className="mt-2 font-mono text-xs leading-relaxed text-cyan-100/70">
                {`f = 3 (monatomic, translation only)`}
                <br />
                {`${formatSci(readout.totalU, 3)} J`}
                <br />
                {`= ${N} · 3/2 · ${formatSci(K_BOLTZMANN, 3)} · ${formatSI(temperature, 'K', 4)}`}
              </p>
            </div>
          </aside>
        </section>

        <ConceptBox
          className="mt-6"
          heading="What to notice"
          items={[
            {
              title: 'Temperature IS average kinetic energy',
              description:
                'Moving the slider rescales every velocity by √(T_new / T_old). Macroscopic temperature is simply the mean kinetic energy per translational degree of freedom.',
            },
            {
              title: 'Maxwell–Boltzmann speed distribution',
              description:
                'Particles are not all moving at the same speed — they follow a broad statistical distribution. Even at one temperature, some particles move many times faster than average.',
            },
            {
              title: 'U scales linearly with T',
              description:
                'For an ideal gas, U depends only on temperature, not volume or pressure. Doubling T exactly doubles the total internal energy.',
            },
            {
              title: 'Elastic walls conserve energy',
              description:
                'Each wall bounce reverses only the perpendicular velocity component, leaving total kinetic energy unchanged between temperature adjustments.',
            },
          ]}
        />
      </div>
    </div>
  );
}
