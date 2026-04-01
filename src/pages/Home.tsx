import { type MouseEvent, useState } from 'react';
import { Link } from 'react-router-dom';

const mechanicsSims = [
  {
    title: '1-D Kinematics',
    path: '/kinematics',
    description: 'Explore motion in one dimension.',
    preview: '/thumbnails/kinematics.png',
  },
  {
    title: '2-D Kinematics',
    path: '/mag-field',
    status: 'Available now',
    description: 'Projectile and planar motion.',
    preview: '/thumbnails/kinematics2d.png',
  },
  {
    title: 'Force Simulator',
    path: '/forces',
    description: 'Force balance and net force.',
    preview: '/thumbnails/forces.png',
  },
  {
    title: 'Simple Friction',
    path: '/gravity-friction',
    description: 'Friction vs pulling force.',
    preview: '/thumbnails/friction.png',
  },
  {
    title: 'Box on Incline',
    path: '/box-incline',
    description: 'Forces on a slope.',
    preview: '/thumbnails/incline.png',
  },
  {
    title: 'Spring Force',
    path: '/spring-force',
    description: "Hooke's Law and spring dynamics.",
    preview: '/thumbnails/spring.png',
  },
];

const enmSims = [
  {
    title: 'Columb\'s Law Explorer',
    description: 'Map field lines and force vectors around charges.',
    path: '/columbs-law',
    status: 'Available now',
    preview: '/thumbnails/columbs.png',
  },
  {
    title: 'Gauss\'s Law Visualizer',
    description: 'Explore electric flux and field distributions for different charge configurations.',
    path: '/gauss-law',
    status: 'Available now',
    preview: '/thumbnails/gauss.png',
  },
  {
    title: 'Maxwell\'s Equations Explorer',
    description: 'Interactively visualize the interplay of electric and magnetic fields as described by Maxwell\'s equations.',
    status: 'Coming soon',
    preview: '/thumbnails/preview.png',
  }, 
  {
    title: 'Ampere\'s Law Simulator',
    description: 'Build and analyze resistor-inductor-capacitor circuits with real-time voltage and current graphs.',
    status: 'Coming soon',
    preview: '/thumbnails/preview.png',
  },
  {
    title: 'Faraday\'s Law Simulator',
    description: 'Visualize changing magnetic flux and induced EMF.',
    status: 'Coming soon',
    preview: '/thumbnails/preview.png',
  },
  {
    title: 'Lenz\'s Law Simulator',
    description: 'Explore the direction of induced currents and their magnetic effects.',
    status: 'Coming soon',
    preview: '/thumbnails/preview.png',
  },
  {
    title: 'Magnetic Field Simulator',
    description: 'Visualize magnetic fields around point charges and magnets.',
    path: '/mag-field',
    status: 'Coming now',
    preview: '/thumbnails/preview.png',
  }
];

const staticsSims = [
  {
    title: 'Beam Balance Simulator',
    description: 'Explore torque and equilibrium with a virtual beam balance.',
    path: '/beam-balance',
    status: 'Available now',
    preview: '/thumbnails/beambalance.png',
  },

];

