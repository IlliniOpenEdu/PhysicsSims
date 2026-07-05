import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { loadAdminState, type AdminControlState } from '../config/internalAdmin';

const base = import.meta.env.BASE_URL;
const PREVIEW_FALLBACK = `${base}thumbnails/preview.png`;

type Track = 'mechanics' | 'enm' | 'statics' | 'oscillations' | 'fluids' | 'thermodynamics';
type SimItem = {
  title: string;
  path: string;
  description: string;
  preview: string;
  track: Track;
  featured?: boolean;
};

const SIMS: SimItem[] = [
  // Mechanics
  { track: 'mechanics', title: '2-D Kinematics', path: '/kinematics-2d', description: 'Projectile and planar motion with adjustable launch angle and speed.', preview: `${base}thumbnails/meche/kinematics2d.png` },
  { track: 'mechanics', title: '1-D Kinematics', path: '/kinematics', description: 'Vertical motion with constant acceleration — throw a ball and watch position, velocity, and time.', preview: `${base}thumbnails/meche/kinematics.png` },
  { track: 'mechanics', title: 'Force Simulator', path: '/forces', description: 'Explore net force, mass, and resulting motion in a simple force diagram setup.', preview: `${base}thumbnails/meche/forces.png` },
  { track: 'mechanics', title: 'Simple Friction', path: '/gravity-friction', description: 'Friction on a horizontal surface with a rope — tension and kinetic friction.', preview: `${base}thumbnails/meche/friction.png` },
  { track: 'mechanics', title: 'Box on Incline', path: '/box-incline', description: 'Forces on a block on a ramp: weight components, normal force, and friction.', preview: `${base}thumbnails/meche/incline.png` },
  { track: 'mechanics', title: 'Spring Force', path: '/spring-force', description: "Hooke's Law and spring dynamics.", preview: `${base}thumbnails/meche/spring.png` },
  { track: 'mechanics', title: 'Pulley System', path: '/pulley-system', description: 'Two-mass Atwood machine: tension, gravity, and motion when masses differ.', preview: `${base}thumbnails/meche/pulley.png` },
  { track: 'mechanics', title: 'Energy Hills', path: '/energy-hills', description: 'Potential ↔ kinetic energy conversion on smooth, bumpy, and looped terrain.', preview: `${base}thumbnails/meche/work.png` },
  { track: 'mechanics', title: 'Spring Energy', path: '/spring-energy', description: "Oscillating spring–mass system: Hooke's law, energy exchange, and conserved total energy.", preview: `${base}thumbnails/meche/spring.png` },
  { track: 'mechanics', title: 'Work in Dynamics', path: '/work-in-dynamics', description: 'Incline, rope pull, and spring tabs with live work tracking (W = F·Δr) per force.', preview: `${base}thumbnails/meche/incline.png` },
  { track: 'mechanics', title: 'Center of Mass', path: '/center-of-mass', description: 'Drag multiple masses in 2D and track the system center of mass in real time.', preview: `${base}thumbnails/meche/com.png` },
  { track: 'mechanics', title: '1D Collision', path: '/momentum-collision-1d', description: 'Elastic and inelastic 1D collisions with live momentum tracking.', preview: `${base}thumbnails/meche/1d.png` },
  { track: 'mechanics', title: '2D Collisions', path: '/momentum-collision-2d', description: 'Elastic disks in a square arena with per-ball Σpₓ, Σpᵧ readouts.', preview: `${base}thumbnails/meche/2d.png` },
  { track: 'mechanics', title: 'Taut String Circular Motion', path: '/rotational-taut-string', description: 'Explore circular motion with tension, speed, radius, and centripetal force.', preview: `${base}thumbnails/meche/rotational.png` },
  { track: 'mechanics', title: 'Angular Motion Builder', path: '/rotational-angular-motion-builder', description: 'Build rotating systems and inspect angular velocity, acceleration, and torque.', preview: `${base}thumbnails/meche/rotational.png` },
  { track: 'mechanics', title: 'Orbital Motion', path: '/orbital-motion', description: 'Model orbiting bodies and see how gravity shapes trajectories.', preview: `${base}thumbnails/meche/orbit.png` },
  { track: 'mechanics', title: 'Rotating Object Builder', path: '/rotational-dynamics-rotating-object-builder', description: 'Adjust mass placement and watch the moment of inertia and angular response change.', preview: `${base}thumbnails/meche/rotational.png` },
  { track: 'mechanics', title: 'Bullet-Disk Collision', path: '/rotational-dynamics-bullet-disk-collision', description: 'Compare angular momentum transfer in a bullet striking a rotating disk.', preview: `${base}thumbnails/meche/bullet-disc.png` },
  { track: 'mechanics', title: 'Torque Seesaw', path: '/rotational-dynamics-torque-seesaw', description: 'Balance torques on a seesaw and find equilibrium conditions.', preview: `${base}thumbnails/statics/beambalance.png` },
  { track: 'mechanics', title: 'Active Torque Disk', path: '/rotational-dynamics-active-torque-disk', description: 'Apply torque to a disk and watch the rotational dynamics update live.', preview: `${base}thumbnails/meche/rotational.png` },
  { track: 'mechanics', title: 'Rolling Without Slipping', path: '/rolling-energy-split', description: 'Roll on a no-slip ramp: PE splits into translational and rotational KE (v = ωr).', preview: `${base}thumbnails/meche/ball-slope.png` },


  // Oscillations
  { track: 'oscillations', title: 'Vertical Spring Oscillator', path: '/oscillations-vertical-spring', description: 'Vertical SHM: spring stretches to equilibrium, then oscillates with live forces and energy.', preview: `${base}thumbnails/meche/ball-spring.png` },
  { track: 'oscillations', title: 'Pendulum Motion Explorer', path: '/oscillations-pendulum', description: 'Simple pendulum: release angle or height, watch period, tension, and energy exchange.', preview: `${base}thumbnails/meche/pendulum.png` },
  { track: 'oscillations', title: 'Wave Generator', path: '/oscillations-wave-generator', description: 'Traveling transverse wave: amplitude, frequency, speed, crests, and v = fλ.', preview: `${base}thumbnails/enm/wave.png` },
  { track: 'oscillations', title: 'Standing Waves', path: '/oscillations-standing-waves', description: 'Fixed-fixed string: harmonics, nodes, antinodes, and resonance peaks.', preview: `${base}thumbnails/enm/wave.png` },
  { track: 'oscillations', title: 'Frequency Generator', path: '/frequency-generator', description: 'Generate sine tones or detect microphone pitch with FFT and a live waveform visualizer.', preview: `${base}thumbnails/enm/wave.png` },
  
  // Fluids
  { track: 'fluids', title: 'Pressure Point Explorer', path: '/pressure-point-explorer', description: 'Interactive P = F/A: drag contact points on paper, live heatmap, real-world presets.', preview: PREVIEW_FALLBACK },
  { track: 'fluids', title: 'Buoyancy Explorer', path: '/buoyancy-explorer', description: 'Archimedes principle: block in water tank, buoyant force, density, float or sink.', preview: `${base}thumbnails/meche/buoyancy.png` },
  { track: 'fluids', title: 'Ideal Gas Law Explorer', path: '/ideal-gas-law-explorer', description: 'Particle gas in a piston cylinder: discover PV = nRT from wall collisions.', preview: `${base}thumbnails/meche/ideal-gas.png` },
  { track: 'fluids', title: 'Fluid Flow Explorer', path: '/fluid-flow-explorer', description: 'Continuity equation A₁v₁ = A₂v₂: flowing particles in a tapering pipe.', preview: `${base}thumbnails/meche/pipe.png` },
  { track: 'fluids', title: 'Bernoulli Flow Explorer', path: '/bernoulli-flow-explorer', description: 'Bernoulli equation with sloping pipe, pressure-colored flow, and energy profiles.', preview: `${base}thumbnails/meche/pipe.png` },
  
  // E&M
  { track: 'enm', title: 'Universal Circuit Builder', path: '/universal-circuit-builder', description: 'Build any DC/AC circuit and solve it live with Modified Nodal Analysis — Ohm, Kirchhoff, RC/RL/RLC transients, and frequency sweeps.', preview: `${base}thumbnails/enm/circuit.png`, featured: true },
  { track: 'enm', title: 'Large Hadron Collider', path: '/lhc', description: 'Simulate particle beam collisions in the LHC — real-time ring and tunnel views.', preview: `${base}thumbnails/enm/LCH.png`, featured: true },
  { track: 'enm', title: 'Wave Equation 3D', path: '/wave-3d', description: 'Real-time 3D wave equation visualization with camera orbit, mode switching, and live parameter control.', preview: `${base}thumbnails/enm/wave.png`, featured: true },
  { track: 'enm', title: "Coulomb's Law Explorer", path: '/coulombs-law', description: 'Map field lines and force vectors around charges in real time.', preview: `${base}thumbnails/enm/coulombs.png` },
  { track: 'enm', title: "Gauss's Law Visualizer", path: '/gauss-law', description: 'Explore electric flux and field distributions for different charge configurations.', preview: `${base}thumbnails/enm/gauss.png` },
  { track: 'enm', title: "Maxwell's Equations", path: '/maxwell', description: 'Interactively visualize the interplay of electric and magnetic fields.', preview: `${base}thumbnails/enm/maxwell.png` },
  { track: 'enm', title: "Ampere's Law Simulator", path: '/amperes-law', description: 'Analyze current loops and their magnetic fields in cross-sectional area.', preview: `${base}thumbnails/enm/ampere.png` },
  { track: 'enm', title: "Faraday's Law Simulator", path: '/faradays-law', description: 'Visualize changing magnetic flux and induced EMF.', preview: `${base}thumbnails/enm/faraday.png` },
  { track: 'enm', title: 'RC Circuit Lab', path:'/rc-circuit', description: 'Explore capacitor charging and discharging with live voltage and current scopes.', preview: `${base}thumbnails/enm/RC.png` },
  { track: 'enm', title: 'Magnetic Field Simulator', path: '/mag-field', description: 'Visualize magnetic fields around point charges and magnets.', preview: `${base}thumbnails/enm/mag.png` },
  { track: 'enm', title: '3D Magnetic Fields', path: '/mag-field-3d', description: 'Explore the full 3D field around a wire, solenoid, current loop, and parallel wires with live field lines and a test compass.', preview: `${base}thumbnails/enm/mag.png` },
  { track: 'enm', title: 'Capacitor Lab', path: '/capacitor', description: 'Understand how capacitors store charge and energy.', preview: `${base}thumbnails/enm/capacitor.png` },
  { track: 'enm', title: 'Optics Simulator', path: '/optics', description: 'Explore light properties including wavelength, polarization, and interference.', preview: `${base}thumbnails/enm/light.png` },

  // Statics
  { track: 'statics', title: 'Beam Balance Simulator', path: '/beam-balance', description: 'Explore torque and equilibrium with a virtual beam balance.', preview: `${base}thumbnails/statics/beambalance.png`, featured: true },
  { track: 'statics', title: 'Beam Load Analyzer', path: '/distributed-load', description: 'Set end supports, apply forces and moments, then inspect reactions, shear, and moment diagrams.', preview: `${base}thumbnails/statics/beam.png` },
  { track: 'statics', title:"Free Body Diagram Builder", path: '/free-body-diagram', description: 'Construct free body diagrams with adjustable forces, angles, and friction.', preview: `${base}thumbnails/meche/forces.png` },
  { track: 'statics', title: 'Centroid Finder', path: '/centroid-finder', description: 'Build composite shapes from rectangles, circles, and holes, then watch the weighted-area method locate the centroid live — table, terms, and crosshair included.', preview: `${base}thumbnails/statics/beam.png` },
  { track: 'statics', title: 'Truss Solver', path: '/truss-solver', description: 'Design 2D and 3D trusses, apply loads and supports, and solve them with a direct-stiffness engine — member forces, stresses, buckling checks, reactions, and an animated deflected shape.', preview: `${base}thumbnails/statics/truss.png` },

  // Thermodynamics
  { track: 'thermodynamics', title: 'Heat Transfer Simulator', path: '/heat-transfer', description: 'Simulate heat conduction, convection, and radiation with adjustable materials and temperatures.', preview: `${base}thumbnails/heat.png` },
  { track: 'thermodynamics', title: 'Internal Energy of an Ideal Gas', path: '/internal-energy', description: 'Watch 80 ideal-gas particles bounce elastically. Adjust temperature and see U = N·(3/2)k_BT update live.', preview: `${base}thumbnails/thermo.png` },
  { track: 'thermodynamics', title: 'Entropy Simulator', path: '/entropy', description: 'Visualize entropy changes in a system of particles with adjustable temperature and volume.', preview: `${base}thumbnails/entropy.png` },
  { track: 'thermodynamics', title: 'Carnot Cycle', path: '/carnot-cycle', description: 'Trace the four reversible legs of a Carnot engine on paired P–V and T–S diagrams. Vary reservoir temperatures, compression ratio, and γ to see efficiency and work respond.', preview: `${base}thumbnails/thermo.png` },
  { track: 'thermodynamics', title: 'Kinetic Theory of Gases', path: '/kinetic-theory', description: 'Watch pressure emerge from wall collisions and the Maxwell–Boltzmann distribution assemble itself. Live histogram, pressure gauge, and speed-colored particles.', preview: `${base}thumbnails/thermo.png` },

];

