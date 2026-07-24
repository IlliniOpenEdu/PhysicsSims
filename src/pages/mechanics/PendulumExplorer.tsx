// id="pendulum_explorer"
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { SliderWithInput } from '../../components/system/SliderWithInput';
import { ConceptBox } from '../../components/system/ConceptBox';
import { useUrlStateSync } from '../../hooks/useUrlStateSync';

type ReleaseMode = 'angle' | 'height';

type ControlsState = {
  massKg: number;
  gravityMps2: number;
  lengthM: number;
  releaseMode: ReleaseMode;
  releaseSide: 'left' | 'right';
  releaseAngleDeg: number;
  releaseHeightM: number;
};

type UiSnapshot = {
  simTime: number;
  thetaRad: number;
  thetaDeg: number;
  omegaRadPerS: number;
  heightM: number;
  speedMps: number;
  tensionN: number;
  peJ: number;
  keJ: number;
  totalEnergyJ: number;
  periodSmallAngleS: number;
  periodMeasuredS: number | null;
};

type HistoryPoint = {
  t: number;
  thetaDeg: number;
  peJ: number;
  keJ: number;
  totalEnergyJ: number;
};

const DEFAULT_CONTROLS: ControlsState = {
  massKg: 2,
  gravityMps2: 9.81,
  lengthM: 2.5,
  releaseMode: 'angle',
  releaseSide: 'right',
  releaseAngleDeg: 35,
  releaseHeightM: 0.45,
};

const MIN_MASS = 0.1;
const MAX_MASS = 100;
const MIN_G = 0.1;
const MAX_G = 25;
const MIN_L = 0.5;
const MAX_L = 20;
const MAX_ANGLE_DEG = 85;

const CANVAS_W = 440;
const CANVAS_H = 520;
const PIVOT_X = CANVAS_W / 2;
const PIVOT_Y = 56;
const PX_PER_M = 38;

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

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

function maxReleaseHeightM(lengthM: number): number {
  return lengthM * (1 - Math.cos(degToRad(MAX_ANGLE_DEG)));
}

function heightToAngleRad(heightM: number, lengthM: number, sign: number): number {
  if (lengthM <= 0) return 0;
  const ratio = clamp(heightM / lengthM, 0, 1);
  const mag = Math.acos(1 - ratio);
  return sign >= 0 ? mag : -mag;
}

function angleRadToHeight(thetaRad: number, lengthM: number): number {
  return lengthM * (1 - Math.cos(thetaRad));
}

function releaseAngleRadFromControls(c: ControlsState): number {
  if (c.releaseMode === 'angle') {
    return degToRad(clamp(c.releaseAngleDeg, -MAX_ANGLE_DEG, MAX_ANGLE_DEG));
  }
  const sign = c.releaseSide === 'left' ? -1 : 1;
  const hMax = maxReleaseHeightM(c.lengthM);
  const h = clamp(c.releaseHeightM, 0, hMax);
  return heightToAngleRad(h, c.lengthM, sign);
}

function stepPendulum(theta: number, omega: number, g: number, L: number, dt: number): { theta: number; omega: number } {
  if (L <= 0 || dt <= 0) return { theta, omega };
  const alpha = -(g / L) * Math.sin(theta);
  const thetaNew = theta + omega * dt + 0.5 * alpha * dt * dt;
  const alphaNew = -(g / L) * Math.sin(thetaNew);
  const omegaNew = omega + 0.5 * (alpha + alphaNew) * dt;
  return { theta: thetaNew, omega: omegaNew };
}

function computeSnapshot(
  theta: number,
  omega: number,
  m: number,
  g: number,
  L: number,
  simTime: number,
  periodMeasuredS: number | null,
): UiSnapshot {
  const heightM = angleRadToHeight(theta, L);
  const speedMps = L * Math.abs(omega);
  const tensionN = m * (L * omega * omega + g * Math.cos(theta));
  const peJ = m * g * heightM;
  const keJ = 0.5 * m * L * L * omega * omega;
  const totalEnergyJ = peJ + keJ;
  const periodSmallAngleS = g > 0 && L > 0 ? (2 * Math.PI * Math.sqrt(L / g)) : 0;

  return {
    simTime,
    thetaRad: theta,
    thetaDeg: radToDeg(theta),
    omegaRadPerS: omega,
    heightM,
    speedMps,
    tensionN,
    peJ,
    keJ,
    totalEnergyJ,
    periodSmallAngleS,
    periodMeasuredS,
  };
}

