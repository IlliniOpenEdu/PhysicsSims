import { useCallback, useEffect, useRef, useState } from 'react';
import { AMU, K_BOLTZMANN } from '../../utils/constants';
import { clamp, histogram, randGaussian } from '../../utils/mathUtils';
import { toSigFigs } from '../../utils/formatters';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Particle {
  x: number; // m
  y: number; // m
  vx: number; // m/s
  vy: number; // m/s
}

interface WallFlash {
  x: number; // m
  y: number; // m
  age: number; // real seconds since the hit
}

export interface KineticReadout {
  tSet: number; // K — slider value
  tMeasured: number; // K — from m⟨v²⟩/(2k_B), 2D
  pMeasured: number; // N/m — from accumulated wall impulse (2D pressure)
  pIdeal: number; // N/m — N·k_B·T_measured / A, for comparison
  vMean: number; // m/s — measured ⟨|v|⟩
  vRms: number; // m/s — measured √⟨v²⟩
  vMp: number; // m/s — most probable speed √(k_B·T_measured/m)
}

export interface UseKineticTheoryResult {
  boxCanvasRef: React.RefObject<HTMLCanvasElement>;
  histCanvasRef: React.RefObject<HTMLCanvasElement>;
  isPlaying: boolean;
  togglePlay: () => void;
  reseed: () => void;
  temperature: number;
  setTemperature: (t: number) => void;
  nParticles: number;
  setNParticles: (n: number) => void;
  massU: number;
  setMassU: (m: number) => void;
  readout: KineticReadout;
}

// ── Simulation constants ──────────────────────────────────────────────────────

const L_X = 1.0; // m — physical box width; height follows the canvas aspect ratio
const RADIUS_PX = 3.5;
const TIME_SCALE = 3.5e-4; // simulated seconds per real second (keeps ~km/s speeds watchable)
const SNAPSHOT_MS = 120;
const HIST_BINS = 26;
const FLASH_LIFE = 0.35; // real seconds
const MAX_FLASHES = 80;
const P_SMOOTHING = 0.35; // EMA factor for the pressure gauge

// ── Physics ───────────────────────────────────────────────────────────────────

/** Per-component Maxwell-Boltzmann sigma: vx ~ N(0, √(k_B·T/m)) */
function componentSigma(T: number, mKg: number): number {
  return Math.sqrt((K_BOLTZMANN * T) / mKg);
}

function initParticles(n: number, T: number, mKg: number, boxW: number, boxH: number, r: number): Particle[] {
  const s = componentSigma(T, mKg);
  return Array.from({ length: n }, () => ({
    x: r + Math.random() * (boxW - 2 * r),
    y: r + Math.random() * (boxH - 2 * r),
    vx: randGaussian(0, s),
    vy: randGaussian(0, s),
  }));
}

interface StepResult {
  impulse: number; // kg·m/s deposited on the walls this step
  hits: { x: number; y: number }[];
}

/**
 * Advance one step: free flight, elastic wall reflections (accumulating |Δp|),
 * then equal-mass pairwise elastic collisions. Collisions are what redistribute
 * energy so the speed histogram genuinely relaxes onto the M-B curve.
 */
function stepSim(
  particles: Particle[],
  dt: number,
  boxW: number,
  boxH: number,
  r: number,
  mKg: number,
): StepResult {
  let impulse = 0;
  const hits: { x: number; y: number }[] = [];

  for (const p of particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.x < r) {
      p.x = r;
      impulse += 2 * mKg * Math.abs(p.vx);
      hits.push({ x: 0, y: p.y });
      p.vx = Math.abs(p.vx);
    } else if (p.x > boxW - r) {
      p.x = boxW - r;
      impulse += 2 * mKg * Math.abs(p.vx);
      hits.push({ x: boxW, y: p.y });
      p.vx = -Math.abs(p.vx);
    }
    if (p.y < r) {
      p.y = r;
      impulse += 2 * mKg * Math.abs(p.vy);
      hits.push({ x: p.x, y: 0 });
      p.vy = Math.abs(p.vy);
    } else if (p.y > boxH - r) {
      p.y = boxH - r;
      impulse += 2 * mKg * Math.abs(p.vy);
      hits.push({ x: p.x, y: boxH });
      p.vy = -Math.abs(p.vy);
    }
  }

  // Equal-mass elastic disc collisions: exchange normal velocity components.
  const d2min = 4 * r * r;
  for (let i = 0; i < particles.length; i++) {
    const a = particles[i];
    for (let j = i + 1; j < particles.length; j++) {
      const b = particles[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d2 = dx * dx + dy * dy;
      if (d2 >= d2min || d2 === 0) continue;
      const d = Math.sqrt(d2);
      const nx = dx / d;
      const ny = dy / d;
      const rvn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (rvn >= 0) continue; // separating — don't re-collide overlapping pairs
      a.vx += rvn * nx;
      a.vy += rvn * ny;
      b.vx -= rvn * nx;
      b.vy -= rvn * ny;
      // Nudge apart so overlapping pairs don't sink into each other
      const overlap = (2 * r - d) / 2;
      a.x -= nx * overlap;
      a.y -= ny * overlap;
      b.x += nx * overlap;
      b.y += ny * overlap;
    }
  }

  return { impulse, hits };
}

