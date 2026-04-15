import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ConceptBox } from '../../components/ConceptBox';
import { SliderWithInput } from '../../components/SliderWithInput';

type Ball = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  m: number;
  r: number;
  color: string;
};

type BallConfig = {
  massKg: number;
  speed: number;
  angleDeg: number;
};

type MomentumReadout = {
  balls: Array<{ label: string; px: number; py: number }>;
  sumPx: number;
  sumPy: number;
  initialSumPx: number;
  initialSumPy: number;
  dSumPx: number;
  dSumPy: number;
};

const CANVAS_PX = 520;
const ARENA_M = 10;
const PX_PER_M = CANVAS_PX / ARENA_M;
const DT_MAX = 1 / 30;
const SUBSTEPS = 6;
const MIN_BALLS = 1;
const MAX_BALLS = 4;
const MIN_MASS = 0.5;
const MAX_MASS = 20;
const MIN_SPEED = 0;
const MAX_SPEED = 15;
const MIN_ANGLE = 0;
const MAX_ANGLE = 360;

const BALL_COLORS = ['#38bdf8', '#22c55e', '#f472b6', '#fbbf24'];

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function radiusFromMass(kg: number) {
  return 0.12 + 0.045 * Math.sqrt(kg);
}

function defaultConfigs(count: number): BallConfig[] {
  const base: BallConfig[] = [
    { massKg: 2, speed: 3, angleDeg: 25 },
    { massKg: 1.5, speed: 4, angleDeg: 200 },
    { massKg: 1, speed: 2.5, angleDeg: 90 },
    { massKg: 2.5, speed: 2, angleDeg: 315 },
  ];
  return base.slice(0, count);
}

function defaultPositions(count: number): Array<{ x: number; y: number }> {
  if (count === 1) return [{ x: ARENA_M / 2, y: ARENA_M / 2 }];
  if (count === 2) return [
    { x: 3.2, y: ARENA_M / 2 },
    { x: 6.8, y: ARENA_M / 2 },
  ];
  if (count === 3) return [
    { x: 5, y: 6.2 },
    { x: 3.3, y: 3.8 },
    { x: 6.7, y: 3.8 },
  ];
  return [
    { x: 2.4, y: 2.4 },
    { x: 7.6, y: 2.4 },
    { x: 2.4, y: 7.6 },
    { x: 7.6, y: 7.6 },
  ];
}

function configToBalls(configs: BallConfig[], positions: Array<{ x: number; y: number }>): Ball[] {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  return configs.map((c, i) => {
    const th = rad(c.angleDeg);
    const m = clamp(c.massKg, MIN_MASS, MAX_MASS);
    return {
      id: i,
      x: positions[i].x,
      y: positions[i].y,
      vx: c.speed * Math.cos(th),
      vy: c.speed * Math.sin(th),
      m,
      r: radiusFromMass(m),
      color: BALL_COLORS[i % BALL_COLORS.length],
    };
  });
}

function resolveWalls(b: Ball) {
  if (b.x - b.r < 0) {
    b.x = b.r;
    b.vx = -b.vx;
  } else if (b.x + b.r > ARENA_M) {
    b.x = ARENA_M - b.r;
    b.vx = -b.vx;
  }
  if (b.y - b.r < 0) {
    b.y = b.r;
    b.vy = -b.vy;
  } else if (b.y + b.r > ARENA_M) {
    b.y = ARENA_M - b.r;
    b.vy = -b.vy;
  }
}

function elasticBallPair(a: Ball, b: Ball) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-9) return;
  const nx = dx / dist;
  const ny = dy / dist;
  const minD = a.r + b.r;

  const v1n = a.vx * nx + a.vy * ny;
  const v2n = b.vx * nx + b.vy * ny;
  const dvn = v1n - v2n;

  if (dist < minD && dvn > 1e-8) {
    const m1 = a.m;
    const m2 = b.m;
    const v1nNew = ((m1 - m2) * v1n + 2 * m2 * v2n) / (m1 + m2);
    const v2nNew = ((m2 - m1) * v2n + 2 * m1 * v1n) / (m1 + m2);

    const v1tx = a.vx - v1n * nx;
    const v1ty = a.vy - v1n * ny;
    const v2tx = b.vx - v2n * nx;
    const v2ty = b.vy - v2n * ny;

    a.vx = v1nNew * nx + v1tx;
    a.vy = v1nNew * ny + v1ty;
    b.vx = v2nNew * nx + v2tx;
    b.vy = v2nNew * ny + v2ty;
  }

  const d2 = Math.hypot(b.x - a.x, b.y - a.y);
  if (d2 < minD && d2 > 1e-9) {
    const nnx = (b.x - a.x) / d2;
    const nny = (b.y - a.y) / d2;
    const overlap = minD - d2;
    const inv = 1 / (a.m + b.m);
    a.x -= nnx * overlap * b.m * inv;
    a.y -= nny * overlap * b.m * inv;
    b.x += nnx * overlap * a.m * inv;
    b.y += nny * overlap * a.m * inv;
  }
}

