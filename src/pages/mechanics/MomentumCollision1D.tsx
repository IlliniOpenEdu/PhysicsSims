import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ConceptBox } from '../../components/ConceptBox';
import { SliderWithInput } from '../../components/SliderWithInput';

type CollisionType = 'elastic' | 'inelastic';

type Body = {
  x: number;
  v: number;
  m: number;
  color: string;
  label: string;
};

type SimState = {
  a: Body;
  b: Body;
  collided: boolean;
  stuck: boolean;
  impulseTimer: number;
  wasOverlapping: boolean;
};

type Snapshot = {
  v1: number;
  v2: number;
  p1: number;
  p2: number;
  pTotal: number;
  collisionType: CollisionType;
  collisionDone: boolean;
};

const CANVAS_W = 960;
const CANVAS_H = 220;
const TRACK_Y = 132;
const BOX_H = 30;
const BOX_W = 34;
const DT_MAX = 1 / 30;

const MIN_MASS = 0.5;
const MAX_MASS = 20;
const MIN_V = -10;
const MAX_V = 10;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function elastic1D(m1: number, m2: number, v1: number, v2: number) {
  const v1f = ((m1 - m2) / (m1 + m2)) * v1 + ((2 * m2) / (m1 + m2)) * v2;
  const v2f = ((2 * m1) / (m1 + m2)) * v1 + ((m2 - m1) / (m1 + m2)) * v2;
  return { v1f, v2f };
}

function inelastic1D(m1: number, m2: number, v1: number, v2: number) {
  return (m1 * v1 + m2 * v2) / (m1 + m2);
}

function createInitialState(m1: number, m2: number, v1: number, v2: number): SimState {
  return {
    a: { x: CANVAS_W / 3, v: v1, m: m1, color: '#38bdf8', label: 'A' },
    b: { x: (2 * CANVAS_W) / 3, v: v2, m: m2, color: '#22c55e', label: 'B' },
    collided: false,
    stuck: false,
    impulseTimer: 0,
    wasOverlapping: false,
  };
}

