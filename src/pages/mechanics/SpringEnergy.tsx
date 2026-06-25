import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { SliderWithInput } from '../../components/SliderWithInput';
import { ConceptBox } from '../../components/ConceptBox';

type Vec2 = { x: number; y: number };

type ControlsState = {
  massKg: number;
  springKNm: number;
  initialDisplacementM: number;
};

const DEFAULT_CONTROLS: ControlsState = {
  massKg: 5,
  springKNm: 10,
  initialDisplacementM: 2,
};

const MIN_MASS = 0.5;
const MAX_MASS = 20;
const MIN_K = 1;
const MAX_K = 50;
const MIN_X0 = -5;
const MAX_X0 = 5;

const TARGET_FPS = 60;
const FRAME_INTERVAL_MS = 1000 / TARGET_FPS;
const MAX_SIM_DT_S = 1 / 30;

/** Right edge of the wall (spring anchor); spring path starts here so coils meet the wall. */
const WALL_RIGHT_X = 22;
const NATURAL_SPRING_PX = 200;
const PX_PER_M = 24;
const CANVAS_W = 640;
const CANVAS_H = 200;
/** Ground line y (horizontal surface the block slides on). */
const GROUND_LINE_Y = CANVAS_H - 28;
/** Fixed block size — does not depend on mass. */
const BLOCK_SIZE_PX = 52;
/** Block center y so the bottom edge rests on the ground line. */
const BOX_CENTER_Y = GROUND_LINE_Y - BLOCK_SIZE_PX / 2;

const FORCE_ARROW_COLOR = 'rgb(248 113 113)';

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

const X0_INIT = clamp(DEFAULT_CONTROLS.initialDisplacementM, MIN_X0, MAX_X0);

function roundTo2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Exact state update for ẍ + (k/m)x = 0 over one interval dt.
 * Total mechanical energy TE = ½mv² + ½kx² is preserved (up to floating-point error).
 */
function stepHarmonicOscillator(x: number, v: number, m: number, k: number, dt: number): { x: number; v: number } {
  if (m <= 0 || k <= 0 || dt <= 0) return { x, v };
  const omega = Math.sqrt(k / m);
  const wd = omega * dt;
  const c = Math.cos(wd);
  const s = Math.sin(wd);
  return {
    x: x * c + (v / omega) * s,
    v: -omega * x * s + v * c,
  };
}

function springPath(length: number, coils = 9): string {
  const safeLength = Math.max(60, length);
  const startX = 0;
  const endX = safeLength;
  const lead = 12;
  const trail = 12;
  const bodyLength = Math.max(20, safeLength - lead - trail);
  const step = bodyLength / (coils * 2);
  const amp = 12;

  let d = `M ${startX} 30 L ${lead} 30`;
  for (let i = 0; i < coils * 2; i++) {
    const x = lead + step * (i + 1);
    const y = i % 2 === 0 ? 30 - amp : 30 + amp;
    d += ` L ${x} ${y}`;
  }
  d += ` L ${endX} 30`;
  return d;
}

type UiSnapshot = {
  xM: number;
  vMps: number;
  keJ: number;
  peSpringJ: number;
  teJ: number;
  forceN: number;
};