function stepPhysics(balls: Ball[], dt: number) {
  for (const b of balls) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
  }
  for (const b of balls) {
    resolveWalls(b);
  }
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < balls.length; i++) {
      for (let j = i + 1; j < balls.length; j++) {
        elasticBallPair(balls[i], balls[j]);
      }
    }
  }
}

function sumMomentum(balls: Ball[]) {
  let sx = 0;
  let sy = 0;
  for (const b of balls) {
    sx += b.m * b.vx;
    sy += b.m * b.vy;
  }
  return { sx, sy };
}

export function Collision2D() {
  const [ballCount, setBallCount] = useState(2);
  const [configs, setConfigs] = useState<BallConfig[]>(() => defaultConfigs(2));
  const [runEpoch, setRunEpoch] = useState(0);
  const [readout, setReadout] = useState<MomentumReadout | null>(null);

  const simRef = useRef<Ball[]>([]);
  const initialPRef = useRef({ sx: 0, sy: 0 });
  const lastTsRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastUiRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const configsRef = useRef(configs);
  const ballCountRef = useRef(ballCount);
  configsRef.current = configs;
  ballCountRef.current = ballCount;

  const applyConfigsSlice = useCallback((count: number, prev: BallConfig[]) => {
    const next = defaultConfigs(count);
    for (let i = 0; i < count && i < prev.length; i++) {
      next[i] = { ...prev[i] };
    }
    return next;
  }, []);

  const resetSimulation = useCallback(() => {
    const n = ballCountRef.current;
    const cfg = configsRef.current.slice(0, n);
    const pos = defaultPositions(n);
    const balls = configToBalls(cfg, pos);
    simRef.current = balls;
    initialPRef.current = sumMomentum(balls);
    lastTsRef.current = null;
  }, []);

  useEffect(() => {
    resetSimulation();
    const balls = simRef.current;
    const { sx, sy } = sumMomentum(balls);
    const i0 = initialPRef.current;
    setReadout({
      balls: balls.map((b, idx) => ({
        label: `Ball ${idx + 1}`,
        px: b.m * b.vx,
        py: b.m * b.vy,
      })),
      sumPx: sx,
      sumPy: sy,
      initialSumPx: i0.sx,
      initialSumPy: i0.sy,
      dSumPx: 0,
      dSumPy: 0,
    });
  }, [runEpoch, resetSimulation]);

  const drawScene = useCallback((ctx: CanvasRenderingContext2D, balls: Ball[], showArrows: boolean) => {
    ctx.clearRect(0, 0, CANVAS_PX, CANVAS_PX);

    const bg = ctx.createLinearGradient(0, 0, CANVAS_PX, CANVAS_PX);
    bg.addColorStop(0, 'rgba(2,6,23,0.98)');
    bg.addColorStop(1, 'rgba(15,23,42,0.98)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, CANVAS_PX, CANVAS_PX);

    ctx.strokeStyle = 'rgba(148,163,184,0.6)';
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, CANVAS_PX - 3, CANVAS_PX - 3);

    const toPx = (wx: number, wy: number) => ({
      px: wx * PX_PER_M,
      py: CANVAS_PX - wy * PX_PER_M,
    });

    for (const b of balls) {
      const c = toPx(b.x, b.y);
      const rp = b.r * PX_PER_M;
      ctx.beginPath();
      ctx.arc(c.px, c.py, rp, 0, Math.PI * 2);
      ctx.fillStyle = b.color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(241,245,249,0.9)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#e2e8f0';
      ctx.font = '11px ui-sans-serif, system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(String(b.id + 1), c.px, c.py + 4);

      if (showArrows) {
        const spd = Math.hypot(b.vx, b.vy);
        if (spd > 0.05) {
          const scale = 12;
          const len = clamp(spd * scale, 8, 56);
          const dirx = b.vx / spd;
          const diry = b.vy / spd;
          const ex = c.px + dirx * len;
          const ey = c.py - diry * len;
          ctx.beginPath();
          ctx.moveTo(c.px, c.py);
          ctx.lineTo(ex, ey);
          ctx.strokeStyle = 'rgba(251,191,36,0.95)';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
    }
  }, []);

  const loop = useCallback(
    (ts: number) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      if (lastTsRef.current == null) {
        lastTsRef.current = ts;
        drawScene(ctx, simRef.current, true);
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      let dt = clamp((ts - lastTsRef.current) / 1000, 0, DT_MAX);
      lastTsRef.current = ts;
      const h = dt / SUBSTEPS;
      const balls = simRef.current;
      for (let s = 0; s < SUBSTEPS; s++) {
        stepPhysics(balls, h);
      }
      drawScene(ctx, balls, true);

      if (ts - lastUiRef.current > 50) {
        lastUiRef.current = ts;
        const { sx, sy } = sumMomentum(balls);
        const i0 = initialPRef.current;
        setReadout({
          balls: balls.map((b, idx) => ({
            label: `Ball ${idx + 1}`,
            px: b.m * b.vx,
            py: b.m * b.vy,
          })),
          sumPx: sx,
          sumPy: sy,
          initialSumPx: i0.sx,
          initialSumPy: i0.sy,
          dSumPx: sx - i0.sx,
          dSumPy: sy - i0.sy,
        });
      }

      rafRef.current = requestAnimationFrame(loop);
    },
    [drawScene],
  );

  useEffect(() => {
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [loop]);

  const updateConfig = (index: number, patch: Partial<BallConfig>) => {
    setConfigs((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  };

  const addBall = () => {
    if (ballCount >= MAX_BALLS) return;
    const next = ballCount + 1;
    setBallCount(next);
    setConfigs((prev) => applyConfigsSlice(next, prev));
    setRunEpoch((e) => e + 1);
  };

  const removeBall = () => {
    if (ballCount <= MIN_BALLS) return;
    const next = ballCount - 1;
    setBallCount(next);
    setConfigs((prev) => prev.slice(0, next));
    setRunEpoch((e) => e + 1);
  };

  const explanationItems = useMemo(
    () => [
      {
        title: 'Momentum in 2D',
        description:
          'Total momentum is (Σpₓ, Σpᵧ). Ball–ball elastic collisions swap normal components of momentum along the line of centers while conserving the vector sum over the two balls. The arena walls exert external impulses, so Σp for all balls can change on a wall bounce.',
      },
      {
        title: 'Independent x and y',
        description:
          'Each component obeys its own “1D” balance: internal forces between balls are equal and opposite along the line of centers, so the vector sum of momenta does not change.',
      },
      {
        title: 'Elastic collisions',
        description:
          'Ball–ball impacts use the elastic impulse along the normal between centers; tangential speeds are unchanged. Walls reverse the perpendicular velocity component.',
      },
      {
        title: 'Redistributing momentum',
        description:
          'After a collision, individual balls can carry very different momentum, but the system totals Σpₓ and Σpᵧ match what they were just before contact (within small numerical error).',
      },
    ],
    [],
  );

  return (
    <div id="2d_momentum_sim" className="mx-auto flex min-h-screen max-w-[90rem] flex-col px-4 py-8 text-slate-100">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">Mechanics · Momentum</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">2D Collisions Simulator</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">
            Elastic disks in a square arena: conserved Σpₓ and Σpᵧ with pairwise collisions and wall bounces.
          </p>
        </div>
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-sky-500 hover:text-sky-100"
        >
          ← Home
        </Link>
      </header>

      <main className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg">
        <h2 className="text-sm font-semibold tracking-wide text-sky-300">Simulation</h2>
        <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,26rem)] lg:items-start">
          <div className="min-w-0">
            <div className="mx-auto w-fit overflow-hidden rounded-xl border border-slate-800 bg-slate-950/60 p-2">
              <canvas
                ref={canvasRef}
                id="collision2d-canvas"
                width={CANVAS_PX}
                height={CANVAS_PX}
                className="block max-h-[min(85vw,560px)] w-auto rounded-lg bg-slate-950/70"
              />
            </div>
            <p className="mt-2 text-center text-[0.65rem] text-slate-500">
              y increases upward · arena {ARENA_M} m × {ARENA_M} m · arrows show velocity
            </p>

            {readout && (
              <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-xs text-slate-200">
                <p className="font-semibold text-slate-100">Momentum</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {readout.balls.map((row, i) => (
                    <p key={i}>
                      <span className="text-slate-400">{row.label}:</span>{' '}
                      <span className="text-sky-200">
                        pₓ = {round2(row.px)}, pᵧ = {round2(row.py)} kg·m/s
                      </span>
                    </p>
                  ))}
                </div>
                <div className="mt-3 rounded-md border border-slate-700 bg-slate-900/50 px-2 py-2">
                  <p>
                    <span className="text-slate-400">Σpₓ =</span>{' '}
                    <span className="font-medium text-sky-200">{round2(readout.sumPx)}</span>
                    <span className="text-slate-500"> kg·m/s</span>
                    <span className="mx-2 text-slate-600">·</span>
                    <span className="text-slate-400">Σpᵧ =</span>{' '}
                    <span className="font-medium text-sky-200">{round2(readout.sumPy)}</span>
                    <span className="text-slate-500"> kg·m/s</span>
                  </p>
                  <p className="mt-1 text-[0.7rem] text-slate-400">
                    At reset: Σpₓ = {round2(readout.initialSumPx)}, Σpᵧ = {round2(readout.initialSumPy)} · Δ(Σpₓ) ={' '}
                    {round2(readout.dSumPx)}, Δ(Σpᵧ) = {round2(readout.dSumPy)} — walls are external, so totals can
                    change; elastic ball–ball collisions exchange momentum without changing the sum over balls until a
                    wall hit.
                  </p>
                </div>
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
              <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-sky-300">System</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={addBall}
                  disabled={ballCount >= MAX_BALLS}
                  className="rounded-full bg-sky-500 px-3 py-1.5 text-xs font-semibold text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-600"
                >
                  Add ball
                </button>
                <button
                  type="button"
                  onClick={removeBall}
                  disabled={ballCount <= MIN_BALLS}
                  className="rounded-full border border-slate-600 px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Remove ball
                </button>
                <button
                  type="button"
                  onClick={() => setRunEpoch((e) => e + 1)}
                  className="rounded-full border border-slate-600 px-3 py-1.5 text-xs font-semibold"
                >
                  Reset simulation
                </button>
              </div>
              <p className="mt-2 text-[0.65rem] text-slate-500">
                Balls: {ballCount} (min {MIN_BALLS}, max {MAX_BALLS}). Edit sliders, then Reset to apply new initial conditions.
              </p>
            </div>

            {configs.slice(0, ballCount).map((c, i) => (
              <div key={i} className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
                <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-sky-300">Ball {i + 1}</p>
                <div className="mt-2 space-y-2">
                  <SliderWithInput
                    label="Mass"
                    queryKey={`c2d-mass-${i}`}
                    units="kg"
                    min={MIN_MASS}
                    max={MAX_MASS}
                    step={0.1}
                    value={c.massKg}
                    onChange={(v) => updateConfig(i, { massKg: clamp(v, MIN_MASS, MAX_MASS) })}
                  />
                  <SliderWithInput
                    label="Initial speed"
                    queryKey={`c2d-spd-${i}`}
                    units="m/s"
                    min={MIN_SPEED}
                    max={MAX_SPEED}
                    step={0.1}
                    value={c.speed}
                    onChange={(v) => updateConfig(i, { speed: clamp(v, MIN_SPEED, MAX_SPEED) })}
                  />
                  <SliderWithInput
                    label="Angle"
                    queryKey={`c2d-ang-${i}`}
                    units="°"
                    min={MIN_ANGLE}
                    max={MAX_ANGLE}
                    step={1}
                    value={c.angleDeg}
                    onChange={(v) => updateConfig(i, { angleDeg: clamp(v, MIN_ANGLE, MAX_ANGLE) })}
                  />
                </div>
              </div>
            ))}
          </aside>
        </div>
      </main>

      <ConceptBox className="mt-8" heading="Explanation" items={explanationItems} />
    </div>
  );
}
