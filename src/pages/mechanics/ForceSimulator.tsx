import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

type Vec2 = { x: number; y: number };

type ForceControl = {
  enabled: boolean;
  magnitude: number; // N
  angleDeg: number; // degrees, 0 = right, 90 = up
};

type ControlsState = {
  mass: number; // kg
  gravityEnabled: boolean;
  forces: ForceControl[];
};

const DEFAULT_CONTROLS: ControlsState = {
  mass: 10,
  gravityEnabled: false,
  forces: [{ enabled: true, magnitude: 5, angleDeg: 0 }],
};

const MAX_FORCES = 4;

const NEW_FORCE_DEFAULTS: ForceControl = {
  enabled: true,
  magnitude: 5,
  angleDeg: 90,
};

const SIMULATION_SPEED = 1; // real time → simulation time
const TARGET_FPS = 60;
const FRAME_INTERVAL_MS = 1000 / TARGET_FPS;

/** Simulation bounds in meters: corners at (±BOUND_M, ±BOUND_M) */
const BOUND_M = 5;

/** SVG container for the playfield (matches the rounded rect below). Box is 6×6 centered on mapping points. */
const BOX_HALF_SVG = 3;
const CONTAINER_MIN_SVG = 3;
const CONTAINER_MAX_SVG = 97;
const MIN_CENTER_SVG = CONTAINER_MIN_SVG + BOX_HALF_SVG;
const MAX_CENTER_SVG = CONTAINER_MAX_SVG - BOX_HALF_SVG;

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Force vector in world coords: 0° = +x (right), 90° = +y (up). */
function forceToVector(force: ForceControl): Vec2 {
  if (!force.enabled || force.magnitude <= 0) return { x: 0, y: 0 };
  const rad = degToRad(force.angleDeg);
  return {
    x: force.magnitude * Math.cos(rad),
    y: force.magnitude * Math.sin(rad),
  };
}

/** Map world position (meters, y up) to SVG coords where the playfield matches ±BOUND_M at the container edges. */
function worldToSvg(pos: Vec2): Vec2 {
  const span = MAX_CENTER_SVG - MIN_CENTER_SVG;
  return {
    x: MIN_CENTER_SVG + ((pos.x + BOUND_M) / (2 * BOUND_M)) * span,
    y: MIN_CENTER_SVG + ((BOUND_M - pos.y) / (2 * BOUND_M)) * span,
  };
}

