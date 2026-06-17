import { Link } from 'react-router-dom';
// this is the old version of the Simulations page, which is just a directory of links to the various simulations. The new version is more of a "home base" for the simulations, with a nicer layout and descriptions for each sim.

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

const energySims: SimLink[] = [
  {
    to: '/energy-hills',
    title: 'Energy Hills',
    description: 'Potential ↔ kinetic energy conversion on smooth, bumpy, and looped terrain.',
  },
  {
    to: '/spring-energy',
    title: 'Spring Energy Simulation',
    description: 'Horizontal spring–mass oscillator: velocity, KE, spring PE, and total energy with a live force arrow.',
  },
];

const momentumSims: SimLink[] = [
  {
    to: '/center-of-mass',
    title: 'Center of Mass',
    description: 'Move 2–5 objects, adjust masses, and observe the center of mass marker update in real time.',
  },
  {
    to: '/impulse-builder',
    title: 'Impulse Builder',
    description:
      'Constant force over a set time on a frictionless track: impulse J = FΔt and momentum change Δp, before collisions.',
  },
  {
    to: '/momentum-collision-1d',
    title: '1D Momentum Collision Simulator',
    description: 'Two boxes collide on a frictionless track with elastic/inelastic modes and live momentum tracking.',
  },
  {
    to: '/momentum-collision-2d',
    title: '2D Collisions Simulator',
    description:
      'Elastic disks in a square arena: pairwise collisions, wall bounces, and live Σpₓ, Σpᵧ tracking per ball.',
  },
];

const rotationalSims: SimLink[] = [
  {
    to: '/rotational-angular-motion-builder',
    title: 'Simple Anguler Motion Visualizer',
    description:
      'Set θ₀, ω₀, and α to visualize rotational kinematics, with live θ-ω-α readouts and time graphs.',
  },
  {
    to: '/rotational-taut-string',
    title: 'Taut Ball on a String (Uniform Circular Motion)',
    description:
      'Ball constrained to a circle by a taut string with live tension, tangential velocity, and centripetal acceleration vectors.',
  },
  {
    to: '/orbital-motion',
    title: 'Gravity & Orbital Motion',
    description:
      'Two-body gravity with presets (Sun-Earth, Earth-Moon): tune mass, distance, and speed for orbit, escape, or crash.',
  },
];

const rotationalDynamicsSims: SimLink[] = [
  {
    to: '/rotational-dynamics-rotating-object-builder',
    title: 'Rotating Object Builder (Moment of Inertia Explorer)',
    description:
      'Construct composite objects from point masses, spheres, and rods to compare per-component and total moment of inertia.',
  },
  {
    to: '/rotational-dynamics-bullet-disk-collision',
    title: 'Bullet & Rotating Disk (Angular Momentum Transfer)',
    description:
      'Fire a bullet into an off-center point on a rotating disk and observe inelastic angular-momentum transfer with L conservation.',
  },
  {
    to: '/rotational-dynamics-torque-seesaw',
    title: 'Torque Visualizer (Seesaw Balance)',
    description:
      'Place masses along a lever to compare left/right torque, identify equilibrium, and observe tilt under net torque.',
  },
  {
    to: '/rotational-dynamics-active-torque-disk',
    title: 'Active Torque Disk Simulator (Hold-to-Apply Torque)',
    description:
      'Hold a button to apply continuous tangential force and watch torque-driven changes in ω, L, and ΔL = τΔt.',
  },
  {
    to: '/rolling-energy-split',
    title: 'Rolling Without Slipping (Energy Split Explorer)',
    description:
      'Roll on a no-slip ramp: see PE convert into translational and rotational KE with β = I/(mr²), conserved total energy, and live stacked energy bars.',
  },
];

const oscillationsSims: SimLink[] = [
  {
    to: '/oscillations-vertical-spring',
    title: 'Vertical Spring Oscillator',
    description:
      'Hang a mass from a ceiling spring: tune k, m, and g, release from displacement y₀, and watch SHM with live forces and energy graphs.',
  },
  {
    to: '/oscillations-pendulum',
    title: 'Pendulum Motion Explorer',
    description:
      'Release a simple pendulum by angle or height: explore period, tension, energy exchange, and why mass does not affect small-angle timing.',
  },
  {
    to: '/oscillations-wave-generator',
    title: 'Wave Generator',
    description:
      'Traveling transverse wave on a string: tune amplitude, frequency, and speed, watch crests propagate, and verify v = fλ live.',
  },
  {
    to: '/oscillations-standing-waves',
    title: 'Standing Waves',
    description:
      'Fixed-fixed string driven at selectable frequencies: nodes, antinodes, harmonic resonance, and optional counter-propagating components.',
  },
];

