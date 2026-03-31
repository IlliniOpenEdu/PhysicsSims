import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

type ControlsState = {
  gravity: number; // m/s^2, positive downward
  initialVelocity: number; // m/s, positive upward
  initialHeight: number; // m
};

const DEFAULT_CONTROLS: ControlsState = {
  gravity: 9.8,
  initialVelocity: 0,
  initialHeight: 10,
};

const MAX_HEIGHT_METERS = 30;

function roundTo2(n: number): number {
  return Math.round(n * 100) / 100;
}
const SIMULATION_SPEED = 0.6; // scale real time → simulation time
const TARGET_FPS = 30;
const FRAME_INTERVAL_MS = 1000 / TARGET_FPS;
/** Approximate display accuracy due to discrete time-step updates at TARGET_FPS */
const DISPLAY_ACCURACY_PERCENT = 1;

/** Time when ball hits ground: h(t) = h0 + v0*t - 0.5*g*t² = 0 => t = (v0 + √(v0²+2*g*h0))/g. When g=0, h = h0 + v0*t so t = -h0/v0 if v0 < 0, else no landing. */
function totalFlightTime(gravity: number, initialVelocity: number, initialHeight: number): number {
  const g = gravity;
  const v0 = initialVelocity;
  const h0 = initialHeight;
  if (g <= 0) {
    if (v0 < 0) return Math.max(0.1, -h0 / v0);
    return 10; // no landing in zero-g, use a default duration for the chart
  }
  const discriminant = v0 * v0 + 2 * g * h0;
  if (discriminant <= 0) return 0;
  return (v0 + Math.sqrt(discriminant)) / g;
}

type ChartBounds = {
  height: { min: number; max: number };
  velocity: { min: number; max: number };
  acceleration: { min: number; max: number };
};

function computeChartBounds(
  gravity: number,
  initialVelocity: number,
  initialHeight: number,
  duration: number
): ChartBounds {
  const g = gravity;
  const v0 = initialVelocity;
  const h0 = initialHeight;
  const apexHeight = g > 0 && v0 > 0 ? h0 + (v0 * v0) / (2 * g) : h0;
  const vFinal = v0 - g * duration;
  return {
    height: { min: 0, max: Math.max(h0, apexHeight, 0.1) },
    velocity: {
      min: Math.min(v0, vFinal) - 0.5,
      max: Math.max(v0, vFinal) + 0.5,
    },
    acceleration: {
      min: g > 0 ? -g - 2 : 0,
      max: g > 0 ? 2 : 1,
    },
  };
}

type HistoryPoint = {
  t: number;
  height: number;
  velocity: number;
  acceleration: number;
};