export function SpringEnergy() {
  const [controls, setControls] = useState<ControlsState>(DEFAULT_CONTROLS);
  const [isRunning, setIsRunning] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  const controlsRef = useRef(controls);
  const isRunningRef = useRef(false);
  const animationFrameIdRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);
  const lastVisualUpdateRef = useRef<number | null>(null);

  const xRef = useRef(X0_INIT);
  const vRef = useRef(0);
  const mRef = useRef(DEFAULT_CONTROLS.massKg);
  const kRef = useRef(DEFAULT_CONTROLS.springKNm);
  const energyScaleRef = useRef(
    Math.max(0.25, 0.5 * DEFAULT_CONTROLS.springKNm * X0_INIT * X0_INIT),
  );
  const vHistoryRef = useRef<number[]>([]);

  const [ui, setUi] = useState<UiSnapshot>(() =>
    computeSnapshot(X0_INIT, 0, DEFAULT_CONTROLS.massKg, DEFAULT_CONTROLS.springKNm),
  );

  useEffect(() => {
    controlsRef.current = controls;
  }, [controls]);

  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  useEffect(() => {
    return () => {
      if (animationFrameIdRef.current !== null) cancelAnimationFrame(animationFrameIdRef.current);
    };
  }, []);

  const pushUiSnapshot = useCallback(() => {
    const x = xRef.current;
    const v = vRef.current;
    const m = mRef.current;
    const k = kRef.current;
    setUi(computeSnapshot(x, v, m, k));
    const hist = vHistoryRef.current;
    hist.push(v);
    if (hist.length > 160) hist.shift();
  }, []);

  const resetSimulation = useCallback(
    (next?: ControlsState) => {
      const c = next ?? controlsRef.current;
      isRunningRef.current = false;
      setIsRunning(false);
      if (animationFrameIdRef.current !== null) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
      lastTimestampRef.current = null;
      lastVisualUpdateRef.current = null;

      mRef.current = c.massKg;
      kRef.current = c.springKNm;
      xRef.current = clamp(c.initialDisplacementM, MIN_X0, MAX_X0);
      vRef.current = 0;
      vHistoryRef.current = [];

      const x0 = xRef.current;
      const te0 = 0.5 * c.springKNm * x0 * x0;
      energyScaleRef.current = Math.max(0.25, te0, 0.5 * c.massKg * 0.01);

      setHasStarted(false);
      controlsRef.current = c;
      pushUiSnapshot();
    },
    [pushUiSnapshot],
  );

  const startLoopIfNeeded = useCallback(() => {
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
      const dt = Math.min(MAX_SIM_DT_S, realDt);

      const m = mRef.current;
      const k = kRef.current;
      const { x, v } = stepHarmonicOscillator(xRef.current, vRef.current, m, k, dt);

      xRef.current = x;
      vRef.current = v;

      const now = performance.now();
      if (lastVisualUpdateRef.current === null || now - lastVisualUpdateRef.current >= FRAME_INTERVAL_MS) {
        lastVisualUpdateRef.current = now;
        pushUiSnapshot();
      }

      animationFrameIdRef.current = requestAnimationFrame(step);
    };

    animationFrameIdRef.current = requestAnimationFrame(step);
  }, [pushUiSnapshot]);

  useEffect(() => {
    if (isRunningRef.current) startLoopIfNeeded();
  }, [isRunning, startLoopIfNeeded]);

  const handleStartOrRestart = () => {
    resetSimulation(controlsRef.current);
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
      pushUiSnapshot();
      return;
    }
    setHasStarted(true);
    isRunningRef.current = true;
    setIsRunning(true);
    startLoopIfNeeded();
  };

  const xForView = !hasStarted ? clamp(controls.initialDisplacementM, MIN_X0, MAX_X0) : ui.xM;
  const viewSnapshot = !hasStarted
    ? computeSnapshot(xForView, 0, controls.massKg, controls.springKNm)
    : ui;
  const energyDenomView = !hasStarted
    ? Math.max(0.25, 0.5 * controls.springKNm * xForView * xForView)
    : energyScaleRef.current;

  const kePctView = clamp(viewSnapshot.keJ / energyDenomView, 0, 1.2);
  const pePctView = clamp(viewSnapshot.peSpringJ / energyDenomView, 0, 1.2);
  const tePctView = clamp(viewSnapshot.teJ / energyDenomView, 0, 1.2);

  const springLengthPx = clamp(NATURAL_SPRING_PX + xForView * PX_PER_M, 70, 420);
  const boxCx = WALL_RIGHT_X + springLengthPx;
  const boxCy = BOX_CENTER_Y;

  const maxArrowForce = MAX_K * Math.max(Math.abs(MIN_X0), Math.abs(MAX_X0));
  const arrowLen =
    viewSnapshot.forceN === 0 ? 0 : clamp(Math.abs(viewSnapshot.forceN) * 0.44, 16, 120);
  const arrowDir = viewSnapshot.forceN >= 0 ? 1 : -1;
  const arrowFrom: Vec2 = { x: boxCx, y: boxCy };
  const arrowTo: Vec2 =
    viewSnapshot.forceN === 0 ? arrowFrom : { x: boxCx + arrowDir * arrowLen, y: boxCy };

  const vHist = vHistoryRef.current;
  const vGraphPath = (() => {
    if (vHist.length < 2) return '';
    let vmax = 1e-6;
    for (const w of vHist) vmax = Math.max(vmax, Math.abs(w));
    const gw = 200;
    const gh = 48;
    const pad = 4;
    return vHist
      .map((w, i) => {
        const tx = pad + (i / (vHist.length - 1)) * (gw - pad * 2);
        const ty = pad + (gh - pad * 2) * (0.5 - 0.45 * (w / vmax));
        return `${tx.toFixed(1)},${ty.toFixed(1)}`;
      })
      .join(' ');
  })();

  const equilibriumX = WALL_RIGHT_X + NATURAL_SPRING_PX;

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-8 text-slate-100">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">Energy · mechanics</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
            Spring Energy Simulation
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">
            A block on a frictionless horizontal surface attached to an ideal spring: watch position and velocity
            oscillate while kinetic and spring potential energy trade places, with total mechanical energy staying
            nearly constant.
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
            Hooke&apos;s law · No friction
          </span>
        </div>
      </header>

      <main className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/40">
          <div className="pointer-events-none absolute inset-0 -z-10 opacity-70">
            <div className="absolute -left-28 top-0 h-60 w-60 rounded-full bg-sky-700/25 blur-3xl" />
            <div className="absolute bottom-0 right-0 h-60 w-60 rounded-full bg-blue-500/20 blur-3xl" />
          </div>

          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold tracking-wide text-sky-300">Simulation canvas</h2>
              <p className="mt-1 text-xs text-slate-400">
                Exact harmonic timestep · Spring force <span className="font-mono text-slate-300">F = −kx</span>
              </p>
            </div>

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

          <div className="mt-5 overflow-hidden rounded-xl border border-slate-800 bg-slate-950/70 p-3">
            <svg
              viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
              className="h-auto w-full max-h-[14rem]"
              role="img"
              aria-label="Spring-mass oscillation on a frictionless surface"
            >
              <defs>
                <linearGradient id="se-spring" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="rgb(56 189 248)" />
                  <stop offset="100%" stopColor="rgb(16 185 129)" />
                </linearGradient>
              </defs>

              <rect x="0" y="0" width={CANVAS_W} height={CANVAS_H} fill="rgba(2,6,23,0.5)" />

              <line
                x1="0"
                y1={GROUND_LINE_Y}
                x2={CANVAS_W}
                y2={GROUND_LINE_Y}
                stroke="rgba(148,163,184,0.55)"
                strokeWidth="3"
              />
              <text x="8" y={CANVAS_H - 10} fill="rgba(148,163,184,0.85)" fontSize="11">
                Frictionless surface
              </text>

              <rect
                x="0"
                y="48"
                width={WALL_RIGHT_X}
                height={GROUND_LINE_Y - 48}
                fill="rgba(51,65,85,0.85)"
                stroke="rgba(148,163,184,0.4)"
              />
              <line
                x1={WALL_RIGHT_X}
                y1="48"
                x2={WALL_RIGHT_X}
                y2={GROUND_LINE_Y}
                stroke="rgba(148,163,184,0.7)"
                strokeWidth="2"
              />

              <line
                x1={equilibriumX}
                y1="44"
                x2={equilibriumX}
                y2={GROUND_LINE_Y}
                stroke="rgba(251,191,36,0.35)"
                strokeWidth="2"
                strokeDasharray="6 5"
              />
              <text x={equilibriumX + 4} y="42" fill="rgba(251,191,36,0.75)" fontSize="10">
                x = 0
              </text>

              <g transform={`translate(${WALL_RIGHT_X}, ${BOX_CENTER_Y - 30})`}>
                <svg width={springLengthPx + 4} height="60" viewBox={`0 0 ${springLengthPx + 4} 60`} preserveAspectRatio="none">
                  <path
                    d={springPath(springLengthPx)}
                    fill="none"
                    stroke="url(#se-spring)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </g>

              <rect
                x={boxCx - BLOCK_SIZE_PX / 2}
                y={GROUND_LINE_Y - BLOCK_SIZE_PX}
                width={BLOCK_SIZE_PX}
                height={BLOCK_SIZE_PX}
                rx="5"
                fill="rgba(52,211,153,0.92)"
                stroke="rgba(6,95,70,0.95)"
                strokeWidth="2"
              />
              <text
                x={boxCx}
                y={boxCy + 4}
                textAnchor="middle"
                fill="rgb(6 78 59)"
                fontSize="12"
                fontWeight="600"
              >
                m
              </text>
              <circle cx={boxCx} cy={boxCy} r="4" fill="rgba(167,243,208,0.9)" stroke="rgba(6,95,70,0.6)" />

              {viewSnapshot.forceN !== 0 ? (
                <Arrow
                  from={arrowFrom}
                  to={arrowTo}
                  color={FORCE_ARROW_COLOR}
                  strokeWidth={4}
                  headSize={11}
                />
              ) : null}
              <text
                x={Math.min(boxCx + arrowDir * 48 + 20, CANVAS_W - 8)}
                y={boxCy - 22}
                textAnchor="end"
                fill={FORCE_ARROW_COLOR}
                fontSize="12"
                fontWeight="600"
              >
                <tspan>F</tspan>
                <tspan baselineShift="sub" fontSize="9" fontWeight="600">
                  spring
                </tspan>
              </text>
            </svg>

            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile label="Velocity (v)" value={`${roundTo2(viewSnapshot.vMps)} m/s`} accent="text-amber-200" />
              <StatTile label="Kinetic (KE)" value={`${roundTo2(viewSnapshot.keJ)} J`} accent="text-sky-200" />
              <StatTile label="Spring PE" value={`${roundTo2(viewSnapshot.peSpringJ)} J`} accent="text-emerald-200" />
              <StatTile label="Total (TE)" value={`${roundTo2(viewSnapshot.teJ)} J`} accent="text-fuchsia-200" />
            </div>

            <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900/80 p-3">
              <p className="text-[0.65rem] font-medium uppercase tracking-[0.12em] text-slate-400">Velocity trace</p>
              <p className="mt-0.5 text-[0.65rem] text-slate-500">Recent horizontal velocity (oscillates with motion)</p>
              <svg viewBox="0 0 200 56" className="mt-2 h-14 w-full" preserveAspectRatio="none">
                <rect x="0" y="0" width="200" height="56" fill="rgba(2,6,23,0.45)" rx="4" />
                <line x1="4" y1="28" x2="196" y2="28" stroke="rgba(148,163,184,0.25)" strokeWidth="1" />
                {vGraphPath ? (
                  <polyline
                    points={vGraphPath}
                    fill="none"
                    stroke="rgb(251 191 36)"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                  />
                ) : (
                  <text
                    x="100"
                    y="24"
                    textAnchor="middle"
                    fill="rgba(148,163,184,0.6)"
                    fontSize="9"
                  >
                    <tspan x="100" dy="0">Run the simulation</tspan>
                    <tspan x="100" dy="12">to see v(t)</tspan>
                  </text>
                )}
              </svg>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
            <p className="text-xs font-semibold text-slate-100">Energy (live)</p>
            <p className="mt-1 text-[0.7rem] text-slate-400">
              KE = ½mv² · PE_spring = ½kx² · TE = KE + PE
            </p>
            <div className="mt-3 space-y-2">
              <EnergyRow
                label="Kinetic (KE)"
                value={viewSnapshot.keJ}
                pct={kePctView}
                barClass="bg-sky-400"
                valueClass="text-sky-200"
              />
              <EnergyRow
                label="Spring PE"
                value={viewSnapshot.peSpringJ}
                pct={pePctView}
                barClass="bg-emerald-400"
                valueClass="text-emerald-200"
              />
              <EnergyRow
                label="Total (TE)"
                value={viewSnapshot.teJ}
                pct={tePctView}
                barClass="bg-fuchsia-400"
                valueClass="text-fuchsia-200"
              />
            </div>
          </div>
        </section>

        <section className="flex min-h-0 flex-col space-y-5 rounded-2xl border border-slate-800 bg-slate-950/80 p-5 shadow-lg shadow-slate-950/40">
          <h2 className="text-sm font-semibold tracking-wide text-sky-300">Controls</h2>
          <p className="text-[0.65rem] text-slate-500">
            Mass, spring constant, and initial displacement apply on <span className="text-slate-300">Start</span> or{' '}
            <span className="text-slate-300">Reset</span>.
          </p>

          <SliderWithInput
            label="Mass (m)"
            min={MIN_MASS}
            max={MAX_MASS}
            step={0.5}
            value={controls.massKg}
            units="kg"
            onChange={(value) => setControls((p) => ({ ...p, massKg: value }))}
          />

          <SliderWithInput
            label="Spring constant (k)"
            min={MIN_K}
            max={MAX_K}
            step={1}
            value={controls.springKNm}
            units="N/m"
            onChange={(value) => setControls((p) => ({ ...p, springKNm: value }))}
          />

          <SliderWithInput
            label="Initial displacement (x₀)"
            min={MIN_X0}
            max={MAX_X0}
            step={0.1}
            value={controls.initialDisplacementM}
            units="m"
            description="From equilibrium along the surface; release from rest at start."
            onChange={(value) => setControls((p) => ({ ...p, initialDisplacementM: value }))}
          />

          <div className="mt-auto flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                resetSimulation(controlsRef.current);
                pushUiSnapshot();
              }}
              className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-[0.7rem] font-semibold text-slate-100 shadow-sm transition hover:border-slate-500"
            >
              Reset to sliders
            </button>
            <button
              type="button"
              onClick={() => {
                const next = DEFAULT_CONTROLS;
                setControls(next);
                controlsRef.current = next;
                resetSimulation(next);
              }}
              className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-[0.7rem] font-semibold text-slate-100 shadow-sm transition hover:border-slate-500"
            >
              Reset all
            </button>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-300">
            <p className="font-medium text-slate-100">Snapshot</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <StatChip label="x (displacement)" value={`${roundTo2(viewSnapshot.xM)} m`} />
              <StatChip label="v" value={`${roundTo2(viewSnapshot.vMps)} m/s`} />
              <StatChip
                label={
                  <>
                    F<sub className="text-[0.78em] font-normal">spring</sub>
                  </>
                }
                uppercaseLabel={false}
                value={`${roundTo2(viewSnapshot.forceN)} N`}
              />
              <StatChip label="|F| max (est.)" value={`${roundTo2(maxArrowForce)} N`} />
            </div>
          </div>
        </section>
      </main>

      <ConceptBox
        heading="Explanation" items={[
          {
            title: "Hooke’s law",
            description: "The spring exerts a restoring force F = −kx on the block, where x is displacement from the relaxed length (equilibrium). The force always points toward x = 0, so it pulls the block back when stretched and pushes when compressed."
          },
          {
            title: "Oscillatory motion",
            description: "On a frictionless surface, that restoring force produces acceleration a = F/m. The block speeds up toward equilibrium, overshoots, then slows as the spring stretches the other way—repeating in simple harmonic motion (for small angles this model stays linear)."
          },
          {
            title: "Energy exchange",
            description: "Kinetic energy KE = ½mv² is largest near equilibrium where speed is highest. Spring potential energy PE = ½kx² is largest at the turning points where the block momentarily stops. Energy sloshes between these two forms every half cycle."
          },
        ]}
        
      ></ConceptBox>
    </div>
  );
}

