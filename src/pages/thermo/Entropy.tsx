import { Link } from 'react-router-dom';
import { ConceptBox } from '../../components/system/ConceptBox';
import { SliderWithInput } from '../../components/system/SliderWithInput';
import { K_BOLTZMANN } from '../../utils/constants';
import { formatSci, formatSI } from '../../utils/formatters';
import { type InitialCondition, useEntropy } from '../../hooks/thermo/useEntropy';

const CANVAS_W = 600;
const CANVAS_H = 420;

const IC_OPTIONS: { value: InitialCondition; label: string }[] = [
  { value: 'all-left', label: 'All Left' },
  { value: 'random', label: 'Random' },
  { value: 'all-right', label: 'All Right' },
];

function ReadoutCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-slate-950/55 p-4">
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">{detail}</p>
    </div>
  );
}

// Format omega (pure integer count) without .toFixed()
function fmtOmega(omega: number): string {
  if (omega < 1e9) return String(Math.round(omega));
  return formatSci(omega, 3);
}

// Format probability as a percentage, switching to sci notation for tiny values
function fmtProbability(p: number): string {
  const pct = p * 100;
  if (pct >= 0.01) return formatSI(pct, '%', 3);
  return `${formatSci(pct, 3)} %`;
}

export function Entropy() {
  const {
    canvasRef,
    isPlaying,
    togglePlay,
    N,
    setN,
    initialCondition,
    setInitialCondition,
    reset,
    readout,
  } = useEntropy(20, 'all-left');

  const entropyStr =
    readout.entropy === 0 ? '0 J/K' : `${formatSci(readout.entropy, 3)} J/K`;

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
              Entropy &amp; Microstates
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
              N particles hop randomly between two halves of a box. Watch the system evolve from an
              ordered macrostate toward the overwhelmingly probable equilibrium — and see entropy
              rise in real time.
            </p>
          </div>
        </header>

        <section className="grid gap-5 lg:grid-cols-[1.5fr_0.9fr]">
          {/* Canvas panel */}
          <div className="rounded-3xl border border-white/[0.08] bg-slate-900/55 p-5 shadow-2xl shadow-slate-950/40">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">Particle Simulation</h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={reset}
                  className="rounded-full border border-slate-700 bg-slate-900 px-4 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-slate-400 hover:text-slate-100"
                >
                  ↺ Reset
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
                className="w-full"
                style={{ display: 'block' }}
              />
            </div>

            {/* Particle color legend */}
            <div className="mt-3 flex flex-wrap items-center gap-4 text-[0.65rem] text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-cyan-400" />
                left half
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-orange-400" />
                right half
              </span>
              <span className="ml-auto text-slate-600">dashed line = permeable partition</span>
            </div>
          </div>

          {/* Controls + readout */}
          <aside className="space-y-5">
            <div className="rounded-3xl border border-white/[0.08] bg-slate-900/55 p-5">
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">Controls</h2>

              {/* N slider */}
              <div className="mt-4 rounded-xl border border-white/[0.06] bg-slate-950/45 p-3">
                <SliderWithInput
                  label="Particles (N)"
                  min={2}
                  max={60}
                  step={1}
                  value={N}
                  onChange={setN}
                  inputClassName="w-16 rounded-md border border-white/10 bg-slate-950 px-2 py-1 text-right text-xs text-slate-100 outline-none focus:border-cyan-300"
                  queryKey="n"
                  syncToUrl={true}
                />
              </div>

              {/* Initial condition segmented control */}
              <div className="mt-3">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Initial condition
                </p>
                <div className="mt-2 flex gap-1 rounded-xl border border-white/[0.06] bg-slate-950/45 p-1">
                  {IC_OPTIONS.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setInitialCondition(value)}
                      className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition ${
                        initialCondition === value
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

            {/* Readout cards */}
            <div className="grid gap-3">
              <ReadoutCard
                label="Macrostate (n_L, n_R)"
                value={`${readout.nLeft} L  /  ${readout.nRight} R`}
                detail={`${readout.nLeft} particles on the left, ${readout.nRight} on the right.`}
              />
              <ReadoutCard
                label="Microstates  Ω = C(N, n_L)"
                value={fmtOmega(readout.omega)}
                detail="Number of microscopic arrangements that produce this exact macrostate."
              />
              <ReadoutCard
                label="Probability  P = Ω / 2^N"
                value={fmtProbability(readout.probability)}
                detail="Fraction of all 2^N equally-likely microstates that match this macrostate."
              />
              <ReadoutCard
                label="Entropy  S = k_B ln(Ω)"
                value={entropyStr}
                detail="Boltzmann entropy: measures how many microstates share this macrostate."
              />
            </div>

            {/* Equation box */}
            <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.045] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200/80">
                Boltzmann's entropy formula
              </p>
              <p className="mt-3 font-mono text-sm text-cyan-50">S = k_B · ln(Ω)</p>
              <p className="mt-2 font-mono text-xs leading-relaxed text-cyan-100/70">
                {`k_B = ${formatSci(K_BOLTZMANN, 3)} J/K`}
                <br />
                {`Ω   = C(${N}, ${readout.nLeft}) = ${fmtOmega(readout.omega)}`}
                <br />
                {`S   = ${entropyStr}`}
              </p>
            </div>
          </aside>
        </section>

        <ConceptBox
          className="mt-6"
          heading="What to notice"
          items={[
            {
              title: 'Equilibrium is overwhelmingly probable',
              description:
                'The macrostate with n_L ≈ N/2 has by far the most microstates Ω. Starting from all-left, the system drifts there quickly and almost never returns — not because deviations are forbidden, but because they are astronomically unlikely.',
            },
            {
              title: 'Entropy always increases toward equilibrium',
              description:
                'S = k_B ln(Ω) rises as particles spread between the halves. The second law is a statement of overwhelming probability: entropy-decreasing fluctuations exist, they are just vanishingly rare.',
            },
            {
              title: 'Macrostate vs microstate',
              description:
                'Many distinct microscopic particle arrangements produce the same count (n_L, n_R). Ω counts them; P tells you how likely that count is when picked at random from all 2^N possibilities.',
            },
            {
              title: 'Effect of N',
              description:
                'Increase N and the equilibrium peak sharpens relative to its width. Large systems fluctuate proportionally less: a 1% deviation from n_L = N/2 becomes exponentially improbable as N grows.',
            },
          ]}
        />
      </div>
    </div>
  );
}
