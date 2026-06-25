// id="vertical_spring_oscillator"
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { SliderWithInput } from '../../components/SliderWithInput';
import { ConceptBox } from '../../components/ConceptBox';

type ControlsState = {
  springKNm: number;
  massKg: number;
  gravityMps2: number;
  initialDisplacementM: number;
};

type UiSnapshot = {
  simTime: number;
  yM: number;
  vMps: number;
  aMps2: number;
  fSpringN: number;
  fWeightN: number;
  fNetN: number;
  peSpringJ: number;
  peGravJ: number;
  keJ: number;
  totalEnergyJ: number;
  omegaRadPerS: number;
  frequencyHz: number;
  eqStretchM: number;
};

type HistoryPoint = {
  t: number;
  yM: number;
  vMps: number;
  peSpringJ: number;
  peGravJ: number;
  keJ: number;
  totalEnergyJ: number;
};

const DEFAULT_CONTROLS: ControlsState = {
  springKNm: 40,
  massKg: 2,
  gravityMps2: 9.81,
  initialDisplacementM: 0.8,
};

const MIN_K = 1;
const MAX_K = 500;
const MIN_MASS = 0.1;
const MAX_MASS = 100;
const MIN_G = 0.1;
const MAX_G = 25;
const MIN_Y0 = -5;
const MAX_Y0 = 5;

const CANVAS_W = 420;
const CANVAS_H = 560;
const CEILING_Y = 48;
const NATURAL_SPRING_PX = 72;
const PX_PER_M = 36;
const MASS_RADIUS_BASE = 22;

const UI_PUSH_MS = 120;
const MAX_SIM_DT_S = 1 / 30;
const HISTORY_WINDOW_S = 6;
const MAX_HISTORY_POINTS = Math.ceil((HISTORY_WINDOW_S * 1000) / UI_PUSH_MS) + 2;

const CHART_W = 360;
const CHART_H = 160;
const CHART_PAD = { top: 16, right: 12, bottom: 24, left: 42 };

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function roundTo2(n: number): number {
  return Math.round(n * 100) / 100;
}

function stepHarmonicOscillator(y: number, v: number, omega: number, dt: number): { y: number; v: number } {
  if (omega <= 0 || dt <= 0) return { y, v };
  const wd = omega * dt;
  const c = Math.cos(wd);
  const s = Math.sin(wd);
  return {
    y: y * c + (v / omega) * s,
    v: -omega * y * s + v * c,
  };
}

function verticalSpringPath(lengthPx: number, centerX: number, coils = 11): string {
  const safeLength = Math.max(48, lengthPx);
  const lead = 14;
  const trail = 14;
  const bodyLength = Math.max(20, safeLength - lead - trail);
  const step = bodyLength / (coils * 2);
  const amp = 11;

  let d = `M ${centerX} 0 L ${centerX} ${lead}`;
  for (let i = 0; i < coils * 2; i++) {
    const y = lead + step * (i + 1);
    const x = centerX + (i % 2 === 0 ? -amp : amp);
    d += ` L ${x} ${y}`;
  }
  d += ` L ${centerX} ${safeLength}`;
  return d;
}

function computeSnapshot(
  y: number,
  v: number,
  m: number,
  k: number,
  g: number,
  simTime: number,
): UiSnapshot {
  const eqStretchM = m > 0 && k > 0 ? (m * g) / k : 0;
  const omegaRadPerS = m > 0 && k > 0 ? Math.sqrt(k / m) : 0;
  const fWeightN = m * g;
  const fSpringN = -k * (eqStretchM + y);
  const fNetN = fWeightN + fSpringN;
  const aMps2 = m > 0 ? fNetN / m : 0;
  const peSpringJ = 0.5 * k * y * y;
  const peGravJ = -m * g * y;
  const keJ = 0.5 * m * v * v;
  const totalEnergyJ = peSpringJ + peGravJ + keJ;

  return {
    simTime,
    yM: y,
    vMps: v,
    aMps2,
    fSpringN,
    fWeightN,
    fNetN,
    peSpringJ,
    peGravJ,
    keJ,
    totalEnergyJ,
    omegaRadPerS,
    frequencyHz: omegaRadPerS / (2 * Math.PI),
    eqStretchM,
  };
}

