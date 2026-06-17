// id="bernoulli_flow_explorer"
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { SliderWithInput } from '../../../components/SliderWithInput';
import { ConceptBox } from '../../../components/ConceptBox';

type FlowParticle = {
  x: number;
  y: number;
  id: number;
};

type PipeState = {
  r1: number;
  r2: number;
  h1: number;
  h2: number;
  p1Pa: number;
  rho: number;
  v1: number;
};

type DataSnapshot = {
  p1Pa: number;
  p2Pa: number;
  v1Mps: number;
  v2Mps: number;
  h1M: number;
  h2M: number;
  rho: number;
  flowRateM3s: number;
  ke1: number;
  ke2: number;
  pe1: number;
  pe2: number;
  totalHeadJ: number;
  simTime: number;
};

type BernoulliTerm = 'P' | 'ke' | 'pe' | null;
type GraphMode = 'pressure' | 'velocity' | 'energy';

const G_MPS2 = 9.81;
const P_ATM_PA = 101_325;

const PIPE_LENGTH_M = 8;
const TAPER_START_FRAC = 0.32;
const TAPER_END_FRAC = 0.68;

const MIN_RADIUS_M = 0.1;
const MAX_RADIUS_M = 2;
const MIN_HEIGHT_M = -10;
const MAX_HEIGHT_M = 10;
const MIN_P1_PA = 10_000;
const MAX_P1_PA = 500_000;
const MIN_RHO = 100;
const MAX_RHO = 2000;

const CANVAS_W = 760;
const CANVAS_H = 420;
const PIPE_PAD = { left: 48, right: 48, top: 56, bottom: 56 };
const INNER_W_PX = CANVAS_W - PIPE_PAD.left - PIPE_PAD.right;
const INNER_H_PX = CANVAS_H - PIPE_PAD.top - PIPE_PAD.bottom;
const HEIGHT_PX_PER_M = INNER_H_PX / 24;
const RADIUS_PX_PER_M = (INNER_H_PX * 0.36) / MAX_RADIUS_M;

const NUM_PARTICLES = 48;
const NUM_STREAMLINES = 7;
const UI_PUSH_MS = 100;
const MAX_SIM_DT_S = 1 / 45;
const HIGHLIGHT_MS = 650;

const CHART_W = 380;
const CHART_H = 180;
const CHART_PAD = { top: 18, right: 14, bottom: 28, left: 50 };
const PROFILE_SAMPLES = 80;

const DEFAULT_R1 = 0.75;
const DEFAULT_R2 = 0.35;
const DEFAULT_H1 = 2;
const DEFAULT_H2 = -1.5;
const DEFAULT_P1 = 220_000;
const DEFAULT_RHO = 1000;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function areaFromRadiusM(r: number): number {
  return Math.PI * r * r;
}

function radiusAtXM(x: number, r1: number, r2: number): number {
  const taperStart = PIPE_LENGTH_M * TAPER_START_FRAC;
  const taperEnd = PIPE_LENGTH_M * TAPER_END_FRAC;
  if (x <= taperStart) return r1;
  if (x >= taperEnd) return r2;
  const t = (x - taperStart) / (taperEnd - taperStart);
  return r1 + (r2 - r1) * t;
}

function heightAtXM(x: number, h1: number, h2: number): number {
  const t = clamp(x / PIPE_LENGTH_M, 0, 1);
  return h1 + (h2 - h1) * t;
}

function solveEntranceVelocity(
  r1: number,
  r2: number,
  h1: number,
  h2: number,
  p1Pa: number,
  rho: number,
  pExitPa = P_ATM_PA,
): number {
  const a1 = areaFromRadiusM(r1);
  const a2 = areaFromRadiusM(r2);
  const areaRatioSq = (a1 / a2) ** 2;
  const drive = pExitPa - p1Pa + rho * G_MPS2 * (h2 - h1);
  let v1Sq: number;
  if (Math.abs(a1 - a2) < 1e-8) {
    v1Sq = (2 * drive) / rho;
  } else {
    v1Sq = (2 * drive) / (rho * (1 - areaRatioSq));
  }
  if (!Number.isFinite(v1Sq) || v1Sq <= 0) return 0.2;
  return clamp(Math.sqrt(v1Sq), 0.15, 25);
}