export function KinematicsDemo() {
  const [controls, setControls] = useState<ControlsState>(DEFAULT_CONTROLS);
  const [isRunning, setIsRunning] = useState(false);
  const [currentHeight, setCurrentHeight] = useState<number>(DEFAULT_CONTROLS.initialHeight);
  const [hasLaunched, setHasLaunched] = useState(false);
  const [hasLanded, setHasLanded] = useState(false);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [totalDuration, setTotalDuration] = useState<number>(1);
  const [chartBounds, setChartBounds] = useState<ChartBounds>({
    height: { min: 0, max: MAX_HEIGHT_METERS },
    velocity: { min: -10, max: 10 },
    acceleration: { min: -15, max: 5 },
  });

  const animationFrameIdRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);
  const simTimeRef = useRef(0);
  const lastVisualUpdateRef = useRef<number | null>(null);

  const isRunningRef = useRef(isRunning);
  const controlsRef = useRef<ControlsState>(controls);

  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  useEffect(() => {
    controlsRef.current = controls;
  }, [controls]);

  useEffect(() => {
    if (!isRunningRef.current && !hasLaunched) {
      setCurrentHeight(controls.initialHeight);
      simTimeRef.current = 0;
    }
  }, [controls.initialHeight, hasLaunched]);

  useEffect(() => {
    return () => {
      if (animationFrameIdRef.current !== null) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, []);

  const startLoopIfNeeded = () => {
    if (animationFrameIdRef.current !== null || !isRunningRef.current) {
      return;
    }

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

      const nextTime = simTimeRef.current + dt;
      simTimeRef.current = nextTime;

      const { gravity, initialVelocity, initialHeight } = controlsRef.current;
      const height =
        initialHeight + initialVelocity * nextTime - 0.5 * gravity * nextTime * nextTime;

      const vel = controlsRef.current.initialVelocity - controlsRef.current.gravity * nextTime;
      const acc = -controlsRef.current.gravity;

      if (height <= 0) {
        setCurrentHeight(0);
        setHistory((prev) => [...prev, { t: nextTime, height: 0, velocity: vel, acceleration: acc }]);
        isRunningRef.current = false;
        setIsRunning(false);
        setHasLanded(true);
        animationFrameIdRef.current = null;
        lastTimestampRef.current = null;
        return;
      }

      const now = performance.now();
      if (
        lastVisualUpdateRef.current === null ||
        now - lastVisualUpdateRef.current >= FRAME_INTERVAL_MS
      ) {
        lastVisualUpdateRef.current = now;
        setCurrentHeight(height);
        setHistory((prev) => [...prev, { t: nextTime, height, velocity: vel, acceleration: acc }]);
      }

      animationFrameIdRef.current = requestAnimationFrame(step);
    };

    animationFrameIdRef.current = requestAnimationFrame(step);
  };

  const handleControlChange = (field: keyof ControlsState, value: number) => {
    setControls((prev) => ({ ...prev, [field]: value }));
  };

  const handleLaunch = () => {
    simTimeRef.current = 0;
    lastTimestampRef.current = null;
    lastVisualUpdateRef.current = null;
    const { gravity, initialVelocity, initialHeight } = controlsRef.current;
    const duration = Math.max(0.1, totalFlightTime(gravity, initialVelocity, initialHeight));
    setTotalDuration(duration);
    setChartBounds(computeChartBounds(gravity, initialVelocity, initialHeight, duration));
    setCurrentHeight(initialHeight);
    setHistory([{ t: 0, height: initialHeight, velocity: initialVelocity, acceleration: -gravity }]);
    setHasLaunched(true);
    setHasLanded(false);
    setIsRunning(true);
    isRunningRef.current = true;
    startLoopIfNeeded();
  };

  const handleTogglePause = () => {
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

  const heightRatio = currentHeight / MAX_HEIGHT_METERS;
  const isOffscreen = heightRatio > 1;
  const clampedRatio = Math.max(0, Math.min(1, heightRatio));
  const velocity = controlsRef.current.initialVelocity - controlsRef.current.gravity * simTimeRef.current;
  const acceleration = -controlsRef.current.gravity;
  const ballBottomPercent = clampedRatio * 100;

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-8 text-slate-100">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">
            Kinematics demo
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
            Throwing a ball straight up
          </h1>
          <p className="mt-2 max-w-xl text-sm text-slate-300">
            Adjust gravity, initial speed, and starting height, then hit launch to see how the ball
            moves. This simple demo focuses on vertical motion under constant acceleration.
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
            One-dimensional motion · No air resistance
          </span>
        </div>
      </header>

      <main className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1.4fr)]">
        <section className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/40">
          <div className="pointer-events-none absolute inset-0 -z-10 opacity-70">
            <div className="absolute -left-32 top-0 h-64 w-64 rounded-full bg-sky-700/30 blur-3xl" />
            <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-blue-500/25 blur-3xl" />
          </div>

          <h2 className="text-sm font-semibold tracking-wide text-sky-300">
            Visualizing vertical motion
          </h2>
          <p className="mt-1 text-xs text-slate-300">
            The ball starts at the chosen height, moves upward if thrown fast enough, then falls
            back down under constant acceleration.
          </p>

          <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-stretch">
            <div className="relative flex min-w-0 h-[30rem] flex-[2] rounded-xl border border-slate-800 bg-gradient-to-t from-slate-950 via-slate-950/95 to-slate-900/80 p-4">
              <div className="relative mr-4 flex w-10 flex-col text-[0.6rem] text-slate-400">
                <div className="relative flex-1 min-h-0">
                  <div className="absolute left-0 right-0 top-0 flex items-center gap-1">
                    <div className="h-px w-3 bg-slate-600" />
                    <span>30 m</span>
                  </div>
                  <div className="absolute left-0 right-0 top-[25%] flex items-center gap-1">
                    <div className="h-px w-3 bg-slate-600" />
                    <span>22.5 m</span>
                  </div>
                  <div className="absolute left-0 right-0 top-1/2 flex items-center gap-1">
                    <div className="h-px w-3 bg-slate-600" />
                    <span>15 m</span>
                  </div>
                  <div className="absolute left-0 right-0 top-[75%] flex items-center gap-1">
                    <div className="h-px w-3 bg-slate-600" />
                    <span>7.5 m</span>
                  </div>
                  <div className="absolute left-0 right-0 bottom-0 flex items-center gap-1">
                    <div className="h-px w-3 bg-slate-600" />
                    <span>0 m</span>
                  </div>
                </div>
              </div>

              <div className="relative flex-1 rounded-lg border border-slate-800/70 bg-gradient-to-t from-slate-950 via-slate-950/95 to-slate-900/80">
                {!isOffscreen && (
                  <div
                    className="absolute left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-sky-400"
                    style={{ bottom: `${ballBottomPercent}%` }}
                  />
                )}

                <div className="absolute inset-x-0 bottom-0 h-px rounded-b-lg bg-emerald-700" />
              </div>
            </div>

            <div className="flex min-w-0 flex-1 flex-shrink-0 max-w-[180px] sm:max-w-[200px] flex-col gap-2 rounded-xl border border-slate-800 bg-slate-950/80 p-2.5 text-[0.75rem] text-slate-300">
              <p className="shrink-0 font-semibold text-sky-200">Live quantities</p>
              <div className="min-w-0 space-y-1.5">
                <MetricRow label="Time" value={simTimeRef.current} units="s" />
                <MetricRow label="Height" value={currentHeight} units="m" />
                <MetricRow label="Velocity" value={velocity} units="m/s" />
                <MetricRow label="Acceleration" value={acceleration} units="m/s²" />
              </div>
            </div>
          </div>
        </section>

        <section className="flex min-h-[30rem] flex-col space-y-4 rounded-2xl border border-slate-800 bg-slate-950/80 p-5 shadow-lg shadow-slate-950/40">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold tracking-wide text-sky-300">
              Launch parameters
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleLaunch}
                disabled={isRunning}
                className="inline-flex items-center gap-2 rounded-full bg-sky-500 px-4 py-1.5 text-xs font-semibold text-slate-950 shadow-md shadow-sky-900/50 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-200"
              >
                {hasLaunched && !isRunning ? 'Relaunch' : 'Launch'}
              </button>
              <button
                type="button"
                onClick={handleTogglePause}
                disabled={hasLanded}
                className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-[0.7rem] font-semibold text-slate-100 shadow-sm transition hover:border-sky-500 hover:text-sky-100 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-800 disabled:text-slate-500"
              >
                {isRunning ? 'Pause' : hasLanded ? 'Pause' : 'Resume'}
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-300">
            Use sliders or type exact values. When you press launch, the ball follows the chosen
            settings until it returns to the ground.
          </p>

          <div className="mt-3 space-y-4 text-xs">
            <ControlRow
              label="Acceleration due to gravity"
              units="m/s²"
              min={0}
              max={25}
              step={0.1}
              value={controls.gravity}
              onChange={(v) => handleControlChange('gravity', v)}
              disabled={isRunning}
            />
            <ControlRow
              label="Initial velocity"
              units="m/s"
              min={-35}
              max={35}
              step={0.5}
              value={controls.initialVelocity}
              onChange={(v) => handleControlChange('initialVelocity', v)}
              disabled={isRunning}
            />
            <ControlRow
              label="Initial height"
              units="m"
              min={0}
              max={30}
              step={0.1}
              value={controls.initialHeight}
              onChange={(v) => handleControlChange('initialHeight', v)}
              disabled={isRunning}
            />
          </div>

          <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/80 p-3 text-[0.7rem] text-slate-300">
            Tip: Earth&apos;s gravity is about
            <span className="mx-1 rounded bg-slate-800 px-1 py-0.5 font-mono text-[0.65rem] text-sky-200">
              g = 9.8 m/s²
            </span>
            so use that value if you want a realistic simulation.
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/40 lg:col-span-2">
          <h2 className="text-sm font-semibold tracking-wide text-sky-300">
            Metrics vs. time
          </h2>
          <p className="mt-1 text-xs text-slate-300">
            Height, velocity, and acceleration over the course of the simulation.
          </p>
          <p className="mt-1 text-[0.65rem] text-slate-500">
            Based on how the simulation is conducted (discrete time steps at {TARGET_FPS} FPS), values are only accurate to approximately {DISPLAY_ACCURACY_PERCENT}%.
          </p>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="min-w-0 flex-1 space-y-4">
              {history.length > 0 && (
                <>
                  <MetricChart
                    data={history}
                    maxTime={totalDuration}
                    series="height"
                    color="#3b82f6"
                    yLabel="Height (m)"
                    yMin={chartBounds.height.min}
                    yMax={chartBounds.height.max}
                  />
                  <MetricChart
                    data={history}
                    maxTime={totalDuration}
                    series="velocity"
                    color="#22c55e"
                    yLabel="Velocity (m/s)"
                    yMin={chartBounds.velocity.min}
                    yMax={chartBounds.velocity.max}
                  />
                  <MetricChart
                    data={history}
                    maxTime={totalDuration}
                    series="acceleration"
                    color="#ef4444"
                    yLabel="Acceleration (m/s²)"
                    yMin={chartBounds.acceleration.min}
                    yMax={chartBounds.acceleration.max}
                  />
                </>
              )}
              {history.length === 0 && (
                <div className="flex h-48 items-center justify-center rounded-xl border border-slate-800 bg-slate-950/50 text-xs text-slate-500">
                  Launch the simulation to see graphs.
                </div>
              )}
            </div>
            <div className="flex shrink-0 flex-col gap-2 rounded-xl border border-slate-800 bg-slate-950/80 p-3 text-[0.75rem] sm:ml-4">
              <p className="font-semibold text-sky-200">Key</p>
              <div className="flex items-center gap-2">
                <span className="h-0.5 w-6 shrink-0 rounded bg-blue-500" aria-hidden />
                <span className="text-slate-300">Height (m)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-0.5 w-6 shrink-0 rounded bg-green-500" aria-hidden />
                <span className="text-slate-300">Velocity (m/s)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-0.5 w-6 shrink-0 rounded bg-red-500" aria-hidden />
                <span className="text-slate-300">Acceleration (m/s²)</span>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

