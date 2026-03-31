import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

type VelocityMode = 'magnitude_angle' | 'vx_vy';

type ControlsState = {
  gravity: number;
  initialHeight: number;
  vx: number;
  vy: number;
};

const DEFAULT_CONTROLS: ControlsState = {
  gravity: 9.8,
  initialHeight: 10,
  vx: 5,
  vy: 10,
};

const MAX_HEIGHT_METERS = 50;
const MAX_WIDTH_METERS = 100;

function roundTo2(n: number): number {
  return Math.round(n * 100) / 100;
}
const SIMULATION_SPEED = 0.6;
const TARGET_FPS = 30;
const FRAME_INTERVAL_MS = 1000 / TARGET_FPS;
const DISPLAY_ACCURACY_PERCENT = 1;

function totalFlightTime2D(g: number, vy: number, h0: number): number {
  if (g <= 0) {
    if (vy < 0) return Math.max(0.1, -h0 / vy);
    return 10;
  }
  const disc = vy * vy + 2 * g * h0;
  if (disc <= 0) return 0;
  return (vy + Math.sqrt(disc)) / g;
}

type ChartBounds2D = {
  x: { min: number; max: number };
  y: { min: number; max: number };
  vx: { min: number; max: number };
  vy: { min: number; max: number };
  a: { min: number; max: number };
};

function computeChartBounds2D(
  g: number,
  vx: number,
  vy: number,
  h0: number,
  duration: number
): ChartBounds2D {
  const maxX = Math.max(0.1, vx * duration);
  const apexY = g > 0 && vy > 0 ? h0 + (vy * vy) / (2 * g) : h0;
  const maxY = Math.max(h0, apexY, 0.1);
  const vyFinal = vy - g * duration;
  return {
    x: { min: 0, max: maxX },
    y: { min: 0, max: maxY },
    vx: { min: vx - 1, max: vx + 1 },
    vy: { min: Math.min(vy, vyFinal) - 1, max: Math.max(vy, vyFinal) + 1 },
    a: { min: g > 0 ? 0 : 0, max: g > 0 ? g + 2 : 2 },
  };
}

type HistoryPoint2D = {
  t: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  a: number;
};

