// id="buoyancy_explorer"
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { SliderWithInput } from '../../../components/SliderWithInput';
import { ConceptBox } from '../../../components/ConceptBox';

type InitialPlacement = 'above' | 'partial' | 'submerged';
type FloatStatus = 'Floating' | 'Neutral Buoyancy' | 'Sinking';
type PresetKey = 'wood' | 'ice' | 'waterNeutral' | 'steel';

type ControlsState = {
  massKg: number;
  sideM: number;
  gravityMps2: number;
  waterDensityKgM3: number;
  initialPlacement: InitialPlacement;
};

type PhysicsSnapshot = {
  simTime: number;
  centerYM: number;
  velocityMps: number;
  accelerationMps2: number;
  volumeM3: number;
  objectDensityKgM3: number;
  submergedFraction: number;
  displacedVolumeM3: number;
  weightN: number;
  buoyantN: number;
  netN: number;
  status: FloatStatus;
};

type HistoryPoint = {
  t: number;
  yM: number;
  buoyantN: number;
};

const DEFAULT_CONTROLS: ControlsState = {
  massKg: 38,
  sideM: 0.4,
  gravityMps2: 9.81,
  waterDensityKgM3: 1000,
  initialPlacement: 'above',
};

const MIN_MASS = 0.1;
const MAX_MASS = 1000;
const MIN_SIDE = 0.1;
const MAX_SIDE = 3;
const MIN_G = 0.1;
const MAX_G = 25;
const MIN_WATER_RHO = 100;
const MAX_WATER_RHO = 2000;

const TANK_H_M = 3.2;
const WATER_SURFACE_M = 2.6;

const CANVAS_W = 720;
const CANVAS_H = 480;
const TANK_PAD = 48;
const TANK_W_PX = CANVAS_W - 2 * TANK_PAD;
const TANK_H_PX = CANVAS_H - 2 * TANK_PAD;
const PX_PER_M = TANK_H_PX / TANK_H_M;
const TANK_X = TANK_PAD;
const TANK_Y = TANK_PAD;

const UI_PUSH_MS = 100;
const MAX_SIM_DT_S = 1 / 45;
const HISTORY_WINDOW_S = 8;
const MAX_HISTORY_POINTS = Math.ceil((HISTORY_WINDOW_S * 1000) / UI_PUSH_MS) + 2;
const EQUILIBRIUM_VEL = 0.08;
const EQUILIBRIUM_FORCE_FRAC = 0.04;

const CHART_W = 360;
const CHART_H = 160;
const CHART_PAD = { top: 16, right: 12, bottom: 24, left: 42 };