const TRACKS = {
  mechanics: {
    label: 'Mechanics',
    dot: 'bg-blue-400',
    text: 'text-blue-400',
    borderL: 'border-l-blue-500',
    chip: 'bg-blue-400/10 text-blue-300 ring-1 ring-blue-400/25',
    glow: 'rgba(96,165,250,0.06)',
  },
  enm: {
    label: 'E&M',
    dot: 'bg-emerald-400',
    text: 'text-emerald-400',
    borderL: 'border-l-emerald-500',
    chip: 'bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-400/25',
    glow: 'rgba(52,211,153,0.06)',
  },
  statics: {
    label: 'Statics',
    dot: 'bg-red-400',
    text: 'text-red-400',
    borderL: 'border-l-red-500',
    chip: 'bg-red-400/10 text-red-300 ring-1 ring-red-400/25',
    glow: 'rgba(248,113,113,0.06)',
  },
  oscillations: {
    label: 'Oscillations',
    dot: 'bg-rose-400',
    text: 'text-rose-400',
    borderL: 'border-l-rose-500',
    chip: 'bg-rose-400/10 text-rose-300 ring-1 ring-rose-400/25',
    glow: 'rgba(251,113,133,0.06)',
  },
  fluids: {
    label: 'Fluids',
    dot: 'bg-amber-400',
    text: 'text-amber-400',
    borderL: 'border-l-amber-500',
    chip: 'bg-amber-400/10 text-amber-300 ring-1 ring-amber-400/25',
    glow: 'rgba(251,191,36,0.06)',
  },

  thermodynamics: {
    label: 'Thermodynamics',
    dot: 'bg-violet-400',
    text: 'text-violet-400',
    borderL: 'border-l-violet-500',
    chip: 'bg-violet-400/10 text-violet-300 ring-1 ring-violet-400/25',
    glow: 'rgba(139,92,246,0.06)',
  },

} as const;

