import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { SliderWithInput } from '../../components/SliderWithInput';

type ControlsState = {
  theta0Deg: number;
  omega0: number;
  alpha: number;
};

type SimSnapshot = {
  t: number;
  theta: number;
  omega: number;
  alpha: number;
  revolutions: number;
};

type HistoryPoint = {
  t: number;
  thetaDeg: number;
  omega: number;
  alpha: number;
};

type SimState = {
  simTime: number;
  theta: number;
  omega: number;
  revolutions: number;
};

const DEFAULT_CONTROLS: ControlsState = {
  theta0Deg: 30,
  omega0: 2,
  alpha: 0.6,
};

const TWO_PI = Math.PI * 2;
const HISTORY_WINDOW_S = 20;
const HISTORY_SAMPLE_MS = 120;
const UI_PUSH_MS = 120;
const MAX_HISTORY_POINTS = Math.ceil((HISTORY_WINDOW_S * 1000) / HISTORY_SAMPLE_MS) + 2;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function wrapAngleRad(theta: number): number {
  let next = theta % TWO_PI;
  if (next < 0) next += TWO_PI;
  return next;
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

function formatAngleDegContinuous(thetaRad: number): number {
  return toDeg(thetaRad);
}

export function AngularMotionBuilder() {
  const [controls, setControls] = useState<ControlsState>(DEFAULT_CONTROLS);
  const [isRunning, setIsRunning] = useState(false);
  const [display, setDisplay] = useState<SimSnapshot>(() => ({
    t: 0,
    theta: (DEFAULT_CONTROLS.theta0Deg * Math.PI) / 180,
    omega: DEFAULT_CONTROLS.omega0,
    alpha: DEFAULT_CONTROLS.alpha,
    revolutions: 0,
  }));
  const [history, setHistory] = useState<HistoryPoint[]>([
    {
      t: 0,
      thetaDeg: DEFAULT_CONTROLS.theta0Deg,
      omega: DEFAULT_CONTROLS.omega0,
      alpha: DEFAULT_CONTROLS.alpha,
    },
  ]);

  const controlsRef = useRef(controls);
  const runningRef = useRef(isRunning);
  const simRef = useRef<SimState>({
    simTime: 0,
    theta: (DEFAULT_CONTROLS.theta0Deg * Math.PI) / 180,
    omega: DEFAULT_CONTROLS.omega0,
    revolutions: 0,
  });
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const lastUiPushRef = useRef(0);
  const lastHistoryPushRef = useRef(0);
  const armLineRef = useRef<SVGLineElement | null>(null);
  const armTipRef = useRef<SVGCircleElement | null>(null);

  useEffect(() => {
    controlsRef.current = controls;
  }, [controls]);

  useEffect(() => {
    runningRef.current = isRunning;
  }, [isRunning]);

  const pushDisplay = (ts: number) => {
    const sim = simRef.current;
    const alpha = controlsRef.current.alpha;
    setDisplay({
      t: sim.simTime,
      theta: sim.theta,
      omega: sim.omega,
      alpha,
      revolutions: sim.revolutions,
    });
    lastUiPushRef.current = ts;
  };

  const pushHistory = (ts: number) => {
    const sim = simRef.current;
    const alpha = controlsRef.current.alpha;
    const point: HistoryPoint = {
      t: sim.simTime,
      thetaDeg: formatAngleDegContinuous(sim.theta),
      omega: sim.omega,
      alpha,
    };
    setHistory((prev) => {
      const next = [...prev, point];
      if (next.length <= MAX_HISTORY_POINTS) return next;
      return next.slice(next.length - MAX_HISTORY_POINTS);
    });
    lastHistoryPushRef.current = ts;
  };

  const updateArmVisual = (thetaRad: number) => {
    const armLength = 34;
    const center = { x: 50, y: 50 };
    const wrapped = wrapAngleRad(thetaRad);
    const x2 = center.x + Math.cos(wrapped) * armLength;
    const y2 = center.y + Math.sin(wrapped) * armLength;
    if (armLineRef.current) {
      armLineRef.current.setAttribute('x1', center.x.toFixed(2));
      armLineRef.current.setAttribute('y1', center.y.toFixed(2));
      armLineRef.current.setAttribute('x2', x2.toFixed(2));
      armLineRef.current.setAttribute('y2', y2.toFixed(2));
    }
    if (armTipRef.current) {
      armTipRef.current.setAttribute('cx', x2.toFixed(2));
      armTipRef.current.setAttribute('cy', y2.toFixed(2));
    }
  };

  useEffect(() => {
    const step = (ts: number) => {
      if (!runningRef.current) {
        rafRef.current = null;
        lastTsRef.current = null;
        return;
      }

      if (lastTsRef.current == null) {
        lastTsRef.current = ts;
        updateArmVisual(simRef.current.theta);
        pushDisplay(ts);
        pushHistory(ts);
        rafRef.current = requestAnimationFrame(step);
        return;
      }

      const dt = Math.min((ts - lastTsRef.current) / 1000, 0.05);
      lastTsRef.current = ts;

      const sim = simRef.current;
      const alpha = controlsRef.current.alpha;
      const omegaPrev = sim.omega;
      sim.omega = omegaPrev + alpha * dt;
      sim.theta = sim.theta + omegaPrev * dt + 0.5 * alpha * dt * dt;
      sim.simTime += dt;
      sim.revolutions = sim.theta / TWO_PI;
      updateArmVisual(sim.theta);

      if (ts - lastUiPushRef.current >= UI_PUSH_MS) {
        pushDisplay(ts);
      }
      if (ts - lastHistoryPushRef.current >= HISTORY_SAMPLE_MS) {
        pushHistory(ts);
      }

      rafRef.current = requestAnimationFrame(step);
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
  }, [isRunning]);

  const resetSimulation = (nextControls?: ControlsState) => {
    const source = nextControls ?? controlsRef.current;
    const theta0Rad = (source.theta0Deg * Math.PI) / 180;
    simRef.current = {
      simTime: 0,
      theta: theta0Rad,
      omega: source.omega0,
      revolutions: 0,
    };
    lastTsRef.current = null;
    lastUiPushRef.current = 0;
    lastHistoryPushRef.current = 0;

    setDisplay({
      t: 0,
      theta: theta0Rad,
      omega: source.omega0,
      alpha: source.alpha,
      revolutions: 0,
    });
    setHistory([
      {
        t: 0,
        thetaDeg: source.theta0Deg,
        omega: source.omega0,
        alpha: source.alpha,
      },
    ]);
    updateArmVisual(theta0Rad);
  };

  const thetaDegDisplay = formatAngleDegContinuous(display.theta);
  const omegaDisplay = display.omega;
  const alphaDisplay = display.alpha;
  const revDisplay = display.revolutions;

  const historyMaxTime = history.length > 0 ? history[history.length - 1].t : 1;

  const yRanges = useMemo(() => {
    if (history.length === 0) {
      return {
        theta: { min: -90, max: 90 },
        omega: { min: -10, max: 10 },
        alpha: { min: -10, max: 10 },
      };
    }
    const thetaVals = history.map((h) => h.thetaDeg);
    const omegaVals = history.map((h) => h.omega);
    const alphaVals = history.map((h) => h.alpha);
    const pad = (minV: number, maxV: number, fallback: number) => {
      if (Math.abs(maxV - minV) < 1e-6) return { min: minV - fallback, max: maxV + fallback };
      const p = (maxV - minV) * 0.15;
      return { min: minV - p, max: maxV + p };
    };
    return {
      theta: pad(Math.min(...thetaVals), Math.max(...thetaVals), 45),
      omega: pad(Math.min(...omegaVals), Math.max(...omegaVals), 3),
      alpha: pad(Math.min(...alphaVals), Math.max(...alphaVals), 2),
    };
  }, [history]);

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-8 text-slate-100">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">
            Rotational kinematics
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
            Simple Anguler Motion Visualizer
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">
            Build rotational motion with initial angle, angular velocity, and angular acceleration.
            This is the rotational analogue of x-v-a kinematics.
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

      <main className="grid gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/40">
          <h2 className="text-sm font-semibold tracking-wide text-sky-300">Rotation canvas</h2>
          <p className="mt-1 text-xs text-slate-300">
            The arm angle shows angular position. Positive values rotate counterclockwise, negative
            values rotate clockwise.
          </p>

          <div className="mt-4 h-[20rem] rounded-xl border border-slate-800 bg-slate-950/80 p-3">
            <svg viewBox="0 0 100 100" className="h-full w-full rounded-lg">
              <rect x={2} y={2} width={96} height={96} rx={4} fill="#020617" stroke="#334155" strokeWidth={0.4} />
              <circle cx={50} cy={50} r={34} fill="none" stroke="#334155" strokeDasharray="1.2 1.8" strokeWidth={0.5} />
              <circle cx={50} cy={50} r={24} fill="rgba(14,165,233,0.12)" stroke="#0ea5e9" strokeWidth={0.5} />
              <line ref={armLineRef} x1={50} y1={50} x2={84} y2={50} stroke="#f59e0b" strokeWidth={1.4} />
              <circle cx={50} cy={50} r={1.6} fill="#f8fafc" />
              <circle ref={armTipRef} cx={84} cy={50} r={1.8} fill="#f59e0b" />
            </svg>
          </div>

          <div className="mt-4 grid gap-2 rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-xs sm:grid-cols-2">
            <DataCell label="Time, t" value={display.t} unit="s" />
            <DataCell label="Angular position, θ" value={thetaDegDisplay} unit="deg" />
            <DataCell label="Angular velocity, ω" value={omegaDisplay} unit="rad/s" />
            <DataCell label="Angular acceleration, α" value={alphaDisplay} unit="rad/s²" />
            <DataCell label="Revolutions" value={revDisplay} unit="rev" />
          </div>
        </section>

        <section className="flex min-h-[20rem] flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-950/80 p-5 shadow-lg shadow-slate-950/40">
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
                  resetSimulation();
                }}
                className="rounded-full bg-sky-500 px-3 py-1 text-[0.7rem] font-semibold text-slate-950 transition hover:bg-sky-400"
              >
                Reset
              </button>
            </div>
          </div>

          <SliderWithInput
            label="Initial angular position (θ₀)"
            units="deg"
            min={0}
            max={360}
            step={1}
            value={controls.theta0Deg}
            onChange={(theta0Deg) => {
              const next = { ...controlsRef.current, theta0Deg };
              setControls(next);
              setIsRunning(false);
              resetSimulation(next);
            }}
            syncToUrl={false}
          />

          <SliderWithInput
            label="Initial angular velocity (ω₀)"
            units="rad/s"
            min={-10}
            max={10}
            step={0.1}
            value={controls.omega0}
            onChange={(omega0) => {
              const next = { ...controlsRef.current, omega0 };
              setControls(next);
              setIsRunning(false);
              resetSimulation(next);
            }}
            syncToUrl={false}
          />

          <SliderWithInput
            label="Angular acceleration (α)"
            units="rad/s²"
            min={-10}
            max={10}
            step={0.1}
            value={controls.alpha}
            onChange={(alpha) => {
              const next = { ...controlsRef.current, alpha };
              setControls(next);
              setIsRunning(false);
              resetSimulation(next);
            }}
            syncToUrl={false}
          />
        </section>
      </main>

      <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/40">
        <h2 className="text-sm font-semibold tracking-wide text-sky-300">Kinematics graphs</h2>
        <p className="mt-1 text-xs text-slate-300">
          For constant α, the ω graph is linear and the θ graph is quadratic, mirroring linear
          kinematics where acceleration controls the slope of velocity.
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <TimeSeriesChart
            title="θ vs time"
            series={history}
            color="#a78bfa"
            yLabel="θ (deg)"
            yRange={yRanges.theta}
            maxT={Math.max(1, historyMaxTime)}
            valueOf={(p) => p.thetaDeg}
          />
          <TimeSeriesChart
            title="ω vs time"
            series={history}
            color="#22c55e"
            yLabel="ω (rad/s)"
            yRange={yRanges.omega}
            maxT={Math.max(1, historyMaxTime)}
            valueOf={(p) => p.omega}
          />
          <TimeSeriesChart
            title="α vs time"
            series={history}
            color="#f97316"
            yLabel="α (rad/s²)"
            yRange={yRanges.alpha}
            maxT={Math.max(1, historyMaxTime)}
            valueOf={(p) => p.alpha}
          />
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-sky-300">
          Concept explanation
        </h2>
        <div className="mt-3 space-y-2 text-sm text-slate-300">
          <p>
            Rotational kinematics maps directly to linear kinematics: θ ↔ x, ω ↔ v, and α ↔ a.
            Angular acceleration changes angular velocity, and angular velocity changes angle.
          </p>
          <p>
            With constant α, ω(t) = ω₀ + αt forms a line in time, and
            θ(t) = θ₀ + ω₀t + 1/2 αt² forms a parabola. The rotating arm gives a direct visual of
            that changing angular state.
          </p>
          <p>
            Signs matter: positive angular quantities rotate one direction while negative values
            reverse direction, just like signed linear velocity and acceleration.
          </p>
        </div>
      </section>
    </div>
  );
}

