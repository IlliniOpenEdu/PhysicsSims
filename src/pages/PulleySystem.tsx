import React, { memo, startTransition, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

type Vec2 = { x: number; y: number };

type ControlsState = {
  mass1Kg: number;
  mass2Kg: number;
};

const DEFAULT_CONTROLS: ControlsState = {
  mass1Kg: 5,
  mass2Kg: 8,
};

const G = 9.8; // m/s^2

const SIMULATION_SPEED = 1;
const TARGET_FPS = 60;
const FRAME_INTERVAL_MS = 1000 / TARGET_FPS;
const MAX_SIM_DT_S = 1 / 30;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function roundTo2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Net force on the two-mass system along the rope (positive → mass 2 tends down): m₂g − m₁g */
function netForceN(m1: number, m2: number): number {
  return G * (m2 - m1);
}

function atwoodAcceleration(m1: number, m2: number): number {
  const denom = m1 + m2;
  if (denom <= 0) return 0;
  return netForceN(m1, m2) / denom;
}

function atwoodTension(m1: number, m2: number): number {
  const denom = m1 + m2;
  if (denom <= 0) return 0;
  return (2 * m1 * m2 * G) / denom;
}

/** Geometry for clamp (matches SVG layout below) — kept out of the per-frame hot path */
const PULLEY_CENTER_X = 50;
/** Pulley placed higher so vertical rope spans read longer (zoomed-out scene) */
const PULLEY_CENTER_Y = 12;
/** Smaller wheel + masses vs earlier version — appears more “zoomed out” in the frame */
const PULLEY_R = 5.5;
const PULLEY_OUTER_R = PULLEY_R + 2;
/** Equilibrium mass center height; longer rope to pulley than compact layout */
const BASE_Y = 74;
const METERS_TO_SVG = 11;
const MASS_SIZE = { w: 7, h: 9 };
const HALF_MASS_H = MASS_SIZE.h / 2;
/** Horizontal line at the top of the floor; masses’ bottoms stay at or above this */
const GROUND_SURFACE_Y = 108;
const GROUND_CONTACT_EPS = 0.5;
/** Highest y allowed for a mass center (bottom edge on/near ground) */
const MAX_CENTER_Y = GROUND_SURFACE_Y - GROUND_CONTACT_EPS - HALF_MASS_H;
const MIN_CENTER_Y = PULLEY_CENTER_Y + PULLEY_R + MASS_SIZE.h / 2 + 5;

/**
 * Rope displacement limits: pulley clearance + ground on both sides.
 * At either limit one mass rests on the ground; motion into the floor is blocked (see stepPhysics).
 */
const MIN_DISP_M = Math.max(
  (MIN_CENTER_Y - BASE_Y) / METERS_TO_SVG,
  (BASE_Y + HALF_MASS_H - GROUND_SURFACE_Y) / METERS_TO_SVG
);
const MAX_DISP_M = Math.min(
  (BASE_Y - MIN_CENTER_Y) / METERS_TO_SVG,
  (GROUND_SURFACE_Y - HALF_MASS_H - BASE_Y) / METERS_TO_SVG
);

/** Match physics contact detection for drawing normal forces */
const DISP_CONTACT_EPS = 2e-3;

export function PulleySystem() {
  const [controls, setControls] = useState<ControlsState>(DEFAULT_CONTROLS);
  const [isRunning, setIsRunning] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  const animationFrameIdRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);
  const lastVisualUpdateRef = useRef<number | null>(null);

  const isRunningRef = useRef(isRunning);
  const controlsRef = useRef<ControlsState>(DEFAULT_CONTROLS);
  const dispRef = useRef(0);
  const velRef = useRef(0);
  const lastPushedDispRef = useRef(0);
  const lastPushedVelRef = useRef(0);

  const [uiSnapshot, setUiSnapshot] = useState(() => ({
    dispM: dispRef.current,
    velMps: velRef.current,
  }));

  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  useEffect(() => {
    return () => {
      if (animationFrameIdRef.current !== null) cancelAnimationFrame(animationFrameIdRef.current);
    };
  }, []);

  const resetSimulation = () => {
    dispRef.current = 0;
    velRef.current = 0;
    lastPushedDispRef.current = 0;
    lastPushedVelRef.current = 0;
    lastTimestampRef.current = null;
    lastVisualUpdateRef.current = null;
    setUiSnapshot({ dispM: 0, velMps: 0 });
  };

  /**
   * Same integration pattern as ForceSimulator: a = F_net / M_total, v += a dt, x += v dt.
   * When one mass is on the ground, normal force cancels the drive on the system: no acceleration
   * into the floor (both masses share one rope, so the other mass stops as well).
   */
  const stepPhysics = (dt: number) => {
    const { mass1Kg, mass2Kg } = controlsRef.current;
    const m1 = clamp(mass1Kg, 0.5, 20);
    const m2 = clamp(mass2Kg, 0.5, 20);
    const totalM = m1 + m2;

    const Fnet = netForceN(m1, m2);
    let a = totalM > 0 ? Fnet / totalM : 0;

    const disp = dispRef.current;
    const eps = 1e-4;
    // Right mass on ground (max disp): cannot accelerate further downward (positive a).
    if (disp >= MAX_DISP_M - eps && a > 0) a = 0;
    // Left mass on ground (min disp): cannot accelerate further downward (negative a).
    if (disp <= MIN_DISP_M + eps && a < 0) a = 0;

    let nextVel = velRef.current + a * dt;
    let nextDisp = disp + nextVel * dt;

    if (nextDisp < MIN_DISP_M) {
      nextDisp = MIN_DISP_M;
      nextVel = 0;
    } else if (nextDisp > MAX_DISP_M) {
      nextDisp = MAX_DISP_M;
      nextVel = 0;
    }

    velRef.current = nextVel;
    dispRef.current = nextDisp;
  };

  const startLoopIfNeeded = () => {
    if (animationFrameIdRef.current !== null || !isRunningRef.current) return;

    const loop = (ts: number) => {
      if (!isRunningRef.current) {
        animationFrameIdRef.current = null;
        lastTimestampRef.current = null;
        return;
      }

      if (lastTimestampRef.current === null) {
        lastTimestampRef.current = ts;
        animationFrameIdRef.current = requestAnimationFrame(loop);
        return;
      }

      const realDt = (ts - lastTimestampRef.current) / 1000;
      lastTimestampRef.current = ts;
      const dt = clamp(realDt * SIMULATION_SPEED, 0, MAX_SIM_DT_S);

      stepPhysics(dt);

      const now = performance.now();
      if (lastVisualUpdateRef.current === null || now - lastVisualUpdateRef.current >= FRAME_INTERVAL_MS) {
        lastVisualUpdateRef.current = now;
        const d = dispRef.current;
        const v = velRef.current;
        const dChanged = Math.abs(d - lastPushedDispRef.current) > 1e-5;
        const vChanged = Math.abs(v - lastPushedVelRef.current) > 1e-5;
        if (dChanged || vChanged) {
          lastPushedDispRef.current = d;
          lastPushedVelRef.current = v;
          setUiSnapshot({ dispM: d, velMps: v });
        }
      }

      animationFrameIdRef.current = requestAnimationFrame(loop);
    };

    animationFrameIdRef.current = requestAnimationFrame(loop);
  };

  useEffect(() => {
    if (isRunningRef.current) startLoopIfNeeded();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning]);

  const handleControlChange = (field: keyof ControlsState, value: number) => {
    const v = clamp(value, 0.5, 20);
    controlsRef.current = { ...controlsRef.current, [field]: v };
    startTransition(() => {
      setControls((prev) => ({ ...prev, [field]: v }));
    });
  };

  const handleStartOrRestart = () => {
    resetSimulation();
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
      isRunningRef.current = true;
      setIsRunning(true);
      startLoopIfNeeded();
    }
  };

  const m1 = controls.mass1Kg;
  const m2 = controls.mass2Kg;
  const a = atwoodAcceleration(m1, m2);
  const tensionN = atwoodTension(m1, m2);

  const motionChip = useMemo(() => {
    if (Math.abs(m1 - m2) < 1e-6) return 'Equilibrium · No acceleration';
    return m2 > m1 ? 'Mass 2 down · Mass 1 up' : 'Mass 1 down · Mass 2 up';
  }, [m1, m2]);

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-8 text-slate-100">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">
            Forces demo
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
            Pulley System
          </h1>
          <p className="mt-2 max-w-xl text-sm text-slate-300">
            Two masses hang on either side of an ideal pulley (massless rope, frictionless pulley).
            If one mass is heavier, it accelerates downward and lifts the other mass upward.
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
            {motionChip}
          </span>
        </div>
      </header>

      <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/40">
        <h2 className="text-sm font-semibold tracking-wide text-sky-300">Color key</h2>
        <p className="mt-1 text-xs text-slate-300">
          Arrows on the canvas originate from each mass center. When a mass rests on the floor, a red
          normal force appears (same style as net-force arrows in the other force labs).
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex items-center gap-2">
            <span
              className="h-3 w-8 shrink-0 rounded border border-slate-500/50"
              style={{ backgroundColor: '#38bdf8' }}
              aria-hidden
            />
            <span className="text-xs text-slate-200">Tension (rope pull)</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="h-3 w-8 shrink-0 rounded border border-slate-500/50 opacity-60"
              style={{ backgroundColor: '#a78bfa' }}
              aria-hidden
            />
            <span className="text-xs text-slate-200">Gravity (weight)</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="h-3 w-8 shrink-0 rounded border border-red-400/60"
              style={{ backgroundColor: '#f97373' }}
              aria-hidden
            />
            <span className="text-xs text-slate-200">Normal (floor push)</span>
          </div>
        </div>
      </section>

      <main className="grid gap-6 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1.2fr)]">
        <section className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/40">
          <div className="pointer-events-none absolute inset-0 -z-10 opacity-70">
            <div className="absolute -left-32 top-0 h-64 w-64 rounded-full bg-sky-700/30 blur-3xl" />
            <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-blue-500/25 blur-3xl" />
          </div>

          <h2 className="text-sm font-semibold tracking-wide text-sky-300">
            Visualizing an Atwood machine
          </h2>
          <p className="mt-1 text-xs text-slate-300">
            The rope length stays constant: when one mass moves down, the other moves up by the same
            amount. The arrows show tension (blue, up), gravity (violet, down), and when a mass sits
            on the floor, normal force (red, up). The bright green line is the floor surface; when a
            mass rests on it, the whole system stops — the normal force balances the drive on the
            rope.
          </p>

          <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-stretch">
            <div className="relative flex min-w-0 h-[30rem] flex-[2] rounded-xl border border-slate-800 bg-gradient-to-t from-slate-950 via-slate-950/95 to-slate-900/80 p-4">
              <PulleySvgScene
                dispM={uiSnapshot.dispM}
                m1Kg={m1}
                m2Kg={m2}
                tensionN={tensionN}
              />

              <div className="absolute left-3 top-3 rounded-md bg-slate-950/80 px-2 py-1 text-[0.6rem] text-slate-300 shadow">
                <p className="font-mono text-[0.6rem] text-slate-200">
                  a ≈ {a.toFixed(2)} m/s²
                </p>
                <p className="font-mono text-[0.6rem] text-slate-200">
                  T ≈ {tensionN.toFixed(1)} N
                </p>
              </div>

              <div className="absolute bottom-3 left-3 rounded-md bg-slate-950/80 px-2 py-1 text-[0.6rem] text-slate-300 shadow">
                <p className="font-mono text-[0.6rem] text-sky-200">
                  displacement = {uiSnapshot.dispM.toFixed(2)} m
                </p>
                <p className="font-mono text-[0.6rem] text-sky-200">
                  v = {uiSnapshot.velMps.toFixed(2)} m/s
                </p>
              </div>
            </div>

            <div className="flex min-w-0 flex-1 max-w-[220px] flex-col gap-2 rounded-xl border border-slate-800 bg-slate-950/80 p-2.5 text-[0.75rem] text-slate-300">
              <p className="shrink-0 font-semibold text-sky-200">Live summary</p>
              <div className="space-y-1.5">
                <MetricRow label="Mass 1" value={m1} units="kg" />
                <MetricRow label="Mass 2" value={m2} units="kg" />
                <MetricRow label="Acceleration" value={a} units="m/s²" />
                <MetricRow label="Tension" value={tensionN} units="N" />
              </div>
            </div>
          </div>
        </section>

        <section className="flex min-h-[30rem] flex-col space-y-4 rounded-2xl border border-slate-800 bg-slate-950/80 p-5 shadow-lg shadow-slate-950/40">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold tracking-wide text-sky-300">
              Controls
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
            Set the two masses, then start the simulation. Gravity is fixed at
            <span className="mx-1 rounded bg-slate-900 px-1 py-0.5 font-mono text-[0.65rem] text-sky-200">
              g = 9.8 m/s²
            </span>
            and the rope/pulley are ideal.
          </p>

          <div className="mt-3 space-y-4 text-xs">
            <ControlRow
              label="Mass 1 (left side)"
              units="kg"
              min={0.5}
              max={20}
              step={0.1}
              value={controls.mass1Kg}
              onChange={(v) => handleControlChange('mass1Kg', v)}
              disabled={false}
            />
            <ControlRow
              label="Mass 2 (right side)"
              units="kg"
              min={0.5}
              max={20}
              step={0.1}
              value={controls.mass2Kg}
              onChange={(v) => handleControlChange('mass2Kg', v)}
              disabled={false}
            />
          </div>

          <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/80 p-3 text-[0.7rem] text-slate-300">
            Ideal Atwood machine formulas:
            <div className="mt-2 space-y-1 font-mono text-[0.65rem] text-sky-200">
              <div>a = g (m₂ − m₁) / (m₁ + m₂)</div>
              <div>T = 2 m₁ m₂ g / (m₁ + m₂)</div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/40 lg:col-span-2">
          <h2 className="text-sm font-semibold tracking-wide text-sky-300">
            Concept explanation
          </h2>
          <div className="mt-3 grid gap-4 text-sm text-slate-300 md:grid-cols-2">
            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
              <p className="font-semibold text-slate-50">Tension vs. weight</p>
              <p className="mt-2 text-xs leading-relaxed">
                Each mass has two main forces: gravity \(mg\) downward and rope tension \(T\) upward.
                Because the pulley is frictionless and the rope is massless, the tension is the same
                on both sides.
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
              <p className="font-semibold text-slate-50">Why unequal masses accelerate</p>
              <p className="mt-2 text-xs leading-relaxed">
                If \(m_2 &gt; m_1\), the net pull on the system points toward mass 2, so mass 2 speeds up
                downward and mass 1 speeds up upward. The acceleration depends on how different the
                masses are compared to the total mass.
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
              <p className="font-semibold text-slate-50">Net force on each mass</p>
              <p className="mt-2 text-xs leading-relaxed">
                For mass 1 (moving up when \(m_2 &gt; m_1\)): \(T - m_1 g = m_1 a\). For mass 2 (moving
                down): \(m_2 g - T = m_2 a\). The same \(a\) appears in both equations because the rope
                constrains them to move together.
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
              <p className="font-semibold text-slate-50">Equilibrium when masses match</p>
              <p className="mt-2 text-xs leading-relaxed">
                If \(m_1 = m_2\), the weights match, so the net driving force is zero and
                \(a = 0\). In an ideal model, the system stays in equilibrium (no change in velocity).
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

