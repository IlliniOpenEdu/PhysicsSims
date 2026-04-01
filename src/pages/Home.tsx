import { type MouseEvent, useState } from 'react';
import { Link } from 'react-router-dom';

const sims = [
  {
    title: '1-D Kinematics',
    path: '/kinematics',
    description: 'Explore motion in one dimension.',
    preview: '/thumbnails/kinematics.png',
  },
  {
    title: '2-D Kinematics',
    path: '/kinematics-2d',
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

const devs = [
  { name: 'Evan Doubek', role: 'Physics / Content' },
  { name: 'Bryan Chen', role: 'UX / Frontend' },
];

export function Home() {
  const [devParallax, setDevParallax] = useState({ x: 0, y: 0 });

  const handleDevMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    const x = (px - 0.5) * 2;
    const y = (py - 0.5) * 2;
    setDevParallax({ x, y });
  };

  const handleDevMouseLeave = () => {
    setDevParallax({ x: 0, y: 0 });
  };

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
            <h1 className="mt-2 bg-gradient-to-r from-cyan-300 via-blue-400 to-violet-400 bg-clip-text text-3xl font-semibold tracking-tight text-transparent sm:text-4xl md:text-5xl">
              PhysicsSims
            </h1>
            <p className="mt-4 max-w-2xl text-sm text-slate-300 sm:text-base">
              Interactive simulations for mechanics and core physics topics, all in the browser.
            </p>
          </div>
        </header>

        <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {sims.map((sim) => (
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
        </section>

        <section className="mt-16">
          <h2 className="text-xl font-semibold text-slate-50">Developers</h2>

          <div
            className="relative mt-6 flex flex-col gap-4 sm:flex-row"
            onMouseMove={handleDevMouseMove}
            onMouseLeave={handleDevMouseLeave}
          >
            <div
              className="pointer-events-none absolute inset-0 -z-10 opacity-80"
              style={{
                transform: `translate(${devParallax.x * -10}px, ${devParallax.y * -8}px)`,
                transition: 'transform 120ms linear',
              }}
            >
              <div className="absolute -left-8 top-2 h-28 w-28 rounded-full bg-sky-500/20 blur-2xl" />
              <div className="absolute right-0 top-10 h-24 w-24 rounded-full bg-blue-400/20 blur-2xl" />
            </div>

            {devs.map((dev, i) => (
              <div
                key={dev.name}
                className="flex flex-1 items-center justify-between rounded-xl border border-slate-800 bg-slate-900/70 px-5 py-4 transition hover:border-sky-500/60 hover:bg-slate-900"
                style={{
                  transform: `translate3d(${devParallax.x * (i === 0 ? 12 : -12)}px, ${devParallax.y * (i === 0 ? 8 : -8)}px, 0) rotateY(${devParallax.x * (i === 0 ? 3 : -3)}deg) rotateX(${devParallax.y * (i === 0 ? -2 : 2)}deg)`,
                  transition:
                    'transform 120ms ease-out, border-color 150ms ease-out, background-color 150ms ease-out',
                  transformStyle: 'preserve-3d',
                  willChange: 'transform',
                }}
              >
                <div>
                  <h3 className="text-base font-medium text-slate-100">{dev.name}</h3>
                  <p className="text-sm text-slate-400">{dev.role}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-blue-600 text-sm font-semibold text-black">
                  {dev.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-800 bg-slate-950/90">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-4 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 PhysicsSims</p>
          <div className="flex gap-4">
            <a href="#" className="hover:text-sky-300">
              Contribution
            </a>
            <a href="#" className="hover:text-sky-300">
              Resources
            </a>
            <a href="#" className="hover:text-sky-300">
              Terms
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