type DataCellProps = {
  label: string;
  value: number;
  unit: string;
};

function DataCell({ label, value, unit }: DataCellProps) {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-900/70 px-3 py-2">
      <p className="text-[0.66rem] text-slate-400">{label}</p>
      <p className="mt-0.5 font-mono text-[0.78rem] text-sky-200">
        {value.toFixed(2)} <span className="text-[0.65rem] text-slate-400">{unit}</span>
      </p>
    </div>
  );
}

type TimeSeriesChartProps = {
  title: string;
  series: HistoryPoint[];
  color: string;
  yLabel: string;
  yRange: { min: number; max: number };
  maxT: number;
  valueOf: (point: HistoryPoint) => number;
};

function TimeSeriesChart({ title, series, color, yLabel, yRange, maxT, valueOf }: TimeSeriesChartProps) {
  const width = 360;
  const height = 160;
  const padding = { top: 16, right: 12, bottom: 24, left: 42 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const tMax = Math.max(1, maxT);
  const yMin = yRange.min;
  const yMax = yRange.max;
  const ySpan = Math.max(1e-6, yMax - yMin);

  const x = (t: number) => padding.left + (t / tMax) * innerW;
  const y = (v: number) => padding.top + innerH - ((v - yMin) / ySpan) * innerH;

  const pathD = series
    .map((point, idx) => `${idx === 0 ? 'M' : 'L'} ${x(point.t).toFixed(2)} ${y(valueOf(point)).toFixed(2)}`)
    .join(' ');

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
      <p className="text-xs font-semibold text-slate-200">{title}</p>
      <p className="mt-0.5 text-[0.65rem] text-slate-400">{yLabel}</p>
      <svg viewBox={`0 0 ${width} ${height}`} className="mt-2 h-auto w-full">
        <line x1={padding.left} y1={padding.top} x2={padding.left} y2={height - padding.bottom} stroke="#475569" strokeWidth={0.7} />
        <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} stroke="#475569" strokeWidth={0.7} />
        <path d={pathD} fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
