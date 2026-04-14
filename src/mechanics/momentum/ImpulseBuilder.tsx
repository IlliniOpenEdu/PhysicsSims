import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ConceptBox } from '../../components/ConceptBox';
import { SliderWithInput } from '../../components/SliderWithInput';

type Phase = 'force' | 'coast';

type SimState = {
  x: number;
  v: number;
  phase: Phase;
  tForce: number;
};

type Controls = {
  massKg: number;
  v0: number;
  forceN: number;
  durationS: number;
};

type Readout = {
  forceN: number;
  timeAppliedS: number;
  impulseN: number;
  p0: number;
  p1: number;
  deltaP: number;
  v: number;
  x: number;
  phase: Phase;
  impulseDelivered: boolean;
};

const CANVAS_W = 960;
const CANVAS_H = 220;
const TRACK_Y = 132;
const BOX_W = 44;
const BOX_H = 30;
const DT_MAX = 1 / 30;
const VIEW_W_M = 12;
/** World line used for drawing only (no hard physics stop — motion is frictionless). */
const TRACK_DRAW_X0_M = 0;
const TRACK_DRAW_X1_M = 2000;
const PX_PER_M = (CANVAS_W - 56) / VIEW_W_M;

const MIN_MASS = 0.5;
const MAX_MASS = 20;
const MIN_V = -10;
const MAX_V = 10;
const MAX_FORCE = 50;
const MAX_DURATION = 5;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}