function measure(particles: Particle[], mKg: number): { tMeasured: number; vMean: number; vRms: number } {
  if (particles.length === 0) return { tMeasured: 0, vMean: 0, vRms: 0 };
  let sumV = 0;
  let sumV2 = 0;
  for (const p of particles) {
    const v2 = p.vx * p.vx + p.vy * p.vy;
    sumV2 += v2;
    sumV += Math.sqrt(v2);
  }
  const meanV2 = sumV2 / particles.length;
  return {
    // 2D: ⟨KE⟩ = k_B·T  ⇒  T = m⟨v²⟩ / (2 k_B)
    tMeasured: (mKg * meanV2) / (2 * K_BOLTZMANN),
    vMean: sumV / particles.length,
    vRms: Math.sqrt(meanV2),
  };
}

/** 2D Maxwell-Boltzmann speed pdf: f(v) = (m·v / k_B·T) · exp(−m·v² / 2k_B·T) */
function mbPdf2D(v: number, T: number, mKg: number): number {
  const a = mKg / (K_BOLTZMANN * T);
  return a * v * Math.exp((-a * v * v) / 2);
}

// ── Drawing ───────────────────────────────────────────────────────────────────

/** slow = cyan (hue 187) → fast = amber (hue 38) */
function speedToColor(speed: number, vScale: number): string {
  const t = clamp(speed / (2.2 * vScale), 0, 1);
  const hue = 187 - 149 * t;
  const light = 55 + 8 * t;
  return `hsl(${hue.toFixed(0)},90%,${light.toFixed(0)}%)`;
}

function drawBox(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  flashes: WallFlash[],
  boxW: number,
  vScale: number,
): void {
  const { width: W, height: H } = ctx.canvas;
  const pxPerM = W / boxW;

  ctx.fillStyle = '#030507';
  ctx.fillRect(0, 0, W, H);

  // Wall-hit flashes — under the particles, fading over FLASH_LIFE
  for (const f of flashes) {
    const alpha = (1 - f.age / FLASH_LIFE) * 0.45;
    if (alpha <= 0) continue;
    const fx = f.x * pxPerM;
    const fy = f.y * pxPerM;
    const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, 16);
    g.addColorStop(0, `rgba(251,191,36,${alpha.toFixed(3)})`);
    g.addColorStop(1, 'rgba(251,191,36,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(fx, fy, 16, 0, Math.PI * 2);
    ctx.fill();
  }

  // Box border
  ctx.strokeStyle = 'rgba(148,163,184,0.12)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

  for (const p of particles) {
    const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
    ctx.beginPath();
    ctx.arc(p.x * pxPerM, p.y * pxPerM, RADIUS_PX, 0, Math.PI * 2);
    ctx.fillStyle = speedToColor(speed, vScale);
    ctx.fill();
  }
}

const HIST_MARGIN = { left: 36, right: 10, top: 14, bottom: 34 };