const CHART_PADDING = { top: 12, right: 12, bottom: 28, left: 44 };
const CHART_HEIGHT = 120;
const NUM_X_TICKS = 6;
const NUM_Y_TICKS = 5;

/** Linear ticks from min to max (inclusive), count + 1 values */
function linearTicks(min: number, max: number, count: number): number[] {
  const range = max - min || 1;
  const ticks: number[] = [];
  for (let i = 0; i <= count; i++) {
    ticks.push(min + (range * i) / count);
  }
  return ticks;
}

function formatTick(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 100 || (abs < 0.01 && abs > 0)) return value.toExponential(1);
  if (abs >= 10 || (abs < 0.1 && abs > 0)) return value.toFixed(1);
  return value.toFixed(2);
}

type MetricChartProps = {
  data: HistoryPoint[];
  maxTime: number;
  series: keyof Omit<HistoryPoint, 't'>;
  color: string;
  yLabel: string;
  yMin: number;
  yMax: number;
};

const CHART_VIEW_WIDTH = 800;

function MetricChart({ data, maxTime, series, color, yLabel, yMin, yMax }: MetricChartProps) {
  if (data.length === 0) return null;
  const maxT = Math.max(0.1, maxTime);
  const rangeY = yMax - yMin || 1;

  const w = CHART_VIEW_WIDTH;
  const h = CHART_HEIGHT;
  const innerW = w - CHART_PADDING.left - CHART_PADDING.right;
  const innerH = h - CHART_PADDING.top - CHART_PADDING.bottom;

  const x = (t: number) =>
    CHART_PADDING.left + (t / maxT) * innerW;
  const y = (v: number) =>
    CHART_PADDING.top + innerH - ((v - yMin) / rangeY) * innerH;

  const pathD = data
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.t)} ${y(p[series])}`)
    .join(' ');

  const xTicks = linearTicks(0, maxT, NUM_X_TICKS);
  const yTicks = linearTicks(yMin, yMax, NUM_Y_TICKS);
  const zeroInRange = yMin < 0 && yMax > 0;
  const zeroY = zeroInRange ? y(0) : null;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-2">
      <p className="mb-1 text-[0.65rem] font-medium text-slate-400">{yLabel}</p>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-auto w-full max-w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Y-axis line */}
        <line
          x1={CHART_PADDING.left}
          y1={CHART_PADDING.top}
          x2={CHART_PADDING.left}
          y2={h - CHART_PADDING.bottom}
          stroke="currentColor"
          strokeWidth={0.5}
          className="text-slate-700"
        />
        {/* X-axis line */}
        <line
          x1={CHART_PADDING.left}
          y1={h - CHART_PADDING.bottom}
          x2={w - CHART_PADDING.right}
          y2={h - CHART_PADDING.bottom}
          stroke="currentColor"
          strokeWidth={0.5}
          className="text-slate-700"
        />
        {/* Zero line (dashed, faded) when 0 is within y range */}
        {zeroY != null && (
          <line
            x1={CHART_PADDING.left}
            y1={zeroY}
            x2={w - CHART_PADDING.right}
            y2={zeroY}
            stroke="currentColor"
            strokeWidth={0.8}
            strokeDasharray="4 3"
            opacity={0.5}
            className="text-slate-500"
          />
        )}
        {/* Y-axis ticks and labels */}
        {yTicks.map((val, i) => {
          const yPos = y(val);
          return (
            <g key={`y-${i}`}>
              <line
                x1={CHART_PADDING.left}
                y1={yPos}
                x2={CHART_PADDING.left - 4}
                y2={yPos}
                stroke="currentColor"
                strokeWidth={0.5}
                className="text-slate-600"
              />
              <text
                x={CHART_PADDING.left - 6}
                y={yPos + 3}
                textAnchor="end"
                className="fill-slate-400 text-[0.55rem]"
              >
                {formatTick(val)}
              </text>
            </g>
          );
        })}
        {/* X-axis ticks and labels */}
        {xTicks.map((t, i) => {
          const xPos = x(t);
          return (
            <g key={`x-${i}`}>
              <line
                x1={xPos}
                y1={h - CHART_PADDING.bottom}
                x2={xPos}
                y2={h - CHART_PADDING.bottom + 4}
                stroke="currentColor"
                strokeWidth={0.5}
                className="text-slate-600"
              />
              <text
                x={xPos}
                y={h - 6}
                textAnchor="middle"
                className="fill-slate-400 text-[0.55rem]"
              >
                {formatTick(t)}
              </text>
            </g>
          );
        })}
        <path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
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

type MetricRowProps = {
  label: string;
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
    const clamped = Math.min(max, Math.max(min, parsed));
    onChange(clamped);
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