const pressureSims: SimLink[] = [
  {
    to: '/pressure-point-explorer',
    title: 'Pressure Point Explorer',
    description:
      'Place circular contact patches on paper: tune force and radius, watch the live heatmap, and compare thumbtacks, coins, heels, and snowshoes via P = F/A.',
  },
  {
    to: '/buoyancy-explorer',
    title: 'Buoyancy Explorer',
    description:
      'Square block in a water tank: weight vs buoyant force, displaced volume, density presets, and float/sink/neutral status.',
  },
  {
    to: '/ideal-gas-law-explorer',
    title: 'Ideal Gas Law Explorer',
    description:
      '2D particle gas in a piston cylinder: collision-based pressure, PV vs nRT, constant-V/P modes, and live P–V–T–n graphs.',
  },
  {
    to: '/fluid-flow-explorer',
    title: 'Fluid Flow Explorer',
    description:
      'Horizontal pipe with adjustable radii: watch A₁v₁ = A₂v₂ — particles speed up in narrow sections and slow in wide ones.',
  },
  {
    to: '/bernoulli-flow-explorer',
    title: 'Bernoulli Flow Explorer',
    description:
      'Sloping tapering pipe: continuity + Bernoulli P + ½ρv² + ρgh = const, pressure-colored flow, energy profiles.',
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
          Physics 211: Mechanics
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-slate-300 sm:text-base">
          This page focus on materials for PHYS211, the algebra-based introductory physics course. The simulations are organized by unit, but feel free to jump around!
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

        <section>
          <h2 className="border-b border-slate-800 pb-2 text-sm font-semibold uppercase tracking-[0.15em] text-fuchsia-300/90">
            Unit 3 — Energy
          </h2>
          <ul className="mt-5 grid gap-4 sm:grid-cols-2">
            {energySims.map((sim) => (
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

        <section>
          <h2 className="border-b border-slate-800 pb-2 text-sm font-semibold uppercase tracking-[0.15em] text-amber-300/90">
            Unit 4 — Momentum
          </h2>
          <ul className="mt-5 grid gap-4 sm:grid-cols-2">
            {momentumSims.map((sim) => (
              <li key={sim.to}>
                <Link
                  to={sim.to}
                  className="group flex h-full flex-col rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-md shadow-slate-950/30 transition hover:border-amber-500/50 hover:bg-slate-900"
                >
                  <span className="text-base font-semibold text-slate-50 group-hover:text-amber-200/95">
                    {sim.title}
                  </span>
                  <p className="mt-2 flex-1 text-sm text-slate-400">{sim.description}</p>
                  <span className="mt-4 text-xs font-medium text-amber-300/90 transition group-hover:text-amber-200">
                    Open lab →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="border-b border-slate-800 pb-2 text-sm font-semibold uppercase tracking-[0.15em] text-violet-300/90">
            Unit 5 — Angular Motion
          </h2>
          <ul className="mt-5 grid gap-4 sm:grid-cols-2">
            {rotationalSims.map((sim) => (
              <li key={sim.to}>
                <Link
                  to={sim.to}
                  className="group flex h-full flex-col rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-md shadow-slate-950/30 transition hover:border-violet-500/50 hover:bg-slate-900"
                >
                  <span className="text-base font-semibold text-slate-50 group-hover:text-violet-200/95">
                    {sim.title}
                  </span>
                  <p className="mt-2 flex-1 text-sm text-slate-400">{sim.description}</p>
                  <span className="mt-4 text-xs font-medium text-violet-300/90 transition group-hover:text-violet-200">
                    Open lab →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="border-b border-slate-800 pb-2 text-sm font-semibold uppercase tracking-[0.15em] text-cyan-300/90">
            Unit 6 — Rotational Dynamics
          </h2>
          <ul className="mt-5 grid gap-4 sm:grid-cols-2">
            {rotationalDynamicsSims.map((sim) => (
              <li key={sim.to}>
                <Link
                  to={sim.to}
                  className="group flex h-full flex-col rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-md shadow-slate-950/30 transition hover:border-cyan-500/50 hover:bg-slate-900"
                >
                  <span className="text-base font-semibold text-slate-50 group-hover:text-cyan-200/95">
                    {sim.title}
                  </span>
                  <p className="mt-2 flex-1 text-sm text-slate-400">{sim.description}</p>
                  <span className="mt-4 text-xs font-medium text-cyan-300/90 transition group-hover:text-cyan-200">
                    Open lab →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="border-b border-slate-800 pb-2 text-sm font-semibold uppercase tracking-[0.15em] text-rose-300/90">
            Oscillations &amp; Waves
          </h2>
          <ul className="mt-5 grid gap-4 sm:grid-cols-2">
            {oscillationsSims.map((sim) => (
              <li key={sim.to}>
                <Link
                  to={sim.to}
                  className="group flex h-full flex-col rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-md shadow-slate-950/30 transition hover:border-rose-500/50 hover:bg-slate-900"
                >
                  <span className="text-base font-semibold text-slate-50 group-hover:text-rose-200/95">
                    {sim.title}
                  </span>
                  <p className="mt-2 flex-1 text-sm text-slate-400">{sim.description}</p>
                  <span className="mt-4 text-xs font-medium text-rose-300/90 transition group-hover:text-rose-200">
                    Open lab →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="border-b border-slate-800 pb-2 text-sm font-semibold uppercase tracking-[0.15em] text-amber-300/90">
            Pressure
          </h2>
          <ul className="mt-5 grid gap-4 sm:grid-cols-2">
            {pressureSims.map((sim) => (
              <li key={sim.to}>
                <Link
                  to={sim.to}
                  className="group flex h-full flex-col rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-md shadow-slate-950/30 transition hover:border-amber-500/50 hover:bg-slate-900"
                >
                  <span className="text-base font-semibold text-slate-50 group-hover:text-amber-200/95">
                    {sim.title}
                  </span>
                  <p className="mt-2 flex-1 text-sm text-slate-400">{sim.description}</p>
                  <span className="mt-4 text-xs font-medium text-amber-300/90 transition group-hover:text-amber-200">
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
