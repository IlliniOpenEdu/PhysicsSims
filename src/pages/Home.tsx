import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnnouncementPopup } from '../components/AnnouncementPopup';
import { loadAdminState, type AdminControlState } from '../config/internalAdmin';


const DEFAULT_HOME_ANNOUNCEMENT = {
  id: 'official-launch-2026-04',
  title: '🎉 PhysicsSims Official Launch',
  description:
    'We are officially live as an interactive learning platform. Additional simulations and features will be introduced throughout the semester.',
  buttons: [
    { text: 'Start Exploring', url: '#mechanics' },
    { text: 'Project Repository', url: 'https://github.com/IlliniOpenEdu/PhysicsSims', newTab: true },
  ],
};

// Put this in console to reset the announcement for testing:
// localStorage.removeItem('home-announcement-dismissed:official-launch-2026-04')

const base = import.meta.env.BASE_URL;
/** Shown when a referenced PNG is missing from `public/thumbnails/`. */
const PREVIEW_FALLBACK = `${base}thumbnails/preview.png`;
const DEPLOY_WORKFLOW_URL = 'https://github.com/IlliniOpenEdu/PhysicsSims/actions/workflows/deploy.yml';
const DEPLOY_STATUS_API = 'https://api.github.com/repos/IlliniOpenEdu/PhysicsSims/actions/workflows/deploy.yml/runs?per_page=1';

type DeployUiState = {
  label: string;
  detail: string;
  dotClass: string;
};

type SimItem = {
  title: string;
  path: string;
  description: string;
  preview: string;
  status?: string;
};

const DEPLOY_LOADING_STATE: DeployUiState = {
  label: 'Checking',
  detail: 'Loading latest deploy run...',
  dotClass: 'bg-amber-300',
};

const DEPLOY_ERROR_STATE: DeployUiState = {
  label: 'Unavailable',
  detail: 'Could not fetch deploy status',
  dotClass: 'bg-slate-400',
};

const getDeployUiState = (status?: string, conclusion?: string): DeployUiState => {
  if (status === 'completed') {
    if (conclusion === 'success') {
      return { label: 'Online', detail: 'Latest deploy succeeded. No issues detected.', dotClass: 'bg-emerald-400 animate-pulse' };
    }
    if (conclusion === 'failure' || conclusion === 'timed_out') {
      return { label: 'Issues', detail: 'Latest deploy failed. Contact support.', dotClass: 'bg-rose-300 animate-ping' };
    }
    if (conclusion === 'cancelled' || conclusion === 'skipped') {
      return { label: 'Paused', detail: 'Latest deploy was not completed. Contact support.', dotClass: 'bg-amber-300 animate-bounce' };
    }
  }

  if (status === 'queued') {
    return { label: 'Queued', detail: 'Deploy run is queued', dotClass: 'bg-amber-300' };
  }

  if (status === 'in_progress' || status === 'waiting' || status === 'requested') {
    return { label: 'Deploying', detail: 'Deploy is currently running', dotClass: 'bg-sky-300' };
  }

  return DEPLOY_ERROR_STATE;
};

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

const mechanicsSims: SimItem[] = [
  {
    title: '1-D Kinematics',
    path: '/kinematics',
    description: 'Explore motion in one dimension.',
    preview: `${base}thumbnails/kinematics.png`,
  },
  {
    title: '2-D Kinematics',
    path: '/kinematics-2d',
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
    preview: `${base}thumbnails/work.png`,
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
    preview: `${base}thumbnails/incline.png`,
  },
  {
    title: 'Momentum · Center of Mass',
    path: '/center-of-mass',
    description: 'Drag multiple masses in 2D and track the system center of mass in real time.',
    preview: `${base}thumbnails/forces.png`,
  },
  {
    title: 'Momentum · Impulse Builder',
    path: '/impulse-builder',
    description: 'Constant horizontal force over a chosen duration: J = FΔt, Δp, and coasting motion on a frictionless track.',
    preview: `${base}thumbnails/forces.png`,
  },
  {
    title: 'Momentum · 1D Collision',
    path: '/momentum-collision-1d',
    description: 'Compare elastic and inelastic 1D collisions while tracking p1, p2, and conserved total momentum.',
    preview: `${base}thumbnails/pulley.png`,
  },
  {
    title: 'Momentum · 2D Collisions',
    path: '/momentum-collision-2d',
    description: 'Elastic balls in a square arena: ball–ball and wall collisions with per-ball and total momentum readouts.',
    preview: `${base}thumbnails/pulley.png`,
  },
];

