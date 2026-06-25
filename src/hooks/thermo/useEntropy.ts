import { useCallback, useEffect, useRef, useState } from 'react';
import { K_BOLTZMANN } from '../../utils/constants';

// ── Types ─────────────────────────────────────────────────────────────────────

export type InitialCondition = 'all-left' | 'random' | 'all-right';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  side: 0 | 1; // 0 = left half, 1 = right half
}

export interface EntropyReadout {
  nLeft: number;
  nRight: number;
  omega: number;      // C(N, nLeft)  — number of microstates
  probability: number; // Ω / 2^N
  entropy: number;    // k_B · ln(Ω)  in J/K
}

export interface UseEntropyResult {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  isPlaying: boolean;
  togglePlay: () => void;
  N: number;
  setN: (n: number) => void;
  initialCondition: InitialCondition;
  setInitialCondition: (ic: InitialCondition) => void;
  reset: () => void;
  readout: EntropyReadout;
}

// ── Math ──────────────────────────────────────────────────────────────────────

const MAX_N = 60;
// Precomputed ln(k!) table: LN_FACT[k] = ln(k!)
const LN_FACT = new Float64Array(MAX_N + 1);
for (let i = 1; i <= MAX_N; i++) LN_FACT[i] = LN_FACT[i - 1] + Math.log(i);

function lnCombination(n: number, k: number): number {
  if (k < 0 || k > n) return -Infinity;
  return LN_FACT[n] - LN_FACT[k] - LN_FACT[n - k];
}

function computeReadout(N: number, nLeft: number): EntropyReadout {
  const lnOmega = lnCombination(N, nLeft);
  return {
    nLeft,
    nRight: N - nLeft,
    omega: Math.exp(lnOmega),
    probability: Math.exp(lnOmega - N * Math.LN2),
    entropy: K_BOLTZMANN * lnOmega,
  };
}

// ── Particles ─────────────────────────────────────────────────────────────────

const RADIUS = 4;
const SPEED = 80;   // px/s — constant speed magnitude
const HOP_RATE = 0.9; // expected hops per particle per second
const SNAPSHOT_MS = 120;

function randVelocity(): { vx: number; vy: number } {
  const angle = Math.random() * 2 * Math.PI;
  return { vx: Math.cos(angle) * SPEED, vy: Math.sin(angle) * SPEED };
}

function initParticles(N: number, ic: InitialCondition, W: number, H: number): Particle[] {
  const halfW = W / 2;
  return Array.from({ length: N }, () => {
    const side: 0 | 1 =
      ic === 'all-left' ? 0 : ic === 'all-right' ? 1 : Math.random() < 0.5 ? 0 : 1;
    const x =
      side === 0
        ? RADIUS + Math.random() * (halfW - 2 * RADIUS)
        : halfW + RADIUS + Math.random() * (halfW - 2 * RADIUS);
    const y = RADIUS + Math.random() * (H - 2 * RADIUS);
    return { x, y, ...randVelocity(), side };
  });
}

function countLeft(particles: Particle[]): number {
  let n = 0;
  for (const p of particles) if (p.side === 0) n++;
  return n;
}

function stepParticles(particles: Particle[], dt: number, W: number, H: number): void {
  const halfW = W / 2;
  const pHop = HOP_RATE * dt;

  for (const p of particles) {
    if (Math.random() < pHop) {
      // Hop to the other side — teleport to a random position there
      p.side = p.side === 0 ? 1 : 0;
      if (p.side === 0) {
        p.x = RADIUS + Math.random() * (halfW - 2 * RADIUS);
      } else {
        p.x = halfW + RADIUS + Math.random() * (halfW - 2 * RADIUS);
      }
      p.y = RADIUS + Math.random() * (H - 2 * RADIUS);
      const v = randVelocity();
      p.vx = v.vx;
      p.vy = v.vy;
    } else {
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Bounce off the walls of the particle's half
      if (p.side === 0) {
        if (p.x < RADIUS) { p.x = RADIUS; p.vx = Math.abs(p.vx); }
        else if (p.x > halfW - RADIUS) { p.x = halfW - RADIUS; p.vx = -Math.abs(p.vx); }
      } else {
        if (p.x < halfW + RADIUS) { p.x = halfW + RADIUS; p.vx = Math.abs(p.vx); }
        else if (p.x > W - RADIUS) { p.x = W - RADIUS; p.vx = -Math.abs(p.vx); }
      }
      if (p.y < RADIUS) { p.y = RADIUS; p.vy = Math.abs(p.vy); }
      else if (p.y > H - RADIUS) { p.y = H - RADIUS; p.vy = -Math.abs(p.vy); }
    }
  }
}