function addVec(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

function scaleVec(v: Vec2, s: number): Vec2 {
  return { x: v.x * s, y: v.y * s };
}

function vecMagnitude(v: Vec2): number {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

function gravityForceVector(mass: number, gravityEnabled: boolean): Vec2 {
  if (!gravityEnabled || mass <= 0) return { x: 0, y: 0 };
  // World coords use y-up; gravity is straight down with magnitude 9.8 * mass
  return { x: 0, y: -9.8 * mass };
}

export function ForceSimulator() {
  const [controls, setControls] = useState<ControlsState>(DEFAULT_CONTROLS);
  const [isRunning, setIsRunning] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [boxPos, setBoxPos] = useState<Vec2>({ x: 0, y: 0 });
  const [boxVel, setBoxVel] = useState<Vec2>({ x: 0, y: 0 });

  const animationFrameIdRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);
  const lastVisualUpdateRef = useRef<number | null>(null);

  const isRunningRef = useRef(isRunning);
  const controlsRef = useRef<ControlsState>(controls);
  const posRef = useRef<Vec2>(boxPos);
  const velRef = useRef<Vec2>(boxVel);

  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  useEffect(() => {
    controlsRef.current = controls;
  }, [controls]);

  useEffect(() => {
    posRef.current = boxPos;
  }, [boxPos]);

  useEffect(() => {
    velRef.current = boxVel;
  }, [boxVel]);

  useEffect(() => {
    return () => {
      if (animationFrameIdRef.current !== null) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, []);

  const startLoopIfNeeded = () => {
    if (animationFrameIdRef.current !== null || !isRunningRef.current) return;

    const step = (timestamp: number) => {
      if (!isRunningRef.current) {
        animationFrameIdRef.current = null;
        lastTimestampRef.current = null;
        return;
      }

      if (lastTimestampRef.current === null) {
        lastTimestampRef.current = timestamp;
        animationFrameIdRef.current = requestAnimationFrame(step);
        return;
      }

      const realDt = (timestamp - lastTimestampRef.current) / 1000;
      lastTimestampRef.current = timestamp;
      const dt = realDt * SIMULATION_SPEED;

      const { mass, forces, gravityEnabled } = controlsRef.current;
      const invMass = mass > 0 ? 1 / mass : 0;

      let netForce: Vec2 = { x: 0, y: 0 };
      for (const f of forces) {
        netForce = addVec(netForce, forceToVector(f));
      }
      netForce = addVec(netForce, gravityForceVector(mass, gravityEnabled));
      const acceleration = scaleVec(netForce, invMass);

      let nextVel = addVec(velRef.current, scaleVec(acceleration, dt));
      let nextPos = addVec(posRef.current, scaleVec(nextVel, dt));

      // Clamp to simulation bounds: x and y in [-BOUND_M, BOUND_M] meters
      // Zero velocity on the axis that hit the boundary so the box stops there
      if (nextPos.x < -BOUND_M) {
        nextPos = { ...nextPos, x: -BOUND_M };
        nextVel = { ...nextVel, x: 0 };
      }
      if (nextPos.x > BOUND_M) {
        nextPos = { ...nextPos, x: BOUND_M };
        nextVel = { ...nextVel, x: 0 };
      }
      if (nextPos.y < -BOUND_M) {
        nextPos = { ...nextPos, y: -BOUND_M };
        nextVel = { ...nextVel, y: 0 };
      }
      if (nextPos.y > BOUND_M) {
        nextPos = { ...nextPos, y: BOUND_M };
        nextVel = { ...nextVel, y: 0 };
      }

      posRef.current = nextPos;
      velRef.current = nextVel;

      const now = performance.now();
      if (
        lastVisualUpdateRef.current === null ||
        now - lastVisualUpdateRef.current >= FRAME_INTERVAL_MS
      ) {
        lastVisualUpdateRef.current = now;
        setBoxPos(nextPos);
        setBoxVel(nextVel);
      }

      animationFrameIdRef.current = requestAnimationFrame(step);
    };

    animationFrameIdRef.current = requestAnimationFrame(step);
  };

  useEffect(() => {
    if (isRunningRef.current) {
      startLoopIfNeeded();
    }
  }, [isRunning]);

  const resetState = () => {
    lastTimestampRef.current = null;
    lastVisualUpdateRef.current = null;
    const center = { x: 0, y: 0 };
    posRef.current = center;
    velRef.current = { x: 0, y: 0 };
    setBoxPos(center);
    setBoxVel({ x: 0, y: 0 });
  };

  const handleStartOrRestart = () => {
    resetState();
    setHasStarted(true);
    isRunningRef.current = true;
    setIsRunning(true);
    startLoopIfNeeded();
  };

  const handleToggleRunning = () => {
    if (isRunningRef.current) {
      isRunningRef.current = false;
      setIsRunning(false);
      if (animationFrameIdRef.current !== null) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
    } else {
      setIsRunning(true);
      isRunningRef.current = true;
      startLoopIfNeeded();
    }
  };

  const handleForceChange = (index: number, patch: Partial<ForceControl>) => {
    setControls((prev) => {
      const nextForces = prev.forces.map((f, i) =>
        i === index ? { ...f, ...patch } : f
      );
      return { ...prev, forces: nextForces };
    });
  };

  const handleAddForce = () => {
    setControls((prev) => {
      if (prev.forces.length >= MAX_FORCES) return prev;
      return {
        ...prev,
        forces: [...prev.forces, { ...NEW_FORCE_DEFAULTS }],
      };
    });
  };

  const handleRemoveForce = (index: number) => {
    setControls((prev) => {
      if (prev.forces.length <= 1) return prev;
      return {
        ...prev,
        forces: prev.forces.filter((_, i) => i !== index),
      };
    });
  };

  const handleMassChange = (mass: number) => {
    setControls((prev) => ({ ...prev, mass }));
  };

  const handleGravityToggle = () => {
    setControls((prev) => ({ ...prev, gravityEnabled: !prev.gravityEnabled }));
  };

  // Derived vectors for display
  const activeForces = controls.forces.map(forceToVector);
  const gravityForce = gravityForceVector(controls.mass, controls.gravityEnabled);
  let netForce: Vec2 = { x: 0, y: 0 };
  for (const f of activeForces) {
    netForce = addVec(netForce, f);
  }
  netForce = addVec(netForce, gravityForce);
  const netForceMag = vecMagnitude(netForce);
  const accelerationMag = controls.mass > 0 ? netForceMag / controls.mass : 0;

  // Visualization: one arrow per force; box and arrows in SVG coords (worldToSvg aligns ±BOUND_M with container edges)
  const boxCenterSvg = worldToSvg(boxPos);
  const arrowScale = 1.2; // N → SVG units length
  const maxArrowLength = 35;

  const forceArrows = controls.forces.map((force, i) => {
    const magnitude = force.magnitude;
    const angleDeg = force.angleDeg;
    const rad = degToRad(angleDeg);
    // 0° = right, 90° = up; SVG y is down so direction is (cos, -sin)
    const dirX = Math.cos(rad);
    const dirY = -Math.sin(rad);
    const visualLength = Math.min(maxArrowLength, magnitude * arrowScale);
    const tip: Vec2 = {
      x: boxCenterSvg.x + dirX * visualLength,
      y: boxCenterSvg.y + dirY * visualLength,
    };
    const colorPalette = ['#38bdf8', '#22c55e', '#eab308', '#f97316'];
    const color = colorPalette[i % colorPalette.length];
    const opacity = force.enabled && magnitude > 0 ? 1 : 0.35;
    return (
      <Arrow
        key={i}
        from={boxCenterSvg}
        to={tip}
        color={color}
        strokeWidth={2.5}
        headSize={8}
        opacity={opacity}
      />
    );
  });

  let gravityArrow: React.ReactNode = null;
  if (controls.gravityEnabled && controls.mass > 0) {
    const magnitude = Math.abs(gravityForce.y);
    const visualLength = Math.min(maxArrowLength, magnitude * arrowScale);
    const tip: Vec2 = {
      x: boxCenterSvg.x,
      y: boxCenterSvg.y + visualLength,
    };
    gravityArrow = (
      <Arrow
        from={boxCenterSvg}
        to={tip}
        color="#a78bfa"
        strokeWidth={2.5}
        headSize={8}
        opacity={0.45}
      />
    );
  }

  let netArrow: React.ReactNode = null;
  if (netForceMag > 0) {
    // Net force is in world coords (y up); SVG has y down, so flip y for drawing
    const dirSvg = { x: netForce.x / netForceMag, y: -netForce.y / netForceMag };
    const visualLength = Math.min(30, netForceMag * arrowScale);
    const tip: Vec2 = {
      x: boxCenterSvg.x + dirSvg.x * visualLength,
      y: boxCenterSvg.y + dirSvg.y * visualLength,
    };
    netArrow = (
      <Arrow
        from={boxCenterSvg}
        to={tip}
        color="#f97373"
        strokeWidth={3}
        headSize={10}
        opacity={0.95}
      />
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-8 text-slate-100">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">
            Forces demo
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
            Net force on a single object
          </h1>
          <p className="mt-2 max-w-xl text-sm text-slate-300">
            Add up to four forces acting on a box in a vacuum. The box accelerates according to the
            vector sum of all forces, following Newton&apos;s Second Law.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-sky-500 hover:text-sky-100"
          >
            <span className="text-sm">←</span>
            Back to welcome
          </Link>
          <span className="inline-flex items-center gap-2 rounded-full border border-sky-700/60 bg-sky-900/60 px-3 py-1 text-[0.7rem] font-medium text-sky-100">
            Single object · No friction or drag
          </span>
        </div>
      </header>

        <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/40">
          <h2 className="text-sm font-semibold tracking-wide text-sky-300">
            Color key
          </h2>
          <p className="mt-1 text-xs text-slate-300">
            Arrows on the canvas are labeled below. Only enabled forces appear in the key.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="flex items-center gap-2">
              <span
                className="h-3 w-8 shrink-0 rounded border border-red-400/60"
                style={{ backgroundColor: '#f97373' }}
                aria-hidden
              />
              <span className="text-xs text-slate-200">Net force</span>
            </div>
            {controls.gravityEnabled && (
              <div className="flex items-center gap-2">
                <span
                  className="h-3 w-8 shrink-0 rounded border border-slate-500/50 opacity-60"
                  style={{ backgroundColor: '#a78bfa' }}
                  aria-hidden
                />
                <span className="text-xs text-slate-200">Gravity</span>
              </div>
            )}
            {controls.forces.map((force, index) =>
              force.enabled ? (
                <div key={index} className="flex items-center gap-2">
                  <span
                    className="h-3 w-8 shrink-0 rounded border border-slate-500/50"
                    style={{
                      backgroundColor: ['#38bdf8', '#22c55e', '#eab308', '#f97316'][index],
                    }}
                    aria-hidden
                  />
                  <span className="text-xs text-slate-200">Force {index + 1}</span>
                </div>
              ) : null
            )}
          </div>
        </section>

      <main className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1.4fr)]">
        <section className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/40">
          <div className="pointer-events-none absolute inset-0 -z-10 opacity-70">
            <div className="absolute -left-32 top-0 h-64 w-64 rounded-full bg-sky-700/30 blur-3xl" />
            <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-blue-500/25 blur-3xl" />
          </div>

          <h2 className="text-sm font-semibold tracking-wide text-sky-300">
            Visualizing forces and motion
          </h2>
          <p className="mt-1 text-xs text-slate-300">
            The box starts in the center. Each enabled force is drawn as an arrow from the box
            center, and the red arrow shows the net force that sets the acceleration.
          </p>

          <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-stretch">
            <div className="relative flex min-w-0 h-[28rem] flex-[2] rounded-xl border border-slate-800 bg-gradient-to-tr from-slate-950 via-slate-950/95 to-slate-900/80 p-4">
              <svg
                viewBox="0 0 100 100"
                className="h-full w-full rounded-lg bg-slate-950/60"
                preserveAspectRatio="xMidYMid meet"
              >
                {/* Container boundaries */}
                <rect
                  x={3}
                  y={3}
                  width={94}
                  height={94}
                  rx={4}
                  ry={4}
                  fill="url(#grid-gradient)"
                  stroke="rgba(148,163,184,0.6)"
                  strokeWidth={0.6}
                />
                <defs>
                  <pattern
                    id="minor-grid"
                    x="0"
                    y="0"
                    width="5"
                    height="5"
                    patternUnits="userSpaceOnUse"
                  >
                    <path
                      d="M 5 0 L 0 0 0 5"
                      fill="none"
                      stroke="rgba(30,64,175,0.35)"
                      strokeWidth="0.15"
                    />
                  </pattern>
                  <pattern
                    id="grid-gradient"
                    x="0"
                    y="0"
                    width="5"
                    height="5"
                    patternUnits="userSpaceOnUse"
                  >
                    <rect width="5" height="5" fill="rgba(15,23,42,0.85)" />
                    <rect width="5" height="5" fill="url(#minor-grid)" />
                  </pattern>
                </defs>

                {/* Axes crosshair at center */}
                <line
                  x1={50}
                  y1={4}
                  x2={50}
                  y2={96}
                  stroke="rgba(30,64,175,0.4)"
                  strokeWidth={0.3}
                  strokeDasharray="1.5 2"
                />
                <line
                  x1={4}
                  y1={50}
                  x2={96}
                  y2={50}
                  stroke="rgba(30,64,175,0.4)"
                  strokeWidth={0.3}
                  strokeDasharray="1.5 2"
                />

                {/* Arrows for individual forces */}
                {forceArrows}

                {/* Gravity arrow */}
                {gravityArrow}

                {/* Net force arrow */}
                {netArrow}

                {/* Box */}
                <rect
                  x={boxCenterSvg.x - BOX_HALF_SVG}
                  y={boxCenterSvg.y - BOX_HALF_SVG}
                  width={BOX_HALF_SVG * 2}
                  height={BOX_HALF_SVG * 2}
                  rx={1}
                  ry={1}
                  fill="#38bdf8"
                  stroke="#0ea5e9"
                  strokeWidth={0.5}
                />
              </svg>

              <div className="absolute left-3 top-3 rounded-md bg-slate-950/80 px-2 py-1 text-[0.6rem] text-slate-300 shadow">
                <p className="font-mono text-[0.6rem] text-slate-200">
                  |F<sub>net</sub>| ≈ {netForceMag.toFixed(1)} N
                </p>
                <p className="font-mono text-[0.6rem] text-slate-200">
                  |a| ≈ {accelerationMag.toFixed(2)} m/s²
                </p>
              </div>

              <div className="absolute bottom-3 left-3 rounded-md bg-slate-950/80 px-2 py-1 text-[0.6rem] text-slate-300 shadow">
                <p className="font-mono text-[0.6rem] text-sky-200">
                  x = {boxPos.x.toFixed(2)} m, y = {boxPos.y.toFixed(2)} m
                </p>
                <p className="font-mono text-[0.6rem] text-sky-200">
                  v<sub>x</sub> = {boxVel.x.toFixed(2)} m/s, v<sub>y</sub> = {boxVel.y.toFixed(2)} m/s
                </p>
              </div>
            </div>

            <div className="flex min-w-0 flex-1 max-w-[200px] flex-col gap-2 rounded-xl border border-slate-800 bg-slate-950/80 p-2.5 text-[0.75rem] text-slate-300">
              <p className="shrink-0 font-semibold text-sky-200">Live summary</p>
              <div className="space-y-1.5">
                <SummaryRow label="Mass" value={controls.mass} units="kg" />
                <SummaryRow label="Net force" value={netForceMag} units="N" />
                <SummaryRow label="Acceleration" value={accelerationMag} units="m/s²" />
              </div>
            </div>
          </div>
        </section>

        <section className="flex min-h-[28rem] flex-col space-y-4 rounded-2xl border border-slate-800 bg-slate-950/80 p-5 shadow-lg shadow-slate-950/40">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold tracking-wide text-sky-300">
              Force controls
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleStartOrRestart}
                disabled={isRunning}
                className="inline-flex items-center gap-2 rounded-full bg-sky-500 px-4 py-1.5 text-xs font-semibold text-slate-950 shadow-md shadow-sky-900/50 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-200"
              >
                {hasStarted && !isRunning ? 'Restart' : 'Start'}
              </button>
              <button
                type="button"
                onClick={handleToggleRunning}
                disabled={!hasStarted}
                className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-[0.7rem] font-semibold text-slate-100 shadow-sm transition hover:border-sky-500 hover:text-sky-100 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-800 disabled:text-slate-500"
              >
                {isRunning ? 'Pause' : 'Resume'}
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-300">
            Start with one force, then add more (up to four total). Each arrow originates at the box
            center. Only the enabled forces contribute to the net force and acceleration.
          </p>

          <div className="mt-2 space-y-3 text-xs">
            <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-3">
              <p className="text-xs font-medium text-slate-100">Mass</p>
              <SliderWithInput
                label="Object mass"
                units="kg"
                min={0.1}
                max={20}
                step={0.1}
                value={controls.mass}
                onChange={handleMassChange}
              />
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-slate-100">Gravity</p>
                  <p className="mt-1 text-[0.65rem] text-slate-400">
                    Applies a constant downward force of {(9.8 * controls.mass).toFixed(1)} N.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleGravityToggle}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.65rem] font-semibold transition ${
                    controls.gravityEnabled
                      ? 'bg-violet-400 text-slate-950'
                      : 'border border-slate-700 bg-slate-900 text-slate-300 hover:border-sky-500'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      controls.gravityEnabled ? 'bg-violet-700' : 'bg-slate-500'
                    }`}
                  />
                  {controls.gravityEnabled ? 'Enabled' : 'Disabled'}
                </button>
              </div>
            </div>

            {controls.forces.map((force, index) => (
              <ForceControlCard
                key={index}
                index={index}
                force={force}
                onChange={(patch) => handleForceChange(index, patch)}
                onRemove={
                  controls.forces.length > 1
                    ? () => handleRemoveForce(index)
                    : undefined
                }
              />
            ))}

            {controls.forces.length < MAX_FORCES && (
              <button
                type="button"
                onClick={handleAddForce}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-600 bg-slate-900/60 py-3 text-[0.8rem] font-medium text-slate-300 transition hover:border-sky-500 hover:bg-slate-800/80 hover:text-sky-200"
              >
                <span className="text-sky-400">+</span>
                Add force
              </button>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

type ArrowProps = {
  from: Vec2;
  to: Vec2;
  color: string;
  strokeWidth?: number;
  headSize?: number;
  opacity?: number;
};

function Arrow({ from, to, color, strokeWidth = 2.5, headSize = 8, opacity = 1 }: ArrowProps) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const headLength = Math.min(headSize, len * 0.4);
  const baseX = to.x - ux * headLength;
  const baseY = to.y - uy * headLength;
  const halfWidth = headLength * 0.7;
  const leftX = baseX - uy * halfWidth;
  const leftY = baseY + ux * halfWidth;
  const rightX = baseX + uy * halfWidth;
  const rightY = baseY - ux * halfWidth;

  return (
    <g opacity={opacity}>
      <line
        x1={from.x}
        y1={from.y}
        x2={baseX}
        y2={baseY}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <polygon
        points={`${to.x},${to.y} ${leftX},${leftY} ${rightX},${rightY}`}
        fill={color}
        stroke={color}
        strokeWidth={0.8}
      />
    </g>
  );
}

type ForceControlCardProps = {
  index: number;
  force: ForceControl;
  onChange: (patch: Partial<ForceControl>) => void;
  onRemove?: () => void;
};

function ForceControlCard({ index, force, onChange, onRemove }: ForceControlCardProps) {
  const labelId = `force-${index + 1}`;
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-[0.65rem] font-semibold text-sky-300">
            {index + 1}
          </span>
          <label htmlFor={labelId} className="text-xs font-medium text-slate-100">
            Force {index + 1}
          </label>
        </div>
        <div className="flex items-center gap-2">
          {onRemove != null && (
            <button
              type="button"
              onClick={onRemove}
              className="rounded-full border border-slate-600 bg-slate-800 px-2 py-1 text-[0.65rem] font-medium text-slate-300 transition hover:border-red-500/70 hover:bg-slate-700 hover:text-red-200"
              title="Remove this force"
            >
              Remove
            </button>
          )}
          <button
            id={labelId}
            type="button"
            onClick={() => onChange({ enabled: !force.enabled })}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.65rem] font-semibold transition ${
              force.enabled
                ? 'bg-emerald-500 text-slate-950'
                : 'border border-slate-700 bg-slate-900 text-slate-300 hover:border-sky-500'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                force.enabled ? 'bg-emerald-700' : 'bg-slate-500'
              }`}
            />
            {force.enabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>
      </div>

      <div className={`mt-3 space-y-3 ${!force.enabled ? 'opacity-60' : ''}`}>
        <SliderWithInput
          label="Magnitude"
          units="N"
          min={0}
          max={20}
          step={0.2}
          value={force.magnitude}
          onChange={(value) => onChange({ magnitude: value })}
        />
        <SliderWithInput
          label="Angle"
          units="°"
          min={0}
          max={360}
          step={1}
          value={force.angleDeg}
          onChange={(value) => onChange({ angleDeg: value })}
          description="0° = right, 90° = up"
        />
      </div>
    </div>
  );
}