export function Home() {

  return (
    <div className="relative flex min-h-screen flex-col bg-slate-950 text-white">
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-70">
        <div className="absolute -left-40 top-0 h-72 w-72 rounded-full bg-sky-700/30 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-blue-500/25 blur-3xl" />
      </div>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
        <header className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="w-full">
            <div className="mb-6 border-b border-slate-800/80 pb-4">
              <Link
                to="/simulations"
                className="inline-flex items-center gap-2 rounded-full bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 shadow-md shadow-sky-900/50 transition hover:bg-sky-400"
              >
                Browse all simulations
                <span className="text-xs">→</span>
              </Link>
            </div>

            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">
              Welcome to
            </p>
            <h1 className="mt-2 bg-[linear-gradient(90deg,#fca5a5_0%,#fdba74_22%,#fde68a_40%,#86efac_58%,#93c5fd_78%,#c4b5fd_100%)] bg-clip-text text-3xl font-semibold tracking-tight text-transparent sm:text-4xl md:text-5xl">
              PhysicsSimsssssssssssssssssssssssssssssssssssssssssssss
            </h1>
            <p className="mt-4 max-w-2xl text-sm text-slate-300 sm:text-base">
              Interactive simulations for mechanics and core physics topics, all in the browser.
            </p>
          </div>
        </header>

        <section id="mechanics" data-hash="mehcanics">
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-400">Mechanics</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-50">Kinematics and Dynamics</h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {mechanicsSims.map((sim) => (
              <Link
                key={sim.path}
                to={sim.path}
                className="group rounded-2xl border border-slate-800/80 bg-slate-900/80 p-6 shadow-lg shadow-slate-950/40 transition hover:-translate-y-1 hover:border-sky-500/60 hover:bg-slate-900"
              >
                <img
                      src={sim.preview}
                      alt={`${sim.title} preview`}
                className="mb-4 h-40 w-full rounded-xl object-cover border border-slate-800"
                    />
                <h2 className="text-lg font-semibold text-slate-50 transition group-hover:text-sky-300">
                  {sim.title}
                </h2>
                <p className="mt-2 text-sm text-slate-400">{sim.description}</p>
                <div className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-sky-400">
                  Open simulation
                  <span className="transition group-hover:translate-x-1">→</span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section id="enm" data-hash="enm" className="mt-12">
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-400">ENM</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-50">Electricity and Magnetism</h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {enmSims.map((sim) => {
              const cardClass =
                'rounded-2xl border border-emerald-900/60 bg-slate-900/60 p-6 shadow-lg shadow-slate-950/30 transition';

              if (sim.path) {
                return (
                  <Link
                    key={sim.title}
                    to={sim.path}
                    className={`${cardClass} hover:-translate-y-1 hover:border-emerald-500/60 hover:bg-slate-900`}
                  >
                    <div className="mb-4 inline-flex rounded-full border border-emerald-700/50 bg-emerald-900/30 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-emerald-200">
                      {sim.status}
                    </div>
                    <img
                      src={sim.preview}
                      className="mb-4 h-40 w-full rounded-xl object-cover border border-slate-800"
                    />
                    <h3 className="text-lg font-semibold text-slate-100">{sim.title}</h3>
                    <p className="mt-2 text-sm text-slate-400">{sim.description}</p>
                    <div className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-emerald-300">
                      Open simulation
                      <span className="transition">→</span>
                    </div>
                  </Link>
                );
              }

              return (
                <article key={sim.title} className={cardClass}>
                  <img
                      src={sim.preview}
                      className="mb-4 h-40 w-full rounded-xl object-cover border border-slate-800"
                    />
                  <div className="mb-4 inline-flex rounded-full border border-emerald-700/50 bg-emerald-900/30 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-emerald-200">
                    {sim.status}
                  </div>
                  <h3 className="text-lg font-semibold text-slate-100">{sim.title}</h3>
                  <p className="mt-2 text-sm text-slate-400">{sim.description}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section id="statics" className="mt-16" data-hash="statics">
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-red-400">Statics</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-50">Equilibrium and Statics</h2>
          </div>
          
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {staticsSims.map((sim) => {
              const cardClass =
                'rounded-2xl border border-red-900/60 bg-slate-900/60 p-6 shadow-lg shadow-slate-950/30 transition';

              if (sim.path) {
                return (
                  <Link
                    key={sim.title}
                    to={sim.path}
                    className={`${cardClass} hover:-translate-y-1 hover:border-red-500/60 hover:bg-slate-900`}
                  >
                    <div className="mb-4 inline-flex rounded-full border border-red-700/50 bg-red-900/30 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-red-200">
                      {sim.status}
                    </div>
                    <img
                      src={sim.preview}
                      className="mb-4 h-40 w-full rounded-xl object-cover border border-slate-800"
                    />
                    <h3 className="text-lg font-semibold text-slate-100">{sim.title}</h3>
                    <p className="mt-2 text-sm text-slate-400">{sim.description}</p>
                    <div className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-red-300">
                      Open simulation
                      <span className="transition">→</span>
                    </div>
                  </Link>
                );
              }

              return (
                <article key={sim.title} className={cardClass}>
                  <img
                      src={sim.preview}
                      className="mb-4 h-40 w-full rounded-xl object-cover border border-slate-800"
                    />
                  <div className="mb-4 inline-flex rounded-full border border-red-700/50 bg-red-900/30 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-red-200">
                    {sim.status}
                  </div>
                  <h3 className="text-lg font-semibold text-slate-100">{sim.title}</h3>
                  <p className="mt-2 text-sm text-slate-400">{sim.description}</p>
                </article>
              );
            })}
          </div>

        </section>

      </main>
    </div>
  );
}
