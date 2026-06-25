import { useCallback, useEffect, useRef, useState } from 'react';
import { K_BOLTZMANN } from '../../utils/constants';
import { clamp, randGaussian } from '../../utils/mathUtils';

const N_PARTICLES = 80;
const RADIUS = 4;
// Per-component thermal velocity at T_REF: vx ~ N(0, V_SIGMA_REF)
const V_SIGMA_REF = 160; // px/s
const T_REF = 300;       // K
const SNAPSHOT_MS = 120;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface InternalEnergyReadout {
  temperature: number;
  avgKE: number;  // J  — (3/2) k_B T
  totalU: number; // J  — N (3/2) k_B T
}

export interface UseInternalEnergyResult {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  isPlaying: boolean;
  togglePlay: () => void;
  temperature: number;
  setTemperature: (t: number) => void;
  readout: InternalEnergyReadout;
}

function componentSigma(T: number): number {
  return V_SIGMA_REF * Math.sqrt(T / T_REF);
}

function initParticles(T: number, W: number, H: number): Particle[] {
  const s = componentSigma(T);
  return Array.from({ length: N_PARTICLES }, () => ({
    x: RADIUS + Math.random() * (W - 2 * RADIUS),
    y: RADIUS + Math.random() * (H - 2 * RADIUS),
    vx: randGaussian(0, s),
    vy: randGaussian(0, s),
  }));
}

function speedToColor(speed: number, vRef: number): string {
  const t = clamp(speed / (2.8 * vRef), 0, 1);
  const hue = 240 - 240 * t; // blue → cyan → green → yellow → red
  const lightness = 50 + 20 * t;
  return `hsl(${hue.toFixed(0)},90%,${lightness.toFixed(0)}%)`;
}

function stepParticles(particles: Particle[], dt: number, W: number, H: number): void {
  for (const p of particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.x < RADIUS) { p.x = RADIUS; p.vx = Math.abs(p.vx); }
    else if (p.x > W - RADIUS) { p.x = W - RADIUS; p.vx = -Math.abs(p.vx); }
    if (p.y < RADIUS) { p.y = RADIUS; p.vy = Math.abs(p.vy); }
    else if (p.y > H - RADIUS) { p.y = H - RADIUS; p.vy = -Math.abs(p.vy); }
  }
}

function drawFrame(ctx: CanvasRenderingContext2D, particles: Particle[], T: number): void {
  const { width: W, height: H } = ctx.canvas;
  const vRef = componentSigma(T);

  ctx.fillStyle = '#030507';
  ctx.fillRect(0, 0, W, H);

  // Box border
  ctx.strokeStyle = 'rgba(148,163,184,0.12)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

  for (const p of particles) {
    const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
    ctx.beginPath();
    ctx.arc(p.x, p.y, RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = speedToColor(speed, vRef);
    ctx.fill();
  }
}

function makeReadout(T: number): InternalEnergyReadout {
  return {
    temperature: T,
    avgKE: (3 / 2) * K_BOLTZMANN * T,
    totalU: N_PARTICLES * (3 / 2) * K_BOLTZMANN * T,
  };
}

export function useInternalEnergy(initialT = 300): UseInternalEnergyResult {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const lastSnapRef = useRef(0);
  const tempRef = useRef(initialT);

  const [temperature, setTemperatureState] = useState(initialT);
  const [isPlaying, setIsPlaying] = useState(true);
  const [readout, setReadout] = useState<InternalEnergyReadout>(() => makeReadout(initialT));

  // Initialize particles once canvas dimensions are known
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    particlesRef.current = initParticles(tempRef.current, canvas.width, canvas.height);
  }, []);

  const setTemperature = useCallback((newT: number) => {
    const scale = Math.sqrt(newT / tempRef.current);
    for (const p of particlesRef.current) {
      p.vx *= scale;
      p.vy *= scale;
    }
    tempRef.current = newT;
    setTemperatureState(newT);
    setReadout(makeReadout(newT));
  }, []);

  const togglePlay = useCallback(() => setIsPlaying((prev) => !prev), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!isPlaying) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      lastTsRef.current = null;
      return;
    }

    if (particlesRef.current.length === 0) {
      particlesRef.current = initParticles(tempRef.current, canvas.width, canvas.height);
    }

    const frame = (ts: number) => {
      if (lastTsRef.current === null) lastTsRef.current = ts;
      const dt = Math.min(0.033, (ts - lastTsRef.current) / 1000);
      lastTsRef.current = ts;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        stepParticles(particlesRef.current, dt, canvas.width, canvas.height);
        drawFrame(ctx, particlesRef.current, tempRef.current);
      }

      if (ts - lastSnapRef.current >= SNAPSHOT_MS) {
        lastSnapRef.current = ts;
        setReadout(makeReadout(tempRef.current));
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
  }, [isPlaying]);

  return { canvasRef, isPlaying, togglePlay, temperature, setTemperature, readout };
}