type SliderWithInputProps = {
  label: string;
  units: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  description?: string;
};

function SliderWithInput({
  label,
  units,
  min,
  max,
  step,
  value,
  onChange,
  description,
}: SliderWithInputProps) {
  const handleSliderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange(Number(event.target.value));
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = Number(event.target.value);
    if (Number.isNaN(parsed)) return;
    const clamped = Math.min(max, Math.max(min, parsed));
    onChange(clamped);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-slate-200">{label}</p>
        <span className="text-[0.65rem] text-slate-400">
          {value.toFixed(2)} {units}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleSliderChange}
          className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-slate-800 accent-sky-400"
        />
        <div className="flex items-center gap-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1">
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={value.toFixed(2)}
            onChange={handleInputChange}
            className="w-20 bg-transparent text-right text-[0.7rem] text-slate-100 outline-none"
          />
          <span className="text-[0.65rem] text-slate-400">{units}</span>
        </div>
      </div>
      <div className="flex justify-between text-[0.6rem] text-slate-500">
        <span>
          Min: {min} {units}
        </span>
        <span>
          Max: {max} {units}
        </span>
      </div>
      {description && (
        <p className="text-[0.6rem] text-slate-500">{description}</p>
      )}
    </div>
  );
}

type SummaryRowProps = {
  label: string;
  value: number;
  units: string;
};

function SummaryRow({ label, value, units }: SummaryRowProps) {
  return (
    <div className="flex items-baseline justify-between gap-3 rounded-md border border-slate-800 bg-slate-900/80 px-3 py-2">
      <span className="text-[0.7rem] text-slate-300">{label}</span>
      <span className="text-[0.7rem] font-mono text-sky-200">
        {value.toFixed(2)}{' '}
        <span className="text-[0.65rem] text-slate-400">{units}</span>
      </span>
    </div>
  );
}

