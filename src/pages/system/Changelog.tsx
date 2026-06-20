import { Link } from 'react-router-dom';

type TagType = 'New' | 'Improved' | 'Fixed' | 'Removed' | 'Featured';

const TAG_STYLES: Record<TagType, string> = {
  New: 'border-blue-400/40 bg-blue-400/10 text-blue-200',
  Improved: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200',
  Fixed: 'border-amber-400/40 bg-amber-400/10 text-amber-200',
  Removed: 'border-rose-400/40 bg-rose-400/10 text-rose-200',
  Featured: 'border-violet-400/40 bg-violet-400/10 text-violet-200',
};

function Tag({ type }: { type: TagType }) {
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.12em] ${TAG_STYLES[type]}`}>
      {type}
    </span>
  );
}

type Entry = { tag: TagType; text: string };
type Release = {
  version: string;
  date: string;
  title: string;
  summary?: string;
  entries: Entry[];
  highlight?: boolean;
};

const RELEASES: Release[] = [
  {
    version: '1.5.0',
    date: 'June 2026',
    title: 'Big batch of simulations and a completed PHYS211 course page!',
    summary: 'A full set of mechanics, electromagnetism and waves simulations.',
    highlight: true,
    entries: [
      { tag: 'Featured', text: 'Full universal circuit builder' },
      { tag: 'Featured', text: 'Free Body Diagram builder' },
      { tag: 'New', text: 'Vertical spring oscillator' },
      { tag: 'New', text: 'Pendulum simulator' },
      { tag: 'New', text: 'Standing waves simulator' },
      { tag: 'New', text: 'Pressure point simulator' },
      { tag: 'New', text: 'Buoyancy simulator' },
      { tag: 'New', text: 'Ideal gas law simulator' },
      { tag: 'New', text: 'Fluid flow simulator' },
      { tag: 'New', text: 'Bernoulli flow simulator' },
      { tag: 'Improved', text: 'Added 2 new tracks in the simulations section' },
      { tag: 'Fixed', text: 'New Landing Page' },
      { tag: 'Removed', text: 'TAM211 page - not yet ready' },


    ],
  },
  {
    version: '1.2.0',
    date: 'May 2026',
    title: 'Rotational Dynamics Suite',
    summary: 'A full set of rotational physics simulations and a redesigned landing page.',
    entries: [
      { tag: 'New', text: 'Taut-string circular motion simulator' },
      { tag: 'New', text: 'Angular motion builder with live graphs' },
      { tag: 'New', text: 'Rotating object builder (moment of inertia)' },
      { tag: 'New', text: 'Bullet-disk collision with angular momentum' },
      { tag: 'New', text: 'Torque seesaw equilibrium simulator' },
      { tag: 'New', text: 'Active torque disk simulator' },
      { tag: 'New', text: 'Rolling energy split visualization' },
      { tag: 'New', text: 'Redesigned landing page with bento-style features section' },
      { tag: 'Improved', text: 'Dashboard routing now uses dedicated /dashboard route' },
      { tag: 'Improved', text: 'CLAUDE.md project config for AI-assisted development' },
    ],
  },
  {
    version: '1.1.0',
    date: 'Spring 2026',
    title: 'E&M Expansion + 3D Visualizations',
    summary: 'Added advanced electromagnetism simulations and a full 3D wave equation renderer. Launched to the public for full release.',
    entries: [
      { tag: 'New', text: 'LHC particle collider simulation (ring + tunnel views)' },
      { tag: 'New', text: '3D wave equation visualizer (Three.js / R3F)' },
      { tag: 'New', text: 'Orbital motion / gravitation simulator' },
      { tag: 'New', text: 'Optics simulator' },
      { tag: 'New', text: 'Magnetic field visualizer' },
      { tag: 'New', text: 'PHYS212 course page with curated E&M labs' },
      { tag: 'New', text: 'System status page (/system)' },
      { tag: 'Improved', text: 'Work in Dynamics simulation with live W = F·Δr tracking' },
    ],
  },
  {
    version: '0.9.5',
    date: 'Early 2025',
    title: 'Initial Release',
    summary: 'PhysicsSims launches to only professors for testing',
    entries: [
      { tag: 'New', text: '1D and 2D kinematics simulators' },
      { tag: 'New', text: 'Force, friction, incline, and pulley simulators' },
      { tag: 'New', text: 'Spring force and spring energy simulators' },
      { tag: 'New', text: 'Energy hills potential/kinetic converter' },
      { tag: 'New', text: '1D and 2D momentum collision simulators' },
      { tag: 'New', text: 'Center of mass and impulse builder' },
      { tag: 'New', text: "Coulomb's law, Gauss's law, Ampere's law explorers" },
      { tag: 'New', text: "Maxwell's equations and Faraday's law visualizers" },
      { tag: 'New', text: 'RC circuit and capacitor labs' },
      { tag: 'New', text: 'Beam balance and distributed load analyzers' },
      { tag: 'New', text: 'PHYS211 and TAM211 course pages' },
      { tag: 'New', text: 'Google Analytics integration with cookie consent' },
    ],
  },
];

export function Changelog() {
  return (
    <div className="relative mx-auto min-h-[100dvh] max-w-4xl overflow-hidden px-3 py-6 text-slate-100 sm:px-4 sm:py-8">
      {/* Ambient glows */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-blue-500/15 blur-3xl" />
        <div className="absolute right-0 top-40 h-80 w-80 rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-purple-500/10 blur-3xl" />
      </div>

      {/* Header */}
      <header className="mb-8 rounded-3xl border border-slate-800/90 bg-slate-900/70 p-5 shadow-[0_20px_60px_rgba(2,6,23,0.55)] sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-300">Changelog</p>
        <h1 className="mt-3 bg-gradient-to-r from-blue-300 via-cyan-300 to-emerald-300 bg-clip-text text-3xl font-semibold tracking-tight text-transparent sm:text-5xl">
          What's new
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
          A running log of every release — new simulations, improvements, and fixes.
        </p>

        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/80 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:border-blue-400 hover:text-blue-100"
          >
            <span>←</span>
            Home
          </Link>
        </div>
      </header>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-[0.6rem] top-2 hidden h-full w-px bg-gradient-to-b from-blue-400/40 via-slate-700/60 to-transparent sm:block" />

        <div className="space-y-6">
          {RELEASES.map((release) => (
            <div key={release.version} className="relative sm:pl-10">
              {/* Timeline dot */}
              <div className="absolute left-0 top-5 hidden sm:block">
                <div className={`h-[1.15rem] w-[1.15rem] rounded-full border-2 ${release.highlight ? 'border-blue-400 bg-blue-400/20 shadow-[0_0_10px_2px_rgba(96,165,250,0.4)]' : 'border-slate-600 bg-slate-900'}`} />
              </div>

              <article className={`rounded-2xl border bg-slate-900/70 p-5 shadow-lg shadow-slate-950/40 sm:p-6 ${release.highlight ? 'border-blue-400/30' : 'border-slate-800'}`}>
                {/* Release header */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-3 py-1 text-xs font-bold tracking-wide ${release.highlight ? 'bg-blue-500/20 text-blue-200 ring-1 ring-blue-400/30' : 'bg-slate-800 text-slate-300'}`}>
                        v{release.version}
                      </span>
                      {release.highlight && (
                        <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-emerald-300 ring-1 ring-emerald-400/25">
                          Latest
                        </span>
                      )}
                    </div>
                    <h2 className="mt-2 text-lg font-semibold text-slate-100">{release.title}</h2>
                    {release.summary && (
                      <p className="mt-1 text-sm text-slate-400">{release.summary}</p>
                    )}
                  </div>
                  <span className="text-xs text-slate-500">{release.date}</span>
                </div>

                {/* Divider */}
                <div className="my-4 h-px bg-slate-800" />

                {/* Entries */}
                <ul className="space-y-2.5">
                  {release.entries.map((entry, i) => (
                    <li key={i} className="flex flex-wrap items-baseline gap-2.5 text-sm">
                      <Tag type={entry.tag} />
                      <span className="text-slate-300">{entry.text}</span>
                    </li>
                  ))}
                </ul>
              </article>
            </div>
          ))}
        </div>

        {/* Bottom cap */}
        <div className="mt-8 sm:pl-10">
          <p className="text-xs text-slate-600">
            PhysicsSims — For students, by students.{' '}
            <a
              href="https://github.com/IlliniOpenEdu/PhysicsSims/commits/main"
              target="_blank"
              rel="noreferrer"
              className="text-slate-500 underline underline-offset-2 hover:text-slate-300 transition"
            >
              View full git history →
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