function buildPipeState(
  r1: number,
  r2: number,
  h1: number,
  h2: number,
  p1Pa: number,
  rho: number,
): PipeState {
  const v1 = solveEntranceVelocity(r1, r2, h1, h2, p1Pa, rho);
  return { r1, r2, h1, h2, p1Pa, rho, v1 };
}

function velocityAtXM(x: number, state: PipeState): number {
  const r = radiusAtXM(x, state.r1, state.r2);
  const a1 = areaFromRadiusM(state.r1);
  const ax = areaFromRadiusM(r);
  return ax > 0 ? (a1 * state.v1) / ax : state.v1;
}

function pressureAtXM(x: number, state: PipeState): number {
  const v = velocityAtXM(x, state);
  const h = heightAtXM(x, state.h1, state.h2);
  return (
    state.p1Pa +
    0.5 * state.rho * (state.v1 ** 2 - v ** 2) +
    state.rho * G_MPS2 * (state.h1 - h)
  );
}

function kineticEnergyDensity(rho: number, v: number): number {
  return 0.5 * rho * v * v;
}

function potentialEnergyDensity(rho: number, h: number): number {
  return rho * G_MPS2 * h;
}

function xMetersToCanvasX(xM: number): number {
  return PIPE_PAD.left + (xM / PIPE_LENGTH_M) * INNER_W_PX;
}

function heightMetersToCanvasY(hM: number): number {
  return PIPE_PAD.top + INNER_H_PX / 2 - hM * HEIGHT_PX_PER_M;
}

function pipeOffsetToCanvasY(offsetM: number): number {
  return offsetM * RADIUS_PX_PER_M;
}

function formatNum(n: number, digits = 3): string {
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 1e5 || (Math.abs(n) > 0 && Math.abs(n) < 0.01)) {
    return n.toExponential(digits);
  }
  return n.toFixed(Math.abs(n) < 10 ? 2 : 1);
}

function formatPressureKPa(pa: number): string {
  return `${(pa / 1000).toFixed(1)} kPa`;
}

function pressureToHue(p: number, pMin: number, pMax: number): number {
  const span = Math.max(1, pMax - pMin);
  const t = clamp((p - pMin) / span, 0, 1);
  return 220 - t * 200;
}

function chartInnerDims() {
  return {
    innerW: CHART_W - CHART_PAD.left - CHART_PAD.right,
    innerH: CHART_H - CHART_PAD.top - CHART_PAD.bottom,
  };
}

function profilePathD(
  valueAtX: (x: number) => number,
  xMin: number,
  xMax: number,
  yMin: number,
  yMax: number,
): string {
  const { innerW, innerH } = chartInnerDims();
  const xSpan = Math.max(1e-9, xMax - xMin);
  const ySpan = Math.max(1e-9, yMax - yMin);
  const x = (v: number) => CHART_PAD.left + ((v - xMin) / xSpan) * innerW;
  const y = (v: number) => CHART_PAD.top + innerH - ((v - yMin) / ySpan) * innerH;

  const pts: string[] = [];
  for (let i = 0; i <= PROFILE_SAMPLES; i++) {
    const xm = xMin + (i / PROFILE_SAMPLES) * (xMax - xMin);
    const val = valueAtX(xm);
    pts.push(`${i === 0 ? 'M' : 'L'} ${x(xm).toFixed(1)} ${y(val).toFixed(1)}`);
  }
  return pts.join(' ');
}

function rangeFromProfile(valueAtX: (x: number) => number, padFrac = 0.1): { min: number; max: number } {
  const vals = Array.from({ length: PROFILE_SAMPLES + 1 }, (_, i) => {
    const x = (i / PROFILE_SAMPLES) * PIPE_LENGTH_M;
    return valueAtX(x);
  });
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const pad = Math.max(1, (maxV - minV) * padFrac);
  return { min: minV - pad, max: maxV + pad };
}

function spawnParticle(id: number, r1: number): FlowParticle {
  const y = (Math.random() * 2 - 1) * r1 * 0.82;
  return { id, x: -0.05 - Math.random() * 0.4, y };
}

