import { Link } from 'react-router-dom';
// this is the old version of the Simulations page, which is just a directory of links to the various simulations. The new version is more of a "home base" for the simulations, with a nicer layout and descriptions for each sim.

type SimLink = {
  to: string;
  title: string;
  description: string;
};

const electricitySims: SimLink[] = [
  {
    to: '/columbs-law',
    title: "Coulomb's Law Explorer",
    description: 'Map electric field vectors and force interactions for point charges.',
  },
  {
    to: '/gauss-law',
    title: "Gauss's Law Visualizer",
    description: 'Relate electric flux to enclosed charge with geometric Gaussian surfaces.',
  },
  {
    to: '/maxwell',
    title: "Maxwell's Equations Explorer",
    description: 'Connect field behavior to the core differential and integral E&M laws.',
  },
];

const dcCircuitsSims: SimLink[] = [
  {
    to: '/rc-circuit',
    title: 'RC Circuit Lab',
    description: 'Investigate capacitor charging and discharging with live voltage and current traces.',
  },
];

const magnetismSims: SimLink[] = [
  {
    to: '/wave-3d',
    title: 'Wave Equation 3D',
    description: 'Interact with traveling, standing, and EM wave modes in a real-time 3D field view.',
  },
  {
    to: '/mag-field',
    title: 'Magnetic Field Simulator',
    description: 'Visualize magnetic field patterns around sources and inspect direction and magnitude.',
  },
  {
    to: '/faradays-law',
    title: "Faraday's Law Simulator",
    description: 'See induced EMF emerge from changing magnetic flux through a loop.',
  },
  {
    to: '/maxwell',
    title: "Maxwell's Equations Explorer",
    description: 'Tie electric and magnetic field evolution together in one unifying framework.',
  },
  {
    to: '/amperes-law',
    title: "Ampere's Law Simulator",
    description: 'Explore loop integrals and current-dependent magnetic response in circuit contexts.',
  },
];

export function Simulations() {
  return (
    <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-70">
        <div className="absolute -left-40 top-0 h-72 w-72 rounded-full bg-sky-700/30 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-blue-500/25 blur-3xl" />
      </div>

      <header className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">Browse labs</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">
          Physics 212: Electricity & Magnetism
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-slate-300 sm:text-base">
          This page focuses on PHYS212 topics and organizes labs by course unit.
          Start with electricity fundamentals, continue to DC circuits, and then move into
          magnetism and induction.
        </p>
      </header>

      <div className="flex flex-col gap-12">
        <section>
          <h2 className="border-b border-slate-800 pb-2 text-sm font-semibold uppercase tracking-[0.15em] text-sky-300">
            Unit 1 — Electricity
          </h2>
          <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {electricitySims.map((sim) => (
              <li key={sim.to}>
                <Link
                  to={sim.to}
                  className="group flex h-full flex-col rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-md shadow-slate-950/30 transition hover:border-sky-600/60 hover:bg-slate-900"
                >
                  <span className="text-base font-semibold text-slate-50 group-hover:text-sky-200">
                    {sim.title}
                  </span>
                  <p className="mt-2 flex-1 text-sm text-slate-400">{sim.description}</p>
                  <span className="mt-4 text-xs font-medium text-sky-400 transition group-hover:text-sky-300">
                    Open lab →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="border-b border-slate-800 pb-2 text-sm font-semibold uppercase tracking-[0.15em] text-emerald-300/90">
            Unit 2 — DC Circuits
          </h2>
          <ul className="mt-5 grid gap-4 sm:grid-cols-2">
            {dcCircuitsSims.map((sim) => (
              <li key={sim.to}>
                <Link
                  to={sim.to}
                  className="group flex h-full flex-col rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-md shadow-slate-950/30 transition hover:border-emerald-600/50 hover:bg-slate-900"
                >
                  <span className="text-base font-semibold text-slate-50 group-hover:text-emerald-200/95">
                    {sim.title}
                  </span>
                  <p className="mt-2 flex-1 text-sm text-slate-400">{sim.description}</p>
                  <span className="mt-4 text-xs font-medium text-emerald-400/90 transition group-hover:text-emerald-300">
                    Open lab →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="border-b border-slate-800 pb-2 text-sm font-semibold uppercase tracking-[0.15em] text-fuchsia-300/90">
            Unit 3 — Magnetism
          </h2>
          <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {magnetismSims.map((sim) => (
              <li key={sim.to}>
                <Link
                  to={sim.to}
                  className="group flex h-full flex-col rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-md shadow-slate-950/30 transition hover:border-fuchsia-600/50 hover:bg-slate-900"
                >
                  <span className="text-base font-semibold text-slate-50 group-hover:text-fuchsia-200/95">
                    {sim.title}
                  </span>
                  <p className="mt-2 flex-1 text-sm text-slate-400">{sim.description}</p>
                  <span className="mt-4 text-xs font-medium text-fuchsia-400/90 transition group-hover:text-fuchsia-300">
                    Open lab →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
