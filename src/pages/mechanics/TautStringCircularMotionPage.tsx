import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { SliderWithInput } from '../../components/system/SliderWithInput';

type ViewMode = 'horizontal' | 'vertical';
type InitialSpeedMode = 'angular' | 'linear';

type ControlsState = {
  massKg: number;
  radiusM: number;
  omega: number;
  viewMode: ViewMode;
  gravity: number;
};

type SimState = {
  theta: number;
  omega: number;
};

type Vector2 = { x: number; y: number };

const DEFAULT_CONTROLS: ControlsState = {
  massKg: 2,
  radiusM: 4,
  omega: 2.5,
  viewMode: 'horizontal',
  gravity: 9.81,
};

const VIEW_SIZE = 100;
const PIVOT: Vector2 = { x: 50, y: 50 };
const MIN_RADIUS_PX = 12;
const MAX_RADIUS_PX = 35;
const MAX_ARROW_LENGTH = 16;
const MIN_ARROW_LENGTH = 2;
const MAX_OMEGA = 10;
const PENDULUM_DAMPING = 0.03;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function mapRadiusToPixels(radiusM: number): number {
  const t = (radiusM - 1) / 9;
  return MIN_RADIUS_PX + clamp(t, 0, 1) * (MAX_RADIUS_PX - MIN_RADIUS_PX);
}

function vectorMagnitude(v: Vector2): number {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

function normalize(v: Vector2): Vector2 {
  const mag = vectorMagnitude(v);
  if (mag <= 1e-8) return { x: 0, y: 0 };
  return { x: v.x / mag, y: v.y / mag };
}

function scale(v: Vector2, s: number): Vector2 {
  return { x: v.x * s, y: v.y * s };
}

function add(a: Vector2, b: Vector2): Vector2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

function drawArrowPath(from: Vector2, to: Vector2, headSize = 2.2): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1e-6) return '';
  const ux = dx / len;
  const uy = dy / len;
  const headLength = Math.min(headSize, len * 0.45);
  const baseX = to.x - ux * headLength;
  const baseY = to.y - uy * headLength;
  const halfWidth = headLength * 0.65;
  const leftX = baseX - uy * halfWidth;
  const leftY = baseY + ux * halfWidth;
  const rightX = baseX + uy * halfWidth;
  const rightY = baseY - ux * halfWidth;
  return `M ${from.x} ${from.y} L ${baseX} ${baseY} M ${leftX} ${leftY} L ${to.x} ${to.y} L ${rightX} ${rightY}`;
}