function computeSnapshot(x: number, v: number, m: number, k: number): UiSnapshot {
  const forceN = -k * x;
  const keJ = 0.5 * m * v * v;
  const peSpringJ = 0.5 * k * x * x;
  return {
    xM: x,
    vMps: v,
    keJ,
    peSpringJ,
    teJ: keJ + peSpringJ,
    forceN,
  };
}

type ArrowProps = {
  from: Vec2;
  to: Vec2;
  color: string;
  strokeWidth?: number;
  headSize?: number;
  opacity?: number;
};

/** Same geometry and styling as force arrows in `ForceSimulator` / `BoxOnIncline`. */
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

function EnergyRow({
  label,
  value,
  pct,
  barClass,
  valueClass,
}: {
  label: string;
  value: number;
  pct: number;
  barClass: string;
  valueClass: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[0.72rem] text-slate-300">{label}</span>
        <span className={`text-[0.72rem] font-mono ${valueClass}`}>{value.toFixed(2)} J</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full border border-slate-800 bg-slate-950/70">
        <div className={`h-full ${barClass}`} style={{ width: `${clamp(pct, 0, 1) * 100}%`, opacity: 0.9 }} />
      </div>
    </div>
  );
}

function StatChip({
  label,
  value,
  uppercaseLabel = true,
}: {
  label: ReactNode;
  value: string;
  uppercaseLabel?: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2">
      <p
        className={`text-[0.65rem] tracking-[0.14em] text-slate-500 ${
          uppercaseLabel ? 'uppercase' : ''
        }`}
      >
        {label}
      </p>
      <p className="mt-1 text-[0.8rem] font-medium text-slate-100">{value}</p>
    </div>
  );
}

function StatTile({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
      <p className="text-[0.65rem] uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${accent}`}>{value}</p>
    </div>
  );
}