export function Kinematics2DDemo() {
  const [controls, setControls] = useState<ControlsState>(DEFAULT_CONTROLS);
  const [velocityMode, setVelocityMode] = useState<VelocityMode>('magnitude_angle');
  const [isRunning, setIsRunning] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: DEFAULT_CONTROLS.initialHeight });
  const [hasLaunched, setHasLaunched] = useState(false);
  const [hasLanded, setHasLanded] = useState(false);
  const [history, setHistory] = useState<HistoryPoint2D[]>([]);
  const [totalDuration, setTotalDuration] = useState<number>(1);
  const [chartBounds, setChartBounds] = useState<ChartBounds2D>({
    x: { min: 0, max: 20 },
    y: { min: 0, max: MAX_HEIGHT_METERS },
    vx: { min: 0, max: 10 },
    vy: { min: -10, max: 15 },
    a: { min: 0, max: 15 },
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
      setPos({ x: 0, y: controls.initialHeight });
      simTimeRef.current = 0;
    }
  }, [controls.initialHeight, hasLaunched]);

  useEffect(() => {
    return () => {
      if (animationFrameIdRef.current !== null)
        cancelAnimationFrame(animationFrameIdRef.current);
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
      const nextTime = simTimeRef.current + dt;
      simTimeRef.current = nextTime;
      const { gravity, initialHeight, vx, vy } = controlsRef.current;
      const g = gravity;
      const h0 = initialHeight;
      const x = vx * nextTime;
      const y = h0 + vy * nextTime - 0.5 * g * nextTime * nextTime;
      const vyNow = vy - g * nextTime;
      const a = g;
      if (y <= 0) {
        setPos({ x: vx * nextTime, y: 0 });
        setHistory((prev) => [...prev, { t: nextTime, x, y: 0, vx, vy: vyNow, a }]);
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
        setPos({ x, y });
        setHistory((prev) => [...prev, { t: nextTime, x, y, vx, vy: vyNow, a }]);
      }
      animationFrameIdRef.current = requestAnimationFrame(step);
    };
    animationFrameIdRef.current = requestAnimationFrame(step);
  };

  const handleControlChange = (field: keyof ControlsState, value: number) => {
    setControls((prev) => ({ ...prev, [field]: value }));
  };

  const handleVelocityAngleChange = (velocity: number, angleDeg: number) => {
    const rad = (angleDeg * Math.PI) / 180;
    setControls((prev) => ({
      ...prev,
      vx: velocity * Math.cos(rad),
      vy: velocity * Math.sin(rad),
    }));
  };

  const velocityMagnitude = Math.sqrt(controls.vx * controls.vx + controls.vy * controls.vy);
  const velocityAngleDeg =
    (Math.atan2(controls.vy, controls.vx) * 180) / Math.PI;

  const handleLaunch = () => {
    simTimeRef.current = 0;
    lastTimestampRef.current = null;
    lastVisualUpdateRef.current = null;
    const { gravity, initialHeight, vx, vy } = controlsRef.current;
    const duration = Math.max(0.1, totalFlightTime2D(gravity, vy, initialHeight));
    setTotalDuration(duration);
    setChartBounds(computeChartBounds2D(gravity, vx, vy, initialHeight, duration));
    setPos({ x: 0, y: initialHeight });
    setHistory([
      { t: 0, x: 0, y: initialHeight, vx, vy, a: gravity },
    ]);
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
      if (animationFrameIdRef.current != null) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
    } else {
      setIsRunning(true);
      isRunningRef.current = true;
      startLoopIfNeeded();
    }
  };

  const ballXPercent = Math.max(0, Math.min(100, (pos.x / MAX_WIDTH_METERS) * 100));
  const ballYPercent = Math.max(0, Math.min(100, (pos.y / MAX_HEIGHT_METERS) * 100));
  const isOffscreen =
    pos.x < 0 ||
    pos.x > MAX_WIDTH_METERS ||
    pos.y < 0 ||
    pos.y > MAX_HEIGHT_METERS;
  const currentVx = controlsRef.current.vx;
  const currentVy = controlsRef.current.vy - controlsRef.current.gravity * simTimeRef.current;

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-8 text-slate-100">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">
            Kinematics demo
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
            Projectile motion
          </h1>
          <p className="mt-2 max-w-xl text-sm text-slate-300">
            Set initial height and acceleration, then choose velocity by speed and angle or by
            v<sub>x</sub> and v<sub>y</sub>. The ball launches from the left and follows a parabolic path.
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
            Two-dimensional motion · No air resistance
          </span>
        </div>
      </header>

      <main className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/40">
          <div className="pointer-events-none absolute inset-0 -z-10 opacity-70">
            <div className="absolute -left-32 top-0 h-64 w-64 rounded-full bg-sky-700/30 blur-3xl" />
            <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-blue-500/25 blur-3xl" />
          </div>
          <h2 className="text-sm font-semibold tracking-wide text-sky-300">
            Visualizing projectile motion
          </h2>
          <p className="mt-1 text-xs text-slate-300">
            Ball starts at the left; horizontal velocity is constant, vertical motion has constant
            downward acceleration. Axes: 0–100 m (x), 0–50 m (y).
          </p>
          <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-stretch">
            <div className="relative flex min-w-0 h-[30rem] flex-[2] rounded-xl border border-slate-800 bg-gradient-to-t from-slate-950 via-slate-950/95 to-slate-900/80 p-4">
              <div className="relative mr-3 flex w-9 flex-shrink-0 flex-col justify-between text-[0.6rem] text-slate-400">
                <div className="relative flex-1 min-h-0">
                  <div className="absolute left-0 right-0 top-0 flex items-center gap-1">
                    <div className="h-px w-2 bg-slate-600" />
                    <span>50 m</span>
                  </div>
                  <div className="absolute left-0 right-0 top-[25%] flex items-center gap-1">
                    <div className="h-px w-2 bg-slate-600" />
                    <span>37.5</span>
                  </div>
                  <div className="absolute left-0 right-0 top-1/2 flex items-center gap-1">
                    <div className="h-px w-2 bg-slate-600" />
                    <span>25 m</span>
                  </div>
                  <div className="absolute left-0 right-0 top-[75%] flex items-center gap-1">
                    <div className="h-px w-2 bg-slate-600" />
                    <span>12.5</span>
                  </div>
                  <div className="absolute left-0 right-0 bottom-0 flex items-center gap-1">
                    <div className="h-px w-2 bg-slate-600" />
                    <span>0 m</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-1 flex-col min-h-0">
                <div className="relative flex-1 min-h-0 rounded-lg border border-slate-800/70 bg-gradient-to-t from-slate-950 via-slate-950/95 to-slate-900/80">
                  {!isOffscreen && (
                    <div
                      className="absolute h-3 w-3 rounded-full bg-sky-400"
                      style={{
                        left: `${ballXPercent}%`,
                        bottom: `${ballYPercent}%`,
                      }}
                    />
                  )}
                  <div className="absolute inset-x-0 bottom-0 h-px bg-emerald-700" />
                </div>
                <div className="mt-1 flex text-[0.6rem] text-slate-400">
                  <span className="w-[20%] text-left">0</span>
                  <span className="w-[20%] text-center">20</span>
                  <span className="w-[20%] text-center">40</span>
                  <span className="w-[20%] text-center">60</span>
                  <span className="w-[20%] text-center">80</span>
                  <span className="w-[20%] text-right">100 m</span>
                </div>
              </div>
            </div>
            <div className="flex min-w-0 flex-1 flex-shrink-0 max-w-[180px] sm:max-w-[200px] flex-col gap-2 rounded-xl border border-slate-800 bg-slate-950/80 p-2.5 text-[0.75rem] text-slate-300">
              <p className="shrink-0 font-semibold text-sky-200">Live quantities</p>
              <div className="min-w-0 space-y-1.5">
                <MetricRow label="Time" value={simTimeRef.current} units="s" />
                <MetricRow label="x" value={pos.x} units="m" />
                <MetricRow label="y" value={pos.y} units="m" />
                <MetricRow label={<><span>v</span><sub>x</sub></>} value={currentVx} units="m/s" />
                <MetricRow label={<><span>v</span><sub>y</sub></>} value={currentVy} units="m/s" />
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
            Set acceleration and initial height, then choose how to specify initial velocity.
          </p>
          <div className="mt-3 space-y-4 text-xs">
            <ControlRow
              label="Acceleration (gravity)"
              units="m/s²"
              min={0}
              max={25}
              step={0.1}
              value={controls.gravity}
              onChange={(v) => handleControlChange('gravity', v)}
              disabled={isRunning}
            />
            <ControlRow
              label="Initial height"
              units="m"
              min={0}
              max={50}
              step={0.1}
              value={controls.initialHeight}
              onChange={(v) => handleControlChange('initialHeight', v)}
              disabled={isRunning}
            />
            <div className="space-y-2">
              <p className="text-slate-200">Initial velocity</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setVelocityMode('magnitude_angle')}
                  className={`rounded-full px-3 py-1 text-[0.7rem] font-medium transition ${
                    velocityMode === 'magnitude_angle'
                      ? 'bg-sky-600 text-slate-50'
                      : 'border border-slate-700 bg-slate-900 text-slate-300 hover:border-sky-500'
                  }`}
                >
                  Speed + angle
                </button>
                <button
                  type="button"
                  onClick={() => setVelocityMode('vx_vy')}
                  className={`rounded-full px-3 py-1 text-[0.7rem] font-medium transition ${
                    velocityMode === 'vx_vy'
                      ? 'bg-sky-600 text-slate-50'
                      : 'border border-slate-700 bg-slate-900 text-slate-300 hover:border-sky-500'
                  }`}
                >
                  v<sub>x</sub> / v<sub>y</sub>
                </button>
              </div>
              {velocityMode === 'magnitude_angle' ? (
                <div className="space-y-3">
                  <ControlRow
                    label="Speed"
                    units="m/s"
                    min={0}
                    max={28}
                    step={0.5}
                    value={velocityMagnitude}
                    onChange={(v) => handleVelocityAngleChange(v, velocityAngleDeg)}
                    disabled={isRunning}
                  />
                  <ControlRow
                    label="Angle (above horizontal)"
                    units="°"
                    min={-90}
                    max={90}
                    step={1}
                    value={velocityAngleDeg}
                    onChange={(angle) => handleVelocityAngleChange(velocityMagnitude, angle)}
                    disabled={isRunning}
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <ControlRow
                    label={<><span>v</span><sub>x</sub></>}
                    units="m/s"
                    min={-20}
                    max={20}
                    step={0.5}
                    value={controls.vx}
                    onChange={(v) => handleControlChange('vx', v)}
                    disabled={isRunning}
                  />
                  <ControlRow
                    label={<><span>v</span><sub>y</sub></>}
                    units="m/s"
                    min={-20}
                    max={20}
                    step={0.5}
                    value={controls.vy}
                    onChange={(v) => handleControlChange('vy', v)}
                    disabled={isRunning}
                  />
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/40 lg:col-span-2">
          <h2 className="text-sm font-semibold tracking-wide text-sky-300">
            Metrics vs. time
          </h2>
          <p className="mt-1 text-xs text-slate-300">
            x, y, v<sub>x</sub>, v<sub>y</sub>, and acceleration over the course of the simulation.
          </p>
          <p className="mt-1 text-[0.65rem] text-slate-500">
            Based on how the simulation is conducted (discrete time steps at {TARGET_FPS} FPS),
            values are only accurate to approximately {DISPLAY_ACCURACY_PERCENT}%.
          </p>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="min-w-0 flex-1 space-y-4">
              {history.length > 0 && (
                <>
                  <MetricChart2D
                    data={history}
                    maxTime={totalDuration}
                    series="x"
                    color="#3b82f6"
                    yLabel="x (m)"
                    yMin={chartBounds.x.min}
                    yMax={chartBounds.x.max}
                  />
                  <MetricChart2D
                    data={history}
                    maxTime={totalDuration}
                    series="y"
                    color="#8b5cf6"
                    yLabel="y (m)"
                    yMin={chartBounds.y.min}
                    yMax={chartBounds.y.max}
                  />
                  <MetricChart2D
                    data={history}
                    maxTime={totalDuration}
                    series="vx"
                    color="#22c55e"
                    yLabel={<><span>v</span><sub>x</sub> (m/s)</>}
                    yMin={chartBounds.vx.min}
                    yMax={chartBounds.vx.max}
                  />
                  <MetricChart2D
                    data={history}
                    maxTime={totalDuration}
                    series="vy"
                    color="#eab308"
                    yLabel={<><span>v</span><sub>y</sub> (m/s)</>}
                    yMin={chartBounds.vy.min}
                    yMax={chartBounds.vy.max}
                  />
                  <MetricChart2D
                    data={history}
                    maxTime={totalDuration}
                    series="a"
                    color="#ef4444"
                    yLabel="Acceleration (m/s²)"
                    yMin={chartBounds.a.min}
                    yMax={chartBounds.a.max}
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
                <span className="text-slate-300">x (m)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-0.5 w-6 shrink-0 rounded bg-violet-500" aria-hidden />
                <span className="text-slate-300">y (m)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-0.5 w-6 shrink-0 rounded bg-green-500" aria-hidden />
                <span className="text-slate-300">v<sub>x</sub> (m/s)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-0.5 w-6 shrink-0 rounded bg-yellow-500" aria-hidden />
                <span className="text-slate-300">v<sub>y</sub> (m/s)</span>
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

function linearTicks(min: number, max: number, count: number): number[] {
  const range = max - min || 1;
  const ticks: number[] = [];
  for (let i = 0; i <= count; i++) ticks.push(min + (range * i) / count);
  return ticks;
}

function formatTick(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 100 || (abs < 0.01 && abs > 0)) return value.toExponential(1);
  if (abs >= 10 || (abs < 0.1 && abs > 0)) return value.toFixed(1);
  return value.toFixed(2);
}

type MetricChart2DProps = {
  data: HistoryPoint2D[];
  maxTime: number;
  series: keyof Omit<HistoryPoint2D, 't'>;
  color: string;
  yLabel: React.ReactNode;
  yMin: number;
  yMax: number;
};

const CHART_VIEW_WIDTH = 800;

function MetricChart2D({
  data,
  maxTime,
  series,
  color,
  yLabel,
  yMin,
  yMax,
}: MetricChart2DProps) {
  if (data.length === 0) return null;
  const maxT = Math.max(0.1, maxTime);
  const rangeY = yMax - yMin || 1;
  const w = CHART_VIEW_WIDTH;
  const h = CHART_HEIGHT;
  const innerW = w - CHART_PADDING.left - CHART_PADDING.right;
  const innerH = h - CHART_PADDING.top - CHART_PADDING.bottom;
  const x = (t: number) => CHART_PADDING.left + (t / maxT) * innerW;
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
        <line
          x1={CHART_PADDING.left}
          y1={CHART_PADDING.top}
          x2={CHART_PADDING.left}
          y2={h - CHART_PADDING.bottom}
          stroke="currentColor"
          strokeWidth={0.5}
          className="text-slate-700"
        />
        <line
          x1={CHART_PADDING.left}
          y1={h - CHART_PADDING.bottom}
          x2={w - CHART_PADDING.right}
          y2={h - CHART_PADDING.bottom}
          stroke="currentColor"
          strokeWidth={0.5}
          className="text-slate-700"
        />
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
        {yTicks.map((val, i) => (
          <g key={`y-${i}`}>
            <line
              x1={CHART_PADDING.left}
              y1={y(val)}
              x2={CHART_PADDING.left - 4}
              y2={y(val)}
              stroke="currentColor"
              strokeWidth={0.5}
              className="text-slate-600"
            />
            <text
              x={CHART_PADDING.left - 6}
              y={y(val) + 3}
              textAnchor="end"
              className="fill-slate-400 text-[0.55rem]"
            >
              {formatTick(val)}
            </text>
          </g>
        ))}
        {xTicks.map((t, i) => (
          <g key={`x-${i}`}>
            <line
              x1={x(t)}
              y1={h - CHART_PADDING.bottom}
              x2={x(t)}
              y2={h - CHART_PADDING.bottom + 4}
              stroke="currentColor"
              strokeWidth={0.5}
              className="text-slate-600"
            />
            <text
              x={x(t)}
              y={h - 6}
              textAnchor="middle"
              className="fill-slate-400 text-[0.55rem]"
            >
              {formatTick(t)}
            </text>
          </g>
        ))}
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
  label: React.ReactNode;
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
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    onChange(Number(e.target.value));
  };
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const parsed = Number(e.target.value);
    if (Number.isNaN(parsed)) return;
    onChange(Math.min(max, Math.max(min, parsed)));
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
        <span>Min: {min} {units}</span>
        <span>Max: {max} {units}</span>
      </div>
    </div>
  );
}

type MetricRowProps = { label: React.ReactNode; value: number; units: string };

function MetricRow({ label, value, units }: MetricRowProps) {
  return (
    <div className="flex items-baseline justify-between gap-3 rounded-md border border-slate-800 bg-slate-900/80 px-3 py-2">
      <span className="text-[0.7rem] text-slate-300">{label}</span>
      <span className="text-[0.7rem] font-mono text-sky-200">
        {roundTo2(value).toFixed(2)} <span className="text-[0.65rem] text-slate-400">{units}</span>
      </span>
    </div>
  );
}