export function MomentumCollision1D() {
  const [m1, setM1] = useState(4);
  const [v1Init, setV1Init] = useState(4);
  const [m2, setM2] = useState(6);
  const [v2Init, setV2Init] = useState(-2);
  const [collisionType, setCollisionType] = useState<CollisionType>('elastic');
  const [runEpoch, setRunEpoch] = useState(0);
  const [ui, setUi] = useState<Snapshot>({
    v1: v1Init,
    v2: v2Init,
    p1: m1 * v1Init,
    p2: m2 * v2Init,
    pTotal: m1 * v1Init + m2 * v2Init,
    collisionType,
    collisionDone: false,
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const simRef = useRef<SimState>(createInitialState(m1, m2, v1Init, v2Init));
  const lastTsRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastUiUpdateRef = useRef(0);
  const pxPerMeterRef = useRef(26);

  const resetSimulation = useCallback(() => {
    simRef.current = createInitialState(m1, m2, v1Init, v2Init);
    setUi({
      v1: v1Init,
      v2: v2Init,
      p1: m1 * v1Init,
      p2: m2 * v2Init,
      pTotal: m1 * v1Init + m2 * v2Init,
      collisionType,
      collisionDone: false,
    });
    lastTsRef.current = null;
  }, [collisionType, m1, m2, v1Init, v2Init]);

  useEffect(() => {
    resetSimulation();
  }, [runEpoch, resetSimulation]);

  const drawScene = useCallback((ctx: CanvasRenderingContext2D, sim: SimState) => {
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    const bg = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    bg.addColorStop(0, 'rgba(2,6,23,0.95)');
    bg.addColorStop(1, 'rgba(15,23,42,0.95)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.strokeStyle = 'rgba(148,163,184,0.45)';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, CANVAS_W - 16, CANVAS_H - 16);

    ctx.fillStyle = 'rgba(51,65,85,0.9)';
    ctx.fillRect(26, TRACK_Y, CANVAS_W - 52, 8);
    ctx.fillStyle = 'rgba(100,116,139,0.7)';
    ctx.fillRect(26, TRACK_Y + 8, CANVAS_W - 52, 4);

    const boxY = TRACK_Y - BOX_H;
    const drawBody = (body: Body) => {
      const xLeft = body.x - BOX_W / 2;
      const boxWMass = BOX_W + body.m * 0.9;
      ctx.fillStyle = body.color;
      ctx.fillRect(xLeft, boxY, boxWMass, BOX_H);
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(xLeft, boxY, boxWMass, BOX_H);

      ctx.fillStyle = '#e2e8f0';
      ctx.font = '12px ui-sans-serif, system-ui';
      ctx.fillText(`${body.label}: ${body.m.toFixed(1)} kg`, xLeft + 4, boxY - 8);

      const arrowScale = 14;
      const arrowLen = clamp(Math.abs(body.v) * arrowScale, 0, 120);
      if (arrowLen > 3) {
        const dir = Math.sign(body.v) || 1;
        const startX = xLeft + boxWMass / 2;
        const endX = startX + dir * arrowLen;
        const y = boxY - 18;
        ctx.beginPath();
        ctx.moveTo(startX, y);
        ctx.lineTo(endX, y);
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(endX, y);
        ctx.lineTo(endX - dir * 7, y - 5);
        ctx.lineTo(endX - dir * 7, y + 5);
        ctx.closePath();
        ctx.fillStyle = '#fbbf24';
        ctx.fill();
      }
    };

    drawBody(sim.a);
    drawBody(sim.b);

    if (sim.impulseTimer > 0) {
      const mid = (sim.a.x + sim.b.x) * 0.5;
      ctx.beginPath();
      ctx.arc(mid, TRACK_Y - 14, 10, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(248,113,113,0.7)';
      ctx.fill();
      ctx.strokeStyle = '#fecaca';
      ctx.stroke();
    }
  }, []);

  const stepPhysics = useCallback((dt: number) => {
    const sim = simRef.current;
    const pxPerMeter = pxPerMeterRef.current;

    sim.a.x += sim.a.v * pxPerMeter * dt;
    sim.b.x += sim.b.v * pxPerMeter * dt;
    sim.impulseTimer = Math.max(0, sim.impulseTimer - dt);

    const aWidth = BOX_W + sim.a.m * 0.9;
    const bWidth = BOX_W + sim.b.m * 0.9;
    const leftLimit = 28;
    const rightLimit = CANVAS_W - 28;

    if (sim.a.x - aWidth / 2 < leftLimit) {
      sim.a.x = leftLimit + aWidth / 2;
      sim.a.v *= -1;
    }
    if (sim.a.x + aWidth / 2 > rightLimit) {
      sim.a.x = rightLimit - aWidth / 2;
      sim.a.v *= -1;
    }
    if (sim.b.x - bWidth / 2 < leftLimit) {
      sim.b.x = leftLimit + bWidth / 2;
      sim.b.v *= -1;
    }
    if (sim.b.x + bWidth / 2 > rightLimit) {
      sim.b.x = rightLimit - bWidth / 2;
      sim.b.v *= -1;
    }

    const aRight = sim.a.x + aWidth / 2;
    const bLeft = sim.b.x - bWidth / 2;
    const overlapping = aRight >= bLeft;
    const approaching = sim.a.v > sim.b.v;

    const enteringContact = overlapping && !sim.wasOverlapping;

    if (enteringContact && approaching) {
      const mA = sim.a.m;
      const mB = sim.b.m;
      const vA = sim.a.v;
      const vB = sim.b.v;
      if (collisionType === 'elastic') {
        const { v1f, v2f } = elastic1D(mA, mB, vA, vB);
        sim.a.v = v1f;
        sim.b.v = v2f;
      } else {
        const vTogether = inelastic1D(mA, mB, vA, vB);
        sim.a.v = vTogether;
        sim.b.v = vTogether;
        sim.stuck = true;
      }
      sim.collided = true;
      sim.impulseTimer = 0.18;

      const contactMid = (aRight + bLeft) * 0.5;
      sim.a.x = contactMid - aWidth / 2;
      sim.b.x = contactMid + bWidth / 2;
    }

    if (sim.stuck) {
      const desiredGap = (aWidth + bWidth) / 2;
      sim.b.x = sim.a.x + desiredGap;
    }

    sim.wasOverlapping = overlapping;
  }, [collisionType]);

  const loop = useCallback((ts: number) => {
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
      drawScene(ctx, simRef.current);
      rafRef.current = requestAnimationFrame(loop);
      return;
    }

    const dt = clamp((ts - lastTsRef.current) / 1000, 0, DT_MAX);
    lastTsRef.current = ts;
    stepPhysics(dt);
    drawScene(ctx, simRef.current);

    if (ts - lastUiUpdateRef.current > 50) {
      lastUiUpdateRef.current = ts;
      const sim = simRef.current;
      const p1 = sim.a.m * sim.a.v;
      const p2 = sim.b.m * sim.b.v;
      setUi({
        v1: sim.a.v,
        v2: sim.b.v,
        p1,
        p2,
        pTotal: p1 + p2,
        collisionType,
        collisionDone: sim.collided,
      });
    }

    rafRef.current = requestAnimationFrame(loop);
  }, [collisionType, drawScene, stepPhysics]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [loop]);

  const totalAbsMomentum = Math.max(1, Math.abs(ui.p1) + Math.abs(ui.p2));
  const p1Bar = (Math.abs(ui.p1) / totalAbsMomentum) * 100;
  const p2Bar = (Math.abs(ui.p2) / totalAbsMomentum) * 100;

  const explanationItems = useMemo(
    () => [
      {
        title: 'Conservation of Momentum',
        description:
          'For a closed frictionless system in 1D, total momentum p_total = m1v1 + m2v2 stays constant during collision.',
      },
      {
        title: 'Mass Controls Velocity Change',
        description:
          'Larger mass means more resistance to velocity change. In collisions, lighter objects often undergo bigger speed changes.',
      },
      {
        title: 'Elastic vs Inelastic',
        description:
          'Elastic collisions conserve both momentum and kinetic energy. Inelastic collisions still conserve momentum, but some kinetic energy transforms into internal energy.',
      },
      {
        title: 'Why p_total Stays Constant',
        description:
          'During contact, boxes exert equal and opposite internal forces. With no external horizontal force, these internal impulses cancel for the system total.',
      },
    ],
    []
  );

  return (
    <div className="mx-auto flex min-h-screen max-w-[90rem] flex-col px-4 py-8 text-slate-100">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">Mechanics · Momentum</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
            1D Momentum Collision Simulator
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">
            Two boxes move on a frictionless track. Compare elastic and inelastic collisions while tracking momentum before and after interaction.
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
        <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,24rem)] lg:items-start">
          <div className="min-w-0">
            <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-950/60 p-2">
              <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} className="block h-auto w-full rounded-lg bg-slate-950/70" />
            </div>

            <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-xs text-slate-200">
              <p className="font-semibold text-slate-100">Momentum Readout</p>
              <div className="mt-2 grid gap-1 sm:grid-cols-3">
                <p>p₁ = {round2(ui.p1)} kg·m/s</p>
                <p>p₂ = {round2(ui.p2)} kg·m/s</p>
                <p className="font-semibold text-sky-300">p_total = {round2(ui.pTotal)} kg·m/s</p>
              </div>
              <div className="mt-2 space-y-2">
                <div>
                  <p className="mb-1 text-[0.7rem] text-slate-400">|p₁|</p>
                  <div className="h-2 w-full rounded bg-slate-800">
                    <div className="h-2 rounded bg-sky-400" style={{ width: `${p1Bar}%` }} />
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-[0.7rem] text-slate-400">|p₂|</p>
                  <div className="h-2 w-full rounded bg-slate-800">
                    <div className="h-2 rounded bg-emerald-400" style={{ width: `${p2Bar}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
              <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-sky-300">Box A</p>
              <div className="mt-2 space-y-2">
                <SliderWithInput
                  label="Mass A"
                  queryKey="mom1d-mass-a"
                  units="kg"
                  min={MIN_MASS}
                  max={MAX_MASS}
                  step={0.1}
                  value={m1}
                  onChange={(value) => setM1(clamp(value, MIN_MASS, MAX_MASS))}
                />
                <SliderWithInput
                  label="Initial velocity A"
                  queryKey="mom1d-vel-a"
                  units="m/s"
                  min={MIN_V}
                  max={MAX_V}
                  step={0.1}
                  value={v1Init}
                  onChange={(value) => setV1Init(clamp(value, MIN_V, MAX_V))}
                />
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
              <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-sky-300">Box B</p>
              <div className="mt-2 space-y-2">
                <SliderWithInput
                  label="Mass B"
                  queryKey="mom1d-mass-b"
                  units="kg"
                  min={MIN_MASS}
                  max={MAX_MASS}
                  step={0.1}
                  value={m2}
                  onChange={(value) => setM2(clamp(value, MIN_MASS, MAX_MASS))}
                />
                <SliderWithInput
                  label="Initial velocity B"
                  queryKey="mom1d-vel-b"
                  units="m/s"
                  min={MIN_V}
                  max={MAX_V}
                  step={0.1}
                  value={v2Init}
                  onChange={(value) => setV2Init(clamp(value, MIN_V, MAX_V))}
                />
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
              <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-sky-300">Simulation Settings</p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setCollisionType('elastic')}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    collisionType === 'elastic' ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  Elastic
                </button>
                <button
                  type="button"
                  onClick={() => setCollisionType('inelastic')}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    collisionType === 'inelastic' ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  Inelastic
                </button>
              </div>
              <button
                type="button"
                onClick={() => setRunEpoch((n) => n + 1)}
                className="mt-3 rounded-full border border-slate-700 px-3 py-1.5 text-xs font-semibold transition hover:border-sky-500 hover:text-sky-200"
              >
                Reset simulation
              </button>
              <div className="mt-3 text-[0.7rem] text-slate-400">
                <p>v₁ = {round2(ui.v1)} m/s</p>
                <p>v₂ = {round2(ui.v2)} m/s</p>
                <p>Mode: {ui.collisionType === 'elastic' ? 'Elastic' : 'Inelastic'}</p>
                <p>Collision: {ui.collisionDone ? 'Occurred' : 'Not yet'}</p>
              </div>
            </div>
          </aside>
        </div>
      </main>

      <ConceptBox className="mt-8" heading="Explanation" items={explanationItems} />
    </div>
  );
}