type PulleySvgSceneProps = {
  dispM: number;
  m1Kg: number;
  m2Kg: number;
  tensionN: number;
};

const PulleySvgScene = memo(function PulleySvgScene({
  dispM,
  m1Kg,
  m2Kg,
  tensionN,
}: PulleySvgSceneProps) {
  const pulleyCenter: Vec2 = { x: PULLEY_CENTER_X, y: PULLEY_CENTER_Y };
  /** Mass centers sit on the vertical lines through the left/right rim (realistic vertical ropes). */
  const mass1Center: Vec2 = { x: PULLEY_CENTER_X - PULLEY_R, y: BASE_Y - dispM * METERS_TO_SVG };
  const mass2Center: Vec2 = { x: PULLEY_CENTER_X + PULLEY_R, y: BASE_Y + dispM * METERS_TO_SVG };

  const m1CenterClamped: Vec2 = { ...mass1Center, y: clamp(mass1Center.y, MIN_CENTER_Y, MAX_CENTER_Y) };
  const m2CenterClamped: Vec2 = { ...mass2Center, y: clamp(mass2Center.y, MIN_CENTER_Y, MAX_CENTER_Y) };

  const ropeLeftPoint: Vec2 = { x: pulleyCenter.x - PULLEY_R, y: pulleyCenter.y };
  const ropeRightPoint: Vec2 = { x: pulleyCenter.x + PULLEY_R, y: pulleyCenter.y };
  const m1Top: Vec2 = { x: m1CenterClamped.x, y: m1CenterClamped.y - MASS_SIZE.h / 2 };
  const m2Top: Vec2 = { x: m2CenterClamped.x, y: m2CenterClamped.y - MASS_SIZE.h / 2 };

  const weight1N = m1Kg * G;
  const weight2N = m2Kg * G;
  const arrowScale = 0.12;
  const maxArrowLength = 16;
  const gravity1Len = Math.min(maxArrowLength, weight1N * arrowScale);
  const gravity2Len = Math.min(maxArrowLength, weight2N * arrowScale);
  const tensionLen = Math.min(maxArrowLength, tensionN * arrowScale);

  const mass1OnGround = dispM <= MIN_DISP_M + DISP_CONTACT_EPS;
  const mass2OnGround = dispM >= MAX_DISP_M - DISP_CONTACT_EPS;
  /** At rest on the floor: N = mg − T (rope pulls up). */
  const normal1N = mass1OnGround ? Math.max(0, weight1N - tensionN) : 0;
  const normal2N = mass2OnGround ? Math.max(0, weight2N - tensionN) : 0;
  const normal1Len = Math.min(maxArrowLength, normal1N * arrowScale);
  const normal2Len = Math.min(maxArrowLength, normal2N * arrowScale);

  const ropePath = [
    `M ${m1Top.x} ${m1Top.y}`,
    `L ${ropeLeftPoint.x} ${ropeLeftPoint.y}`,
    `A ${PULLEY_R} ${PULLEY_R} 0 0 1 ${ropeRightPoint.x} ${ropeRightPoint.y}`,
    `L ${m2Top.x} ${m2Top.y}`,
  ].join(' ');

  return (
    <svg
      viewBox="0 0 100 120"
      className="h-full w-full rounded-lg bg-slate-950/60"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient
          id="pulley-sky"
          gradientUnits="userSpaceOnUse"
          x1={50}
          y1={3}
          x2={50}
          y2={GROUND_SURFACE_Y}
        >
          <stop offset="0%" stopColor="rgba(15,23,42,0.88)" />
          <stop offset="100%" stopColor="rgba(15,23,42,0.94)" />
        </linearGradient>
      </defs>

      {/* Sky fills the chamber; no green fill below the floor line (only the line marks the floor). */}
      <rect
        x={3}
        y={3}
        width={94}
        height={114}
        rx={4}
        ry={4}
        fill="url(#pulley-sky)"
        stroke="rgba(148,163,184,0.55)"
        strokeWidth={0.55}
      />
      <line
        x1={4}
        y1={GROUND_SURFACE_Y}
        x2={96}
        y2={GROUND_SURFACE_Y}
        stroke="rgba(16,185,129,0.75)"
        strokeWidth={0.85}
      />

      <circle
        cx={pulleyCenter.x}
        cy={pulleyCenter.y}
        r={PULLEY_OUTER_R}
        fill="rgba(30,41,59,0.9)"
        stroke="rgba(148,163,184,0.55)"
        strokeWidth={0.65}
      />
      <circle
        cx={pulleyCenter.x}
        cy={pulleyCenter.y}
        r={PULLEY_R}
        fill="rgba(15,23,42,0.9)"
        stroke="rgba(56,189,248,0.65)"
        strokeWidth={0.65}
      />
      <circle cx={pulleyCenter.x} cy={pulleyCenter.y} r={1.25} fill="#38bdf8" opacity={0.9} />

      <path
        d={ropePath}
        fill="none"
        stroke="rgba(226,232,240,0.65)"
        strokeWidth={1.15}
        strokeLinecap="round"
      />

      <Arrow
        from={m1CenterClamped}
        to={{ x: m1CenterClamped.x, y: m1CenterClamped.y - tensionLen }}
        color="#38bdf8"
        strokeWidth={2}
        headSize={6}
        opacity={0.95}
      />
      <Arrow
        from={m1CenterClamped}
        to={{ x: m1CenterClamped.x, y: m1CenterClamped.y + gravity1Len }}
        color="#a78bfa"
        strokeWidth={2}
        headSize={6}
        opacity={0.55}
      />
      {normal1N > 0 && (
        <Arrow
          from={m1CenterClamped}
          to={{ x: m1CenterClamped.x, y: m1CenterClamped.y - normal1Len }}
          color="#f97373"
          strokeWidth={2}
          headSize={6}
          opacity={0.95}
        />
      )}
      <Arrow
        from={m2CenterClamped}
        to={{ x: m2CenterClamped.x, y: m2CenterClamped.y - tensionLen }}
        color="#38bdf8"
        strokeWidth={2}
        headSize={6}
        opacity={0.95}
      />
      <Arrow
        from={m2CenterClamped}
        to={{ x: m2CenterClamped.x, y: m2CenterClamped.y + gravity2Len }}
        color="#a78bfa"
        strokeWidth={2}
        headSize={6}
        opacity={0.55}
      />
      {normal2N > 0 && (
        <Arrow
          from={m2CenterClamped}
          to={{ x: m2CenterClamped.x, y: m2CenterClamped.y - normal2Len }}
          color="#f97373"
          strokeWidth={2}
          headSize={6}
          opacity={0.95}
        />
      )}

      <rect
        x={m1CenterClamped.x - MASS_SIZE.w / 2}
        y={m1CenterClamped.y - MASS_SIZE.h / 2}
        width={MASS_SIZE.w}
        height={MASS_SIZE.h}
        rx={1.5}
        ry={1.5}
        fill="#22c55e"
        stroke="rgba(16,185,129,0.9)"
        strokeWidth={0.65}
      />
      <rect
        x={m2CenterClamped.x - MASS_SIZE.w / 2}
        y={m2CenterClamped.y - MASS_SIZE.h / 2}
        width={MASS_SIZE.w}
        height={MASS_SIZE.h}
        rx={1.5}
        ry={1.5}
        fill="#f97316"
        stroke="rgba(249,115,22,0.9)"
        strokeWidth={0.65}
      />
    </svg>
  );
});

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