type FilterTrack = Track | 'all';
const FILTER_TRACKS: FilterTrack[] = ['all', 'mechanics', 'fluids', 'oscillations', 'enm', 'statics', 'thermodynamics'];

function SimCard({ sim, index }: { sim: SimItem; index: number }) {
  const t = TRACKS[sim.track];
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.28, delay: Math.min(index * 0.022, 0.3), ease: [0.22, 1, 0.36, 1] }}
    >
      <Link
        to={sim.path}
        className={`group relative flex h-full flex-col overflow-hidden rounded-2xl border-l-2 border border-white/[0.06] bg-white/[0.02] ${t.borderL} transition-all duration-200 hover:bg-white/[0.05] hover:border-white/[0.11] hover:-translate-y-0.5 hover:shadow-lg`}
        style={{ boxShadow: `inset 0 0 50px 0 ${t.glow}` }}
      >
        {/* Thumbnail */}
        <div className="relative overflow-hidden">
          <img
            src={sim.preview}
            alt=""
            className="h-36 w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
            onError={(e) => { e.currentTarget.src = PREVIEW_FALLBACK; }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#030507]/85 via-[#030507]/15 to-transparent" />
          {sim.featured && (
            <span className={`absolute left-3 top-3 rounded-full px-2 py-0.5 text-[0.56rem] font-bold uppercase tracking-widest ${t.chip}`}>
              Featured
            </span>
          )}
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col p-4">
          <p className={`mb-1 text-[0.58rem] font-bold uppercase tracking-[0.24em] ${t.text}`}>
            {t.label}
          </p>
          <h3 className="text-sm font-semibold leading-snug text-white">{sim.title}</h3>
          <p className="mt-1.5 flex-1 text-[0.7rem] leading-relaxed text-slate-500">{sim.description}</p>
          <span className={`mt-3 inline-flex items-center gap-1.5 text-[0.7rem] font-semibold transition-all duration-200 group-hover:gap-2.5 ${t.text}`}>
            Open lab
            <span className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
          </span>
        </div>
      </Link>
    </motion.div>
  );
}