const enmSims: SimItem[] = [
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
    preview: `${base}thumbnails/ampere.png`,
  },
  {
    title: 'Faraday\'s Law Simulator',
    description: 'Visualize changing magnetic flux and induced EMF.',
    path: '/faradays-law',
    status: 'IOLab module',
    preview: `${base}thumbnails/faraday.png`,
  },
  {
    title: 'RC Circuit Lab',
    description: 'Explore capacitor charging and discharging with live voltage and current scopes.',
    path: '/rc-circuit',
    status: 'Available now',
    preview: `${base}thumbnails/RC.png`,
  },
  {
    title: 'Magnetic Field Simulator',
    description: 'Visualize magnetic fields around point charges and magnets.',
    path: '/mag-field',
    status: 'Available now',
    preview: `${base}thumbnails/mag.png`,
  }
];

const staticsSims: SimItem[] = [
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
    preview: `${base}thumbnails/beam.png`,
  },

];

export function Home() {
  const [viewMode, setViewMode] = useState<'grid' | 'compact'>('grid');
  const [isLaunchAnnouncementOpen, setIsLaunchAnnouncementOpen] = useState(false);
  const [deployState, setDeployState] = useState<DeployUiState>(DEPLOY_LOADING_STATE);
  const [deployRunUrl, setDeployRunUrl] = useState(DEPLOY_WORKFLOW_URL);
  const [deployUpdatedAt, setDeployUpdatedAt] = useState<string | null>(null);
  const [adminControls, setAdminControls] = useState<AdminControlState>(loadAdminState);

  const mergedAnnouncement = adminControls.announcement.enabled
    ? {
      id: adminControls.announcement.id,
      title: adminControls.announcement.title,
      description: adminControls.announcement.description,
      buttons: [
        {
          text: adminControls.announcement.primaryButtonText,
          url: adminControls.announcement.primaryButtonUrl,
          newTab: adminControls.announcement.openPrimaryInNewTab,
        },
      ],
    }
    : DEFAULT_HOME_ANNOUNCEMENT;

  const dismissKey = `home-announcement-dismissed:${mergedAnnouncement.id}`;

  useEffect(() => {
    try {
      const isDismissed = window.localStorage.getItem(dismissKey) === 'true';
      setIsLaunchAnnouncementOpen(!isDismissed);
    } catch {
      setIsLaunchAnnouncementOpen(true);
    }
  }, [dismissKey]);

  useEffect(() => {
    const onStorageUpdated = () => {
      setAdminControls(loadAdminState());
    };

    window.addEventListener('storage', onStorageUpdated);
    return () => {
      window.removeEventListener('storage', onStorageUpdated);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const fetchDeployStatus = async () => {
      try {
        if (adminControls.bugTestControls.simulateSlowNetworkMs > 0) {
          await new Promise((resolve) => {
            window.setTimeout(resolve, adminControls.bugTestControls.simulateSlowNetworkMs);
          });
        }

        if (adminControls.bugTestControls.mockDeployStatus !== 'auto') {
          if (adminControls.bugTestControls.mockDeployStatus === 'online') {
            setDeployState({ label: 'Online', detail: 'Forced by internal test control.', dotClass: 'bg-emerald-400 animate-pulse' });
          }
          if (adminControls.bugTestControls.mockDeployStatus === 'issues') {
            setDeployState({ label: 'Issues', detail: 'Forced by internal test control.', dotClass: 'bg-rose-300 animate-ping' });
          }
          if (adminControls.bugTestControls.mockDeployStatus === 'deploying') {
            setDeployState({ label: 'Deploying', detail: 'Forced by internal test control.', dotClass: 'bg-sky-300' });
          }
          return;
        }

        const response = await fetch(DEPLOY_STATUS_API, {
          signal: controller.signal,
          headers: {
            Accept: 'application/vnd.github+json',
          },
          cache: 'no-store',
        });

        if (!response.ok) {
          throw new Error(`GitHub status fetch failed with ${response.status}`);
        }

        const data = await response.json() as {
          workflow_runs?: Array<{
            status?: string;
            conclusion?: string;
            html_url?: string;
            updated_at?: string;
          }>;
        };

        const latestRun = data.workflow_runs?.[0];
        if (!latestRun) {
          setDeployState(DEPLOY_ERROR_STATE);
          return;
        }

        setDeployState(getDeployUiState(latestRun.status, latestRun.conclusion));
        setDeployRunUrl(latestRun.html_url ?? DEPLOY_WORKFLOW_URL);
        setDeployUpdatedAt(latestRun.updated_at ?? null);
      } catch {
        if (!controller.signal.aborted) {
          setDeployState(DEPLOY_ERROR_STATE);
        }
      }
    };

    void fetchDeployStatus();

    return () => {
      controller.abort();
    };
  }, [adminControls.bugTestControls.mockDeployStatus, adminControls.bugTestControls.simulateSlowNetworkMs]);

  const closeLaunchAnnouncement = () => {
    setIsLaunchAnnouncementOpen(false);
    try {
      window.localStorage.setItem(dismissKey, 'true');
    } catch {
      // Ignore storage failures in restricted browsing environments.
    }
  };

  const isCompact = viewMode === 'compact';
  const isMaintenanceMode = adminControls.featureFlags.maintenanceMode;
  const featureExperimentalMechanics = adminControls.featureFlags.experimentalMechanics;
  const featuredSimPath = adminControls.contentOverrides.featuredSimPath;

  if (adminControls.bugTestControls.forceHomeError) {
    throw new Error('Home error forced by admin bug/test controls.');
  }

  const filterByPublishState = (sim: SimItem) => adminControls.simulationVisibility[sim.path] !== false;

  const visibleMechanics = mechanicsSims.filter(filterByPublishState);
  const visibleENM = enmSims.filter(filterByPublishState);
  const visibleStatics = staticsSims.filter(filterByPublishState);

  const sectionGridClass = isCompact
    ? 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3'
    : 'grid gap-5 md:grid-cols-2 xl:grid-cols-3';
  const baseCardClass = isCompact
    ? 'group relative overflow-hidden rounded-3xl border border-white/10 bg-[#12151c] p-4 shadow-md shadow-slate-950/35 transition duration-300'
    : 'group relative overflow-hidden rounded-3xl border border-white/10 bg-[#12151c] p-5 shadow-lg shadow-slate-950/45 transition duration-300';
  const previewClass = isCompact
    ? 'mb-3 h-28 w-full rounded-2xl object-cover border border-white/10'
    : 'mb-4 h-36 w-full rounded-2xl object-cover border border-white/10';
  const compactListClass = 'divide-y divide-white/10 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur';

  const allCount = visibleMechanics.length + visibleENM.length + visibleStatics.length;

  const sections = [
    {
      id: 'mechanics',
      short: 'Mechanics',
      title: 'Kinematics and Dynamics',
      accent: 'text-cyan-300',
      chipClass: 'border-cyan-400/40 bg-cyan-400/10 text-cyan-200',
      arrowClass: 'text-cyan-200',
      hoverClass: 'hover:border-cyan-300/70',
      glowClass: 'from-cyan-400/25 via-sky-400/10 to-transparent',
      sims: visibleMechanics,
    },
    {
      id: 'enm',
      short: 'E&M',
      title: 'Electricity and Magnetism',
      accent: 'text-emerald-300',
      chipClass: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200',
      arrowClass: 'text-emerald-200',
      hoverClass: 'hover:border-emerald-300/70',
      glowClass: 'from-emerald-400/25 via-lime-400/10 to-transparent',
      sims: visibleENM,
    },
    {
      id: 'statics',
      short: 'Statics',
      title: 'Equilibrium and Supports',
      accent: 'text-rose-300',
      chipClass: 'border-rose-400/40 bg-rose-400/10 text-rose-200',
      arrowClass: 'text-rose-200',
      hoverClass: 'hover:border-rose-300/70',
      glowClass: 'from-rose-400/25 via-orange-400/10 to-transparent',
      sims: visibleStatics,
    },
  ] as const;

  return (
    <>
      <AnnouncementPopup
        announcement={mergedAnnouncement}
        isOpen={isLaunchAnnouncementOpen}
        onClose={closeLaunchAnnouncement}
      />

      <div className="relative flex min-h-screen flex-col overflow-hidden bg-slate-950 text-white">
        <div className="pointer-events-none absolute inset-0 -z-10 opacity-90 home-bg-shift">
          <div className="absolute -left-52 top-[-4rem] h-96 w-96 rounded-full bg-cyan-500/20 blur-3xl" />
          <div className="absolute right-[-5rem] top-20 h-[26rem] w-[26rem] rounded-full bg-sky-500/15 blur-3xl" />
          <div className="absolute bottom-[-8rem] left-1/3 h-[24rem] w-[24rem] rounded-full bg-rose-500/10 blur-3xl" />
          <div className="absolute inset-0 bg-[conic-gradient(from_180deg_at_35%_0%,rgba(34,211,238,0.10),transparent_35%,rgba(56,189,248,0.10),transparent_70%,rgba(244,63,94,0.1))] opacity-60" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_38%),linear-gradient(180deg,rgba(2,6,23,0.6),rgba(2,6,23,0.92))]" />
        </div>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:py-12">
          {isMaintenanceMode ? (
            <div className="mb-6 rounded-2xl border border-amber-300/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              Maintenance mode is enabled. Browsing is limited while updates are in progress.
            </div>
          ) : null}

          <header className="framer-rise grid gap-4 lg:grid-cols-[1.45fr_0.55fr]">
            <div className="relative overflow-hidden rounded-3xl border border-cyan-200/15 bg-[#0f131a] p-6 shadow-xl shadow-cyan-950/20 sm:p-8">
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(140deg,rgba(255,255,255,0.06),transparent_30%,rgba(56,189,248,0.08)_78%)]" />
              <div className="pointer-events-none absolute -right-16 top-10 h-36 w-36 rounded-full bg-sky-300/10 blur-3xl" />
              <div className="pointer-events-none absolute right-20 top-16 h-16 w-16 rounded-full border border-cyan-200/20 bg-cyan-300/10 float-orb" />
              <div className="pointer-events-none absolute right-40 top-32 h-2 w-2 rounded-full bg-cyan-200/80 animate-particle-1" />
              <div className="pointer-events-none absolute right-24 top-44 h-1.5 w-1.5 rounded-full bg-sky-200/70 animate-particle-2" />
              <div className="pointer-events-none absolute right-44 top-56 h-1 w-1 rounded-full bg-rose-200/70 animate-particle-3" />

              <div className="relative">
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-slate-300 sm:text-xs">
                  • IlliniOpenEdu 
                </p>
                <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-[1.04] tracking-tight text-slate-50 sm:text-5xl md:text-6xl">
                  {adminControls.contentOverrides.homeHeroTitle}
                </h1>
                <p className="mt-4 max-w-2xl text-sm text-slate-300 sm:text-base">
                  {adminControls.contentOverrides.homeHeroSubtitle}
                </p>

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <Link
                    to={featuredSimPath}
                    className="group framer-press inline-flex items-center gap-2 rounded-full border border-cyan-300/50 bg-cyan-400/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-cyan-100 transition hover:bg-cyan-300/25"
                  >
                    Launch Simulations
                    <span className="transition group-hover:translate-x-1">→</span>
                  </Link>
                  <a
                    href="#mechanics"
                    className="framer-press inline-flex items-center rounded-full border border-white/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-200 transition hover:border-white/40 hover:bg-white/[0.05]"
                  >
                    Browse Tracks
                  </a>
                </div>

                <p className="mt-4 text-[0.68rem] uppercase tracking-[0.2em] text-cyan-200/80">
                  {adminControls.contentOverrides.homeHeroTagline} {allCount} simulations.
                </p>

                <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-2xl border border-white/10 bg-[#151922] p-4">
                    <p className="text-[0.65rem] uppercase tracking-[0.16em] text-slate-400">Simulations</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-50">{allCount}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-[#151922] p-4">
                    <p className="text-[0.65rem] uppercase tracking-[0.16em] text-slate-400">Collections</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-50">3</p>
                  </div>
                  <div className="col-span-2 rounded-2xl border border-white/10 bg-[#151922] p-4">
                    <p className="text-[0.65rem] uppercase tracking-[0.16em] text-slate-400">Server Status</p>
                    <a
                      href={deployRunUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex w-full items-center justify-between rounded-full border border-white/10 bg-slate-900/80 px-3 py-2 transition hover:border-cyan-300/50"
                      aria-label="Open deploy workflow status"
                    >
                      <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-100">
                        <span className={`h-2.5 w-2.5 rounded-full ${deployState.dotClass}`} />
                        {deployState.label}
                      </span>
                      <span className="text-xs text-slate-400">View latest run</span>
                    </a>
                    <p className="mt-2 text-xs text-slate-400">{deployState.detail}</p>
                    {deployUpdatedAt ? (
                      <p className="mt-1 text-[0.68rem] uppercase tracking-[0.08em] text-slate-500">
                        Updated {new Date(deployUpdatedAt).toLocaleString()}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <aside className="framer-rise relative overflow-hidden rounded-3xl border border-white/10 bg-[#0e1219]/90 p-5 [animation-delay:90ms] sm:p-6">
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent_45%,rgba(14,165,233,0.05))]" />
              <div className="relative">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Explore By Track</p>
                <div className="mt-4 space-y-3">
                  <a href="#mechanics" className="framer-press block rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 transition hover:border-cyan-300/60 hover:bg-cyan-400/10">
                    <p className="text-sm font-semibold text-cyan-200">Mechanics</p>
                    <p className="mt-1 text-xs text-slate-400">
                      Motion, forces, energy, springs and work.{featureExperimentalMechanics ? ' Experimental labs enabled.' : ''}
                    </p>
                  </a>
                  <a href="#enm" className="framer-press block rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 transition hover:border-emerald-300/60 hover:bg-emerald-400/10">
                    <p className="text-sm font-semibold text-emerald-200">Electricity & Magnetism</p>
                    <p className="mt-1 text-xs text-slate-400">Fields, circuits, and Maxwell visualization.</p>
                  </a>
                  <a href="#statics" className="framer-press block rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 transition hover:border-rose-300/60 hover:bg-rose-400/10">
                    <p className="text-sm font-semibold text-rose-200">Statics</p>
                    <p className="mt-1 text-xs text-slate-400">Equilibrium, reactions, shear and moments.</p>
                  </a>
                </div>

                <div className="mt-5 border-t border-white/10 pt-4">
                  <p className="text-[0.68rem] uppercase tracking-[0.15em] text-slate-500">Browse Mode</p>
                  <div className="mt-2 inline-flex rounded-full border border-white/10 bg-slate-900/80 p-1 text-[0.72rem]">
                    <button
                      type="button"
                      onClick={() => setViewMode('grid')}
                      className={`rounded-full px-3 py-1 transition-all duration-200 ${viewMode === 'grid' ? 'bg-cyan-400/20 text-cyan-100' : 'text-slate-300 hover:bg-white/[0.06] hover:text-slate-100'}`}
                    >
                      Grid
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('compact')}
                      className={`rounded-full px-3 py-1 transition-all duration-200 ${viewMode === 'compact' ? 'bg-cyan-400/20 text-cyan-100' : 'text-slate-300 hover:bg-white/[0.06] hover:text-slate-100'}`}
                    >
                      Compact
                    </button>
                  </div>
                </div>
              </div>
            </aside>
          </header>

          {sections.map((section, sectionIndex) => (
            <section
              key={section.id}
              id={section.id}
              data-hash={section.id}
              className={sectionIndex === 0 ? 'mt-12' : 'mt-16'}
            >
              <div className="mb-5 flex items-end justify-between gap-4">
                <div>
                  <div className="mb-2 inline-flex items-center gap-2">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/15 text-[0.62rem] font-semibold text-slate-300">
                      {sectionIndex + 1}
                    </span>
                    <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${section.accent}`}>
                      {section.short}
                    </p>
                  </div>
                  <p className="sr-only">{section.short}</p>
                  <h2 className="mt-1 text-2xl font-semibold text-slate-50 sm:text-[1.75rem]">{section.title}</h2>
                </div>
                <p className="hidden text-xs uppercase tracking-[0.14em] text-slate-400 sm:block">
                  {section.sims.length} experiences
                </p>
              </div>

              {isMaintenanceMode ? (
                <div className="mb-4 rounded-xl border border-amber-300/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                  Simulation launch is temporarily paused by maintenance mode.
                </div>
              ) : null}

              {isCompact ? (
                <ul className={compactListClass}>
                  {section.sims.map((sim) => (
                    <li key={sim.path ?? sim.title}>
                      {sim.path && !isMaintenanceMode ? (
                        <Link to={sim.path} className="block px-4 py-3 transition hover:bg-white/[0.03] sm:px-5">
                          <p className="text-sm font-semibold text-slate-100">{sim.title}</p>
                          <p className="mt-0.5 text-xs text-slate-400">{sim.description}</p>
                        </Link>
                      ) : (
                        <div className="px-4 py-3 sm:px-5">
                          <p className="text-sm font-semibold text-slate-100">{sim.title}</p>
                          <p className="mt-0.5 text-xs text-slate-400">{sim.description}</p>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className={sectionGridClass}>
                  {section.sims.map((sim, simIndex) => {
                    const isFeatured = section.id === 'mechanics' && sim.path === featuredSimPath;
                    const cardClass = isFeatured
                      ? `${baseCardClass} md:col-span-2 ring-2 ring-cyan-300/45 shadow-2xl shadow-cyan-950/25 ${section.hoverClass} framer-rise framer-press hover:-translate-y-1.5 hover:bg-white/[0.08]`
                      : `${baseCardClass} ${section.hoverClass} framer-rise framer-press opacity-90 hover:-translate-y-1 hover:bg-white/[0.05] hover:opacity-100`;
                    const imageClass = isFeatured
                      ? 'mb-4 aspect-[16/9] w-full rounded-2xl border border-white/10 object-cover object-center'
                      : `${previewClass} transition-transform duration-500 group-hover:scale-[1.04]`;

                    const statusChip = sim.status ? (
                      <div className={`mb-3 inline-flex rounded-full border px-2.5 py-1 text-[0.63rem] font-semibold uppercase tracking-[0.09em] ${section.chipClass}`}>
                        {sim.status}
                      </div>
                    ) : null;

                    if (sim.path && !isMaintenanceMode) {
                      return (
                        <Link
                          key={sim.path}
                          to={sim.path}
                          className={cardClass}
                          style={{ animationDelay: `${simIndex * 45}ms` }}
                        >
                          <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${section.glowClass} opacity-70 transition-opacity duration-300 group-hover:opacity-100`} />
                          <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
                          <div className="relative">
                          {isFeatured ? (
                            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-300/55 bg-cyan-400/20 px-3 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-cyan-100">
                              Featured
                            </div>
                          ) : null}
                          {statusChip}
                          <SimPreviewImg
                            src={sim.preview}
                            alt={`${sim.title} preview`}
                            className={imageClass}
                          />
                          <h3 className={`${isFeatured ? 'text-xl' : 'text-lg'} font-semibold text-slate-100 transition group-hover:text-white`}>
                            {sim.title}
                          </h3>
                          <p className="mt-2 text-sm text-slate-300/85">{sim.description}</p>
                          <div className={`mt-5 inline-flex items-center gap-2 text-sm font-medium ${section.arrowClass}`}>
                            Open simulation
                            <span className="transition group-hover:translate-x-1">→</span>
                          </div>
                          </div>
                        </Link>
                      );
                    }

                    return (
                      <article
                        key={sim.title}
                        className={`${baseCardClass} framer-rise`}
                        style={{ animationDelay: `${simIndex * 45}ms` }}
                      >
                        <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${section.glowClass} opacity-70`} />
                        <div className="relative">
                        {statusChip}
                        <SimPreviewImg
                          src={sim.preview}
                          alt={`${sim.title} preview`}
                          className={previewClass}
                        />
                        <h3 className="text-lg font-semibold text-slate-100">{sim.title}</h3>
                        <p className="mt-2 text-sm text-slate-300/80">{sim.description}</p>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          ))}

          {adminControls.featureFlags.showDebugPanel ? (
            <section className="mt-14 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Debug Panel</p>
              <p className="mt-2 text-xs text-slate-300">featuredSimPath: {featuredSimPath}</p>
              <p className="mt-1 text-xs text-slate-300">maintenanceMode: {String(isMaintenanceMode)}</p>
              <p className="mt-1 text-xs text-slate-300">mockDeployStatus: {adminControls.bugTestControls.mockDeployStatus}</p>
              <p className="mt-1 text-xs text-slate-300">simulateSlowNetworkMs: {adminControls.bugTestControls.simulateSlowNetworkMs}</p>
            </section>
          ) : null}
        </main>
      </div>
    </>
  );
}