type MetricRowProps = {
  label: React.ReactNode;
  value: number;
  units: string;
};

function MetricRow({ label, value, units }: MetricRowProps) {
  return (
    <div className="flex items-baseline justify-between gap-3 rounded-md border border-slate-800 bg-slate-900/80 px-3 py-2">
      <span className="text-[0.7rem] text-slate-300">{label}</span>
      <span className="text-[0.7rem] font-mono text-sky-200">
        {roundTo2(value).toFixed(2)}{' '}
        <span className="text-[0.65rem] text-slate-400">{units}</span>
      </span>
    </div>
  );
}

type ControlRowProps = {
  label: string;
  units: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
};

function ControlRow({
  label,
  units,
  min,
  max,
  step,
  value,
  onChange,
  disabled = false,
}: ControlRowProps) {
  const handleSliderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    onChange(Number(event.target.value));
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const parsed = Number(event.target.value);
    if (Number.isNaN(parsed)) return;
    onChange(clamp(parsed, min, max));
  };

  return (
    <div className={`space-y-1.5 ${disabled ? 'pointer-events-none opacity-60' : ''}`}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-slate-200">{label}</p>
        <span className="text-[0.65rem] text-slate-400">
          {roundTo2(value).toFixed(2)} {units}
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
          disabled={disabled}
          className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-slate-800 accent-sky-400 disabled:cursor-not-allowed"
        />
        <div className="flex items-center gap-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1">
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={roundTo2(value)}
            onChange={handleInputChange}
            disabled={disabled}
            className="w-20 bg-transparent text-right text-[0.7rem] text-slate-100 outline-none disabled:cursor-not-allowed"
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
    </div>
  );
}