type Vec2 = { x: number; y: number };

function forceArrowLen(forceN: number, scale = 0.35): number {
  return clamp(Math.abs(forceN) * scale, 0, 140);
}

function massRadiusFromMass(m: number): number {
  return clamp(MASS_RADIUS_BASE + Math.log10(Math.max(0.1, m)) * 6, 18, 38);
}

function chartInnerDims() {
  return {
    innerW: CHART_W - CHART_PAD.left - CHART_PAD.right,
    innerH: CHART_H - CHART_PAD.top - CHART_PAD.bottom,
  };
}

function rangeFromValues(values: number[], fallbackPad: number): { min: number; max: number } {
  if (values.length === 0) return { min: -fallbackPad, max: fallbackPad };
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const pad = Math.max(fallbackPad * 0.12, (maxV - minV) * 0.12 || fallbackPad);
  return { min: minV - pad, max: maxV + pad };
}

function seriesPathD(
  series: HistoryPoint[],
  windowS: number,
  valueOf: (p: HistoryPoint) => number,
  yMin: number,
  yMax: number,
): string {
  if (series.length === 0) return '';
  const tEnd = series[series.length - 1].t;
  const tStart = Math.max(0, tEnd - windowS);
  const windowSeries = series.filter((p) => p.t >= tStart);
  if (windowSeries.length === 0) return '';
  const { innerW, innerH } = chartInnerDims();
  const ySpan = Math.max(1e-6, yMax - yMin);
  const tSpan = Math.max(0.25, tEnd - tStart);
  const x = (t: number) => CHART_PAD.left + ((t - tStart) / tSpan) * innerW;
  const y = (v: number) => CHART_PAD.top + innerH - ((v - yMin) / ySpan) * innerH;
  return windowSeries
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.t).toFixed(1)} ${y(valueOf(p)).toFixed(1)}`)
    .join(' ');
}

function windowedSeries(series: HistoryPoint[], windowS: number): HistoryPoint[] {
  if (series.length === 0) return [];
  const tEnd = series[series.length - 1].t;
  const tStart = Math.max(0, tEnd - windowS);
  return series.filter((p) => p.t >= tStart);
}

function setVerticalForceLine(
  line: SVGLineElement | null,
  from: Vec2,
  forceN: number,
  visible: boolean,
  scale = 0.35,
) {
  if (!line) return;
  if (!visible || Math.abs(forceN) < 1e-6) {
    line.setAttribute('visibility', 'hidden');
    return;
  }
  line.setAttribute('visibility', 'visible');
  const len = forceArrowLen(forceN, scale);
  const dir = forceN >= 0 ? 1 : -1;
  line.setAttribute('x1', from.x.toFixed(2));
  line.setAttribute('y1', from.y.toFixed(2));
  line.setAttribute('x2', from.x.toFixed(2));
  line.setAttribute('y2', (from.y + dir * len).toFixed(2));
}

function initialSpringHistory(): HistoryPoint[] {
  const snap = computeSnapshot(
    DEFAULT_CONTROLS.initialDisplacementM,
    0,
    DEFAULT_CONTROLS.massKg,
    DEFAULT_CONTROLS.springKNm,
    DEFAULT_CONTROLS.gravityMps2,
    0,
  );
  return [
    {
      t: 0,
      yM: snap.yM,
      vMps: snap.vMps,
      peSpringJ: snap.peSpringJ,
      peGravJ: snap.peGravJ,
      keJ: snap.keJ,
      totalEnergyJ: snap.totalEnergyJ,
    },
  ];
}

export function VerticalSpringOscillator() {
  const [controls, setControls] = useState<ControlsState>(DEFAULT_CONTROLS);
  const [isRunning, setIsRunning] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [showGravityForce, setShowGravityForce] = useState(true);
  const [showSpringForce, setShowSpringForce] = useState(true);
  const [showNetForce, setShowNetForce] = useState(true);

  const controlsRef = useRef(controls);
  const isRunningRef = useRef(false);
  const hasStartedRef = useRef(false);
  const showGravityForceRef = useRef(showGravityForce);
  const showSpringForceRef = useRef(showSpringForce);
  const showNetForceRef = useRef(showNetForce);
  const animationFrameIdRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);
  const lastUiPushRef = useRef(0);
  const simTimeRef = useRef(0);

  const springPathRef = useRef<SVGPathElement | null>(null);
  const massCircleRef = useRef<SVGCircleElement | null>(null);
  const massTextRef = useRef<SVGTextElement | null>(null);
  const eqLineRef = useRef<SVGLineElement | null>(null);
  const weightLineRef = useRef<SVGLineElement | null>(null);
  const springLineRef = useRef<SVGLineElement | null>(null);
  const netLineRef = useRef<SVGLineElement | null>(null);
  const positionPathRef = useRef<SVGPathElement | null>(null);
  const velocityPathRef = useRef<SVGPathElement | null>(null);
  const peSpringPathRef = useRef<SVGPathElement | null>(null);
  const peGravPathRef = useRef<SVGPathElement | null>(null);
  const kePathRef = useRef<SVGPathElement | null>(null);
  const totalEnergyPathRef = useRef<SVGPathElement | null>(null);

  const yRef = useRef(DEFAULT_CONTROLS.initialDisplacementM);
  const vRef = useRef(0);
  const mRef = useRef(DEFAULT_CONTROLS.massKg);
  const kRef = useRef(DEFAULT_CONTROLS.springKNm);
  const gRef = useRef(DEFAULT_CONTROLS.gravityMps2);

  const [ui, setUi] = useState<UiSnapshot>(() =>
    computeSnapshot(
      DEFAULT_CONTROLS.initialDisplacementM,
      0,
      DEFAULT_CONTROLS.massKg,
      DEFAULT_CONTROLS.springKNm,
      DEFAULT_CONTROLS.gravityMps2,
      0,
    ),
  );
  const historyRef = useRef<HistoryPoint[]>(initialSpringHistory());

  useEffect(() => {
    controlsRef.current = controls;
  }, [controls]);

  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  useEffect(() => {
    hasStartedRef.current = hasStarted;
  }, [hasStarted]);

  useEffect(() => {
    return () => {
      if (animationFrameIdRef.current !== null) cancelAnimationFrame(animationFrameIdRef.current);
    };
  }, []);

  const updateCanvasVisual = useCallback(() => {
    const m = mRef.current;
    const k = kRef.current;
    const g = gRef.current;
    const y = hasStartedRef.current
      ? yRef.current
      : clamp(controlsRef.current.initialDisplacementM, MIN_Y0, MAX_Y0);
    const v = hasStartedRef.current ? vRef.current : 0;
    const snap = computeSnapshot(y, v, m, k, g, simTimeRef.current);

    const eqStretchPx = snap.eqStretchM * PX_PER_M;
    const springLengthPx = NATURAL_SPRING_PX + eqStretchPx + y * PX_PER_M;
    const centerX = CANVAS_W / 2;
    const massCenterY = CEILING_Y + springLengthPx;
    const eqLineY = CEILING_Y + NATURAL_SPRING_PX + eqStretchPx;
    const massRadius = massRadiusFromMass(m);
    const arrowOrigin: Vec2 = { x: centerX + massRadius + 18, y: massCenterY };

    springPathRef.current?.setAttribute('d', verticalSpringPath(springLengthPx, centerX));
    massCircleRef.current?.setAttribute('cx', centerX.toFixed(2));
    massCircleRef.current?.setAttribute('cy', massCenterY.toFixed(2));
    massCircleRef.current?.setAttribute('r', massRadius.toFixed(2));
    massTextRef.current?.setAttribute('x', centerX.toFixed(2));
    massTextRef.current?.setAttribute('y', (massCenterY + 4).toFixed(2));
    eqLineRef.current?.setAttribute('y1', eqLineY.toFixed(2));
    eqLineRef.current?.setAttribute('y2', eqLineY.toFixed(2));

    setVerticalForceLine(weightLineRef.current, arrowOrigin, snap.fWeightN, showGravityForceRef.current);
    setVerticalForceLine(springLineRef.current, arrowOrigin, snap.fSpringN, showSpringForceRef.current);
    setVerticalForceLine(
      netLineRef.current,
      { x: arrowOrigin.x + 28, y: arrowOrigin.y },
      snap.fNetN,
      showNetForceRef.current,
    );
  }, []);

  useEffect(() => {
    showGravityForceRef.current = showGravityForce;
    showSpringForceRef.current = showSpringForce;
    showNetForceRef.current = showNetForce;
    updateCanvasVisual();
  }, [showGravityForce, showSpringForce, showNetForce, updateCanvasVisual]);

  const updateGraphVisuals = useCallback(() => {
    const series = windowedSeries(historyRef.current, HISTORY_WINDOW_S);
    const yRange = rangeFromValues(
      series.map((p) => p.yM),
      0.5,
    );
    const vRange = rangeFromValues(
      series.map((p) => p.vMps),
      0.5,
    );
    const eRange = rangeFromValues(
      series.flatMap((p) => [p.peSpringJ, p.peGravJ, p.keJ, p.totalEnergyJ]),
      1,
    );
    positionPathRef.current?.setAttribute(
      'd',
      seriesPathD(series, HISTORY_WINDOW_S, (p) => p.yM, yRange.min, yRange.max),
    );
    velocityPathRef.current?.setAttribute(
      'd',
      seriesPathD(series, HISTORY_WINDOW_S, (p) => p.vMps, vRange.min, vRange.max),
    );
    peSpringPathRef.current?.setAttribute(
      'd',
      seriesPathD(series, HISTORY_WINDOW_S, (p) => p.peSpringJ, eRange.min, eRange.max),
    );
    peGravPathRef.current?.setAttribute(
      'd',
      seriesPathD(series, HISTORY_WINDOW_S, (p) => p.peGravJ, eRange.min, eRange.max),
    );
    kePathRef.current?.setAttribute(
      'd',
      seriesPathD(series, HISTORY_WINDOW_S, (p) => p.keJ, eRange.min, eRange.max),
    );
    totalEnergyPathRef.current?.setAttribute(
      'd',
      seriesPathD(series, HISTORY_WINDOW_S, (p) => p.totalEnergyJ, eRange.min, eRange.max),
    );
  }, []);

  useEffect(() => {
    updateGraphVisuals();
  }, [updateGraphVisuals]);

  const pushThrottledUpdates = useCallback(() => {
    const snap = computeSnapshot(
      yRef.current,
      vRef.current,
      mRef.current,
      kRef.current,
      gRef.current,
      simTimeRef.current,
    );
    setUi(snap);
    const point: HistoryPoint = {
      t: snap.simTime,
      yM: snap.yM,
      vMps: snap.vMps,
      peSpringJ: snap.peSpringJ,
      peGravJ: snap.peGravJ,
      keJ: snap.keJ,
      totalEnergyJ: snap.totalEnergyJ,
    };
    const hist = historyRef.current;
    hist.push(point);
    const tCutoff = point.t - HISTORY_WINDOW_S;
    while (hist.length > MAX_HISTORY_POINTS || (hist.length > 1 && hist[0].t < tCutoff)) {
      hist.shift();
    }
    updateGraphVisuals();
  }, [updateGraphVisuals]);

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
      lastUiPushRef.current = 0;
      simTimeRef.current = 0;

      mRef.current = c.massKg;
      kRef.current = c.springKNm;
      gRef.current = c.gravityMps2;
      yRef.current = clamp(c.initialDisplacementM, MIN_Y0, MAX_Y0);
      vRef.current = 0;

      setHasStarted(false);
      controlsRef.current = c;

      const snap = computeSnapshot(yRef.current, 0, c.massKg, c.springKNm, c.gravityMps2, 0);
      setUi(snap);
      historyRef.current = [
        {
          t: 0,
          yM: snap.yM,
          vMps: snap.vMps,
          peSpringJ: snap.peSpringJ,
          peGravJ: snap.peGravJ,
          keJ: snap.keJ,
          totalEnergyJ: snap.totalEnergyJ,
        },
      ];
      requestAnimationFrame(() => {
        updateCanvasVisual();
        updateGraphVisuals();
      });
    },
    [updateCanvasVisual, updateGraphVisuals],
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
      simTimeRef.current += dt;

      const m = mRef.current;
      const k = kRef.current;
      const omega = m > 0 && k > 0 ? Math.sqrt(k / m) : 0;
      const { y, v } = stepHarmonicOscillator(yRef.current, vRef.current, omega, dt);
      yRef.current = y;
      vRef.current = v;

      updateCanvasVisual();

      const now = performance.now();
      if (now - lastUiPushRef.current >= UI_PUSH_MS) {
        lastUiPushRef.current = now;
        pushThrottledUpdates();
      }

      animationFrameIdRef.current = requestAnimationFrame(step);
    };

    animationFrameIdRef.current = requestAnimationFrame(step);
  }, [pushThrottledUpdates, updateCanvasVisual]);

  useEffect(() => {
    if (isRunningRef.current) startLoopIfNeeded();
  }, [isRunning, startLoopIfNeeded]);

  const handleStart = () => {
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
      pushThrottledUpdates();
      return;
    }
    if (!hasStarted) return;
    isRunningRef.current = true;
    setIsRunning(true);
    startLoopIfNeeded();
  };

  const handleControlChange = (patch: Partial<ControlsState>) => {
    const next = { ...controlsRef.current, ...patch };
    setControls(next);
    resetSimulation(next);
  };

  const yForView = !hasStarted ? clamp(controls.initialDisplacementM, MIN_Y0, MAX_Y0) : ui.yM;
  const viewSnapshot = !hasStarted
    ? computeSnapshot(
        yForView,
        0,
        controls.massKg,
        controls.springKNm,
        controls.gravityMps2,
        0,
      )
    : ui;

  const eqStretchM = viewSnapshot.eqStretchM;

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-8 text-slate-100">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-400">
            Oscillations &amp; waves
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
            Vertical Spring Oscillator
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-300">
            A mass hangs from a ceiling-mounted spring. Gravity sets the equilibrium stretch; release from
            an initial displacement to watch simple harmonic motion, force balance, and energy exchange.
          </p>
        </div>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-sky-500 hover:text-sky-100"
        >
          ← Dashboard
        </Link>
      </header>

      <main className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/40">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold tracking-wide text-rose-300">Simulation canvas</h2>
              <p className="mt-1 text-xs text-slate-400">
                y measured from equilibrium · positive downward · no damping
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleStart}
                disabled={isRunning}
                className="rounded-full bg-rose-500 px-4 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-200"
              >
                {hasStarted && !isRunning ? 'Restart' : 'Start'}
              </button>
              <button
                type="button"
                onClick={handleToggleRunning}
                disabled={!hasStarted}
                className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-[0.7rem] font-semibold text-slate-100 transition hover:border-rose-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isRunning ? 'Pause' : 'Resume'}
              </button>
              <button
                type="button"
                onClick={() => resetSimulation(controlsRef.current)}
                className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-[0.7rem] font-semibold text-slate-100 transition hover:border-slate-500"
              >
                Reset
              </button>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-slate-800 bg-slate-950/80 p-3">
            <svg viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`} className="mx-auto h-auto w-full max-h-[34rem]">
              <rect x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill="#020617" />
              <line
                x1={24}
                y1={CEILING_Y}
                x2={CANVAS_W - 24}
                y2={CEILING_Y}
                stroke="#94a3b8"
                strokeWidth={5}
                strokeLinecap="round"
              />
              <text x={28} y={CEILING_Y - 10} fill="#94a3b8" fontSize={11}>
                Ceiling anchor
              </text>

              <line
                ref={eqLineRef}
                x1={CANVAS_W / 2 - 70}
                y1={CEILING_Y + NATURAL_SPRING_PX}
                x2={CANVAS_W / 2 + 70}
                y2={CEILING_Y + NATURAL_SPRING_PX}
                stroke="rgba(251,191,36,0.45)"
                strokeWidth={1.5}
                strokeDasharray="5 4"
              />
              <text x={CANVAS_W / 2 + 76} y={CEILING_Y + NATURAL_SPRING_PX + 4} fill="rgba(251,191,36,0.8)" fontSize={10}>
                equilibrium
              </text>

              <g transform={`translate(0, ${CEILING_Y})`}>
                <path
                  ref={springPathRef}
                  d={verticalSpringPath(NATURAL_SPRING_PX, CANVAS_W / 2)}
                  fill="none"
                  stroke="url(#vso-spring)"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>

              <circle ref={massCircleRef} cx={CANVAS_W / 2} cy={CEILING_Y + NATURAL_SPRING_PX} r={22} fill="#38bdf8" stroke="#e2e8f0" strokeWidth={2} />
              <text ref={massTextRef} x={CANVAS_W / 2} y={CEILING_Y + NATURAL_SPRING_PX + 4} textAnchor="middle" fill="#0f172a" fontSize={11} fontWeight={600}>
                m
              </text>

              <line ref={weightLineRef} stroke="#f87171" strokeWidth={2.5} strokeLinecap="round" visibility="hidden" />
              <line ref={springLineRef} stroke="#34d399" strokeWidth={2.5} strokeLinecap="round" visibility="hidden" />
              <line ref={netLineRef} stroke="#fbbf24" strokeWidth={2.5} strokeLinecap="round" visibility="hidden" />

              <defs>
                <linearGradient id="vso-spring" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#fb7185" />
                  <stop offset="100%" stopColor="#f472b6" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          <div className="mt-3 flex flex-wrap gap-3 text-[0.68rem] text-slate-400">
            <label className="inline-flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={showGravityForce}
                onChange={(e) => setShowGravityForce(e.target.checked)}
                className="rounded border-slate-600 bg-slate-900"
              />
              <span className="text-red-300">Weight (mg)</span>
            </label>
            <label className="inline-flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={showSpringForce}
                onChange={(e) => setShowSpringForce(e.target.checked)}
                className="rounded border-slate-600 bg-slate-900"
              />
              <span className="text-emerald-300">Spring force</span>
            </label>
            <label className="inline-flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={showNetForce}
                onChange={(e) => setShowNetForce(e.target.checked)}
                className="rounded border-slate-600 bg-slate-900"
              />
              <span className="text-amber-300">Net force</span>
            </label>
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-950/80 p-5 shadow-lg shadow-slate-950/40">
          <h2 className="text-sm font-semibold tracking-wide text-rose-300">Controls</h2>

          <SliderWithInput
            label="Spring constant (k)"
            units="N/m"
            min={MIN_K}
            max={MAX_K}
            step={1}
            value={controls.springKNm}
            onChange={(v) => handleControlChange({ springKNm: v })}
            queryKey="k"
          />
          <SliderWithInput
            label="Mass"
            units="kg"
            min={MIN_MASS}
            max={MAX_MASS}
            step={0.1}
            value={controls.massKg}
            onChange={(v) => handleControlChange({ massKg: v })}
            queryKey="m"
          />
          <SliderWithInput
            label="Gravity (g)"
            units="m/s²"
            min={MIN_G}
            max={MAX_G}
            step={0.1}
            value={controls.gravityMps2}
            onChange={(v) => handleControlChange({ gravityMps2: v })}
            queryKey="g"
          />
          <SliderWithInput
            label="Initial displacement (y₀)"
            units="m"
            min={MIN_Y0}
            max={MAX_Y0}
            step={0.05}
            value={controls.initialDisplacementM}
            description="Relative to equilibrium; released from rest on Start."
            onChange={(v) => handleControlChange({ initialDisplacementM: v })}
            queryKey="y0"
          />

          <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 text-xs">
            <p className="font-medium text-slate-100">Oscillation parameters</p>
            <div className="mt-2 grid grid-cols-2 gap-2 text-slate-300">
              <StatChip label="ω" value={`${roundTo2(viewSnapshot.omegaRadPerS)} rad/s`} />
              <StatChip label="f" value={`${roundTo2(viewSnapshot.frequencyHz)} Hz`} />
              <StatChip label="Equilibrium stretch" value={`${roundTo2(eqStretchM)} m`} />
              <StatChip label="Period T" value={`${roundTo2(viewSnapshot.frequencyHz > 0 ? 1 / viewSnapshot.frequencyHz : 0)} s`} />
            </div>
          </div>
        </section>
      </main>

      <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
        <h2 className="text-sm font-semibold tracking-wide text-rose-300">Real-time data</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <StatChip label="Position y" value={`${roundTo2(viewSnapshot.yM)} m`} />
          <StatChip label="Velocity" value={`${roundTo2(viewSnapshot.vMps)} m/s`} />
          <StatChip label="Acceleration" value={`${roundTo2(viewSnapshot.aMps2)} m/s²`} />
          <StatChip label="Spring force" value={`${roundTo2(viewSnapshot.fSpringN)} N`} />
          <StatChip label="Weight" value={`${roundTo2(viewSnapshot.fWeightN)} N`} />
          <StatChip label="Net force" value={`${roundTo2(viewSnapshot.fNetN)} N`} />
          <StatChip label="Spring PE" value={`${roundTo2(viewSnapshot.peSpringJ)} J`} />
          <StatChip label="Gravitational PE" value={`${roundTo2(viewSnapshot.peGravJ)} J`} />
          <StatChip label="Kinetic energy" value={`${roundTo2(viewSnapshot.keJ)} J`} />
          <StatChip label="Total energy" value={`${roundTo2(viewSnapshot.totalEnergyJ)} J`} />
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
        <h2 className="text-sm font-semibold tracking-wide text-rose-300">Graphs</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
            <p className="text-xs font-semibold text-slate-200">Position vs time</p>
            <p className="mt-0.5 text-[0.65rem] text-slate-400">y (m) · last {HISTORY_WINDOW_S} s</p>
            <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="mt-2 h-auto w-full">
              <line
                x1={CHART_PAD.left}
                y1={CHART_PAD.top}
                x2={CHART_PAD.left}
                y2={CHART_H - CHART_PAD.bottom}
                stroke="#475569"
                strokeWidth={0.7}
              />
              <line
                x1={CHART_PAD.left}
                y1={CHART_H - CHART_PAD.bottom}
                x2={CHART_W - CHART_PAD.right}
                y2={CHART_H - CHART_PAD.bottom}
                stroke="#475569"
                strokeWidth={0.7}
              />
              <path
                ref={positionPathRef}
                fill="none"
                stroke="#fb7185"
                strokeWidth={1.7}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
            <p className="text-xs font-semibold text-slate-200">Velocity vs time</p>
            <p className="mt-0.5 text-[0.65rem] text-slate-400">v (m/s) · last {HISTORY_WINDOW_S} s</p>
            <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="mt-2 h-auto w-full">
              <line
                x1={CHART_PAD.left}
                y1={CHART_PAD.top}
                x2={CHART_PAD.left}
                y2={CHART_H - CHART_PAD.bottom}
                stroke="#475569"
                strokeWidth={0.7}
              />
              <line
                x1={CHART_PAD.left}
                y1={CHART_H - CHART_PAD.bottom}
                x2={CHART_W - CHART_PAD.right}
                y2={CHART_H - CHART_PAD.bottom}
                stroke="#475569"
                strokeWidth={0.7}
              />
              <path
                ref={velocityPathRef}
                fill="none"
                stroke="#38bdf8"
                strokeWidth={1.7}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
            <p className="text-xs font-semibold text-slate-200">Energy vs time</p>
            <p className="mt-0.5 text-[0.65rem] text-slate-400">
              Spring PE · Grav PE · KE · Total · last {HISTORY_WINDOW_S} s
            </p>
            <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="mt-2 h-auto w-full">
              <line
                x1={CHART_PAD.left}
                y1={CHART_PAD.top}
                x2={CHART_PAD.left}
                y2={CHART_H - CHART_PAD.bottom}
                stroke="#475569"
                strokeWidth={0.7}
              />
              <line
                x1={CHART_PAD.left}
                y1={CHART_H - CHART_PAD.bottom}
                x2={CHART_W - CHART_PAD.right}
                y2={CHART_H - CHART_PAD.bottom}
                stroke="#475569"
                strokeWidth={0.7}
              />
              <path ref={peSpringPathRef} fill="none" stroke="#a78bfa" strokeWidth={1.5} strokeLinecap="round" />
              <path ref={peGravPathRef} fill="none" stroke="#34d399" strokeWidth={1.5} strokeLinecap="round" />
              <path ref={kePathRef} fill="none" stroke="#38bdf8" strokeWidth={1.5} strokeLinecap="round" />
              <path ref={totalEnergyPathRef} fill="none" stroke="#fbbf24" strokeWidth={1.5} strokeLinecap="round" />
            </svg>
            <div className="mt-2 flex flex-wrap gap-2 text-[0.62rem] text-slate-400">
              <span className="text-violet-300">Spring PE</span>
              <span className="text-emerald-300">Grav PE</span>
              <span className="text-sky-300">KE</span>
              <span className="text-amber-300">Total</span>
            </div>
          </div>
        </div>
      </section>

      <ConceptBox
        heading="Key ideas"
        items={[
          {
            title: 'Equilibrium position',
            description:
              'Gravity stretches the spring until upward spring force balances weight: k ΔL_eq = mg. Oscillations are measured as displacement y from this equilibrium, not from the unstretched spring length.',
          },
          {
            title: 'Restoring force & SHM',
            description:
              'Near equilibrium the net force is F_net = −ky, so acceleration is proportional to displacement. The motion is simple harmonic with angular frequency ω = √(k/m), independent of amplitude and gravity.',
          },
          {
            title: 'Effect of k and m',
            description:
              'A stiffer spring (larger k) increases ω and shortens the period. A larger mass lowers ω and slows the oscillation, while also increasing the equilibrium stretch ΔL_eq = mg/k.',
          },
          {
            title: 'Role of gravity',
            description:
              'Gravity sets where equilibrium sits but does not change ω for ideal vertical springs. It contributes gravitational potential energy mgh relative to equilibrium (shown as −mgy with y positive downward).',
          },
          {
            title: 'Energy exchange',
            description:
              'Kinetic energy peaks at equilibrium; spring and gravitational potential energies peak at turning points. With no damping, total mechanical energy stays constant while the three terms trade.',
          },
        ]}
      />
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-900/70 px-3 py-2">
      <p className="text-[0.66rem] text-slate-400">{label}</p>
      <p className="mt-0.5 font-mono text-[0.78rem] text-rose-200">{value}</p>
    </div>
  );
}
