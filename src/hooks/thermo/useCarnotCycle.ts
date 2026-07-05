import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { R_GAS } from '../../utils/constants';
import { clamp } from '../../utils/mathUtils';
import { toSigFigs } from '../../utils/formatters';

// ── Types ─────────────────────────────────────────────────────────────────────

export type GasType = 'monatomic' | 'diatomic';

export const GAMMA_BY_GAS: Record<GasType, number> = {
  monatomic: 5 / 3,
  diatomic: 7 / 5,
};

export interface CyclePoint {
  V: number; // m³
  P: number; // Pa
  T: number; // K
  S: number; // J/K, relative to state 1
}

export interface CarnotCycleData {
  Th: number;
  Tc: number;
  ratio: number; // V₂/V₁
  gamma: number;
  corners: [CyclePoint, CyclePoint, CyclePoint, CyclePoint];
  legs: CyclePoint[][]; // 4 sampled polylines, leg i runs corner i → corner i+1
  eta: number; // 1 − Tc/Th
  Qh: number; // J absorbed at Th
  Qc: number; // J rejected at Tc
  Wnet: number; // J per cycle
  dS: number; // J/K entropy width of the TS rectangle
  areaPV: number; // J — shoelace area of the sampled PV loop
  areaTS: number; // J — shoelace area of the TS loop
}

export interface UseCarnotCycleResult {
  pvCanvasRef: React.RefObject<HTMLCanvasElement>;
  tsCanvasRef: React.RefObject<HTMLCanvasElement>;
  isPlaying: boolean;
  togglePlay: () => void;
  resetDot: () => void;
  Th: number;
  setTh: (v: number) => void;
  Tc: number;
  setTc: (v: number) => void;
  ratio: number;
  setRatio: (v: number) => void;
  gasType: GasType;
  setGasType: (g: GasType) => void;
  cycle: CarnotCycleData;
}

// ── Slider bounds (shared with the page + moduleParams) ───────────────────────

export const T_HOT_MIN = 350;
export const T_HOT_MAX = 1200;
export const T_COLD_MIN = 100;
export const T_COLD_MAX = 1000;
export const RATIO_MIN = 1.5;
export const RATIO_MAX = 10;
export const MIN_T_GAP = 25; // K — enforced gap so T_cold < T_hot always holds

// ── Physics (analytic, ideal gas, n = 1 mol) ──────────────────────────────────

const N_MOLES = 1;
const V_STATE1 = 0.01; // m³ — reference volume at state 1
const SAMPLES_PER_LEG = 64;

/**
 * Point on leg `leg` (0-3) at fraction t ∈ [0,1].
 * Volume is interpolated logarithmically so the dot paces evenly along each leg.
 *  leg 0: isothermal expansion at Th   (1→2)
 *  leg 1: adiabatic expansion Th→Tc    (2→3)
 *  leg 2: isothermal compression at Tc (3→4)
 *  leg 3: adiabatic compression Tc→Th  (4→1)
 */
export function pointOnLeg(cycle: CarnotCycleData, leg: number, t: number): CyclePoint {
  const { Th, Tc, gamma, corners, dS } = cycle;
  const nR = N_MOLES * R_GAS;
  const a = corners[leg];
  const b = corners[(leg + 1) % 4];
  const V = a.V * Math.pow(b.V / a.V, t);

  let T: number;
  let S: number;
  switch (leg) {
    case 0:
      T = Th;
      S = nR * Math.log(V / a.V);
      break;
    case 1:
      T = Th * Math.pow(a.V / V, gamma - 1);
      S = dS;
      break;
    case 2:
      T = Tc;
      S = dS + nR * Math.log(V / a.V);
      break;
    default:
      T = Tc * Math.pow(a.V / V, gamma - 1);
      S = 0;
      break;
  }
  return { V, P: (nR * T) / V, T, S };
}