export function ImpulseBuilder() {
  const [massKg, setMassKg] = useState(4);
  const [v0, setV0] = useState(0);
  const [forceMagN, setForceMagN] = useState(20);
  const [durationS, setDurationS] = useState(1.5);
  const [runEpoch, setRunEpoch] = useState(0);

  const [readout, setReadout] = useState<Readout>({
    forceN: 0,
    timeAppliedS: 0,
    impulseN: 0,
    p0: 0,
    p1: 0,
    deltaP: 0,
    v: 0,
    x: 1.5,
    phase: 'force',
    impulseDelivered: false,
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const simRef = useRef<SimState>({
    x: 1.5,
    v: 0,
    phase: 'force',
    tForce: 0,
  });
  const p0Ref = useRef(0);
  const controlsRef = useRef<Controls>({
    massKg: 4,
    v0: 0,
    forceN: 20,
    durationS: 1.5,
  });
  const lastTsRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastUiRef = useRef(0);

  useEffect(() => {
    controlsRef.current = {
      massKg,
      v0,
      forceN: forceMagN,
      durationS,
    };
  }, [massKg, v0, forceMagN, durationS]);

  const resetSimulation = useCallback(() => {
    const c = controlsRef.current;
    const startInForce = c.durationS > 0;
    simRef.current = {
      x: 1.5,
      v: c.v0,
      phase: startInForce ? 'force' : 'coast',
      tForce: 0,
    };
    p0Ref.current = c.massKg * c.v0;
    lastTsRef.current = null;
  }, []);

  useEffect(() => {
    resetSimulation();
  }, [runEpoch, resetSimulation]);

  const drawScene = useCallback((ctx: CanvasRenderingContext2D, sim: SimState, c: Controls) => {
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    const bg = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    bg.addColorStop(0, 'rgba(2,6,23,0.95)');
    bg.addColorStop(1, 'rgba(15,23,42,0.95)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.strokeStyle = 'rgba(148,163,184,0.45)';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, CANVAS_W - 16, CANVAS_H - 16);

    /*
     * Camera: follow the box. Using boxX = 28 + (sim.x - camX) * PX_PER_M makes (sim.x - camX)
     * constant once camX > 0, so the box would freeze on screen while the track stayed fixed.
     * Instead: draw track + box in world x (meters), then translate by (28 - camX*PX_PER_M) so the
     * track scrolls under the box and motion stays visible for the whole run.
     */
    const camX = Math.max(0, sim.x - VIEW_W_M * 0.32);
    const boxY = TRACK_Y - BOX_H;
    const stripeStartM = Math.max(TRACK_DRAW_X0_M, Math.floor(camX - 2));
    const stripeEndM = Math.min(TRACK_DRAW_X1_M, Math.ceil(camX + VIEW_W_M + 4));

    ctx.save();
    ctx.beginPath();
    ctx.rect(28, 16, CANVAS_W - 56, CANVAS_H - 32);
    ctx.clip();

    ctx.translate(28 - camX * PX_PER_M, 0);

    for (let xm = stripeStartM; xm < stripeEndM; xm += 1) {
      const xw = xm * PX_PER_M;
      const stripe = xm % 2 === 0;
      ctx.fillStyle = stripe ? 'rgba(51,65,85,0.95)' : 'rgba(41,53,71,0.95)';
      ctx.fillRect(xw, TRACK_Y, PX_PER_M + 0.5, 8);
      ctx.fillStyle = stripe ? 'rgba(90,104,122,0.75)' : 'rgba(75,88,105,0.75)';
      ctx.fillRect(xw, TRACK_Y + 8, PX_PER_M + 0.5, 4);
      ctx.strokeStyle = 'rgba(148,163,184,0.22)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(xw, TRACK_Y);
      ctx.lineTo(xw, TRACK_Y + 12);
      ctx.stroke();
    }
    const vis0 = stripeStartM * PX_PER_M;
    const vis1 = stripeEndM * PX_PER_M;
    ctx.strokeStyle = 'rgba(148,163,184,0.35)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(vis0, TRACK_Y - 3);
    ctx.lineTo(vis1, TRACK_Y - 3);
    ctx.stroke();
    ctx.setLineDash([]);

    const boxXw = sim.x * PX_PER_M;
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(boxXw - BOX_W / 2, boxY, BOX_W, BOX_H);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(boxXw - BOX_W / 2, boxY, BOX_W, BOX_H);

    const forceActive = sim.phase === 'force' && sim.tForce < c.durationS - 1e-9;
    const showArrow = forceActive && Math.abs(c.forceN) > 1e-6;

    if (showArrow) {
      const dir = Math.sign(c.forceN) || 1;
      const arrowLen = clamp(Math.abs(c.forceN) * 2.2, 18, 130);
      const y = boxY - 22;
      const startX = boxXw;
      const endX = boxXw + dir * arrowLen;
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(endX, y);
      ctx.lineTo(endX - dir * 8, y - 5);
      ctx.lineTo(endX - dir * 8, y + 5);
      ctx.closePath();
      ctx.fillStyle = '#fbbf24';
      ctx.fill();
      ctx.fillStyle = '#fde68a';
      ctx.font = '11px ui-sans-serif, system-ui';
      ctx.fillText('F', endX + dir * 6, y + 4);
    }

    ctx.restore();

    const barY = CANVAS_H - 28;
    const barX = 32;
    const barW = CANVAS_W - 64;
    const barH = 8;
    ctx.fillStyle = 'rgba(30,41,59,0.95)';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.strokeStyle = 'rgba(148,163,184,0.5)';
    ctx.strokeRect(barX, barY, barW, barH);
    if (c.durationS > 1e-6) {
      const frac = clamp(sim.tForce / c.durationS, 0, 1);
      ctx.fillStyle = forceActive ? 'rgba(56,189,248,0.85)' : 'rgba(100,116,139,0.7)';
      ctx.fillRect(barX, barY, barW * frac, barH);
    }
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px ui-sans-serif, system-ui';
    ctx.textAlign = 'left';
    ctx.fillText('Force window: 0', barX, barY - 6);
    ctx.textAlign = 'right';
    ctx.fillText(`Δt = ${c.durationS.toFixed(2)} s`, barX + barW, barY - 6);
    ctx.textAlign = 'left';
  }, []);

  const stepPhysics = useCallback((dt: number) => {
    const sim = simRef.current;
    const c = controlsRef.current;

    if (sim.phase === 'force') {
      if (c.durationS <= 1e-9) {
        sim.phase = 'coast';
      } else if (sim.tForce >= c.durationS - 1e-9) {
        sim.phase = 'coast';
      } else {
        const a = c.forceN / c.massKg;
        const remaining = c.durationS - sim.tForce;
        const h = Math.min(dt, remaining);
        const v0 = sim.v;
        sim.v = v0 + a * h;
        sim.x += v0 * h + 0.5 * a * h * h;
        sim.tForce += h;
        if (sim.tForce >= c.durationS - 1e-9) {
          sim.phase = 'coast';
          sim.tForce = c.durationS;
        }
        return;
      }
    }

    sim.x += sim.v * dt;
  }, []);

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
      drawScene(ctx, simRef.current, controlsRef.current);
      rafRef.current = requestAnimationFrame(loop);
      return;
    }

    const dt = clamp((ts - lastTsRef.current) / 1000, 0, DT_MAX);
    lastTsRef.current = ts;
    stepPhysics(dt);
    drawScene(ctx, simRef.current, controlsRef.current);

    if (ts - lastUiRef.current > 50) {
      lastUiRef.current = ts;
      const sim = simRef.current;
      const c = controlsRef.current;
      const m = c.massKg;
      const p0 = p0Ref.current;
      const p1 = m * sim.v;
      const deltaP = p1 - p0;
      const impulse = c.forceN * c.durationS;
      const forceDisplay = sim.phase === 'force' && sim.tForce < c.durationS - 1e-9 ? c.forceN : 0;
      const tApplied = sim.phase === 'force' ? sim.tForce : c.durationS;
      const impulseDelivered = sim.phase === 'coast' || c.durationS <= 1e-9;

      setReadout({
        forceN: forceDisplay,
        timeAppliedS: tApplied,
        impulseN: impulse,
        p0,
        p1,
        deltaP,
        v: sim.v,
        x: sim.x,
        phase: sim.phase,
        impulseDelivered,
      });
    }

    rafRef.current = requestAnimationFrame(loop);
  }, [drawScene, stepPhysics]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [loop]);

  const impulseMatchesDelta =
    readout.impulseDelivered && Math.abs(readout.deltaP - readout.impulseN) < 0.05;

  const explanationItems = useMemo(
    () => [
      {
        title: 'Impulse as force × time',
        description:
          'When a constant net force F acts for a time interval Δt, the impulse J = FΔt is the momentum transferred to the object along that line of action.',
      },
      {
        title: 'Impulse and momentum change',
        description:
          'For straight-line motion with no other horizontal forces, Δp = J. That is the same as mΔv because J = ∫F dt and F is the only contributor to horizontal acceleration here.',
      },
      {
        title: 'Why duration matters',
        description:
          'Doubling Δt with the same F doubles the impulse and (for constant mass) doubles the change in velocity. Magnitude and how long the push lasts both matter.',
      },
      {
        title: 'From impulse to collisions',
        description:
          'Contact forces in a collision also transfer momentum through impulses. Understanding F and Δt here sets up how we analyze momentum change in collision problems next.',
      },
    ],
    [],
  );

  return (
    <div id="impulse_builder_01" className="mx-auto flex min-h-screen max-w-[90rem] flex-col px-4 py-8 text-slate-100">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">Mechanics · Momentum</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">Impulse Builder</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">
            Apply a constant horizontal force on a frictionless track for a set time. Watch how impulse J = FΔt matches the change in momentum Δp.
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
              <canvas
                ref={canvasRef}
                width={CANVAS_W}
                height={CANVAS_H}
                className="block h-auto w-full rounded-lg bg-slate-950/70"
              />
            </div>

            <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-xs text-slate-200">
              <p className="font-semibold text-slate-100">Impulse &amp; momentum</p>
              <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                <p>
                  <span className="text-slate-400">F (applied now):</span>{' '}
                  <span className="text-sky-200">{round2(readout.forceN)} N</span>
                </p>
                <p>
                  <span className="text-slate-400">Time in force phase:</span>{' '}
                  <span className="text-sky-200">{round3(readout.timeAppliedS)} s</span>
                </p>
                <p>
                  <span className="text-slate-400">J = F·Δt (set):</span>{' '}
                  <span className="font-medium text-amber-200">{round2(readout.impulseN)} N·s</span>
                </p>
                <p>
                  <span className="text-slate-400">p₀:</span>{' '}
                  <span className="text-slate-100">{round2(readout.p0)} kg·m/s</span>
                </p>
                <p>
                  <span className="text-slate-400">p₁:</span>{' '}
                  <span className="text-slate-100">{round2(readout.p1)} kg·m/s</span>
                </p>
                <p>
                  <span className="text-slate-400">v (now):</span>{' '}
                  <span className="text-emerald-200">{round2(readout.v)} m/s</span>
                </p>
                <p>
                  <span className="text-slate-400">x (now):</span>{' '}
                  <span className="text-slate-300">{round2(readout.x)} m</span>
                </p>
                <p
                  className={`rounded-md border px-2 py-1 sm:col-span-2 ${
                    impulseMatchesDelta
                      ? 'border-amber-400/70 bg-amber-500/10 text-amber-100'
                      : 'border-slate-700 bg-slate-900/50'
                  }`}
                >
                  <span className="text-slate-400">Δp = p₁ − p₀:</span>{' '}
                  <span className="font-semibold">{round2(readout.deltaP)} kg·m/s</span>
                  {impulseMatchesDelta && (
                    <span className="ml-2 text-[0.7rem] text-amber-200/95">— matches J = F·Δt</span>
                  )}
                </p>
              </div>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
              <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-sky-300">Object</p>
              <div className="mt-2 space-y-2">
                <SliderWithInput
                  label="Mass"
                  queryKey="impulse-mass"
                  units="kg"
                  min={MIN_MASS}
                  max={MAX_MASS}
                  step={0.1}
                  value={massKg}
                  onChange={(value) => setMassKg(clamp(value, MIN_MASS, MAX_MASS))}
                />
                <SliderWithInput
                  label="Initial velocity"
                  queryKey="impulse-v0"
                  units="m/s"
                  min={MIN_V}
                  max={MAX_V}
                  step={0.1}
                  value={v0}
                  onChange={(value) => setV0(clamp(value, MIN_V, MAX_V))}
                />
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
              <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-sky-300">Force</p>
              <div className="mt-2 space-y-2">
                <SliderWithInput
                  label="Force (+x only)"
                  queryKey="impulse-force-mag"
                  units="N"
                  min={0}
                  max={MAX_FORCE}
                  step={0.5}
                  value={forceMagN}
                  onChange={(value) => setForceMagN(clamp(value, 0, MAX_FORCE))}
                />
                <p className="text-[0.65rem] text-slate-500">Applied force points to the right only.</p>
                <SliderWithInput
                  label="Time force is applied"
                  queryKey="impulse-duration"
                  units="s"
                  min={0}
                  max={MAX_DURATION}
                  step={0.05}
                  value={durationS}
                  onChange={(value) => setDurationS(clamp(value, 0, MAX_DURATION))}
                />
                <p className="text-[0.65rem] leading-snug text-slate-500">
                  Only how long <span className="text-slate-400">F</span> acts. After that, coast at constant v (frictionless — stripes scroll so you can see it).
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
              <button
                type="button"
                onClick={() => setRunEpoch((n) => n + 1)}
                className="w-full rounded-full border border-slate-700 px-3 py-1.5 text-xs font-semibold transition hover:border-sky-500 hover:text-sky-200"
              >
                Reset simulation
              </button>
              <p className="mt-2 text-[0.65rem] text-slate-500">
                Phase: {readout.phase === 'force' ? 'Force active' : 'Coast (constant v)'}
              </p>
            </div>
          </aside>
        </div>
      </main>

      <ConceptBox className="mt-8" heading="Explanation" items={explanationItems} />
    </div>
  );
}