export function TautStringCircularMotionPage() {
  const [controls, setControls] = useState<ControlsState>(DEFAULT_CONTROLS);
  const [initialSpeedMode, setInitialSpeedMode] = useState<InitialSpeedMode>('angular');
  const [initialLinearSpeed, setInitialLinearSpeed] = useState(
    DEFAULT_CONTROLS.omega * DEFAULT_CONTROLS.radiusM
  );
  const [isRunning, setIsRunning] = useState(true);
  const [displayTick, setDisplayTick] = useState(0);

  const simStateRef = useRef<SimState>({ theta: 0, omega: DEFAULT_CONTROLS.omega });
  const controlsRef = useRef(controls);
  const runningRef = useRef(isRunning);
  const rafRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);
  const lastDisplayUpdateRef = useRef<number>(0);

  const ballRef = useRef<SVGCircleElement | null>(null);
  const stringRef = useRef<SVGLineElement | null>(null);
  const pathRef = useRef<SVGCircleElement | null>(null);
  const tensionArrowRef = useRef<SVGPathElement | null>(null);
  const velocityArrowRef = useRef<SVGPathElement | null>(null);
  const accelArrowRef = useRef<SVGPathElement | null>(null);

  useEffect(() => {
    controlsRef.current = controls;
    if (controls.viewMode === 'horizontal') {
      simStateRef.current.omega = controls.omega;
    }
  }, [controls]);

  useEffect(() => {
    runningRef.current = isRunning;
  }, [isRunning]);

  const radiusPx = useMemo(() => mapRadiusToPixels(controls.radiusM), [controls.radiusM]);

  const omegaDisplay = controls.viewMode === 'vertical' ? simStateRef.current.omega : controls.omega;
  const linearDisplay = Math.abs(omegaDisplay) * controls.radiusM;

  const currentDerived = useMemo(() => {
    const radiusM = controls.radiusM;
    const omega = omegaDisplay;
    const massKg = controls.massKg;
    const v = Math.abs(omega) * radiusM;
    const aC = radiusM > 0 ? (v * v) / radiusM : 0;
    const gravityTerm =
      controls.viewMode === 'vertical' ? controls.gravity * Math.sin(simStateRef.current.theta) : 0;
    const tensionN = massKg * Math.max(0, aC + gravityTerm);
    return { v, aC, tensionN };
  }, [controls.gravity, controls.massKg, controls.radiusM, controls.viewMode, omegaDisplay]);

  const updateVisuals = (timestamp: number) => {
    const sim = simStateRef.current;
    const liveControls = controlsRef.current;

    const radiusLivePx = mapRadiusToPixels(liveControls.radiusM);
    const cosT = Math.cos(sim.theta);
    const sinT = Math.sin(sim.theta);
    const ballPos: Vector2 = {
      x: PIVOT.x + radiusLivePx * cosT,
      y: PIVOT.y + radiusLivePx * sinT,
    };

    const radialInward = normalize({ x: PIVOT.x - ballPos.x, y: PIVOT.y - ballPos.y });

    const omegaForForces = liveControls.viewMode === 'vertical' ? sim.omega : liveControls.omega;
    const v = Math.abs(omegaForForces) * liveControls.radiusM;
    const aC = liveControls.radiusM > 0 ? (v * v) / liveControls.radiusM : 0;
    const gravityTerm =
      liveControls.viewMode === 'vertical' ? liveControls.gravity * Math.sin(sim.theta) : 0;
    const tensionN = liveControls.massKg * Math.max(0, aC + gravityTerm);
    // Instantaneous velocity direction from position derivative on the circle.
    // (SVG y increases downward, so this derivative is in screen coordinates.)
    const velocityDir = normalize({
      x: -sinT * omegaForForces,
      y: cosT * omegaForForces,
    });

    const tensionLength = clamp(2.5 + tensionN * 0.03, MIN_ARROW_LENGTH, MAX_ARROW_LENGTH);
    const velocityLength = clamp(2 + v * 0.35, MIN_ARROW_LENGTH, MAX_ARROW_LENGTH);
    const accelLength = clamp(1.2 + aC * 0.08, MIN_ARROW_LENGTH, MAX_ARROW_LENGTH * 0.75);

    const tensionTip = add(ballPos, scale(radialInward, tensionLength));
    const velocityTip = add(ballPos, scale(velocityDir, velocityLength));
    const accelTip = add(ballPos, scale(radialInward, accelLength));

    if (ballRef.current) {
      ballRef.current.setAttribute('cx', ballPos.x.toFixed(3));
      ballRef.current.setAttribute('cy', ballPos.y.toFixed(3));
    }
    if (stringRef.current) {
      stringRef.current.setAttribute('x1', PIVOT.x.toFixed(3));
      stringRef.current.setAttribute('y1', PIVOT.y.toFixed(3));
      stringRef.current.setAttribute('x2', ballPos.x.toFixed(3));
      stringRef.current.setAttribute('y2', ballPos.y.toFixed(3));
    }
    if (pathRef.current) {
      pathRef.current.setAttribute('r', radiusLivePx.toFixed(3));
    }
    if (tensionArrowRef.current) {
      tensionArrowRef.current.setAttribute('d', drawArrowPath(ballPos, tensionTip));
    }
    if (velocityArrowRef.current) {
      velocityArrowRef.current.setAttribute('d', drawArrowPath(ballPos, velocityTip));
    }
    if (accelArrowRef.current) {
      accelArrowRef.current.setAttribute('d', drawArrowPath(ballPos, accelTip));
    }

    if (timestamp - lastDisplayUpdateRef.current > 100) {
      lastDisplayUpdateRef.current = timestamp;
      setDisplayTick((n) => n + 1);
    }
  };

  useEffect(() => {
    const step = (timestamp: number) => {
      if (!runningRef.current) {
        rafRef.current = null;
        lastTimestampRef.current = null;
        return;
      }

      if (lastTimestampRef.current === null) {
        lastTimestampRef.current = timestamp;
        updateVisuals(timestamp);
        rafRef.current = requestAnimationFrame(step);
        return;
      }

      const dt = Math.min((timestamp - lastTimestampRef.current) / 1000, 0.05);
      lastTimestampRef.current = timestamp;

      const sim = simStateRef.current;
      const liveControls = controlsRef.current;
      if (liveControls.viewMode === 'vertical') {
        // Vertical view: pendulum-like angular dynamics with string-length constraint.
        const angularAccel =
          (liveControls.gravity / Math.max(0.25, liveControls.radiusM)) * Math.cos(sim.theta) -
          PENDULUM_DAMPING * sim.omega;
        sim.omega += angularAccel * dt;
      } else {
        sim.omega = liveControls.omega;
      }
      sim.theta = (sim.theta + sim.omega * dt) % (Math.PI * 2);
      updateVisuals(timestamp);

      rafRef.current = requestAnimationFrame(step);
    };

    if (isRunning && rafRef.current === null) {
      rafRef.current = requestAnimationFrame(step);
    }
    if (!isRunning && rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTimestampRef.current = null;
    }

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isRunning]);

  useEffect(() => {
    // Keep drawn radius in sync immediately after slider changes.
    if (pathRef.current) {
      pathRef.current.setAttribute('r', radiusPx.toFixed(3));
    }
  }, [radiusPx]);

  useEffect(() => {
    // Re-seed state when switching between ideal horizontal and gravity-driven vertical views.
    if (controls.viewMode === 'vertical') {
      simStateRef.current.theta = Math.PI / 2 - 0.35;
      simStateRef.current.omega = controls.omega;
    } else {
      simStateRef.current.theta = 0;
      simStateRef.current.omega = controls.omega;
    }
    lastTimestampRef.current = null;
    lastDisplayUpdateRef.current = 0;
    setDisplayTick((n) => n + 1);
  }, [controls.viewMode]);

  useEffect(() => {
    if (initialSpeedMode !== 'linear') return;
    const targetOmega = clamp(initialLinearSpeed / Math.max(0.1, controls.radiusM), 0, MAX_OMEGA);
    setControls((prev) => {
      if (Math.abs(prev.omega - targetOmega) < 1e-6) return prev;
      return { ...prev, omega: targetOmega };
    });
  }, [controls.radiusM, initialLinearSpeed, initialSpeedMode]);

  const theta = simStateRef.current.theta + displayTick * 0;
  const rDisplay = controls.radiusM;
  const aDisplay = currentDerived.aC;
  const tensionDisplay = currentDerived.tensionN;

  const resetSimulation = () => {
    simStateRef.current.theta = controlsRef.current.viewMode === 'vertical' ? Math.PI / 2 - 0.35 : 0;
    simStateRef.current.omega = controlsRef.current.omega;
    lastTimestampRef.current = null;
    lastDisplayUpdateRef.current = 0;
    setDisplayTick((n) => n + 1);
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-8 text-slate-100">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">
            Rotational kinematics
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
            Taut Ball on a String (Uniform Circular Motion)
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">
            Switch between ideal horizontal uniform circular motion and vertical-plane motion where
            gravity drives pendulum-like oscillations while the string remains taut.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-sky-500 hover:text-sky-100"
          >
            ← Dashboard
          </Link>
          <span className="inline-flex items-center gap-2 rounded-full border border-sky-700/60 bg-sky-900/60 px-3 py-1 text-[0.7rem] font-medium text-sky-100">
            Horizontal/vertical string motion
          </span>
        </div>
      </header>

      <main className="grid gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <section className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/40">
          <h2 className="text-sm font-semibold tracking-wide text-sky-300">Simulation canvas</h2>
          <p className="mt-1 text-xs text-slate-300">
            Tension points inward to the pivot and velocity stays tangent to motion. The faint ring
            marks the fixed radius constraint.
          </p>

          <div className="mt-4 h-[30rem] rounded-xl border border-slate-800 bg-slate-950/80 p-3">
            <svg viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`} className="h-full w-full rounded-lg">
              <rect x={2} y={2} width={96} height={96} rx={4} fill="#020617" stroke="#334155" strokeWidth={0.4} />
              <circle
                ref={pathRef}
                cx={PIVOT.x}
                cy={PIVOT.y}
                r={radiusPx}
                fill="none"
                stroke="#334155"
                strokeWidth={0.6}
                strokeDasharray="1.2 1.5"
              />
              <circle cx={PIVOT.x} cy={PIVOT.y} r={1.5} fill="#f8fafc" />
              <line ref={stringRef} x1={PIVOT.x} y1={PIVOT.y} x2={PIVOT.x + radiusPx} y2={PIVOT.y} stroke="#94a3b8" strokeWidth={0.9} />

              <path ref={tensionArrowRef} d="" stroke="#ef4444" strokeWidth={0.9} fill="none" />
              <path ref={velocityArrowRef} d="" stroke="#22c55e" strokeWidth={0.9} fill="none" />
              <path ref={accelArrowRef} d="" stroke="#38bdf8" strokeWidth={0.75} fill="none" />

              <circle ref={ballRef} cx={PIVOT.x + radiusPx} cy={PIVOT.y} r={2} fill="#f59e0b" stroke="#fbbf24" strokeWidth={0.4} />
            </svg>
          </div>

          <div className="mt-4 grid gap-2 text-[0.72rem] text-slate-300 sm:grid-cols-3">
            <Legend swatchClass="bg-red-500" label="Tension (inward)" />
            <Legend swatchClass="bg-green-500" label="Velocity (tangent)" />
            <Legend swatchClass="bg-sky-400" label="Centripetal acceleration" />
          </div>

          <div className="mt-4 grid gap-2 rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-xs text-slate-200 sm:grid-cols-2">
            <DataCell
              label="View mode"
              valueText={controls.viewMode === 'horizontal' ? 'Horizontal' : 'Vertical'}
            />
            <DataCell
              label="Initial speed input"
              valueText={initialSpeedMode === 'angular' ? 'Angular velocity (ω₀)' : 'Linear speed (v₀)'}
            />
            <DataCell label="Angular velocity, ω" value={omegaDisplay} unit="rad/s" />
            <DataCell label="Linear speed, v = ωr" value={linearDisplay} unit="m/s" />
            <DataCell label="Radius, r" value={rDisplay} unit="m" />
            <DataCell label="Centripetal acceleration, a = v²/r" value={aDisplay} unit="m/s²" />
            <DataCell label="Tension, T = mv²/r" value={tensionDisplay} unit="N" />
            <DataCell label="Angle, θ" value={theta} unit="rad" />
            {controls.viewMode === 'vertical' ? (
              <DataCell label="Gravity, g" value={controls.gravity} unit="m/s²" />
            ) : null}
          </div>
        </section>

        <section className="flex min-h-[30rem] flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-950/80 p-5 shadow-lg shadow-slate-950/40">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-wide text-sky-300">Controls</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsRunning((v) => !v)}
                className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-[0.7rem] font-semibold text-slate-100 transition hover:border-sky-500"
              >
                {isRunning ? 'Pause' : 'Resume'}
              </button>
              <button
                type="button"
                onClick={resetSimulation}
                className="rounded-full bg-sky-500 px-3 py-1 text-[0.7rem] font-semibold text-slate-950 transition hover:bg-sky-400"
              >
                Reset
              </button>
            </div>
          </div>

          <SliderWithInput
            label="Mass"
            units="kg"
            min={0.5}
            max={20}
            step={0.1}
            value={controls.massKg}
            onChange={(massKg) => setControls((prev) => ({ ...prev, massKg }))}
            syncToUrl={true}
            queryKey="m"
          />

          <SliderWithInput
            label="String length / radius"
            units="m"
            min={1}
            max={10}
            step={0.1}
            value={controls.radiusM}
            onChange={(radiusM) => setControls((prev) => ({ ...prev, radiusM }))}
            syncToUrl={true}
            queryKey="r"
          />

          <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-slate-100">Initial speed input type</p>
                <p className="mt-1 text-[0.68rem] text-slate-400">
                  Choose whether to set the simulation by initial angular velocity or initial linear speed.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setInitialSpeedMode('angular');
                    setControls((prev) => ({ ...prev, omega: clamp(prev.omega, 0, MAX_OMEGA) }));
                  }}
                  className={`rounded-full px-2.5 py-1 text-[0.65rem] font-semibold transition ${
                    initialSpeedMode === 'angular'
                      ? 'bg-sky-500 text-slate-950'
                      : 'border border-slate-700 bg-slate-900 text-slate-300 hover:border-sky-500'
                  }`}
                >
                  Set ω₀
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInitialSpeedMode('linear');
                    setInitialLinearSpeed(Math.abs(controlsRef.current.omega) * controlsRef.current.radiusM);
                  }}
                  className={`rounded-full px-2.5 py-1 text-[0.65rem] font-semibold transition ${
                    initialSpeedMode === 'linear'
                      ? 'bg-violet-400 text-slate-950'
                      : 'border border-slate-700 bg-slate-900 text-slate-300 hover:border-sky-500'
                  }`}
                >
                  Set v₀
                </button>
              </div>
            </div>
          </div>

          {initialSpeedMode === 'angular' ? (
            <SliderWithInput
              label="Initial angular velocity (ω₀)"
              units="rad/s"
              min={0}
              max={MAX_OMEGA}
              step={0.1}
              value={controls.omega}
              onChange={(omega) => {
                setControls((prev) => ({ ...prev, omega }));
                setInitialLinearSpeed(omega * controls.radiusM);
              }}
              syncToUrl={true}
              queryKey="omega0"
            />
          ) : (
            <SliderWithInput
              label="Initial linear speed (v₀)"
              units="m/s"
              min={0}
              max={MAX_OMEGA * controls.radiusM}
              step={0.1}
              value={initialLinearSpeed}
              onChange={(v0) => {
                const clampedV0 = clamp(v0, 0, MAX_OMEGA * controls.radiusM);
                setInitialLinearSpeed(clampedV0);
                const omega = clamp(clampedV0 / Math.max(0.1, controls.radiusM), 0, MAX_OMEGA);
                setControls((prev) => ({ ...prev, omega }));
              }}
              syncToUrl={true}
              queryKey="v0"
            />
          )}

          <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-slate-100">Motion view</p>
                <p className="mt-1 text-[0.68rem] text-slate-400">
                  Horizontal keeps ideal uniform circular motion. Vertical enables gravity-driven
                  pendulum behavior.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setControls((prev) => ({ ...prev, viewMode: 'horizontal', gravity: prev.gravity }))
                  }
                  className={`rounded-full px-2.5 py-1 text-[0.65rem] font-semibold transition ${
                    controls.viewMode === 'horizontal'
                      ? 'bg-sky-500 text-slate-950'
                      : 'border border-slate-700 bg-slate-900 text-slate-300 hover:border-sky-500'
                  }`}
                >
                  Horizontal
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setControls((prev) => ({ ...prev, viewMode: 'vertical', gravity: prev.gravity }))
                  }
                  className={`rounded-full px-2.5 py-1 text-[0.65rem] font-semibold transition ${
                    controls.viewMode === 'vertical'
                      ? 'bg-violet-400 text-slate-950'
                      : 'border border-slate-700 bg-slate-900 text-slate-300 hover:border-sky-500'
                  }`}
                >
                  Vertical
                </button>
              </div>
            </div>
          </div>

          {controls.viewMode === 'vertical' ? (
            <SliderWithInput
              label="Gravity strength (g)"
              units="m/s²"
              min={0}
              max={25}
              step={0.1}
              value={controls.gravity}
              onChange={(gravity) => setControls((prev) => ({ ...prev, gravity }))}
              syncToUrl={true}
              queryKey="g"
            />
          ) : null}
        </section>
      </main>

      <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-sky-300">
          Concept explanation
        </h2>
        <div className="mt-3 space-y-2 text-sm text-slate-300">
          <p>
            In uniform circular motion, speed can stay constant while velocity changes direction.
            That directional change requires an inward (centripetal) acceleration, a<sub>c</sub> = v²/r.
          </p>
          <p>
            In horizontal mode, the motion is constrained to ideal uniform circular motion with
            user-set angular velocity. In vertical mode, gravity introduces angular acceleration, so
            weak initial spin can transition into pendulum-like oscillation.
          </p>
          <p>
            The velocity vector is tangent to the circle at every instant, while tension and
            centripetal acceleration point toward the pivot. That inward pull continuously bends the
            path into a circle.
          </p>
        </div>
      </section>
    </div>
  );
}

function Legend({ swatchClass, label }: { swatchClass: string; label: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-md border border-slate-800 bg-slate-950/70 px-2 py-1">
      <span className={`h-2 w-6 rounded ${swatchClass}`} />
      <span>{label}</span>
    </div>
  );
}

function DataCell({
  label,
  value,
  unit,
  valueText,
}: {
  label: string;
  value?: number;
  unit?: string;
  valueText?: string;
}) {
  const content = valueText ?? `${(value ?? 0).toFixed(2)}${unit ? ` ${unit}` : ''}`;
  return (
    <div className="rounded-md border border-slate-800 bg-slate-900/70 px-3 py-2">
      <p className="text-[0.66rem] text-slate-400">{label}</p>
      <p className="mt-0.5 font-mono text-[0.78rem] text-sky-200">
        {content}
      </p>
    </div>
  );
}
