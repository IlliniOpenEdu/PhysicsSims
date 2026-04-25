import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { SliderWithInput } from '../../components/SliderWithInput';

type Vec2 = { x: number; y: number };

type OrbitalControls = {
  centralMass: number; // kg
  orbitingMass: number; // kg
  initialDistance: number; // m
  initialSpeed: number; // m/s
};

type SimSnapshot = {
  distance: number;
  speed: number;
  force: number;
  acceleration: number;
  energy: number;
  orbitType: 'bound' | 'unbound';
  simTime: number;
  crashed: boolean;
};

type SimState = {
  pos: Vec2;
  vel: Vec2;
  simTime: number;
  crashed: boolean;
};

const G = 6.674e-11;
const MAX_STEP_S = 1800; // Numerical stability with semi-implicit Euler.
const UI_PUSH_MS = 80;
const TRAIL_PUSH_MS = 50;
const MAX_TRAIL_POINTS = 1200;
const SECONDS_PER_DAY = 86_400;

const SUN_EARTH: OrbitalControls = {
  centralMass: 2e30,
  orbitingMass: 6e24,
  initialDistance: 1.5e11,
  initialSpeed: 29_800,
};

const EARTH_MOON: OrbitalControls = {
  centralMass: 6e24,
  orbitingMass: 7.35e22,
  initialDistance: 3.84e8,
  initialSpeed: 1_022,
};

const DEFAULT_CONTROLS: OrbitalControls = SUN_EARTH;

