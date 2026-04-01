import { Link } from 'react-router-dom';

type SimLink = {
  to: string;
  title: string;
  description: string;
};

const kinematicsSims: SimLink[] = [
  {
    to: '/kinematics',
    title: '1-D Kinematics',
    description: 'Vertical motion with constant acceleration — throw a ball and watch position, velocity, and time.',
  },
  {
    to: '/kinematics-2d',
    title: '2-D Kinematics',
    description: 'Projectile motion in two dimensions with adjustable launch angle and speed.',
  },
];

const forcesSims: SimLink[] = [
  {
    to: '/forces',
    title: 'Force simulator',
    description: 'Explore net force, mass, and resulting motion in a simple force diagram setup.',
  },
  {
    to: '/pulley-system',
    title: 'Pulley system',
    description: 'Two-mass Atwood machine: tension, gravity, and motion when masses differ.',
  },
  {
    to: '/gravity-friction',
    title: 'Simple friction (rope pull)',
    description: 'Friction on a horizontal surface with a rope — tension and kinetic friction.',
  },
  {
    to: '/box-incline',
    title: 'Box on an incline',
    description: 'Forces on a block on a ramp: weight components, normal force, and friction.',
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
          Simulations
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-slate-300 sm:text-base">
          Pick a unit, then open a lab. Kinematics comes first (motion without worrying about why
          the acceleration is what it is); forces builds on that with pushes, pulls, and contact
          forces.
        </p>
      </header>

      <div className="flex flex-col gap-12">
        <section>
          <h2 className="border-b border-slate-800 pb-2 text-sm font-semibold uppercase tracking-[0.15em] text-sky-300">
            Unit 1 — Kinematics
          </h2>
          <ul className="mt-5 grid gap-4 sm:grid-cols-2">
            {kinematicsSims.map((sim) => (
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
            Unit 2 — Forces
          </h2>
          <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {forcesSims.map((sim) => (
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
      </div>
    </div>
  );
}