function createParticles(r1: number): FlowParticle[] {
  return Array.from({ length: NUM_PARTICLES }, (_, i) => spawnParticle(i, r1));
}

function computeSnapshot(state: PipeState, simTime: number): DataSnapshot {
  const v2 = velocityAtXM(PIPE_LENGTH_M, state);
  const p2 = pressureAtXM(PIPE_LENGTH_M, state);
  const a1 = areaFromRadiusM(state.r1);
  const q = a1 * state.v1;
  const ke1 = kineticEnergyDensity(state.rho, state.v1);
  const ke2 = kineticEnergyDensity(state.rho, v2);
  const pe1 = potentialEnergyDensity(state.rho, state.h1);
  const pe2 = potentialEnergyDensity(state.rho, state.h2);
  const totalHeadJ = state.p1Pa + ke1 + pe1;
  return {
    p1Pa: state.p1Pa,
    p2Pa: p2,
    v1Mps: state.v1,
    v2Mps: v2,
    h1M: state.h1,
    h2M: state.h2,
    rho: state.rho,
    flowRateM3s: q,
    ke1,
    ke2,
    pe1,
    pe2,
    totalHeadJ,
    simTime,
  };
}

export function BernoulliFlowExplorer() {
  const [entranceRadiusM, setEntranceRadiusM] = useState(DEFAULT_R1);
  const [exitRadiusM, setExitRadiusM] = useState(DEFAULT_R2);
  const [entranceHeightM, setEntranceHeightM] = useState(DEFAULT_H1);
  const [exitHeightM, setExitHeightM] = useState(DEFAULT_H2);
  const [entrancePressurePa, setEntrancePressurePa] = useState(DEFAULT_P1);
  const [fluidDensity, setFluidDensity] = useState(DEFAULT_RHO);
  const [isRunning, setIsRunning] = useState(true);
  const [graphMode, setGraphMode] = useState<GraphMode>('pressure');
  const [highlight, setHighlight] = useState<BernoulliTerm>(null);
  const [snapshot, setSnapshot] = useState<DataSnapshot>(() =>
    computeSnapshot(
      buildPipeState(DEFAULT_R1, DEFAULT_R2, DEFAULT_H1, DEFAULT_H2, DEFAULT_P1, DEFAULT_RHO),
      0,
    ),
  );

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const profilePathRef = useRef<SVGPathElement>(null);
  const energyKePathRef = useRef<SVGPathElement>(null);
  const energyPePathRef = useRef<SVGPathElement>(null);
  const energyPPathRef = useRef<SVGPathElement>(null);
  const particlesRef = useRef<FlowParticle[]>(createParticles(DEFAULT_R1));
  const stateRef = useRef<PipeState>(
    buildPipeState(DEFAULT_R1, DEFAULT_R2, DEFAULT_H1, DEFAULT_H2, DEFAULT_P1, DEFAULT_RHO),
  );
  const prevTermsRef = useRef({ p: DEFAULT_P1, ke: 0, pe: 0 });
  const runningRef = useRef(true);
  const simTimeRef = useRef(0);
  const lastFrameRef = useRef(0);
  const lastUiPushRef = useRef(0);
  const rafRef = useRef(0);
  const streamPhaseRef = useRef(0);
  const highlightTimerRef = useRef<number | null>(null);

  const rebuildState = useCallback(() => {
    stateRef.current = buildPipeState(
      entranceRadiusM,
      exitRadiusM,
      entranceHeightM,
      exitHeightM,
      entrancePressurePa,
      fluidDensity,
    );
  }, [entranceRadiusM, exitRadiusM, entranceHeightM, exitHeightM, entrancePressurePa, fluidDensity]);

  const flashHighlight = useCallback((key: BernoulliTerm) => {
    setHighlight(key);
    if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = window.setTimeout(() => setHighlight(null), HIGHLIGHT_MS);
  }, []);

  const detectDominantTerm = useCallback((snap: DataSnapshot) => {
    const dP = Math.abs(snap.p1Pa - prevTermsRef.current.p);
    const dKe = Math.abs(snap.ke1 - prevTermsRef.current.ke);
    const dPe = Math.abs(snap.pe1 - prevTermsRef.current.pe);
    prevTermsRef.current = { p: snap.p1Pa, ke: snap.ke1, pe: snap.pe1 };
    if (dP >= dKe && dP >= dPe) flashHighlight('P');
    else if (dKe >= dPe) flashHighlight('ke');
    else flashHighlight('pe');
  }, [flashHighlight]);

  useEffect(() => {
    runningRef.current = isRunning;
  }, [isRunning]);

  useEffect(() => {
    rebuildState();
  }, [rebuildState]);

  const updateGraphs = useCallback((state: PipeState, mode: GraphMode) => {
    if (mode === 'pressure') {
      const path = profilePathRef.current;
      if (!path) return;
      const yr = rangeFromProfile((x) => pressureAtXM(x, state) / 1000);
      path.setAttribute(
        'd',
        profilePathD((x) => pressureAtXM(x, state) / 1000, 0, PIPE_LENGTH_M, yr.min, yr.max),
      );
    } else if (mode === 'velocity') {
      const path = profilePathRef.current;
      if (!path) return;
      const yr = rangeFromProfile((x) => velocityAtXM(x, state), 0.15);
      path.setAttribute(
        'd',
        profilePathD((x) => velocityAtXM(x, state), 0, PIPE_LENGTH_M, Math.max(0, yr.min), yr.max),
      );
    } else {
      const pPath = energyPPathRef.current;
      const kePath = energyKePathRef.current;
      const pePath = energyPePathRef.current;
      if (!pPath || !kePath || !pePath) return;
      const pRange = rangeFromProfile((x) => pressureAtXM(x, state) / 1000);
      const keRange = rangeFromProfile((x) => kineticEnergyDensity(state.rho, velocityAtXM(x, state)) / 1000);
      const peRange = rangeFromProfile((x) => potentialEnergyDensity(state.rho, heightAtXM(x, state.h1, state.h2)) / 1000);
      const yMin = Math.min(pRange.min, keRange.min, peRange.min);
      const yMax = Math.max(pRange.max, keRange.max, peRange.max);
      pPath.setAttribute(
        'd',
        profilePathD((x) => pressureAtXM(x, state) / 1000, 0, PIPE_LENGTH_M, yMin, yMax),
      );
      kePath.setAttribute(
        'd',
        profilePathD(
          (x) => kineticEnergyDensity(state.rho, velocityAtXM(x, state)) / 1000,
          0,
          PIPE_LENGTH_M,
          yMin,
          yMax,
        ),
      );
      pePath.setAttribute(
        'd',
        profilePathD(
          (x) => potentialEnergyDensity(state.rho, heightAtXM(x, state.h1, state.h2)) / 1000,
          0,
          PIPE_LENGTH_M,
          yMin,
          yMax,
        ),
      );
    }
  }, []);

  const drawScene = useCallback((particles: FlowParticle[], state: PipeState, streamPhase: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.65)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    const pressures = Array.from({ length: PROFILE_SAMPLES + 1 }, (_, i) => {
      const x = (i / PROFILE_SAMPLES) * PIPE_LENGTH_M;
      return pressureAtXM(x, state);
    });
    const pMin = Math.min(...pressures);
    const pMax = Math.max(...pressures);

    const wallPts = 120;
    const upperWall: Array<{ x: number; y: number }> = [];
    const lowerWall: Array<{ x: number; y: number }> = [];
    for (let i = 0; i <= wallPts; i++) {
      const xm = (i / wallPts) * PIPE_LENGTH_M;
      const r = radiusAtXM(xm, state.r1, state.r2);
      const centerY = heightMetersToCanvasY(heightAtXM(xm, state.h1, state.h2));
      const rPx = r * RADIUS_PX_PER_M;
      const cx = xMetersToCanvasX(xm);
      upperWall.push({ x: cx, y: centerY - rPx });
      lowerWall.push({ x: cx, y: centerY + rPx });
    }

    for (let i = 0; i < wallPts; i++) {
      const xm = ((i + 0.5) / wallPts) * PIPE_LENGTH_M;
      const p = pressureAtXM(xm, state);
      const hue = pressureToHue(p, pMin, pMax);
      ctx.beginPath();
      ctx.moveTo(upperWall[i].x, upperWall[i].y);
      ctx.lineTo(upperWall[i + 1].x, upperWall[i + 1].y);
      ctx.lineTo(lowerWall[i + 1].x, lowerWall[i + 1].y);
      ctx.lineTo(lowerWall[i].x, lowerWall[i].y);
      ctx.closePath();
      ctx.fillStyle = `hsla(${hue}, 78%, 48%, 0.42)`;
      ctx.fill();
    }

    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(upperWall[0].x, upperWall[0].y);
    for (let i = 1; i < upperWall.length; i++) ctx.lineTo(upperWall[i].x, upperWall[i].y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(lowerWall[0].x, lowerWall[0].y);
    for (let i = 1; i < lowerWall.length; i++) ctx.lineTo(lowerWall[i].x, lowerWall[i].y);
    ctx.stroke();

    ctx.setLineDash([6, 8]);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= wallPts; i++) {
      const xm = (i / wallPts) * PIPE_LENGTH_M;
      const cx = xMetersToCanvasX(xm);
      const cy = heightMetersToCanvasY(heightAtXM(xm, state.h1, state.h2));
      if (i === 0) ctx.moveTo(cx, cy);
      else ctx.lineTo(cx, cy);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.lineWidth = 1.1;
    ctx.setLineDash([10, 14]);
    ctx.lineDashOffset = -streamPhase * 42;
    for (let s = 0; s < NUM_STREAMLINES; s++) {
      const frac = (s + 1) / (NUM_STREAMLINES + 1);
      const yOff = (frac * 2 - 1) * state.r1 * 0.72;
      ctx.beginPath();
      let started = false;
      for (let i = 0; i <= wallPts; i++) {
        const xm = (i / wallPts) * PIPE_LENGTH_M;
        const r = radiusAtXM(xm, state.r1, state.r2);
        if (Math.abs(yOff) > r * 0.9) continue;
        const cx = xMetersToCanvasX(xm);
        const centerY = heightMetersToCanvasY(heightAtXM(xm, state.h1, state.h2));
        const cy = centerY + pipeOffsetToCanvasY(yOff * (r / state.r1));
        if (!started) {
          ctx.moveTo(cx, cy);
          started = true;
        } else {
          ctx.lineTo(cx, cy);
        }
      }
      ctx.stroke();
    }
    ctx.restore();

    const maxV = Math.max(state.v1, velocityAtXM(PIPE_LENGTH_M, state), 0.5);
    for (const p of particles) {
      const vLocal = velocityAtXM(p.x, state);
      const rLocal = radiusAtXM(p.x, state.r1, state.r2);
      const press = pressureAtXM(p.x, state);
      const cx = xMetersToCanvasX(p.x);
      const centerY = heightMetersToCanvasY(heightAtXM(p.x, state.h1, state.h2));
      const cy = centerY + pipeOffsetToCanvasY(p.y * (rLocal / state.r1));
      const speedT = clamp(vLocal / maxV, 0, 1);
      const hue = pressureToHue(press, pMin, pMax);
      const pr = Math.max(3, 2.5 + speedT * 2);
      ctx.beginPath();
      ctx.fillStyle = `hsla(${hue}, 90%, 58%, 0.95)`;
      ctx.arc(cx, cy, pr, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `hsla(${hue}, 95%, 72%, 0.45)`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + pr * (1.4 + speedT), cy);
      ctx.stroke();
    }

    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px ui-sans-serif, system-ui';
    ctx.fillText('Entrance', PIPE_PAD.left, PIPE_PAD.top - 18);
    ctx.fillText('Exit', CANVAS_W - PIPE_PAD.right - 28, PIPE_PAD.top - 18);
    ctx.fillStyle = '#f97316';
    ctx.fillText('Higher P → warm', PIPE_PAD.left, CANVAS_H - 12);
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('Lower P → cool', PIPE_PAD.left + 118, CANVAS_H - 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(`P₁ ${formatPressureKPa(state.p1Pa)}`, PIPE_PAD.left, CANVAS_H - 28);
    ctx.fillText(
      `P₂ ${formatPressureKPa(pressureAtXM(PIPE_LENGTH_M, state))}`,
      CANVAS_W - PIPE_PAD.right - 88,
      CANVAS_H - 28,
    );
  }, []);

  const stepParticles = useCallback((dt: number, state: PipeState) => {
    for (const p of particlesRef.current) {
      const vLocal = velocityAtXM(p.x, state);
      p.x += vLocal * dt;
      const rLocal = radiusAtXM(p.x, state.r1, state.r2);
      const limit = rLocal * 0.88;
      if (Math.abs(p.y) > limit) p.y = Math.sign(p.y) * limit;
      if (p.x > PIPE_LENGTH_M + 0.2) {
        const spawned = spawnParticle(p.id, state.r1);
        p.x = spawned.x;
        p.y = spawned.y;
      }
    }
  }, []);

  const handleReset = () => {
    rebuildState();
    particlesRef.current = createParticles(stateRef.current.r1);
    simTimeRef.current = 0;
    streamPhaseRef.current = 0;
    const snap = computeSnapshot(stateRef.current, 0);
    setSnapshot(snap);
    updateGraphs(stateRef.current, graphMode);
  };

  useEffect(() => {
    const tick = (now: number) => {
      rafRef.current = requestAnimationFrame(tick);
      if (!lastFrameRef.current) lastFrameRef.current = now;
      const dt = clamp((now - lastFrameRef.current) / 1000, 0, MAX_SIM_DT_S);
      lastFrameRef.current = now;

      rebuildState();

      if (runningRef.current && dt > 0) {
        stepParticles(dt, stateRef.current);
        simTimeRef.current += dt;
        streamPhaseRef.current += dt;
      }

      drawScene(particlesRef.current, stateRef.current, streamPhaseRef.current);

      if (now - lastUiPushRef.current >= UI_PUSH_MS) {
        lastUiPushRef.current = now;
        const snap = computeSnapshot(stateRef.current, simTimeRef.current);
        setSnapshot(snap);
        detectDominantTerm(snap);
        updateGraphs(stateRef.current, graphMode);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [detectDominantTerm, drawScene, graphMode, rebuildState, stepParticles, updateGraphs]);

  useEffect(() => {
    rebuildState();
    updateGraphs(stateRef.current, graphMode);
  }, [
    graphMode,
    entranceRadiusM,
    exitRadiusM,
    entranceHeightM,
    exitHeightM,
    entrancePressurePa,
    fluidDensity,
    rebuildState,
    updateGraphs,
  ]);

  const hl = (key: BernoulliTerm) =>
    highlight === key
      ? 'text-amber-300 scale-110 inline-block transition-transform'
      : 'text-sky-300';

  return (
    <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col overflow-hidden px-4 py-8">
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-70">
        <div className="absolute -left-32 top-0 h-72 w-72 rounded-full bg-orange-700/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-sky-600/20 blur-3xl" />
      </div>

      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">
          Mechanics · Pressure
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Bernoulli Flow Explorer</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">
          Water flows through a sloping, tapering pipe. Fluid color tracks pressure — warm where P is
          high, cool where it drops. Continuity sets the speed; Bernoulli trades pressure, motion,
          and height energy.
        </p>
        <Link
          to="/211"
          className="mt-3 inline-block text-sm text-cyan-400/90 hover:text-cyan-300"
        >
          ← Back to simulations
        </Link>
      </header>

      <div className="mb-4 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl">
        <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} className="block w-full" />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Controls</h2>

          <SliderWithInput
            label="Entrance radius"
            min={MIN_RADIUS_M}
            max={MAX_RADIUS_M}
            step={0.05}
            value={entranceRadiusM}
            onChange={setEntranceRadiusM}
            units="m"
          />
          <SliderWithInput
            label="Exit radius"
            min={MIN_RADIUS_M}
            max={MAX_RADIUS_M}
            step={0.05}
            value={exitRadiusM}
            onChange={setExitRadiusM}
            units="m"
          />
          <SliderWithInput
            label="Entrance height"
            min={MIN_HEIGHT_M}
            max={MAX_HEIGHT_M}
            step={0.25}
            value={entranceHeightM}
            onChange={setEntranceHeightM}
            units="m"
            description="Elevation h₁ — higher inlet raises gravitational PE."
          />
          <SliderWithInput
            label="Exit height"
            min={MIN_HEIGHT_M}
            max={MAX_HEIGHT_M}
            step={0.25}
            value={exitHeightM}
            onChange={setExitHeightM}
            units="m"
            description="Elevation h₂ — climbing the pipe lowers pressure."
          />
          <SliderWithInput
            label="Entrance pressure"
            min={MIN_P1_PA / 1000}
            max={MAX_P1_PA / 1000}
            step={5}
            value={entrancePressurePa / 1000}
            onChange={(kpa) => setEntrancePressurePa(kpa * 1000)}
            units="kPa"
          />
          <SliderWithInput
            label="Fluid density"
            min={MIN_RHO}
            max={MAX_RHO}
            step={50}
            value={fluidDensity}
            onChange={setFluidDensity}
            units="kg/m³"
          />

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsRunning((r) => !r)}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
            >
              {isRunning ? 'Pause' : 'Play'}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-600"
            >
              Reset
            </button>
          </div>
        </section>

        <div className="space-y-4">
          <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
              Bernoulli equation
            </h2>
            <p className="text-center text-lg font-semibold text-white sm:text-xl leading-relaxed">
              <span className={hl('P')}>P</span>
              <span className="text-slate-400"> + </span>
              <span className={hl('ke')}>½ρv²</span>
              <span className="text-slate-400"> + </span>
              <span className={hl('pe')}>ρgh</span>
              <span className="text-slate-400"> = const</span>
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-lg bg-slate-800/60 p-2">
                <span className="text-slate-400">P₁</span>
                <p className="font-mono text-orange-200">{formatPressureKPa(snapshot.p1Pa)}</p>
              </div>
              <div className="rounded-lg bg-slate-800/60 p-2">
                <span className="text-slate-400">½ρv₁²</span>
                <p className="font-mono text-cyan-200">{formatNum(snapshot.ke1)} Pa</p>
              </div>
              <div className="rounded-lg bg-slate-800/60 p-2">
                <span className="text-slate-400">ρgh₁</span>
                <p className="font-mono text-emerald-200">{formatNum(snapshot.pe1)} Pa</p>
              </div>
              <div className="rounded-lg bg-slate-800/60 p-2">
                <span className="text-slate-400">P₂</span>
                <p className="font-mono text-orange-200">{formatPressureKPa(snapshot.p2Pa)}</p>
              </div>
              <div className="rounded-lg bg-slate-800/60 p-2">
                <span className="text-slate-400">½ρv₂²</span>
                <p className="font-mono text-cyan-200">{formatNum(snapshot.ke2)} Pa</p>
              </div>
              <div className="rounded-lg bg-slate-800/60 p-2">
                <span className="text-slate-400">ρgh₂</span>
                <p className="font-mono text-emerald-200">{formatNum(snapshot.pe2)} Pa</p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
              Flow data
            </h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-slate-400">P₁</dt>
              <dd className="font-mono text-right text-white">{formatPressureKPa(snapshot.p1Pa)}</dd>
              <dt className="text-slate-400">P₂</dt>
              <dd className="font-mono text-right text-white">{formatPressureKPa(snapshot.p2Pa)}</dd>
              <dt className="text-slate-400">v₁</dt>
              <dd className="font-mono text-right text-white">{formatNum(snapshot.v1Mps)} m/s</dd>
              <dt className="text-slate-400">v₂</dt>
              <dd className="font-mono text-right text-white">{formatNum(snapshot.v2Mps)} m/s</dd>
              <dt className="text-slate-400">h₁</dt>
              <dd className="font-mono text-right text-white">{snapshot.h1M.toFixed(2)} m</dd>
              <dt className="text-slate-400">h₂</dt>
              <dd className="font-mono text-right text-white">{snapshot.h2M.toFixed(2)} m</dd>
              <dt className="text-slate-400">Fluid density ρ</dt>
              <dd className="font-mono text-right text-white">{snapshot.rho.toFixed(0)} kg/m³</dd>
              <dt className="text-slate-400">Flow rate Q</dt>
              <dd className="font-mono text-right text-emerald-300">
                {formatNum(snapshot.flowRateM3s)} m³/s
              </dd>
            </dl>
          </section>
        </div>
      </div>

      <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Profiles along pipe
          </h2>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['pressure', 'Pressure vs position'],
                ['velocity', 'Velocity vs position'],
                ['energy', 'Energy components'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setGraphMode(id)}
                className={`rounded-md px-2.5 py-1 text-xs ${
                  graphMode === id
                    ? 'bg-violet-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <p className="mb-2 text-xs text-slate-500">
          {graphMode === 'pressure' && 'Static pressure P(x) from Bernoulli — drops when speed or height rises.'}
          {graphMode === 'velocity' && 'Speed v(x) = A₁v₁/A(x) from continuity.'}
          {graphMode === 'energy' &&
            'Pressure energy P, kinetic ½ρv², and gravitational ρgh (all in kPa-equivalent units).'}
        </p>
        <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="mx-auto w-full max-w-xl">
          <rect
            x={CHART_PAD.left}
            y={CHART_PAD.top}
            width={CHART_W - CHART_PAD.left - CHART_PAD.right}
            height={CHART_H - CHART_PAD.top - CHART_PAD.bottom}
            fill="rgba(15,23,42,0.5)"
            stroke="rgba(71,85,105,0.5)"
          />
          <text x={CHART_PAD.left} y={CHART_H - 6} fill="#64748b" fontSize={10}>
            0 m
          </text>
          <text x={CHART_W - CHART_PAD.right - 18} y={CHART_H - 6} fill="#64748b" fontSize={10}>
            {PIPE_LENGTH_M} m
          </text>
          {graphMode === 'energy' ? (
            <>
              <path
                ref={energyPPathRef}
                fill="none"
                stroke="#fb923c"
                strokeWidth={2}
                strokeLinejoin="round"
              />
              <path
                ref={energyKePathRef}
                fill="none"
                stroke="#38bdf8"
                strokeWidth={2}
                strokeLinejoin="round"
              />
              <path
                ref={energyPePathRef}
                fill="none"
                stroke="#34d399"
                strokeWidth={2}
                strokeLinejoin="round"
              />
              <text x={CHART_PAD.left + 4} y={CHART_PAD.top + 12} fill="#fb923c" fontSize={10}>
                P
              </text>
              <text x={CHART_PAD.left + 24} y={CHART_PAD.top + 12} fill="#38bdf8" fontSize={10}>
                ½ρv²
              </text>
              <text x={CHART_PAD.left + 58} y={CHART_PAD.top + 12} fill="#34d399" fontSize={10}>
                ρgh
              </text>
            </>
          ) : (
            <path
              ref={profilePathRef}
              fill="none"
              stroke="#a78bfa"
              strokeWidth={2}
              strokeLinejoin="round"
            />
          )}
        </svg>
      </section>

      <ConceptBox
        heading="Bernoulli's principle"
        items={[
          {
            title: 'Conservation of energy',
            description:
              'Along a streamline, P + ½ρv² + ρgh stays constant. Fluid can trade pressure energy for kinetic energy (speeding up) or gravitational potential energy (rising).',
          },
          {
            title: 'Pressure ↔ velocity',
            description:
              'Where the pipe narrows, v increases and P tends to drop. Where it widens, fluid slows and pressure recovers — if height is unchanged.',
          },
          {
            title: 'Pressure ↔ height',
            description:
              'Climbing upward converts pressure into gravitational PE (ρgh). Descending does the reverse — why outlet pressure can exceed inlet pressure on a downhill run.',
          },
          {
            title: 'Water towers',
            description:
              'Elevated tanks store gravitational PE as height. That energy becomes pressure and flow in household plumbing.',
          },
          {
            title: 'Airplane wings',
            description:
              'Faster flow over the curved top surface is linked (with other effects) to lower pressure above the wing — an everyday Bernoulli example.',
          },
          {
            title: 'Mountain streams',
            description:
              'Water rushes through narrow rocky channels (high v, lower P) and spreads out in pools (slower, higher static pressure).',
          },
        ]}
      />
    </div>
  );
}