const PRESETS: Record<PresetKey, { densityKgM3: number; sideM: number; label: string }> = {
  wood: { densityKgM3: 600, sideM: 0.45, label: 'Wood' },
  ice: { densityKgM3: 920, sideM: 0.5, label: 'Ice' },
  waterNeutral: { densityKgM3: 1000, sideM: 0.35, label: 'Water neutral' },
  steel: { densityKgM3: 7800, sideM: 0.25, label: 'Steel' },
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function roundTo2(n: number): number {
  return Math.round(n * 100) / 100;
}

function metersToCanvasY(yM: number): number {
  return TANK_Y + TANK_H_PX - yM * PX_PER_M;
}

function submergedHeightM(centerYM: number, sideM: number, waterSurfaceM: number): number {
  const bottom = centerYM - sideM / 2;
  const top = centerYM + sideM / 2;
  if (top <= waterSurfaceM) return sideM;
  if (bottom >= waterSurfaceM) return 0;
  return waterSurfaceM - bottom;
}

function displacedVolumeM3(centerYM: number, sideM: number, waterSurfaceM: number): number {
  const h = submergedHeightM(centerYM, sideM, waterSurfaceM);
  return sideM * sideM * h;
}

function initialCenterY(placement: InitialPlacement, sideM: number): number {
  const half = sideM / 2;
  if (placement === 'above') return WATER_SURFACE_M + half + 0.35;
  if (placement === 'partial') return WATER_SURFACE_M;
  return Math.max(half + 0.1, WATER_SURFACE_M - half - 0.25);
}

function computePhysics(
  centerYM: number,
  velocityMps: number,
  massKg: number,
  sideM: number,
  g: number,
  rhoWater: number,
  simTime: number,
): PhysicsSnapshot {
  const volumeM3 = sideM * sideM * sideM;
  const objectDensityKgM3 = volumeM3 > 0 ? massKg / volumeM3 : 0;
  const dispVol = displacedVolumeM3(centerYM, sideM, WATER_SURFACE_M);
  const submergedFraction = volumeM3 > 0 ? dispVol / volumeM3 : 0;
  const weightN = massKg * g;
  const buoyantN = rhoWater * g * dispVol;
  const netN = buoyantN - weightN;
  const accelerationMps2 = massKg > 0 ? netN / massKg : 0;

  const densityRatio = rhoWater > 0 ? objectDensityKgM3 / rhoWater : 0;
  let status: FloatStatus;
  if (Math.abs(densityRatio - 1) < 0.025) {
    status = 'Neutral Buoyancy';
  } else if (densityRatio > 1.025) {
    status = 'Sinking';
  } else {
    status = 'Floating';
  }

  return {
    simTime,
    centerYM,
    velocityMps,
    accelerationMps2,
    volumeM3,
    objectDensityKgM3,
    submergedFraction,
    displacedVolumeM3: dispVol,
    weightN,
    buoyantN,
    netN,
    status,
  };
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

function timeSeriesPathD(
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

function forceArrowLen(forceN: number, scale = 0.018): number {
  return clamp(Math.abs(forceN) * scale, 0, 110);
}

function setForceLine(
  line: SVGLineElement | null,
  cx: number,
  cy: number,
  forceN: number,
  color: string,
  visible: boolean,
) {
  if (!line) return;
  if (!visible || Math.abs(forceN) < 1e-6) {
    line.setAttribute('visibility', 'hidden');
    return;
  }
  const len = forceArrowLen(forceN);
  const up = forceN > 0;
  line.setAttribute('visibility', 'visible');
  line.setAttribute('stroke', color);
  line.setAttribute('x1', cx.toFixed(1));
  line.setAttribute('y1', cy.toFixed(1));
  line.setAttribute('x2', cx.toFixed(1));
  line.setAttribute('y2', (cy + (up ? -len : len)).toFixed(1));
}

export function BuoyancyExplorer() {
  const [controls, setControls] = useState<ControlsState>(DEFAULT_CONTROLS);
  const [isRunning, setIsRunning] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [showWeight, setShowWeight] = useState(true);
  const [showBuoyant, setShowBuoyant] = useState(true);

  const controlsRef = useRef(controls);
  const isRunningRef = useRef(false);
  const simTimeRef = useRef(0);
  const centerYRef = useRef(initialCenterY(DEFAULT_CONTROLS.initialPlacement, DEFAULT_CONTROLS.sideM));
  const velocityRef = useRef(0);
  const animationFrameIdRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);
  const lastUiPushRef = useRef(0);

  const blockRectRef = useRef<SVGRectElement | null>(null);
  const submergedRectRef = useRef<SVGRectElement | null>(null);
  const weightLineRef = useRef<SVGLineElement | null>(null);
  const buoyantLineRef = useRef<SVGLineElement | null>(null);
  const positionPathRef = useRef<SVGPathElement | null>(null);
  const buoyantPathRef = useRef<SVGPathElement | null>(null);

  const showWeightRef = useRef(showWeight);
  const showBuoyantRef = useRef(showBuoyant);
  const historyRef = useRef<HistoryPoint[]>([]);

  const initialSnap = computePhysics(
    centerYRef.current,
    0,
    DEFAULT_CONTROLS.massKg,
    DEFAULT_CONTROLS.sideM,
    DEFAULT_CONTROLS.gravityMps2,
    DEFAULT_CONTROLS.waterDensityKgM3,
    0,
  );
  const [ui, setUi] = useState<PhysicsSnapshot>(initialSnap);

  useEffect(() => {
    controlsRef.current = controls;
  }, [controls]);

  useEffect(() => {
    return () => {
      if (animationFrameIdRef.current !== null) cancelAnimationFrame(animationFrameIdRef.current);
    };
  }, []);

  const updateGraphVisuals = useCallback(() => {
    const series = historyRef.current.filter((p) => p.t >= Math.max(0, simTimeRef.current - HISTORY_WINDOW_S));
    const yRange = rangeFromValues(
      series.length > 0 ? series.map((p) => p.yM) : [0, TANK_H_M],
      0.4,
    );
    const bRange = rangeFromValues(
      series.length > 0 ? series.map((p) => p.buoyantN) : [0, 100],
      10,
    );
    positionPathRef.current?.setAttribute(
      'd',
      timeSeriesPathD(historyRef.current, HISTORY_WINDOW_S, (p) => p.yM, yRange.min, yRange.max),
    );
    buoyantPathRef.current?.setAttribute(
      'd',
      timeSeriesPathD(
        historyRef.current,
        HISTORY_WINDOW_S,
        (p) => p.buoyantN,
        bRange.min,
        bRange.max,
      ),
    );
  }, []);

  const updateCanvasVisual = useCallback(() => {
    const c = controlsRef.current;
    const snap = computePhysics(
      centerYRef.current,
      velocityRef.current,
      c.massKg,
      c.sideM,
      c.gravityMps2,
      c.waterDensityKgM3,
      simTimeRef.current,
    );

    const sidePx = c.sideM * PX_PER_M;
    const cx = TANK_X + TANK_W_PX / 2;
    const cy = metersToCanvasY(centerYRef.current);
    const top = cy - sidePx / 2;
    const waterY = metersToCanvasY(WATER_SURFACE_M);
    const subH = submergedHeightM(centerYRef.current, c.sideM, WATER_SURFACE_M) * PX_PER_M;

    blockRectRef.current?.setAttribute('x', (cx - sidePx / 2).toFixed(1));
    blockRectRef.current?.setAttribute('y', top.toFixed(1));
    blockRectRef.current?.setAttribute('width', sidePx.toFixed(1));
    blockRectRef.current?.setAttribute('height', sidePx.toFixed(1));

    if (subH > 0.5) {
      submergedRectRef.current?.setAttribute('visibility', 'visible');
      submergedRectRef.current?.setAttribute('x', (cx - sidePx / 2).toFixed(1));
      submergedRectRef.current?.setAttribute('y', Math.max(top, waterY).toFixed(1));
      submergedRectRef.current?.setAttribute('width', sidePx.toFixed(1));
      submergedRectRef.current?.setAttribute(
        'height',
        Math.min(subH, sidePx).toFixed(1),
      );
    } else {
      submergedRectRef.current?.setAttribute('visibility', 'hidden');
    }

    setForceLine(weightLineRef.current, cx + sidePx / 2 + 18, cy, -snap.weightN, '#f87171', showWeightRef.current);
    setForceLine(buoyantLineRef.current, cx + sidePx / 2 + 42, cy, snap.buoyantN, '#38bdf8', showBuoyantRef.current);
  }, []);

  useEffect(() => {
    showWeightRef.current = showWeight;
    showBuoyantRef.current = showBuoyant;
    updateCanvasVisual();
  }, [showWeight, showBuoyant, updateCanvasVisual]);

  const pushThrottledUpdates = useCallback(() => {
    const c = controlsRef.current;
    const snap = computePhysics(
      centerYRef.current,
      velocityRef.current,
      c.massKg,
      c.sideM,
      c.gravityMps2,
      c.waterDensityKgM3,
      simTimeRef.current,
    );
    setUi(snap);

    const hist = historyRef.current;
    hist.push({ t: snap.simTime, yM: snap.centerYM, buoyantN: snap.buoyantN });
    const tCutoff = snap.simTime - HISTORY_WINDOW_S;
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
      velocityRef.current = 0;
      centerYRef.current = initialCenterY(c.initialPlacement, c.sideM);
      historyRef.current = [];

      setHasStarted(false);
      controlsRef.current = c;

      const snap = computePhysics(
        centerYRef.current,
        0,
        c.massKg,
        c.sideM,
        c.gravityMps2,
        c.waterDensityKgM3,
        0,
      );
      setUi(snap);
      requestAnimationFrame(() => {
        updateCanvasVisual();
        updateGraphVisuals();
      });
    },
    [updateCanvasVisual, updateGraphVisuals],
  );

  const stepPhysics = useCallback((dt: number) => {
    const c = controlsRef.current;
    const half = c.sideM / 2;
    const yMin = half;
    const yMax = TANK_H_M - half;

    let y = centerYRef.current;
    let v = velocityRef.current;

    const snap = computePhysics(y, v, c.massKg, c.sideM, c.gravityMps2, c.waterDensityKgM3, simTimeRef.current);
    let a = snap.accelerationMps2;

    const nearEquilibrium =
      snap.weightN > 0 &&
      Math.abs(snap.buoyantN - snap.weightN) / snap.weightN < EQUILIBRIUM_FORCE_FRAC;

    if (nearEquilibrium && snap.status === 'Floating') {
      const targetSubmerged = (snap.objectDensityKgM3 / c.waterDensityKgM3) * c.sideM;
      const targetCenter = WATER_SURFACE_M - targetSubmerged + half;
      if (Math.abs(v) < EQUILIBRIUM_VEL) {
        y += (targetCenter - y) * clamp(dt * 6, 0, 0.35);
        v *= 0.82;
      }
    }

    if (nearEquilibrium && snap.status === 'Neutral Buoyancy') {
      v *= 0.88;
      a *= 0.5;
    }

    v += a * dt;
    if (nearEquilibrium) v *= 0.985;
    y += v * dt;

    if (y < yMin) {
      y = yMin;
      v = 0;
    }
    if (y > yMax) {
      y = yMax;
      v = Math.min(v, 0);
    }

    centerYRef.current = y;
    velocityRef.current = v;
  }, []);

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

      const dt = Math.min(MAX_SIM_DT_S, (timestamp - lastTimestampRef.current) / 1000);
      lastTimestampRef.current = timestamp;
      simTimeRef.current += dt;
      setHasStarted(true);

      stepPhysics(dt);
      updateCanvasVisual();

      const now = performance.now();
      if (now - lastUiPushRef.current >= UI_PUSH_MS) {
        lastUiPushRef.current = now;
        pushThrottledUpdates();
      }

      animationFrameIdRef.current = requestAnimationFrame(step);
    };

    animationFrameIdRef.current = requestAnimationFrame(step);
  }, [pushThrottledUpdates, stepPhysics, updateCanvasVisual]);

  useEffect(() => {
    isRunningRef.current = isRunning;
    if (isRunning) startLoopIfNeeded();
  }, [isRunning, startLoopIfNeeded]);

  useEffect(() => {
    updateCanvasVisual();
  }, [controls, updateCanvasVisual]);

  const handleControlChange = (patch: Partial<ControlsState>) => {
    const next = { ...controlsRef.current, ...patch };
    setControls(next);
    controlsRef.current = next;
    if (!hasStarted) {
      centerYRef.current = initialCenterY(next.initialPlacement, next.sideM);
    }
    updateCanvasVisual();
    pushThrottledUpdates();
  };

  const applyPreset = (key: PresetKey) => {
    const p = PRESETS[key];
    const massKg = p.densityKgM3 * p.sideM * p.sideM * p.sideM;
    const next: ControlsState = {
      ...controlsRef.current,
      massKg: clamp(massKg, MIN_MASS, MAX_MASS),
      sideM: p.sideM,
    };
    setControls(next);
    resetSimulation(next);
  };

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
  };

  const viewSnap = !hasStarted
    ? computePhysics(
        initialCenterY(controls.initialPlacement, controls.sideM),
        0,
        controls.massKg,
        controls.sideM,
        controls.gravityMps2,
        controls.waterDensityKgM3,
        0,
      )
    : ui;

  const densityCompare =
    viewSnap.objectDensityKgM3 < controls.waterDensityKgM3 * 0.975
      ? 'Object is less dense than water → floats'
      : viewSnap.objectDensityKgM3 > controls.waterDensityKgM3 * 1.025
        ? 'Object is denser than water → sinks'
        : 'Object density ≈ water → neutral buoyancy';

  const statusColor =
    viewSnap.status === 'Floating'
      ? 'border-emerald-700/50 bg-emerald-950/40 text-emerald-200'
      : viewSnap.status === 'Neutral Buoyancy'
        ? 'border-sky-700/50 bg-sky-950/40 text-sky-200'
        : 'border-orange-700/50 bg-orange-950/40 text-orange-200';

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-8 text-slate-100">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-400">Pressure</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
            Buoyancy Explorer
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-300">
            A square block in a water tank — watch weight and buoyant force compete as displaced volume
            grows with submersion (Archimedes&apos; principle).
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

      <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-lg shadow-slate-950/40">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className={`rounded-lg border px-4 py-2 text-center ${statusColor}`}>
            <p className="text-[0.65rem] font-semibold uppercase tracking-wider opacity-80">Status</p>
            <p className="text-sm font-semibold">{viewSnap.status}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleStart}
              disabled={isRunning}
              className="rounded-full bg-amber-500 px-4 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-amber-400 disabled:opacity-50"
            >
              {hasStarted && !isRunning ? 'Restart' : 'Start'}
            </button>
            <button
              type="button"
              onClick={handleToggleRunning}
              disabled={!hasStarted}
              className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-[0.7rem] font-semibold transition hover:border-amber-500 disabled:opacity-40"
            >
              {isRunning ? 'Pause' : 'Resume'}
            </button>
            <button
              type="button"
              onClick={() => resetSimulation(controlsRef.current)}
              className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-[0.7rem] font-semibold transition hover:border-slate-500"
            >
              Reset
            </button>
          </div>
        </div>

        <svg viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`} className="mx-auto block h-auto w-full max-w-4xl">
          <rect x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill="#020617" />
          <rect
            x={TANK_X}
            y={TANK_Y}
            width={TANK_W_PX}
            height={TANK_H_PX}
            fill="#0f172a"
            stroke="#475569"
            strokeWidth={2}
          />
          <rect
            x={TANK_X + 2}
            y={metersToCanvasY(WATER_SURFACE_M)}
            width={TANK_W_PX - 4}
            height={metersToCanvasY(0) - metersToCanvasY(WATER_SURFACE_M)}
            fill="rgba(56,189,248,0.22)"
          />
          <line
            x1={TANK_X}
            y1={metersToCanvasY(WATER_SURFACE_M)}
            x2={TANK_X + TANK_W_PX}
            y2={metersToCanvasY(WATER_SURFACE_M)}
            stroke="#38bdf8"
            strokeWidth={2}
            strokeDasharray="8 5"
          />
          <text x={TANK_X + 8} y={metersToCanvasY(WATER_SURFACE_M) - 8} fill="#7dd3fc" fontSize={11}>
            Water surface
          </text>

          <rect
            ref={blockRectRef}
            fill="#94a3b8"
            stroke="#e2e8f0"
            strokeWidth={2}
            rx={2}
          />
          <rect ref={submergedRectRef} fill="rgba(56,189,248,0.45)" visibility="hidden" />

          <line ref={weightLineRef} strokeWidth={3} strokeLinecap="round" visibility="hidden" />
          <line ref={buoyantLineRef} strokeWidth={3} strokeLinecap="round" visibility="hidden" />
        </svg>

        <div className="mt-3 flex flex-wrap gap-4 text-[0.68rem] text-slate-400">
          <label className="inline-flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={showWeight}
              onChange={(e) => setShowWeight(e.target.checked)}
              className="rounded border-slate-600 bg-slate-900"
            />
            <span className="text-red-300">Weight</span>
          </label>
          <label className="inline-flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={showBuoyant}
              onChange={(e) => setShowBuoyant(e.target.checked)}
              className="rounded border-slate-600 bg-slate-900"
            />
            <span className="text-sky-300">Buoyant force</span>
          </label>
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5">
          <h2 className="text-sm font-semibold tracking-wide text-amber-300">Presets</h2>
          <p className="mt-1 text-xs text-slate-400">Quick density comparisons — same tank, different materials.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {(Object.keys(PRESETS) as PresetKey[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => applyPreset(key)}
                className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-3 text-left transition hover:border-amber-500/50"
              >
                <p className="text-sm font-semibold text-slate-100">{PRESETS[key].label}</p>
                <p className="mt-1 text-[0.65rem] text-slate-400">
                  ρ ≈ {PRESETS[key].densityKgM3} kg/m³ · side {PRESETS[key].sideM} m
                </p>
              </button>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-950/80 p-5">
          <h2 className="text-sm font-semibold tracking-wide text-amber-300">Controls</h2>
          <SliderWithInput
            label="Object mass"
            units="kg"
            min={MIN_MASS}
            max={MAX_MASS}
            step={0.1}
            value={controls.massKg}
            onChange={(v) => handleControlChange({ massKg: v })}
            queryKey="m"
          />
          <SliderWithInput
            label="Square side length"
            units="m"
            min={MIN_SIDE}
            max={MAX_SIDE}
            step={0.05}
            value={controls.sideM}
            onChange={(v) => handleControlChange({ sideM: v })}
            syncToUrl={true}
            queryKey="l"
          />
          <SliderWithInput
            label="Gravity (g)"
            units="m/s²"
            min={MIN_G}
            max={MAX_G}
            step={0.1}
            value={controls.gravityMps2}
            onChange={(v) => handleControlChange({ gravityMps2: v })}
            syncToUrl={true}
            queryKey="g"
          />
          <SliderWithInput
            label="Water density"
            units="kg/m³"
            min={MIN_WATER_RHO}
            max={MAX_WATER_RHO}
            step={10}
            value={controls.waterDensityKgM3}
            onChange={(v) => handleControlChange({ waterDensityKgM3: v })}
            syncToUrl={false}
            queryKey="wrho"
          />
          <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
            <p className="text-xs font-medium text-slate-200">Initial position</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(
                [
                  ['above', 'Above water'],
                  ['partial', 'Partially submerged'],
                  ['submerged', 'Fully submerged'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleControlChange({ initialPlacement: value })}
                  className={`rounded-full px-2.5 py-1 text-[0.65rem] font-semibold transition ${
                    controls.initialPlacement === value
                      ? 'bg-amber-500 text-slate-950'
                      : 'border border-slate-700 bg-slate-900 text-slate-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
        <h2 className="text-sm font-semibold tracking-wide text-amber-300">Real-time data</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <StatChip label="Mass" value={`${roundTo2(viewSnap.objectDensityKgM3 > 0 ? controls.massKg : 0)} kg`} />
          <StatChip label="Volume" value={`${roundTo2(viewSnap.volumeM3)} m³`} />
          <StatChip label="Object density" value={`${roundTo2(viewSnap.objectDensityKgM3)} kg/m³`} />
          <StatChip label="Water density" value={`${roundTo2(controls.waterDensityKgM3)} kg/m³`} />
          <StatChip label="Submerged" value={`${roundTo2(viewSnap.submergedFraction * 100)} %`} />
          <StatChip label="Weight" value={`${roundTo2(viewSnap.weightN)} N`} />
          <StatChip label="Buoyant force" value={`${roundTo2(viewSnap.buoyantN)} N`} />
          <StatChip label="Net force" value={`${roundTo2(viewSnap.netN)} N`} />
          <StatChip label="Velocity" value={`${roundTo2(viewSnap.velocityMps)} m/s`} />
          <StatChip label="Acceleration" value={`${roundTo2(viewSnap.accelerationMps2)} m/s²`} />
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
        <h2 className="text-sm font-semibold tracking-wide text-amber-300">Density comparison</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <StatChip label="Object density" value={`${roundTo2(viewSnap.objectDensityKgM3)} kg/m³`} />
          <StatChip label="Water density" value={`${roundTo2(controls.waterDensityKgM3)} kg/m³`} />
          <StatChip label="Prediction" value={densityCompare} />
        </div>
        <p className="mt-3 text-xs text-slate-400">
          ρ<sub>object</sub> &lt; ρ<sub>water</sub> → float · ρ<sub>object</sub> ≈ ρ<sub>water</sub> → neutral ·
          ρ<sub>object</sub> &gt; ρ<sub>water</sub> → sink
        </p>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
        <h2 className="text-sm font-semibold tracking-wide text-amber-300">Graphs</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
            <p className="text-xs font-semibold text-slate-200">Position vs time</p>
            <p className="mt-0.5 text-[0.65rem] text-slate-400">Center height · last {HISTORY_WINDOW_S} s</p>
            <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="mt-2 h-auto w-full">
              <line x1={CHART_PAD.left} y1={CHART_PAD.top} x2={CHART_PAD.left} y2={CHART_H - CHART_PAD.bottom} stroke="#475569" strokeWidth={0.7} />
              <line x1={CHART_PAD.left} y1={CHART_H - CHART_PAD.bottom} x2={CHART_W - CHART_PAD.right} y2={CHART_H - CHART_PAD.bottom} stroke="#475569" strokeWidth={0.7} />
              <path ref={positionPathRef} fill="none" stroke="#fbbf24" strokeWidth={1.7} strokeLinecap="round" />
            </svg>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
            <p className="text-xs font-semibold text-slate-200">Buoyant force vs time</p>
            <p className="mt-0.5 text-[0.65rem] text-slate-400">F<sub>B</sub> · last {HISTORY_WINDOW_S} s</p>
            <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="mt-2 h-auto w-full">
              <line x1={CHART_PAD.left} y1={CHART_PAD.top} x2={CHART_PAD.left} y2={CHART_H - CHART_PAD.bottom} stroke="#475569" strokeWidth={0.7} />
              <line x1={CHART_PAD.left} y1={CHART_H - CHART_PAD.bottom} x2={CHART_W - CHART_PAD.right} y2={CHART_H - CHART_PAD.bottom} stroke="#475569" strokeWidth={0.7} />
              <path ref={buoyantPathRef} fill="none" stroke="#38bdf8" strokeWidth={1.7} strokeLinecap="round" />
            </svg>
          </div>
        </div>
      </section>

      <ConceptBox
        heading="Key ideas"
        items={[
          {
            title: "Archimedes' principle",
            description:
              'The buoyant force on an object equals the weight of the fluid it displaces: F_B = ρ_fluid g V_displaced. More submersion means more displaced water and a larger upward push.',
          },
          {
            title: 'Buoyant force vs weight',
            description:
              'If buoyant force matches weight, the object is in vertical equilibrium. If weight is greater, the net force points down and the object sinks. If buoyant force is greater, it rises.',
          },
          {
            title: 'Density decides float or sink',
            description:
              'An object floats when its average density is less than the fluid density. A steel block sinks; a wooden raft floats because wood is less dense than water.',
          },
          {
            title: 'Ships and hollow hulls',
            description:
              'A ship is mostly air inside its hull, so its average density stays below water even though steel alone would sink.',
          },
          {
            title: 'Icebergs',
            description:
              'Ice is slightly less dense than seawater, so most of an iceberg sits below the surface while a fraction floats above — about 10% for typical ice in water.',
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
      <p className="mt-0.5 font-mono text-[0.78rem] text-amber-200">{value}</p>
    </div>
  );
}
