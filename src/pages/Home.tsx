import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnnouncementPopup } from '../components/AnnouncementPopup';


const HOME_ANNOUNCEMENT = {
  id: 'official-launch-2026-04',
  title: '🎉 PhysicsSims Official Launch',
  description:
    'We are officially live as an interactive learning platform. Additional simulations and features will be introduced throughout the semester.',
  buttons: [
    { text: 'Start Exploring', url: '#mechanics' },
    { text: 'Project Repository', url: 'https://github.com/IlliniOpenEdu/PhysicsSims', newTab: true },
    { text: 'Feedback & Suggestions', url: '#contact' },
  ],
};

// Put this in console to reset the announcement for testing:
// localStorage.removeItem('home-announcement-dismissed:official-launch-2026-04')

/** Shown when a referenced PNG is missing from `public/thumbnails/`. */
const PREVIEW_FALLBACK = '/thumbnails/placeholder.svg';
const base = import.meta.env.BASE_URL;

function SimPreviewImg({
  src,
  alt,
  className,
}: {
  src: string;
  alt?: string;
  className?: string;
}) {
  return (
    <img
      src={src}
      alt={alt ?? ''}
      className={className}
      onError={(e) => {
        const el = e.currentTarget;
        if (el.src.includes('placeholder.svg')) return;
        el.src = PREVIEW_FALLBACK;
      }}
    />
  );
}

const mechanicsSims = [
  {
    title: '1-D Kinematics',
    path: '/kinematics',
    description: 'Explore motion in one dimension.',
    preview: `${base}thumbnails/kinematics.png`,
  },
  {
    title: '2-D Kinematics',
    path: '/kinematics-2d',
    status: 'Available now',
    description: 'Projectile and planar motion.',
    preview: `${base}thumbnails/kinematics2d.png`,
  },
  {
    title: 'Force Simulator',
    path: '/forces',
    description: 'Force balance and net force.',
    preview: `${base}thumbnails/forces.png`,
  },
  {
    title: 'Simple Friction',
    path: '/gravity-friction',
    description: 'Friction vs pulling force.',
    preview: `${base}thumbnails/friction.png`,
  },
  {
    title: 'Box on Incline',
    path: '/box-incline',
    description: 'Forces on a slope.',
    preview: `${base}thumbnails/incline.png`,
  },
  {
    title: 'Spring Force',
    path: '/spring-force',
    description: 'Hooke\'s Law and spring dynamics.',
    preview: `${base}thumbnails/spring.png`,
  },
  {
    title: 'Pulley system',
    path: '/pulley-system',
    description: 'Two-mass Atwood machine: tension, gravity, and motion when masses differ.',
    preview: `${base}thumbnails/pulley.png`,
  },
  {
    title: 'Energy Hills',
    path: '/energy-hills',
    description: 'Potential ↔ kinetic energy conversion on smooth, bumpy, and looped terrain.',
    preview: `${base}thumbnails/energy-hills.png`,
  },
  {
    title: 'Spring Energy',
    path: '/spring-energy',
    description: 'Oscillating spring–mass system: Hooke’s law, energy exchange, and conserved total energy.',
    preview: `${base}thumbnails/spring.png`,
  },
  {
    title: 'Work in Dynamics',
    path: '/work-in-dynamics',
    description: 'Incline, rope pull, and spring tabs with live work tracking (W = F·Δr) per force.',
    preview: `${base}thumbnails/energy-hills.png`,
  },
];

const enmSims = [
  {
    title: "Columb's Law Explorer",
    description: 'Map field lines and force vectors around charges.',
    path: '/columbs-law',
    status: 'Available now',
    preview: `${base}thumbnails/columbs.png`,
  },
  {
    title: 'Gauss\'s Law Visualizer',
    description: 'Explore electric flux and field distributions for different charge configurations.',
    path: '/gauss-law',
    status: 'Available now',
    preview: `${base}thumbnails/gauss.png`,
  },
  {
    title: 'Maxwell\'s Equations Explorer',
    description: 'Interactively visualize the interplay of electric and magnetic fields as described by Maxwell\'s equations.',
    path: '/maxwell',
    status: 'Available now',
    preview: `${base}thumbnails/maxwell.png`,
  }, 
  {
    title: 'Ampere\'s Law Simulator',
    description: 'Build and analyze resistor-inductor-capacitor circuits with real-time voltage and current graphs.',
    path: '/amperes-law',
    status: 'Available now',
    preview: `${base}thumbnails/amperes.png`,
  },
  {
    title: 'Faraday\'s Law Simulator',
    description: 'Visualize changing magnetic flux and induced EMF.',
    path: '/faradays-law',
    status: 'IOLab module',
    preview: `${base}thumbnails/faradays.png`,
  },
  {
    title: 'RC Circuit Lab',
    description: 'Explore capacitor charging and discharging with live voltage and current scopes.',
    path: '/rc-circuit',
    status: 'Available now',
    preview: `${base}thumbnails/preview.png`,
  },
  {
    title: 'Magnetic Field Simulator',
    description: 'Visualize magnetic fields around point charges and magnets.',
    path: '/mag-field',
    status: 'Available now',
    preview: `${base}thumbnails/preview.png`,
  }
];