function drawHistogram(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  T: number,
  mKg: number,
): void {
  const { width: W, height: H } = ctx.canvas;

  ctx.fillStyle = '#030507';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(148,163,184,0.12)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
  if (particles.length === 0) return;

  const vScale = Math.sqrt((2 * K_BOLTZMANN * T) / mKg); // v_rms at the set T
  const vMax = 3.2 * Math.sqrt((K_BOLTZMANN * T) / mKg) * Math.SQRT2;
  const speeds = particles.map((p) => Math.sqrt(p.vx * p.vx + p.vy * p.vy));
  const bins = histogram(speeds, HIST_BINS, 0, vMax);
  const binW = vMax / HIST_BINS;
  const N = particles.length;

  const plotW = W - HIST_MARGIN.left - HIST_MARGIN.right;
  const plotH = H - HIST_MARGIN.top - HIST_MARGIN.bottom;
  const x0 = HIST_MARGIN.left;
  const yBase = H - HIST_MARGIN.bottom;

  // Common vertical scale for bars and the theoretical curve
  let yMax = 0;
  for (const [, count] of bins) if (count > yMax) yMax = count;
  const peakExpected = N * mbPdf2D(Math.sqrt((K_BOLTZMANN * T) / mKg), T, mKg) * binW;
  yMax = Math.max(yMax, peakExpected, 4) * 1.15;

  // Bars, colored with the same speed→color mapping as the particles
  const barW = plotW / HIST_BINS;
  bins.forEach(([center, count], i) => {
    const h = (count / yMax) * plotH;
    ctx.fillStyle = speedToColor(center, vScale);
    ctx.globalAlpha = 0.75;
    ctx.fillRect(x0 + i * barW + 1, yBase - h, barW - 2, h);
  });
  ctx.globalAlpha = 1;

  // Theoretical M-B curve at the set temperature
  ctx.strokeStyle = 'rgba(226,232,240,0.85)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i <= 100; i++) {
    const v = (vMax * i) / 100;
    const y = yBase - ((N * mbPdf2D(v, T, mKg) * binW) / yMax) * plotH;
    const x = x0 + (v / vMax) * plotW;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Axes
  ctx.strokeStyle = 'rgba(148,163,184,0.35)';
  ctx.beginPath();
  ctx.moveTo(x0, HIST_MARGIN.top);
  ctx.lineTo(x0, yBase);
  ctx.lineTo(W - HIST_MARGIN.right, yBase);
  ctx.stroke();

  ctx.font = '10px monospace';
  ctx.fillStyle = 'rgba(148,163,184,0.6)';
  ctx.textAlign = 'center';
  for (let i = 0; i <= 2; i++) {
    const v = (vMax * i) / 2;
    ctx.fillText(String(toSigFigs(v, 3)), x0 + (i / 2) * plotW, yBase + 14);
  }
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(148,163,184,0.75)';
  ctx.fillText('count', 6, 12);
  ctx.textAlign = 'right';
  ctx.fillText('speed (m/s)', W - HIST_MARGIN.right, H - 6);
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useKineticTheory(
  initialT = 300,
  initialN = 200,
  initialMassU = 4,
): UseKineticTheoryResult {
  const boxCanvasRef = useRef<HTMLCanvasElement>(null);
  const histCanvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const flashesRef = useRef<WallFlash[]>([]);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const lastSnapRef = useRef(0);
  const tempRef = useRef(initialT);
  const nRef = useRef(initialN);
  const massURef = useRef(initialMassU);
  const boxDimsRef = useRef({ w: L_X, h: L_X, r: 0.005 });
  const pressureWinRef = useRef({ impulse: 0, simTime: 0 });
  const pSmoothRef = useRef(0);

  const [temperature, setTemperatureState] = useState(initialT);
  const [nParticles, setNParticlesState] = useState(initialN);
  const [massU, setMassUState] = useState(initialMassU);
  const [isPlaying, setIsPlaying] = useState(true);
  const [readout, setReadout] = useState<KineticReadout>({
    tSet: initialT,
    tMeasured: initialT,
    pMeasured: 0,
    pIdeal: 0,
    vMean: 0,
    vRms: 0,
    vMp: 0,
  });

  const makeReadout = useCallback((): KineticReadout => {
    const mKg = massURef.current * AMU;
    const { w, h } = boxDimsRef.current;
    const { tMeasured, vMean, vRms } = measure(particlesRef.current, mKg);
    return {
      tSet: tempRef.current,
      tMeasured,
      pMeasured: pSmoothRef.current,
      pIdeal: (particlesRef.current.length * K_BOLTZMANN * tMeasured) / (w * h),
      vMean,
      vRms,
      vMp: Math.sqrt((K_BOLTZMANN * tMeasured) / mKg),
    };
  }, []);

  const drawAll = useCallback(() => {
    const boxCtx = boxCanvasRef.current?.getContext('2d');
    const histCtx = histCanvasRef.current?.getContext('2d');
    const vScale = Math.sqrt((2 * K_BOLTZMANN * tempRef.current) / (massURef.current * AMU));
    if (boxCtx) {
      drawBox(boxCtx, particlesRef.current, flashesRef.current, boxDimsRef.current.w, vScale);
    }
    if (histCtx) {
      drawHistogram(histCtx, particlesRef.current, tempRef.current, massURef.current * AMU);
    }
  }, []);

  // Initialize particles once canvas dimensions are known
  useEffect(() => {
    const canvas = boxCanvasRef.current;
    if (!canvas) return;
    const w = L_X;
    const h = (canvas.height / canvas.width) * L_X;
    const r = (RADIUS_PX / canvas.width) * L_X;
    boxDimsRef.current = { w, h, r };
    particlesRef.current = initParticles(
      nRef.current, tempRef.current, massURef.current * AMU, w, h, r,
    );
    setReadout(makeReadout());
    drawAll();
  }, [drawAll, makeReadout]);

  // Instant re-thermalization: rescale every velocity by √(T_new/T_old)
  const setTemperature = useCallback((newT: number) => {
    const scale = Math.sqrt(newT / tempRef.current);
    for (const p of particlesRef.current) {
      p.vx *= scale;
      p.vy *= scale;
    }
    tempRef.current = newT;
    setTemperatureState(newT);
    setReadout(makeReadout());
    drawAll();
  }, [drawAll, makeReadout]);

  // Mass change keeps T fixed: v ∝ √(m_old/m_new) — heavier means slower at the same T
  const setMassU = useCallback((newMassU: number) => {
    const scale = Math.sqrt(massURef.current / newMassU);
    for (const p of particlesRef.current) {
      p.vx *= scale;
      p.vy *= scale;
    }
    massURef.current = newMassU;
    setMassUState(newMassU);
    setReadout(makeReadout());
    drawAll();
  }, [drawAll, makeReadout]);

  const setNParticles = useCallback((newN: number) => {
    const n = Math.round(newN);
    const cur = particlesRef.current;
    const { w, h, r } = boxDimsRef.current;
    if (n < cur.length) {
      particlesRef.current = cur.slice(0, n);
    } else if (n > cur.length) {
      particlesRef.current = cur.concat(
        initParticles(n - cur.length, tempRef.current, massURef.current * AMU, w, h, r),
      );
    }
    nRef.current = n;
    setNParticlesState(n);
    setReadout(makeReadout());
    drawAll();
  }, [drawAll, makeReadout]);

  const reseed = useCallback(() => {
    const { w, h, r } = boxDimsRef.current;
    particlesRef.current = initParticles(
      nRef.current, tempRef.current, massURef.current * AMU, w, h, r,
    );
    flashesRef.current = [];
    setReadout(makeReadout());
    drawAll();
  }, [drawAll, makeReadout]);

  const togglePlay = useCallback(() => setIsPlaying((prev) => !prev), []);

  useEffect(() => {
    const canvas = boxCanvasRef.current;
    if (!canvas) return;

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

      const { w, h, r } = boxDimsRef.current;
      const mKg = massURef.current * AMU;
      const dtSim = dt * TIME_SCALE;

      const { impulse, hits } = stepSim(particlesRef.current, dtSim, w, h, r, mKg);

      // Pressure window: P = (Σ|Δp| / Δt_sim) / perimeter
      pressureWinRef.current.impulse += impulse;
      pressureWinRef.current.simTime += dtSim;

      // Age flashes, add new ones
      const flashes = flashesRef.current;
      for (const f of flashes) f.age += dt;
      flashesRef.current = flashes.filter((f) => f.age < FLASH_LIFE);
      for (const hit of hits) {
        if (flashesRef.current.length >= MAX_FLASHES) break;
        flashesRef.current.push({ x: hit.x, y: hit.y, age: 0 });
      }

      drawAll();

      if (ts - lastSnapRef.current >= SNAPSHOT_MS) {
        lastSnapRef.current = ts;
        const win = pressureWinRef.current;
        if (win.simTime > 0) {
          const perimeter = 2 * (w + h);
          const pInst = win.impulse / (win.simTime * perimeter);
          pSmoothRef.current =
            pSmoothRef.current === 0
              ? pInst
              : pSmoothRef.current + (pInst - pSmoothRef.current) * P_SMOOTHING;
          pressureWinRef.current = { impulse: 0, simTime: 0 };
        }
        setReadout(makeReadout());
      }

      rafRef.current = requestAnimationFrame(frame);
    };

    rafRef.current = requestAnimationFrame(frame);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isPlaying, drawAll, makeReadout]);

  return {
    boxCanvasRef,
    histCanvasRef,
    isPlaying,
    togglePlay,
    reseed,
    temperature,
    setTemperature,
    nParticles,
    setNParticles,
    massU,
    setMassU,
    readout,
  };
}