export function Dashboard() {
  const [activeTrack, setActiveTrack] = useState<FilterTrack>('all');
  const [query, setQuery] = useState('');
  const [adminControls, setAdminControls] = useState<AdminControlState>(loadAdminState);

  useEffect(() => {
    const onStorageUpdated = () => {
      setAdminControls(loadAdminState());
    };

    window.addEventListener('storage', onStorageUpdated);
    return () => {
      window.removeEventListener('storage', onStorageUpdated);
    };
  }, []);

  const visibleSims = useMemo(
    () => SIMS.filter((sim) => adminControls.simulationVisibility[sim.path] !== false),
    [adminControls.simulationVisibility],
  );

  const counts = useMemo<Record<FilterTrack, number>>(() => ({
    all: visibleSims.length,
    mechanics: visibleSims.filter((s) => s.track === 'mechanics').length,
    enm:       visibleSims.filter((s) => s.track === 'enm').length,
    statics:   visibleSims.filter((s) => s.track === 'statics').length,
    oscillations: visibleSims.filter((s) => s.track === 'oscillations').length,
    fluids: visibleSims.filter((s) => s.track === 'fluids').length,
    thermodynamics: visibleSims.filter((s) => s.track === 'thermodynamics').length,
  }), [visibleSims]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return visibleSims.filter((s) => {
      const matchTrack = activeTrack === 'all' || s.track === activeTrack;
      const matchQuery = !q || s.title.toLowerCase().includes(q) || s.description.toLowerCase().includes(q);
      return matchTrack && matchQuery;
    });
  }, [activeTrack, query, visibleSims]);

  return (
    <div className="min-h-screen bg-[#030507] text-white">
      {/* Fixed ambient glow */}
      <div className="pointer-events-none fixed inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(56,189,248,0.07),transparent)]" />

      <div className="relative mx-auto max-w-7xl px-4 pb-24 pt-12 sm:px-6 lg:px-8">

        {/* ── Header ── */}
        <motion.div
          className="mb-10"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="mb-1.5 text-[0.6rem] font-semibold uppercase tracking-[0.34em] text-sky-400/60">
            IlliniOpenEdu · Simulation Library
          </p>
          <h1 className="text-[2rem] font-semibold tracking-tight text-white sm:text-4xl">
            All Simulations
          </h1>

          {/* Stat pills */}
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.72rem]">
            <span className="text-slate-500">
              <span className="font-semibold text-white">{counts.all}</span> simulations
            </span>
            <span className="h-3 w-px bg-white/[0.07]" />
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
              <span className="text-blue-300/60">{counts.mechanics} Mechanics</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span className="text-emerald-300/60">{counts.enm} E&amp;M</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
              <span className="text-red-300/60">{counts.statics} Statics</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
              <span className="text-rose-300/60">{counts.oscillations} Oscillations</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              <span className="text-amber-300/60">{counts.fluids} Fluids</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
              <span className="text-violet-300/60">{counts.thermodynamics} Thermodynamics</span>
            </span>
          </div>
        </motion.div>

        {/* ── Filter / search bar ── */}
        <motion.div
          className="mb-8 flex flex-wrap items-center gap-3"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.07, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Track tabs */}
          <div className="flex flex-wrap items-center gap-0.5 rounded-xl border border-white/[0.06] bg-white/[0.025] p-1 w-full sm:w-auto">
            {FILTER_TRACKS.map((t) => {
              const isActive = activeTrack === t;
              const label = t === 'all' ? 'All' : TRACKS[t].label;
              const dot = t === 'all' ? 'bg-slate-400' : TRACKS[t].dot;
              const count = counts[t];
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setActiveTrack(t)}
                  className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[0.76rem] font-medium transition-all duration-150 ${
                    isActive ? 'bg-white/[0.09] text-white shadow-sm' : 'text-slate-500 hover:text-slate-200'
                  }`}
                >
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot} ${isActive ? '' : 'opacity-40'}`} />
                  {label}
                  <span className={`rounded-full px-1.5 py-px text-[0.58rem] font-semibold ${isActive ? 'bg-white/10 text-white' : 'bg-white/[0.04] text-slate-600'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search */}
          <div className="relative min-w-[160px] flex-1 max-w-xs">
            <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              type="search"
              placeholder="Search..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-xl border border-white/[0.06] bg-white/[0.025] py-2 pl-8 pr-3 text-[0.76rem] text-slate-200 placeholder-slate-600 outline-none transition focus:border-white/[0.12] focus:bg-white/[0.04]"
            />
          </div>

          {(query || activeTrack !== 'all') && (
            <span className="ml-auto text-[0.68rem] text-slate-600">
              {filtered.length} result{filtered.length !== 1 ? 's' : ''}
            </span>
          )}
        </motion.div>

        {/* ── Grid ── */}
        <AnimatePresence mode="popLayout">
          {filtered.length > 0 ? (
            <motion.div
              key="grid"
              layout
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            >
              {filtered.map((sim, i) => (
                <SimCard key={sim.path} sim={sim} index={i} />
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3 py-28 text-center"
            >
              <p className="text-3xl text-slate-800">—</p>
              <p className="text-sm text-slate-500">No simulations match that filter.</p>
              <button
                type="button"
                onClick={() => { setQuery(''); setActiveTrack('all'); }}
                className="mt-1 text-xs text-sky-400 underline-offset-2 hover:underline"
              >
                Clear filters
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