type Vec2 = { x: number; y: number };

function forceArrowLen(forceN: number, scale = 0.28): number {
  return clamp(Math.abs(forceN) * scale, 0, 120);
}

function setDirectedForceLine(
  line: SVGLineElement | null,
  from: Vec2,
  dir: Vec2,
  magnitude: number,
  visible: boolean,
  scale = 0.28,
) {
  if (!line) return;
  if (!visible || magnitude < 1e-6) {
    line.setAttribute('visibility', 'hidden');
    return;
  }
  const len = forceArrowLen(magnitude, scale);
  const dLen = Math.hypot(dir.x, dir.y) || 1;
  const ux = dir.x / dLen;
  const uy = dir.y / dLen;
  line.setAttribute('visibility', 'visible');
  line.setAttribute('x1', from.x.toFixed(2));
  line.setAttribute('y1', from.y.toFixed(2));
  line.setAttribute('x2', (from.x + ux * len).toFixed(2));
  line.setAttribute('y2', (from.y + uy * len).toFixed(2));
}

function massRadiusFromMass(m: number): number {
  return clamp(16 + Math.log10(Math.max(0.1, m)) * 5, 14, 32);
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

function parseNumberParam(params: URLSearchParams, key: string): number | null {
  const raw = params.get(key);
  if (raw == null) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatNumberParam(value: number): string {
  return Number(value.toFixed(2)).toString();
}

function readControlsFromUrl(params: URLSearchParams): Partial<ControlsState> {
  const patch: Partial<ControlsState> = {};

  const massKg = parseNumberParam(params, 'm');
  if (massKg != null) patch.massKg = clamp(massKg, MIN_MASS, MAX_MASS);

  const gravityMps2 = parseNumberParam(params, 'g');
  if (gravityMps2 != null) patch.gravityMps2 = clamp(gravityMps2, MIN_G, MAX_G);

  const lengthM = parseNumberParam(params, 'L');
  if (lengthM != null) patch.lengthM = clamp(lengthM, MIN_L, MAX_L);

  const modeRaw = params.get('mode');
  if (modeRaw === 'angle' || modeRaw === 'height') {
    patch.releaseMode = modeRaw;
  }

  const releaseMode = patch.releaseMode ?? DEFAULT_CONTROLS.releaseMode;
  if (releaseMode === 'angle') {
    const releaseAngleDeg = parseNumberParam(params, 'a');
    if (releaseAngleDeg != null) {
      patch.releaseAngleDeg = clamp(releaseAngleDeg, -MAX_ANGLE_DEG, MAX_ANGLE_DEG);
    }
  } else {
    const releaseHeightM = parseNumberParam(params, 'h');
    if (releaseHeightM != null) {
      const maxHeight = maxReleaseHeightM(patch.lengthM ?? DEFAULT_CONTROLS.lengthM);
      patch.releaseHeightM = clamp(releaseHeightM, 0, maxHeight);
    }

    const sideRaw = params.get('side');
    if (sideRaw === 'left' || sideRaw === 'right') {
      patch.releaseSide = sideRaw;
    }
  }

  return patch;
}

function writeControlsToUrl(state: ControlsState, params: URLSearchParams) {
  const massKg = clamp(state.massKg, MIN_MASS, MAX_MASS);
  const gravityMps2 = clamp(state.gravityMps2, MIN_G, MAX_G);
  const lengthM = clamp(state.lengthM, MIN_L, MAX_L);

  if (!Object.is(massKg, DEFAULT_CONTROLS.massKg)) params.set('m', formatNumberParam(massKg));
  else params.delete('m');

  if (!Object.is(gravityMps2, DEFAULT_CONTROLS.gravityMps2)) params.set('g', formatNumberParam(gravityMps2));
  else params.delete('g');

  if (!Object.is(lengthM, DEFAULT_CONTROLS.lengthM)) params.set('L', formatNumberParam(lengthM));
  else params.delete('L');

  params.set('mode', state.releaseMode);

  if (state.releaseMode === 'angle') {
    const releaseAngleDeg = clamp(state.releaseAngleDeg, -MAX_ANGLE_DEG, MAX_ANGLE_DEG);
    if (!Object.is(releaseAngleDeg, DEFAULT_CONTROLS.releaseAngleDeg)) {
      params.set('a', formatNumberParam(releaseAngleDeg));
    } else {
      params.delete('a');
    }
    params.delete('h');
    params.delete('side');
    return;
  }

  const maxHeight = maxReleaseHeightM(lengthM);
  const releaseHeightM = clamp(state.releaseHeightM, 0, maxHeight);
  if (!Object.is(releaseHeightM, DEFAULT_CONTROLS.releaseHeightM)) {
    params.set('h', formatNumberParam(releaseHeightM));
  } else {
    params.delete('h');
  }

  params.set('side', state.releaseSide);
  params.delete('a');
}

const pendulumUrlOptions = {
  read: readControlsFromUrl,
  write: writeControlsToUrl,
};

export function PendulumExplorer() {
  const [controls, setControls] = useState<ControlsState>(DEFAULT_CONTROLS);
  const [isRunning, setIsRunning] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [showWeight, setShowWeight] = useState(true);
  const [showTension, setShowTension] = useState(true);
  const [showVelocity, setShowVelocity] = useState(true);

  const controlsRef = useRef(controls);
  const isRunningRef = useRef(false);
  const hasStartedRef = useRef(false);
  const showWeightRef = useRef(showWeight);
  const showTensionRef = useRef(showTension);
  const showVelocityRef = useRef(showVelocity);
  const animationFrameIdRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);
  const lastUiPushRef = useRef(0);
  const simTimeRef = useRef(0);

  const rodLineRef = useRef<SVGLineElement | null>(null);
  const bobCircleRef = useRef<SVGCircleElement | null>(null);
  const bobTextRef = useRef<SVGTextElement | null>(null);
  const weightLineRef = useRef<SVGLineElement | null>(null);
  const tensionLineRef = useRef<SVGLineElement | null>(null);
  const velocityLineRef = useRef<SVGLineElement | null>(null);
  const thetaPathRef = useRef<SVGPathElement | null>(null);
  const pePathRef = useRef<SVGPathElement | null>(null);
  const kePathRef = useRef<SVGPathElement | null>(null);
  const totalEnergyPathRef = useRef<SVGPathElement | null>(null);

  const thetaRef = useRef(releaseAngleRadFromControls(DEFAULT_CONTROLS));
  const omegaRef = useRef(0);
  const mRef = useRef(DEFAULT_CONTROLS.massKg);
  const gRef = useRef(DEFAULT_CONTROLS.gravityMps2);
  const lRef = useRef(DEFAULT_CONTROLS.lengthM);

  const lastPeakTimeRef = useRef<number | null>(null);
  const periodMeasuredRef = useRef<number | null>(null);
  const prevOmegaSignRef = useRef(0);

  const initialSnap = computeSnapshot(
    releaseAngleRadFromControls(DEFAULT_CONTROLS),
    0,
    DEFAULT_CONTROLS.massKg,
    DEFAULT_CONTROLS.gravityMps2,
    DEFAULT_CONTROLS.lengthM,
    0,
    null,
  );

  const [ui, setUi] = useState<UiSnapshot>(initialSnap);
  const historyRef = useRef<HistoryPoint[]>([
    {
      t: 0,
      thetaDeg: initialSnap.thetaDeg,
      peJ: initialSnap.peJ,
      keJ: initialSnap.keJ,
      totalEnergyJ: initialSnap.totalEnergyJ,
    },
  ]);

  useUrlStateSync(controls, setControls, pendulumUrlOptions);

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
    const g = gRef.current;
    const L = lRef.current;
    const theta = hasStartedRef.current ? thetaRef.current : releaseAngleRadFromControls(controlsRef.current);
    const omega = hasStartedRef.current ? omegaRef.current : 0;
    const snap = computeSnapshot(theta, omega, m, g, L, simTimeRef.current, periodMeasuredRef.current);

    const bobPos = bobPosition(theta, L);
    const massRadius = massRadiusFromMass(m);

    rodLineRef.current?.setAttribute('x1', PIVOT_X.toFixed(2));
    rodLineRef.current?.setAttribute('y1', PIVOT_Y.toFixed(2));
    rodLineRef.current?.setAttribute('x2', bobPos.x.toFixed(2));
    rodLineRef.current?.setAttribute('y2', bobPos.y.toFixed(2));
    bobCircleRef.current?.setAttribute('cx', bobPos.x.toFixed(2));
    bobCircleRef.current?.setAttribute('cy', bobPos.y.toFixed(2));
    bobCircleRef.current?.setAttribute('r', massRadius.toFixed(2));
    bobTextRef.current?.setAttribute('x', bobPos.x.toFixed(2));
    bobTextRef.current?.setAttribute('y', (bobPos.y + 4).toFixed(2));

    const arrowBase: Vec2 = { x: bobPos.x + massRadius + 14, y: bobPos.y };
    setDirectedForceLine(
      weightLineRef.current,
      arrowBase,
      { x: 0, y: 1 },
      m * g,
      showWeightRef.current,
    );
    setDirectedForceLine(
      tensionLineRef.current,
      arrowBase,
      { x: PIVOT_X - bobPos.x, y: PIVOT_Y - bobPos.y },
      snap.tensionN,
      showTensionRef.current,
    );
    const velSign = omega >= 0 ? 1 : -1;
    setDirectedForceLine(
      velocityLineRef.current,
      { x: arrowBase.x + 26, y: arrowBase.y },
      { x: Math.cos(theta) * velSign, y: -Math.sin(theta) * velSign },
      snap.speedMps,
      showVelocityRef.current,
      18,
    );
  }, []);

  useEffect(() => {
    showWeightRef.current = showWeight;
    showTensionRef.current = showTension;
    showVelocityRef.current = showVelocity;
    updateCanvasVisual();
  }, [showWeight, showTension, showVelocity, updateCanvasVisual]);

  const updateGraphVisuals = useCallback(() => {
    const series = windowedSeries(historyRef.current, HISTORY_WINDOW_S);
    const thetaRange = rangeFromValues(
      series.map((p) => p.thetaDeg),
      10,
    );
    const eRange = rangeFromValues(
      series.flatMap((p) => [p.peJ, p.keJ, p.totalEnergyJ]),
      1,
    );
    thetaPathRef.current?.setAttribute(
      'd',
      seriesPathD(series, HISTORY_WINDOW_S, (p) => p.thetaDeg, thetaRange.min, thetaRange.max),
    );
    pePathRef.current?.setAttribute(
      'd',
      seriesPathD(series, HISTORY_WINDOW_S, (p) => p.peJ, eRange.min, eRange.max),
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
      thetaRef.current,
      omegaRef.current,
      mRef.current,
      gRef.current,
      lRef.current,
      simTimeRef.current,
      periodMeasuredRef.current,
    );
    setUi(snap);
    const point: HistoryPoint = {
      t: snap.simTime,
      thetaDeg: snap.thetaDeg,
      peJ: snap.peJ,
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

  const resetSimulation = useCallback((next?: ControlsState) => {
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
    lastPeakTimeRef.current = null;
    periodMeasuredRef.current = null;
    prevOmegaSignRef.current = 0;

    mRef.current = c.massKg;
    gRef.current = c.gravityMps2;
    lRef.current = c.lengthM;
    thetaRef.current = releaseAngleRadFromControls(c);
    omegaRef.current = 0;

    setHasStarted(false);
    controlsRef.current = c;

    const snap = computeSnapshot(thetaRef.current, 0, c.massKg, c.gravityMps2, c.lengthM, 0, null);
    setUi(snap);
    historyRef.current = [
      {
        t: 0,
        thetaDeg: snap.thetaDeg,
        peJ: snap.peJ,
        keJ: snap.keJ,
        totalEnergyJ: snap.totalEnergyJ,
      },
    ];
    requestAnimationFrame(() => {
      updateCanvasVisual();
      updateGraphVisuals();
    });
  }, [updateCanvasVisual, updateGraphVisuals]);

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

      const { theta, omega } = stepPendulum(
        thetaRef.current,
        omegaRef.current,
        gRef.current,
        lRef.current,
        dt,
      );
      thetaRef.current = theta;
      omegaRef.current = omega;

      const omegaSign = Math.sign(omega);
      if (prevOmegaSignRef.current !== 0 && omegaSign !== 0 && omegaSign !== prevOmegaSignRef.current) {
        const t = simTimeRef.current;
        if (lastPeakTimeRef.current != null) {
          periodMeasuredRef.current = t - lastPeakTimeRef.current;
        }
        lastPeakTimeRef.current = t;
      }
      if (omegaSign !== 0) prevOmegaSignRef.current = omegaSign;

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
    if (patch.releaseAngleDeg != null) {
      next.releaseSide = patch.releaseAngleDeg < 0 ? 'left' : 'right';
    }
    if (next.releaseMode === 'height') {
      const hMax = maxReleaseHeightM(next.lengthM);
      next.releaseHeightM = clamp(next.releaseHeightM, 0, hMax);
    }
    setControls(next);
    resetSimulation(next);
  };

  const thetaForView = !hasStarted ? releaseAngleRadFromControls(controls) : ui.thetaRad;
  const viewSnapshot = !hasStarted
    ? computeSnapshot(
        thetaForView,
        0,
        controls.massKg,
        controls.gravityMps2,
        controls.lengthM,
        0,
        null,
      )
    : ui;

  const hMax = maxReleaseHeightM(controls.lengthM);

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-8 text-slate-100">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-400">
            Oscillations &amp; waves
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
            Pendulum Motion Explorer
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-300">
            Release a simple pendulum from a chosen angle or height and explore how length and gravity set the
            period, how tension and weight combine, and how kinetic and gravitational potential energy trade.
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
              <p className="mt-1 text-xs text-slate-400">θ = 0 at equilibrium (hanging straight down) · no air drag</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleStart}
                disabled={isRunning}
                className="rounded-full bg-rose-500 px-4 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:bg-slate-600"
              >
                {hasStarted && !isRunning ? 'Restart' : 'Start'}
              </button>
              <button
                type="button"
                onClick={handleToggleRunning}
                disabled={!hasStarted}
                className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-[0.7rem] font-semibold text-slate-100 transition hover:border-rose-500 disabled:opacity-40"
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
            <svg viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`} className="mx-auto h-auto w-full max-h-[32rem]">
              <rect x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill="#020617" />
              <line x1={PIVOT_X - 70} y1={PIVOT_Y} x2={PIVOT_X + 70} y2={PIVOT_Y} stroke="#64748b" strokeWidth={5} strokeLinecap="round" />
              <circle cx={PIVOT_X} cy={PIVOT_Y} r={6} fill="#e2e8f0" stroke="#94a3b8" strokeWidth={1.5} />

              <line ref={rodLineRef} x1={PIVOT_X} y1={PIVOT_Y} x2={PIVOT_X} y2={PIVOT_Y + 100} stroke="#cbd5e1" strokeWidth={2.5} />
              <circle ref={bobCircleRef} cx={PIVOT_X} cy={PIVOT_Y + 100} r={18} fill="#38bdf8" stroke="#f8fafc" strokeWidth={2} />
              <text ref={bobTextRef} x={PIVOT_X} y={PIVOT_Y + 104} textAnchor="middle" fill="#0f172a" fontSize={11} fontWeight={600}>
                m
              </text>

              <line ref={weightLineRef} stroke="#f87171" strokeWidth={2.5} strokeLinecap="round" visibility="hidden" />
              <line ref={tensionLineRef} stroke="#34d399" strokeWidth={2.5} strokeLinecap="round" visibility="hidden" />
              <line ref={velocityLineRef} stroke="#38bdf8" strokeWidth={2.5} strokeLinecap="round" visibility="hidden" />
            </svg>
          </div>

          <div className="mt-3 flex flex-wrap gap-3 text-[0.68rem] text-slate-400">
            <label className="inline-flex items-center gap-1.5">
              <input type="checkbox" checked={showWeight} onChange={(e) => setShowWeight(e.target.checked)} className="rounded border-slate-600 bg-slate-900" />
              <span className="text-red-300">Weight</span>
            </label>
            <label className="inline-flex items-center gap-1.5">
              <input type="checkbox" checked={showTension} onChange={(e) => setShowTension(e.target.checked)} className="rounded border-slate-600 bg-slate-900" />
              <span className="text-emerald-300">Tension</span>
            </label>
            <label className="inline-flex items-center gap-1.5">
              <input type="checkbox" checked={showVelocity} onChange={(e) => setShowVelocity(e.target.checked)} className="rounded border-slate-600 bg-slate-900" />
              <span className="text-sky-300">Velocity</span>
            </label>
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-950/80 p-5 shadow-lg shadow-slate-950/40">
          <h2 className="text-sm font-semibold tracking-wide text-rose-300">Controls</h2>

          <SliderWithInput
            label="Pendulum mass"
            units="kg"
            min={MIN_MASS}
            max={MAX_MASS}
            step={0.1}
            value={controls.massKg}
            onChange={(v) => handleControlChange({ massKg: v })}
            syncToUrl={false}
          />
          <SliderWithInput
            label="Gravity (g)"
            units="m/s²"
            min={MIN_G}
            max={MAX_G}
            step={0.1}
            value={controls.gravityMps2}
            onChange={(v) => handleControlChange({ gravityMps2: v })}
            syncToUrl={false}
          />
          <SliderWithInput
            label="Pendulum length (L)"
            units="m"
            min={MIN_L}
            max={MAX_L}
            step={0.1}
            value={controls.lengthM}
            onChange={(v) => handleControlChange({ lengthM: v })}
            syncToUrl={false}
          />

          <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
            <p className="text-xs font-medium text-slate-200">Release condition</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => handleControlChange({ releaseMode: 'angle' })}
                className={`rounded-full px-2.5 py-1 text-[0.65rem] font-semibold transition ${
                  controls.releaseMode === 'angle'
                    ? 'bg-rose-500 text-slate-950'
                    : 'border border-slate-700 bg-slate-900 text-slate-300'
                }`}
              >
                Angle
              </button>
              <button
                type="button"
                onClick={() => handleControlChange({ releaseMode: 'height' })}
                className={`rounded-full px-2.5 py-1 text-[0.65rem] font-semibold transition ${
                  controls.releaseMode === 'height'
                    ? 'bg-rose-500 text-slate-950'
                    : 'border border-slate-700 bg-slate-900 text-slate-300'
                }`}
              >
                Height
              </button>
            </div>
            {controls.releaseMode === 'angle' ? (
              <div className="mt-2">
                <SliderWithInput
                  label="Release angle (θ₀)"
                  units="deg"
                  min={-MAX_ANGLE_DEG}
                  max={MAX_ANGLE_DEG}
                  step={1}
                  value={controls.releaseAngleDeg}
                  description="From equilibrium (straight down). Positive = counterclockwise."
                  onChange={(v) => handleControlChange({ releaseAngleDeg: v })}
                  syncToUrl={false}
                />
              </div>
            ) : (
              <div className="mt-2 space-y-2">
                <SliderWithInput
                  label="Release height (h)"
                  units="m"
                  min={0}
                  max={hMax}
                  step={0.01}
                  value={controls.releaseHeightM}
                  description={`Above lowest point · max ≈ ${roundTo2(hMax)} m at ${MAX_ANGLE_DEG}°`}
                  onChange={(v) => handleControlChange({ releaseHeightM: v })}
                  syncToUrl={false}
                />
                <div className="flex items-center gap-2">
                  <span className="text-[0.68rem] text-slate-400">Swing side</span>
                  <button
                    type="button"
                    onClick={() => handleControlChange({ releaseSide: 'left' })}
                    className={`rounded-full px-2.5 py-1 text-[0.65rem] font-semibold ${
                      controls.releaseSide === 'left'
                        ? 'bg-rose-500 text-slate-950'
                        : 'border border-slate-700 bg-slate-900 text-slate-300'
                    }`}
                  >
                    Left
                  </button>
                  <button
                    type="button"
                    onClick={() => handleControlChange({ releaseSide: 'right' })}
                    className={`rounded-full px-2.5 py-1 text-[0.65rem] font-semibold ${
                      controls.releaseSide === 'right'
                        ? 'bg-rose-500 text-slate-950'
                        : 'border border-slate-700 bg-slate-900 text-slate-300'
                    }`}
                  >
                    Right
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
        <h2 className="text-sm font-semibold tracking-wide text-rose-300">Real-time data</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <StatChip label="Height above lowest" value={`${roundTo2(viewSnapshot.heightM)} m`} />
          <StatChip label="Angle θ" value={`${roundTo2(viewSnapshot.thetaDeg)}°`} />
          <StatChip label="Speed" value={`${roundTo2(viewSnapshot.speedMps)} m/s`} />
          <StatChip label="Angular velocity ω" value={`${roundTo2(viewSnapshot.omegaRadPerS)} rad/s`} />
          <StatChip label="Tension" value={`${roundTo2(viewSnapshot.tensionN)} N`} />
          <StatChip label="Potential energy" value={`${roundTo2(viewSnapshot.peJ)} J`} />
          <StatChip label="Kinetic energy" value={`${roundTo2(viewSnapshot.keJ)} J`} />
          <StatChip label="Total energy" value={`${roundTo2(viewSnapshot.totalEnergyJ)} J`} />
          <StatChip label="Period (small-angle)" value={`${roundTo2(viewSnapshot.periodSmallAngleS)} s`} />
          <StatChip
            label="Period (measured)"
            value={viewSnapshot.periodMeasuredS != null ? `${roundTo2(viewSnapshot.periodMeasuredS)} s` : '—'}
          />
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
        <h2 className="text-sm font-semibold tracking-wide text-rose-300">Graphs</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
            <p className="text-xs font-semibold text-slate-200">Angle vs time</p>
            <p className="mt-0.5 text-[0.65rem] text-slate-400">θ (deg) · last {HISTORY_WINDOW_S} s</p>
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
                ref={thetaPathRef}
                fill="none"
                stroke="#fb7185"
                strokeWidth={1.7}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
            <p className="text-xs font-semibold text-slate-200">Energy vs time</p>
            <p className="mt-0.5 text-[0.65rem] text-slate-400">PE · KE · Total · last {HISTORY_WINDOW_S} s</p>
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
              <path ref={pePathRef} fill="none" stroke="#34d399" strokeWidth={1.5} strokeLinecap="round" />
              <path ref={kePathRef} fill="none" stroke="#38bdf8" strokeWidth={1.5} strokeLinecap="round" />
              <path ref={totalEnergyPathRef} fill="none" stroke="#fbbf24" strokeWidth={1.5} strokeLinecap="round" />
            </svg>
            <div className="mt-2 flex flex-wrap gap-2 text-[0.62rem] text-slate-400">
              <span className="text-emerald-300">PE</span>
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
            title: 'Pendulum motion',
            description:
              'A simple pendulum swings because gravity provides a restoring torque. For angle θ from vertical, the tangential acceleration is approximately −(g/L) sin θ, producing periodic motion.',
          },
          {
            title: 'Effect of length and gravity',
            description:
              'Longer strings and weaker gravity slow the swing: small-angle period T ≈ 2π√(L/g). Doubling L increases the period by √2; doubling g shortens it by √2.',
          },
          {
            title: 'Energy exchange',
            description:
              'At the release point gravitational PE is highest; at the bottom KE is highest. With no drag, total mechanical energy stays nearly constant while PE and KE trade each half cycle.',
          },
          {
            title: 'Why mass does not affect period',
            description:
              'Heavier bobs need more force to accelerate but also have more inertia. In the ideal model those effects cancel, so ω = √(g/L) and the period do not depend on mass.',
          },
          {
            title: 'Tension vs weight',
            description:
              'Weight always points down. Tension along the rod is largest at the bottom of the swing, where it must both support the weight and supply centripetal acceleration: T = mg cos θ + mLω².',
          },
        ]}
      />
    </div>
  );
}

function bobPosition(thetaRad: number, lengthM: number): Vec2 {
  const r = lengthM * PX_PER_M;
  return {
    x: PIVOT_X + r * Math.sin(thetaRad),
    y: PIVOT_Y + r * Math.cos(thetaRad),
  };
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-900/70 px-3 py-2">
      <p className="text-[0.66rem] text-slate-400">{label}</p>
      <p className="mt-0.5 font-mono text-[0.78rem] text-rose-200">{value}</p>
    </div>
  );
}