function vecMag(v: Vec2): number {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatSci(value: number): string {
  if (value === 0) return '0';
  return value.toExponential(3);
}

export function OrbitalMotion() {
  const [controls, setControls] = useState<OrbitalControls>(DEFAULT_CONTROLS);
  const [isRunning, setIsRunning] = useState(true);
  const [timeScaleDaysPerSecond, setTimeScaleDaysPerSecond] = useState(1);
  const [snapshot, setSnapshot] = useState<SimSnapshot>({
    distance: DEFAULT_CONTROLS.initialDistance,
    speed: DEFAULT_CONTROLS.initialSpeed,
    force: 0,
    acceleration: 0,
    energy: 0,
    orbitType: 'bound',
    simTime: 0,
    crashed: false,
  });
  const [trailSvg, setTrailSvg] = useState<string>('');

  const controlsRef = useRef(controls);
  const runningRef = useRef(isRunning);
  const timeScaleRef = useRef(timeScaleDaysPerSecond);
  const stateRef = useRef<SimState>({
    pos: { x: controls.initialDistance, y: 0 },
    vel: { x: 0, y: controls.initialSpeed },
    simTime: 0,
    crashed: false,
  });
  const trailWorldRef = useRef<Vec2[]>([{ x: controls.initialDistance, y: 0 }]);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const lastUiPushRef = useRef(0);
  const lastTrailPushRef = useRef(0);

  const orbitCircleRef = useRef<SVGCircleElement | null>(null);
  const orbitBodyRef = useRef<SVGCircleElement | null>(null);
  const velocityArrowRef = useRef<SVGLineElement | null>(null);
  const forceArrowRef = useRef<SVGLineElement | null>(null);

  useEffect(() => {
    controlsRef.current = controls;
  }, [controls]);

  useEffect(() => {
    runningRef.current = isRunning;
  }, [isRunning]);

  useEffect(() => {
    timeScaleRef.current = timeScaleDaysPerSecond;
  }, [timeScaleDaysPerSecond]);

  const worldHalfSpan = useMemo(() => {
    return Math.max(controls.initialDistance * 2.2, 1e7);
  }, [controls.initialDistance]);

  const centralRadiusPx = 1.4;

  const worldToSvg = (p: Vec2): Vec2 => ({
    x: 50 + (p.x / worldHalfSpan) * 46,
    y: 50 - (p.y / worldHalfSpan) * 46,
  });

  const pushUi = (ts: number) => {
    const { pos, vel, simTime, crashed } = stateRef.current;
    const { centralMass, orbitingMass } = controlsRef.current;
    const r = vecMag(pos);
    const v = vecMag(vel);
    const safeR = Math.max(r, 1);
    const force = (G * centralMass * orbitingMass) / (safeR * safeR);
    const acceleration = force / Math.max(orbitingMass, 1);
    const mu = G * centralMass;
    const specificEnergy = 0.5 * v * v - mu / safeR;
    setSnapshot({
      distance: r,
      speed: v,
      force,
      acceleration,
      energy: specificEnergy,
      orbitType: specificEnergy < 0 ? 'bound' : 'unbound',
      simTime,
      crashed,
    });
    lastUiPushRef.current = ts;
  };

  const pushTrailSvg = (ts: number) => {
    const points = trailWorldRef.current;
    if (points.length === 0) return;
    const path = points
      .map((p, idx) => {
        const s = worldToSvg(p);
        return `${idx === 0 ? 'M' : 'L'} ${s.x.toFixed(2)} ${s.y.toFixed(2)}`;
      })
      .join(' ');
    setTrailSvg(path);
    lastTrailPushRef.current = ts;
  };

  const resetSim = (next?: OrbitalControls) => {
    const c = next ?? controlsRef.current;
    stateRef.current = {
      pos: { x: c.initialDistance, y: 0 },
      vel: { x: 0, y: c.initialSpeed },
      simTime: 0,
      crashed: false,
    };
    trailWorldRef.current = [{ x: c.initialDistance, y: 0 }];
    lastTsRef.current = null;
    lastUiPushRef.current = 0;
    lastTrailPushRef.current = 0;
    pushUi(performance.now());
    pushTrailSvg(performance.now());
  };

  useEffect(() => {
    resetSim(controlsRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const step = (ts: number) => {
      if (!runningRef.current) {
        rafRef.current = null;
        lastTsRef.current = null;
        return;
      }

      if (lastTsRef.current == null) {
        lastTsRef.current = ts;
        pushUi(ts);
        pushTrailSvg(ts);
        rafRef.current = requestAnimationFrame(step);
        return;
      }

      let dtSim = ((ts - lastTsRef.current) / 1000) * timeScaleRef.current * SECONDS_PER_DAY;
      lastTsRef.current = ts;

      const c = controlsRef.current;
      const s = stateRef.current;
      const collisionRadius = Math.max(c.initialDistance * 0.03, 1e6);

      while (dtSim > 0 && !s.crashed) {
        const h = Math.min(dtSim, MAX_STEP_S);
        dtSim -= h;

        const r = vecMag(s.pos);
        const safeR = Math.max(r, 1);
        const factor = (-G * c.centralMass) / (safeR * safeR * safeR);
        const accel = { x: factor * s.pos.x, y: factor * s.pos.y };

        // Semi-implicit Euler for improved stability on orbital motion.
        s.vel.x += accel.x * h;
        s.vel.y += accel.y * h;
        s.pos.x += s.vel.x * h;
        s.pos.y += s.vel.y * h;
        s.simTime += h;

        const rAfter = vecMag(s.pos);
        if (rAfter <= collisionRadius) {
          s.crashed = true;
        }
      }

      const posSvg = worldToSvg(s.pos);
      if (orbitBodyRef.current) {
        orbitBodyRef.current.setAttribute('cx', posSvg.x.toFixed(2));
        orbitBodyRef.current.setAttribute('cy', posSvg.y.toFixed(2));
      }
      const centralSvg = { x: 50, y: 50 };
      if (orbitCircleRef.current) {
        orbitCircleRef.current.setAttribute('r', centralRadiusPx.toFixed(2));
      }

      const speed = vecMag(s.vel);
      const vScale = speed > 0 ? Math.min(10, 2 + Math.log10(speed + 1)) : 0;
      const vDir = speed > 0 ? { x: s.vel.x / speed, y: s.vel.y / speed } : { x: 0, y: 0 };
      if (velocityArrowRef.current) {
        velocityArrowRef.current.setAttribute('x1', posSvg.x.toFixed(2));
        velocityArrowRef.current.setAttribute('y1', posSvg.y.toFixed(2));
        velocityArrowRef.current.setAttribute('x2', (posSvg.x + (vDir.x * vScale * 46) / 100).toFixed(2));
        velocityArrowRef.current.setAttribute('y2', (posSvg.y - (vDir.y * vScale * 46) / 100).toFixed(2));
      }

      const rNow = Math.max(vecMag(s.pos), 1);
      const forceNow = (G * c.centralMass * c.orbitingMass) / (rNow * rNow);
      const forceDir = { x: -s.pos.x / rNow, y: -s.pos.y / rNow };
      const forceScale = Math.min(14, 1.2 + Math.log10(forceNow + 1) * 0.35);
      if (forceArrowRef.current) {
        forceArrowRef.current.setAttribute('x1', posSvg.x.toFixed(2));
        forceArrowRef.current.setAttribute('y1', posSvg.y.toFixed(2));
        forceArrowRef.current.setAttribute('x2', (posSvg.x + (forceDir.x * forceScale * 46) / 100).toFixed(2));
        forceArrowRef.current.setAttribute('y2', (posSvg.y - (forceDir.y * forceScale * 46) / 100).toFixed(2));
      }

      trailWorldRef.current.push({ x: s.pos.x, y: s.pos.y });
      if (trailWorldRef.current.length > MAX_TRAIL_POINTS) {
        trailWorldRef.current = trailWorldRef.current.slice(
          trailWorldRef.current.length - MAX_TRAIL_POINTS
        );
      }

      if (ts - lastUiPushRef.current >= UI_PUSH_MS) pushUi(ts);
      if (ts - lastTrailPushRef.current >= TRAIL_PUSH_MS) pushTrailSvg(ts);

      if (!s.crashed) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        pushUi(ts);
        rafRef.current = null;
        setIsRunning(false);
      }
    };

    if (isRunning && rafRef.current == null) {
      rafRef.current = requestAnimationFrame(step);
    }
    if (!isRunning && rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTsRef.current = null;
    }

    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [centralRadiusPx, isRunning, worldHalfSpan]);

  const applyPreset = (preset: OrbitalControls) => {
    setControls(preset);
    setIsRunning(false);
    requestAnimationFrame(() => resetSim(preset));
  };

  const orbitingMassMax = Math.max(controls.centralMass, 1e10);

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-8 text-slate-100">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">Mechanics</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
            Gravity &amp; Orbital Motion
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">
            Explore how gravitational force and initial velocity create stable orbits, escapes, or
            crashes around a massive central body.
          </p>
        </div>
        <Link
          to="/211"
          className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-sky-500 hover:text-sky-100"
        >
          <span className="text-sm">←</span>
          Back to PHYS211
        </Link>
      </header>

      <main className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/40">
          <h2 className="text-sm font-semibold tracking-wide text-sky-300">Orbital canvas</h2>
          <p className="mt-1 text-xs text-slate-300">
            Real distances are heavily compressed for visibility. Motion uses real SI units with an
            accelerated simulation clock.
          </p>
          <div className="mt-4 h-[28rem] rounded-xl border border-slate-800 bg-slate-950/85 p-3">
            <svg viewBox="0 0 100 100" className="h-full w-full rounded-lg">
              <rect x={2} y={2} width={96} height={96} rx={4} fill="#020617" stroke="#334155" strokeWidth={0.4} />
              <path d={trailSvg} fill="none" stroke="#67e8f9" strokeWidth={0.35} opacity={0.8} />
              <circle ref={orbitCircleRef} cx={50} cy={50} r={centralRadiusPx} fill="#f59e0b" stroke="#fbbf24" strokeWidth={0.6} />
              <line ref={velocityArrowRef} x1={60} y1={50} x2={62} y2={48} stroke="#22c55e" strokeWidth={0.5} />
              <line ref={forceArrowRef} x1={60} y1={50} x2={58} y2={50} stroke="#ef4444" strokeWidth={0.5} />
              <circle ref={orbitBodyRef} cx={60} cy={50} r={1.4} fill="#38bdf8" />
            </svg>
          </div>

          <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/70 p-3">
            <SliderWithInput
              label="Time scale"
              units="days/s"
              min={0.1}
              max={10}
              step={0.1}
              value={timeScaleDaysPerSecond}
              onChange={(v) => setTimeScaleDaysPerSecond(v)}
              syncToUrl={false}
            />
          </div>

          <div className="mt-4 grid gap-2 rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-xs text-slate-200 sm:grid-cols-2">
            <DataRow label="Distance, r" value={formatSci(snapshot.distance)} />
            <DataRow label="Speed, v" value={`${formatSci(snapshot.speed)} m/s`} />
            <DataRow label="|F grav|" value={`${formatSci(snapshot.force)} N`} />
            <DataRow label="|a|" value={`${formatSci(snapshot.acceleration)} m/s²`} />
            <DataRow label="Orbit type" value={snapshot.orbitType} />
            <DataRow label="Specific energy" value={`${formatSci(snapshot.energy)} J/kg`} />
            <DataRow label="Sim time" value={`${(snapshot.simTime / 86400).toFixed(2)} days`} />
            <DataRow label="Status" value={snapshot.crashed ? 'Crashed into central body' : 'In flight'} />
          </div>
        </section>

        <section className="flex min-h-[28rem] flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-950/80 p-5 shadow-lg shadow-slate-950/40">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-wide text-sky-300">Controls</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsRunning((v) => !v)}
                className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-[0.7rem] font-semibold text-slate-100 transition hover:border-sky-500"
              >
                {isRunning ? 'Pause' : 'Play'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsRunning(false);
                  resetSim();
                }}
                className="rounded-full bg-sky-500 px-3 py-1 text-[0.7rem] font-semibold text-slate-950 transition hover:bg-sky-400"
              >
                Reset
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
            <p className="text-xs font-medium text-slate-100">Presets</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => applyPreset(SUN_EARTH)}
                className="rounded-full border border-slate-600 bg-slate-950 px-3 py-1 text-[0.68rem] font-semibold text-slate-200 transition hover:border-sky-500 hover:text-sky-100"
              >
                Sun-Earth
              </button>
              <button
                type="button"
                onClick={() => applyPreset(EARTH_MOON)}
                className="rounded-full border border-slate-600 bg-slate-950 px-3 py-1 text-[0.68rem] font-semibold text-slate-200 transition hover:border-sky-500 hover:text-sky-100"
              >
                Earth-Moon
              </button>
            </div>
          </div>

          <SliderWithInput
            label="Central mass (M)"
            units="kg"
            min={1e20}
            max={2e30}
            step={1e20}
            value={controls.centralMass}
            onChange={(centralMass) => setControls((p) => ({ ...p, centralMass }))}
            syncToUrl={false}
          />

          <SliderWithInput
            label="Orbiting mass (m)"
            units="kg"
            min={1e10}
            max={orbitingMassMax}
            step={Math.max(1e10, orbitingMassMax / 200)}
            value={controls.orbitingMass}
            onChange={(orbitingMass) =>
              setControls((p) => ({ ...p, orbitingMass: clamp(orbitingMass, 1e10, p.centralMass) }))
            }
            syncToUrl={false}
          />

          <SliderWithInput
            label="Initial distance (r0)"
            units="m"
            min={1e6}
            max={6e12}
            step={Math.max(1e6, 6e12 / 1000)}
            value={controls.initialDistance}
            onChange={(initialDistance) => setControls((p) => ({ ...p, initialDistance }))}
            syncToUrl={false}
          />

          <SliderWithInput
            label="Initial tangential velocity (v0)"
            units="m/s"
            min={0}
            max={2e5}
            step={10}
            value={controls.initialSpeed}
            onChange={(initialSpeed) => setControls((p) => ({ ...p, initialSpeed }))}
            syncToUrl={false}
          />

          <button
            type="button"
            onClick={() => {
              setIsRunning(false);
              resetSim();
            }}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-sky-500 hover:text-sky-100"
          >
            Apply current controls
          </button>
        </section>
      </main>

      <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-sky-300">
          Concept explanation
        </h2>
        <div className="mt-3 space-y-2 text-sm text-slate-300">
          <p>
            Gravity follows an inverse-square law: F = G(Mm)/r². As distance grows, force rapidly
            weakens, which changes orbital curvature.
          </p>
          <p>
            Orbital motion appears when tangential velocity continuously “misses” the central body
            while gravity bends the path inward. Too little speed causes a crash, while too much
            speed yields an escape trajectory.
          </p>
          <p>
            Changing mass or radius shifts gravitational acceleration and required orbital speed. The
            Sun-Earth and Earth-Moon presets provide real-world scale references.
          </p>
        </div>
      </section>
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-900/70 px-3 py-2">
      <p className="text-[0.66rem] text-slate-400">{label}</p>
      <p className="mt-0.5 font-mono text-[0.78rem] text-sky-200">{value}</p>
    </div>
  );
}