function drawFrame(ctx: CanvasRenderingContext2D, particles: Particle[], N: number): void {
  const { width: W, height: H } = ctx.canvas;
  const halfW = W / 2;
  void N;

  // Background
  ctx.fillStyle = '#030507';
  ctx.fillRect(0, 0, W, H);

  // Outer border
  ctx.strokeStyle = 'rgba(148,163,184,0.12)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

  // Center divider
  ctx.save();
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = 'rgba(148,163,184,0.28)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(halfW, 0);
  ctx.lineTo(halfW, H);
  ctx.stroke();
  ctx.restore();

  // Side labels
  ctx.fillStyle = 'rgba(148,163,184,0.22)';
  ctx.font = '11px monospace';
  ctx.fillText('LEFT', 8, 16);
  ctx.fillText('RIGHT', halfW + 8, 16);

  // Particles
  for (const p of particles) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = p.side === 0 ? '#22d3ee' : '#fb923c';
    ctx.fill();
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useEntropy(
  initialN: number = 20,
  initialIc: InitialCondition = 'all-left',
): UseEntropyResult {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const lastSnapRef = useRef(0);
  const NRef = useRef(initialN);
  const icRef = useRef<InitialCondition>(initialIc);

  const [N, setNState] = useState(initialN);
  const [initialCondition, setInitialConditionState] = useState<InitialCondition>(initialIc);
  const [isPlaying, setIsPlaying] = useState(true);
  const [readout, setReadout] = useState<EntropyReadout>(() =>
    computeReadout(
      initialN,
      initialIc === 'all-left' ? initialN : initialIc === 'all-right' ? 0 : Math.round(initialN / 2),
    ),
  );

  const doReset = useCallback((n: number, ic: InitialCondition) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const particles = initParticles(n, ic, canvas.width, canvas.height);
    particlesRef.current = particles;
    const nLeft = countLeft(particles);
    setReadout(computeReadout(n, nLeft));
    // Draw immediately so the canvas updates even while paused
    const ctx = canvas.getContext('2d');
    if (ctx) drawFrame(ctx, particles, n);
  }, []);

  // Initialize once canvas dimensions are known
  useEffect(() => {
    doReset(NRef.current, icRef.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setN = useCallback(
    (n: number) => {
      NRef.current = n;
      setNState(n);
      doReset(n, icRef.current);
    },
    [doReset],
  );

  const setInitialCondition = useCallback(
    (ic: InitialCondition) => {
      icRef.current = ic;
      setInitialConditionState(ic);
      doReset(NRef.current, ic);
    },
    [doReset],
  );

  const reset = useCallback(() => {
    doReset(NRef.current, icRef.current);
  }, [doReset]);

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
      particlesRef.current = initParticles(NRef.current, icRef.current, canvas.width, canvas.height);
    }

    const frame = (ts: number) => {
      if (lastTsRef.current === null) lastTsRef.current = ts;
      const dt = Math.min(0.033, (ts - lastTsRef.current) / 1000);
      lastTsRef.current = ts;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        stepParticles(particlesRef.current, dt, canvas.width, canvas.height);
        drawFrame(ctx, particlesRef.current, NRef.current);
      }

      if (ts - lastSnapRef.current >= SNAPSHOT_MS) {
        lastSnapRef.current = ts;
        const nLeft = countLeft(particlesRef.current);
        setReadout(computeReadout(NRef.current, nLeft));
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

  return { canvasRef, isPlaying, togglePlay, N, setN, initialCondition, setInitialCondition, reset, readout };
}