const staticsSims = [
  {
    title: 'Beam Balance Simulator',
    description: 'Explore torque and equilibrium with a virtual beam balance.',
    path: '/beam-balance',
    status: 'Available now',
    preview: `${base}thumbnails/beambalance.png`,
  },
  {
    title: 'Beam Load and Support Analyzer',
    description: 'Set end supports, apply forces/moments/UDLs, and inspect reactions, shear, and moment.',
    path: '/distributed-load',
    status: 'Available now',
    preview: `${base}thumbnails/preview.png`,
  },

];

export function Home() {
  const [viewMode, setViewMode] = useState<'grid' | 'compact'>('grid');
  const [isLaunchAnnouncementOpen, setIsLaunchAnnouncementOpen] = useState(false);
  const dismissKey = `home-announcement-dismissed:${HOME_ANNOUNCEMENT.id}`;

  useEffect(() => {
    try {
      const isDismissed = window.localStorage.getItem(dismissKey) === 'true';
      setIsLaunchAnnouncementOpen(!isDismissed);
    } catch {
      setIsLaunchAnnouncementOpen(true);
    }
  }, [dismissKey]);

  const closeLaunchAnnouncement = () => {
    setIsLaunchAnnouncementOpen(false);
    try {
      window.localStorage.setItem(dismissKey, 'true');
    } catch {
      // Ignore storage failures in restricted browsing environments.
    }
  };

  const isCompact = viewMode === 'compact';
  const sectionGridClass = isCompact
    ? 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3'
    : 'grid gap-6 md:grid-cols-2 xl:grid-cols-3';
  const baseCardClass = isCompact
    ? 'group rounded-2xl border bg-slate-900/80 p-4 shadow-md shadow-slate-950/35 transition'
    : 'group rounded-2xl border bg-slate-900/80 p-6 shadow-lg shadow-slate-950/40 transition';
  const previewClass = isCompact
    ? 'mb-3 h-28 w-full rounded-xl object-cover border border-slate-800'
    : 'mb-4 h-40 w-full rounded-xl object-cover border border-slate-800';

  return (
    <>
      <AnnouncementPopup
        announcement={HOME_ANNOUNCEMENT}
        isOpen={isLaunchAnnouncementOpen}
        onClose={closeLaunchAnnouncement}
      />

      <div className="relative flex min-h-screen flex-col bg-slate-950 text-white">
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-70">
        <div className="absolute -left-40 top-0 h-72 w-72 rounded-full bg-sky-700/30 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-blue-500/25 blur-3xl" />
      </div>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
        <header className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400 ">
            Welcome to
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl md:text-5xl bg-[linear-gradient(90deg,#fca5a5_0%,#fdba74_22%,#fde68a_40%,#86efac_58%,#93c5fd_78%,#c4b5fd_100%)] bg-clip-text text-transparent">
            PhysicsSims
          </h1>
          <p className="mt-4 max-w-2xl text-sm text-slate-300 sm:text-base">
            Interactive simulations for mechanics and core physics topics, all in the browser.
          </p>
          <div className="mt-4 inline-flex rounded-full border border-slate-700 bg-slate-900/70 p-1 text-[0.72rem]">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`rounded-full px-3 py-1 transition ${viewMode === 'grid' ? 'bg-sky-500/25 text-sky-100' : 'text-slate-300 hover:text-slate-100'}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="h-4 w-4" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
              </svg>

            </button>
            <button
              type="button"
              onClick={() => setViewMode('compact')}
              className={`rounded-full px-3 py-1 transition ${viewMode === 'compact' ? 'bg-sky-500/25 text-sky-100' : 'text-slate-300 hover:text-slate-100'}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="h-4 w-4" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
              </svg>

            </button>
          </div>
        </header>

        <section id="mechanics" data-hash="mechanics">
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-400">Mechanics</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-50">Kinematics and Dynamics</h2>
          </div>

          {isCompact ? (
            <ul className="divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-900/50">
              {mechanicsSims.map((sim) => (
                <li key={sim.path}>
                  <Link to={sim.path} className="block px-4 py-3 transition hover:bg-slate-900/80">
                    <p className="text-sm font-semibold text-slate-100">{sim.title}</p>
                    <p className="mt-0.5 text-xs text-slate-400">{sim.description}</p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className={sectionGridClass}>
              {mechanicsSims.map((sim) => (
                <Link
                  key={sim.path}
                  to={sim.path}
                  className={`${baseCardClass} border-slate-800/80 hover:-translate-y-1 hover:border-sky-500/60 hover:bg-slate-900`}
                >
                  <SimPreviewImg
                    src={sim.preview}
                    alt={`${sim.title} preview`}
                    className={previewClass}
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
          )}
        </section>

        <section id="enm" data-hash="enm" className="mt-12">
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-400">ENM</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-50">Electricity and Magnetism</h2>
          </div>

          {isCompact ? (
            <ul className="divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-900/50">
              {enmSims.map((sim) => {
                if (sim.path) {
                  return (
                    <li key={sim.title}>
                      <Link to={sim.path} className="block px-4 py-3 transition hover:bg-slate-900/80">
                        <p className="text-sm font-semibold text-slate-100">{sim.title}</p>
                        {/* <p className="mt-0.5 text-xs text-emerald-300/90">{sim.status}</p> */}
                        <p className="mt-0.5 text-xs text-slate-400">{sim.description}</p>
                      </Link>
                    </li>
                  );
                }
                return (
                  <li key={sim.title} className="px-4 py-3">
                    <p className="text-sm font-semibold text-slate-100">{sim.title}</p>
                    {/* <p className="mt-0.5 text-xs text-emerald-300/90">{sim.status}</p> */}
                    <p className="mt-0.5 text-xs text-slate-400">{sim.description}</p>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className={sectionGridClass}>
              {enmSims.map((sim) => {
                const cardClass =
                  `${baseCardClass} border-emerald-900/60 bg-slate-900/60 shadow-slate-950/30`;

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
                      <SimPreviewImg
                        src={sim.preview}
                        alt=""
                        className={previewClass}
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
                    <SimPreviewImg
                      src={sim.preview}
                      alt=""
                      className={previewClass}
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
          )}
        </section>

        <section id="statics" className="mt-16" data-hash="statics">
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-red-400">Statics</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-50">Equilibrium and Statics</h2>
          </div>
          
          {isCompact ? (
            <ul className="divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-900/50">
              {staticsSims.map((sim) => {
                if (sim.path) {
                  return (
                    <li key={sim.title}>
                      <Link to={sim.path} className="block px-4 py-3 transition hover:bg-slate-900/80">
                        <p className="text-sm font-semibold text-slate-100">{sim.title}</p>
                        {/* <p className="mt-0.5 text-xs text-red-300/90">{sim.status}</p> */}
                        <p className="mt-0.5 text-xs text-slate-400">{sim.description}</p>
                      </Link>
                    </li>
                  );
                }
                return (
                  <li key={sim.title} className="px-4 py-3">
                    <p className="text-sm font-semibold text-slate-100">{sim.title}</p>
                    {/* <p className="mt-0.5 text-xs text-red-300/90">{sim.status}</p> */}
                    <p className="mt-0.5 text-xs text-slate-400">{sim.description}</p>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className={sectionGridClass}>
              {staticsSims.map((sim) => {
                const cardClass =
                  `${baseCardClass} border-red-900/60 bg-slate-900/60 shadow-slate-950/30`;

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
                      <SimPreviewImg
                        src={sim.preview}
                        alt=""
                        className={previewClass}
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
                    <SimPreviewImg
                      src={sim.preview}
                      alt=""
                      className={previewClass}
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
          )}

        </section>

      </main>
    </div>
    </>
  );
}