/** Signed polygon area via the shoelace formula. */
function shoelace(pts: { x: number; y: number }[]): number {
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

export function computeCycle(Th: number, Tc: number, ratio: number, gamma: number): CarnotCycleData {
  const nR = N_MOLES * R_GAS;

  // Corner volumes. The adiabatic legs obey T·V^(γ−1) = const, so the volume
  // blow-up factor between the isotherms is (Th/Tc)^(1/(γ−1)) — this is what
  // guarantees V₃/V₄ = V₂/V₁ and closes the loop.
  const v1 = V_STATE1;
  const v2 = ratio * v1;
  const adiabaticFactor = Math.pow(Th / Tc, 1 / (gamma - 1));
  const v3 = v2 * adiabaticFactor;
  const v4 = v1 * adiabaticFactor;

  const dS = nR * Math.log(ratio);
  const Qh = nR * Th * Math.log(v2 / v1);
  const Qc = nR * Tc * Math.log(v3 / v4);
  const Wnet = Qh - Qc;
  const eta = 1 - Tc / Th;

  const corners: [CyclePoint, CyclePoint, CyclePoint, CyclePoint] = [
    { V: v1, P: (nR * Th) / v1, T: Th, S: 0 },
    { V: v2, P: (nR * Th) / v2, T: Th, S: dS },
    { V: v3, P: (nR * Tc) / v3, T: Tc, S: dS },
    { V: v4, P: (nR * Tc) / v4, T: Tc, S: 0 },
  ];

  const partial: CarnotCycleData = {
    Th, Tc, ratio, gamma, corners, legs: [], eta, Qh, Qc, Wnet, dS,
    areaPV: 0, areaTS: 0,
  };

  const legs: CyclePoint[][] = [];
  for (let leg = 0; leg < 4; leg++) {
    const pts: CyclePoint[] = [];
    for (let i = 0; i <= SAMPLES_PER_LEG; i++) {
      pts.push(pointOnLeg(partial, leg, i / SAMPLES_PER_LEG));
    }
    legs.push(pts);
  }
  partial.legs = legs;

  // Sanity-check areas: both loops should enclose W_net.
  const loop = legs.flatMap((pts) => pts.slice(0, -1));
  partial.areaPV = Math.abs(shoelace(loop.map((p) => ({ x: p.V, y: p.P }))));
  partial.areaTS = Math.abs(shoelace(loop.map((p) => ({ x: p.S, y: p.T }))));

  return partial;
}

// ── Drawing ───────────────────────────────────────────────────────────────────

// Leg colors: isothermal hot, adiabatic, isothermal cold, adiabatic
export const LEG_COLORS = ['#f87171', '#c084fc', '#38bdf8', '#c084fc'] as const;

interface DiagramSpec {
  getX: (p: CyclePoint) => number;
  getY: (p: CyclePoint) => number;
  xLabel: string;
  yLabel: string;
  xScale: number; // multiplies raw value for tick display (m³ → L, Pa → kPa)
  yScale: number;
  fill: string;
}

const PV_SPEC: DiagramSpec = {
  getX: (p) => p.V,
  getY: (p) => p.P,
  xLabel: 'V (L)',
  yLabel: 'P (kPa)',
  xScale: 1e3,
  yScale: 1e-3,
  fill: 'rgba(56,189,248,0.07)',
};

const TS_SPEC: DiagramSpec = {
  getX: (p) => p.S,
  getY: (p) => p.T,
  xLabel: 'S (J/K)',
  yLabel: 'T (K)',
  xScale: 1,
  yScale: 1,
  fill: 'rgba(192,132,252,0.08)',
};

const MARGIN = { left: 54, right: 14, top: 16, bottom: 34 };

function drawDiagram(
  ctx: CanvasRenderingContext2D,
  cycle: CarnotCycleData,
  u: number,
  spec: DiagramSpec,
): void {
  const { width: W, height: H } = ctx.canvas;

  // Bounds over the sampled loop, padded 8%
  let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
  for (const leg of cycle.legs) {
    for (const p of leg) {
      const x = spec.getX(p);
      const y = spec.getY(p);
      if (x < xMin) xMin = x;
      if (x > xMax) xMax = x;
      if (y < yMin) yMin = y;
      if (y > yMax) yMax = y;
    }
  }
  const xPad = (xMax - xMin) * 0.08 || 1;
  const yPad = (yMax - yMin) * 0.08 || 1;
  xMin -= xPad; xMax += xPad;
  yMin -= yPad; yMax += yPad;

  const plotW = W - MARGIN.left - MARGIN.right;
  const plotH = H - MARGIN.top - MARGIN.bottom;
  const toX = (x: number) => MARGIN.left + ((x - xMin) / (xMax - xMin)) * plotW;
  const toY = (y: number) => H - MARGIN.bottom - ((y - yMin) / (yMax - yMin)) * plotH;

  // Background
  ctx.fillStyle = '#030507';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(148,163,184,0.12)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

  // Gridlines + tick labels
  ctx.font = '10px monospace';
  const TICKS = 4;
  for (let i = 0; i <= TICKS; i++) {
    const fx = xMin + ((xMax - xMin) * i) / TICKS;
    const fy = yMin + ((yMax - yMin) * i) / TICKS;
    const px = toX(fx);
    const py = toY(fy);

    ctx.strokeStyle = 'rgba(148,163,184,0.08)';
    ctx.beginPath();
    ctx.moveTo(px, MARGIN.top);
    ctx.lineTo(px, H - MARGIN.bottom);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(MARGIN.left, py);
    ctx.lineTo(W - MARGIN.right, py);
    ctx.stroke();

    ctx.fillStyle = 'rgba(148,163,184,0.6)';
    ctx.textAlign = 'center';
    ctx.fillText(String(toSigFigs(fx * spec.xScale, 3)), px, H - MARGIN.bottom + 14);
    ctx.textAlign = 'right';
    ctx.fillText(String(toSigFigs(fy * spec.yScale, 3)), MARGIN.left - 6, py + 3);
  }

  // Axis lines
  ctx.strokeStyle = 'rgba(148,163,184,0.35)';
  ctx.beginPath();
  ctx.moveTo(MARGIN.left, MARGIN.top);
  ctx.lineTo(MARGIN.left, H - MARGIN.bottom);
  ctx.lineTo(W - MARGIN.right, H - MARGIN.bottom);
  ctx.stroke();

  // Axis labels
  ctx.fillStyle = 'rgba(148,163,184,0.75)';
  ctx.textAlign = 'left';
  ctx.fillText(spec.yLabel, 6, 12);
  ctx.textAlign = 'right';
  ctx.fillText(spec.xLabel, W - MARGIN.right, H - 6);

  // Shaded enclosed area
  ctx.beginPath();
  cycle.legs.forEach((pts, li) => {
    pts.forEach((p, pi) => {
      const px = toX(spec.getX(p));
      const py = toY(spec.getY(p));
      if (li === 0 && pi === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
  });
  ctx.closePath();
  ctx.fillStyle = spec.fill;
  ctx.fill();

  // Legs + direction arrows
  cycle.legs.forEach((pts, li) => {
    ctx.strokeStyle = LEG_COLORS[li];
    ctx.lineWidth = 2;
    ctx.beginPath();
    pts.forEach((p, pi) => {
      const px = toX(spec.getX(p));
      const py = toY(spec.getY(p));
      if (pi === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();

    // Arrowhead at leg midpoint showing traversal direction
    const mid = pts[Math.floor(pts.length / 2)];
    const next = pts[Math.floor(pts.length / 2) + 1];
    const mx = toX(spec.getX(mid));
    const my = toY(spec.getY(mid));
    const angle = Math.atan2(toY(spec.getY(next)) - my, toX(spec.getX(next)) - mx);
    ctx.fillStyle = LEG_COLORS[li];
    ctx.save();
    ctx.translate(mx, my);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(5, 0);
    ctx.lineTo(-4, 4);
    ctx.lineTo(-4, -4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });

  // Corner markers + state numbers
  ctx.font = '11px monospace';
  cycle.corners.forEach((c, i) => {
    const px = toX(spec.getX(c));
    const py = toY(spec.getY(c));
    ctx.beginPath();
    ctx.arc(px, py, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#e2e8f0';
    ctx.fill();
    ctx.fillStyle = 'rgba(226,232,240,0.8)';
    ctx.textAlign = 'left';
    ctx.fillText(String(i + 1), px + 6, py - 6);
  });

  // Animated dot — same loop parameter u drives both diagrams (phase-locked)
  const leg = Math.floor(u) % 4;
  const dot = pointOnLeg(cycle, leg, u - Math.floor(u));
  const dx = toX(spec.getX(dot));
  const dy = toY(spec.getY(dot));
  ctx.beginPath();
  ctx.arc(dx, dy, 8, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(dx, dy, 4.5, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
}

// ── Hook ──────────────────────────────────────────────────────────────────────

const CYCLE_SPEED = 0.45; // legs per second → full cycle in ~9 s

export function useCarnotCycle(
  initialTh = 600,
  initialTc = 300,
  initialRatio = 3,
  initialGas: GasType = 'monatomic',
): UseCarnotCycleResult {
  const pvCanvasRef = useRef<HTMLCanvasElement>(null);
  const tsCanvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const uRef = useRef(0); // loop parameter ∈ [0,4): leg index + fraction
  const thRef = useRef(initialTh);

  const [Th, setThState] = useState(initialTh);
  const [Tc, setTcState] = useState(initialTc);
  const [ratio, setRatioState] = useState(initialRatio);
  const [gasType, setGasType] = useState<GasType>(initialGas);
  const [isPlaying, setIsPlaying] = useState(true);

  const cycle = useMemo(
    () => computeCycle(Th, Tc, ratio, GAMMA_BY_GAS[gasType]),
    [Th, Tc, ratio, gasType],
  );
  const cycleRef = useRef(cycle);

  const drawBoth = useCallback(() => {
    const pvCtx = pvCanvasRef.current?.getContext('2d');
    const tsCtx = tsCanvasRef.current?.getContext('2d');
    if (pvCtx) drawDiagram(pvCtx, cycleRef.current, uRef.current, PV_SPEC);
    if (tsCtx) drawDiagram(tsCtx, cycleRef.current, uRef.current, TS_SPEC);
  }, []);

  // Redraw whenever the cycle changes so the canvases update even while paused
  useEffect(() => {
    cycleRef.current = cycle;
    drawBoth();
  }, [cycle, drawBoth]);

  const setTh = useCallback((v: number) => {
    const th = clamp(v, T_HOT_MIN, T_HOT_MAX);
    thRef.current = th;
    setThState(th);
    // Keep T_cold strictly below T_hot
    setTcState((tc) => Math.min(tc, th - MIN_T_GAP));
  }, []);

  const setTc = useCallback((v: number) => {
    setTcState(clamp(v, T_COLD_MIN, thRef.current - MIN_T_GAP));
  }, []);

  const setRatio = useCallback((v: number) => {
    setRatioState(clamp(v, RATIO_MIN, RATIO_MAX));
  }, []);

  const togglePlay = useCallback(() => setIsPlaying((prev) => !prev), []);

  const resetDot = useCallback(() => {
    uRef.current = 0;
    drawBoth();
  }, [drawBoth]);

  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      lastTsRef.current = null;
      return;
    }

    const frame = (ts: number) => {
      if (lastTsRef.current === null) lastTsRef.current = ts;
      const dt = Math.min(0.033, (ts - lastTsRef.current) / 1000);
      lastTsRef.current = ts;

      uRef.current = (uRef.current + CYCLE_SPEED * dt) % 4;
      drawBoth();

      rafRef.current = requestAnimationFrame(frame);
    };

    rafRef.current = requestAnimationFrame(frame);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isPlaying, drawBoth]);

  return {
    pvCanvasRef,
    tsCanvasRef,
    isPlaying,
    togglePlay,
    resetDot,
    Th,
    setTh,
    Tc,
    setTc,
    ratio,
    setRatio,
    gasType,
    setGasType,
    cycle,
  };
}
