// id="fluid_flow_explorer"
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { SliderWithInput } from '../../../components/SliderWithInput';
import { ConceptBox } from '../../../components/ConceptBox';

type FlowParticle = {
  x: number;
  y: number;
  id: number;
};

type DataSnapshot = {
  area1M2: number;
  area2M2: number;
  velocity1Mps: number;
  velocity2Mps: number;
  flowRate1: number;
  flowRate2: number;
  simTime: number;
};

type HighlightKey = 'A1' | 'A2' | 'v1' | 'v2' | null;
type GraphMode = 'velocity' | 'area';

const PIPE_LENGTH_M = 8;
const TAPER_START_FRAC = 0.32;
const TAPER_END_FRAC = 0.68;

const MIN_RADIUS_M = 0.1;
const MAX_RADIUS_M = 2;
const MIN_V1_MPS = 0.1;
const MAX_V1_MPS = 20;

const CANVAS_W = 760;
const CANVAS_H = 400;
const PIPE_PAD = { left: 48, right: 48, top: 48, bottom: 48 };
const INNER_W_PX = CANVAS_W - PIPE_PAD.left - PIPE_PAD.right;
const INNER_H_PX = CANVAS_H - PIPE_PAD.top - PIPE_PAD.bottom;
const CENTER_Y_PX = PIPE_PAD.top + INNER_H_PX / 2;

const NUM_PARTICLES = 48;
const NUM_STREAMLINES = 7;
const UI_PUSH_MS = 100;
const MAX_SIM_DT_S = 1 / 45;
const HIGHLIGHT_MS = 650;

const CHART_W = 360;
const CHART_H = 170;
const CHART_PAD = { top: 18, right: 14, bottom: 28, left: 46 };
const PROFILE_SAMPLES = 80;

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

function velocityAtXM(x: number, r1: number, r2: number, v1: number): number {
  const r = radiusAtXM(x, r1, r2);
  const a1 = areaFromRadiusM(r1);
  const ax = areaFromRadiusM(r);
  return ax > 0 ? (a1 * v1) / ax : v1;
}

function xMetersToCanvasX(xM: number): number {
  return PIPE_PAD.left + (xM / PIPE_LENGTH_M) * INNER_W_PX;
}

function canvasYMeters(yM: number): number {
  return CENTER_Y_PX - (yM / (MAX_RADIUS_M * 1.05)) * (INNER_H_PX * 0.44);
}

function formatNum(n: number, digits = 3): string {
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 1000 || (Math.abs(n) > 0 && Math.abs(n) < 0.01)) {
    return n.toExponential(digits);
  }
  return n.toFixed(Math.abs(n) < 10 ? 2 : 1);
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

function spawnParticle(id: number, r1: number): FlowParticle {
  const r = radiusAtXM(0, r1, r1);
  const y = (Math.random() * 2 - 1) * r * 0.82;
  return { id, x: -0.05 - Math.random() * 0.4, y };
}

function createParticles(r1: number): FlowParticle[] {
  return Array.from({ length: NUM_PARTICLES }, (_, i) => spawnParticle(i, r1));
}

export function FluidFlowExplorer() {
  const [entranceRadiusM, setEntranceRadiusM] = useState(0.75);
  const [exitRadiusM, setExitRadiusM] = useState(0.35);
  const [entranceVelocityMps, setEntranceVelocityMps] = useState(2.5);
  const [isRunning, setIsRunning] = useState(true);
  const [graphMode, setGraphMode] = useState<GraphMode>('velocity');
  const [highlight, setHighlight] = useState<HighlightKey>(null);
  const [snapshot, setSnapshot] = useState<DataSnapshot>(() => {
    const a1 = areaFromRadiusM(0.75);
    const a2 = areaFromRadiusM(0.35);
    const v1 = 2.5;
    const v2 = (a1 * v1) / a2;
    const q = a1 * v1;
    return {
      area1M2: a1,
      area2M2: a2,
      velocity1Mps: v1,
      velocity2Mps: v2,
      flowRate1: q,
      flowRate2: q,
      simTime: 0,
    };
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const profilePathRef = useRef<SVGPathElement>(null);
  const particlesRef = useRef<FlowParticle[]>(createParticles(0.75));
  const r1Ref = useRef(0.75);
  const r2Ref = useRef(0.35);
  const v1Ref = useRef(2.5);
  const runningRef = useRef(true);
  const simTimeRef = useRef(0);
  const lastFrameRef = useRef(0);
  const lastUiPushRef = useRef(0);
  const rafRef = useRef(0);
  const streamPhaseRef = useRef(0);
  const highlightTimerRef = useRef<number | null>(null);

  const flashHighlight = useCallback((key: HighlightKey) => {
    setHighlight(key);
    if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = window.setTimeout(() => setHighlight(null), HIGHLIGHT_MS);
  }, []);

  useEffect(() => {
    runningRef.current = isRunning;
  }, [isRunning]);

  useEffect(() => {
    r1Ref.current = entranceRadiusM;
    flashHighlight('A1');
  }, [entranceRadiusM, flashHighlight]);

  useEffect(() => {
    r2Ref.current = exitRadiusM;
    flashHighlight('A2');
  }, [exitRadiusM, flashHighlight]);

  useEffect(() => {
    v1Ref.current = entranceVelocityMps;
    flashHighlight('v1');
  }, [entranceVelocityMps, flashHighlight]);

  const computeSnapshot = useCallback((): DataSnapshot => {
    const r1 = r1Ref.current;
    const r2 = r2Ref.current;
    const v1 = v1Ref.current;
    const a1 = areaFromRadiusM(r1);
    const a2 = areaFromRadiusM(r2);
    const v2 = a2 > 0 ? (a1 * v1) / a2 : 0;
    const q = a1 * v1;
    return {
      area1M2: a1,
      area2M2: a2,
      velocity1Mps: v1,
      velocity2Mps: v2,
      flowRate1: q,
      flowRate2: a2 * v2,
      simTime: simTimeRef.current,
    };
  }, []);

  const updateProfileGraph = useCallback((r1: number, r2: number, v1: number, mode: GraphMode) => {
    const path = profilePathRef.current;
    if (!path) return;

    if (mode === 'velocity') {
      const vals = Array.from({ length: PROFILE_SAMPLES + 1 }, (_, i) => {
        const x = (i / PROFILE_SAMPLES) * PIPE_LENGTH_M;
        return velocityAtXM(x, r1, r2, v1);
      });
      const yMin = 0;
      const yMax = Math.max(...vals, v1, velocityAtXM(PIPE_LENGTH_M, r1, r2, v1)) * 1.12;
      path.setAttribute(
        'd',
        profilePathD(
          (x) => velocityAtXM(x, r1, r2, v1),
          0,
          PIPE_LENGTH_M,
          yMin,
          yMax,
        ),
      );
    } else {
      const vals = Array.from({ length: PROFILE_SAMPLES + 1 }, (_, i) => {
        const x = (i / PROFILE_SAMPLES) * PIPE_LENGTH_M;
        return areaFromRadiusM(radiusAtXM(x, r1, r2));
      });
      const yMin = 0;
      const yMax = Math.max(...vals) * 1.12;
      path.setAttribute(
        'd',
        profilePathD(
          (x) => areaFromRadiusM(radiusAtXM(x, r1, r2)),
          0,
          PIPE_LENGTH_M,
          yMin,
          yMax,
        ),
      );
    }
  }, []);

  const drawScene = useCallback(
    (particles: FlowParticle[], r1: number, r2: number, v1: number, streamPhase: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

      ctx.fillStyle = 'rgba(15, 23, 42, 0.6)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      const wallPts = 120;
      const upperWall: Array<{ x: number; y: number }> = [];
      const lowerWall: Array<{ x: number; y: number }> = [];
      for (let i = 0; i <= wallPts; i++) {
        const xm = (i / wallPts) * PIPE_LENGTH_M;
        const r = radiusAtXM(xm, r1, r2);
        const cx = xMetersToCanvasX(xm);
        upperWall.push({ x: cx, y: canvasYMeters(r) });
        lowerWall.push({ x: cx, y: canvasYMeters(-r) });
      }

      ctx.beginPath();
      ctx.moveTo(upperWall[0].x, upperWall[0].y);
      for (let i = 1; i < upperWall.length; i++) ctx.lineTo(upperWall[i].x, upperWall[i].y);
      for (let i = lowerWall.length - 1; i >= 0; i--) ctx.lineTo(lowerWall[i].x, lowerWall[i].y);
      ctx.closePath();
      const waterGrad = ctx.createLinearGradient(PIPE_PAD.left, 0, CANVAS_W - PIPE_PAD.right, 0);
      waterGrad.addColorStop(0, 'rgba(14, 165, 233, 0.22)');
      waterGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.28)');
      waterGrad.addColorStop(1, 'rgba(14, 165, 233, 0.22)');
      ctx.fillStyle = waterGrad;
      ctx.fill();

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

      ctx.save();
      ctx.strokeStyle = 'rgba(125, 211, 252, 0.45)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([10, 14]);
      ctx.lineDashOffset = -streamPhase * 40;
      for (let s = 0; s < NUM_STREAMLINES; s++) {
        const frac = (s + 1) / (NUM_STREAMLINES + 1);
        const yOff = (frac * 2 - 1) * r1 * 0.75;
        ctx.beginPath();
        let started = false;
        for (let i = 0; i <= wallPts; i++) {
          const xm = (i / wallPts) * PIPE_LENGTH_M;
          const r = radiusAtXM(xm, r1, r2);
          if (Math.abs(yOff) > r * 0.92) continue;
          const cx = xMetersToCanvasX(xm);
          const cy = canvasYMeters(yOff * (r / r1));
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

      const v2 = velocityAtXM(PIPE_LENGTH_M, r1, r2, v1);
      const maxV = Math.max(v1, v2, 0.5);
      for (const p of particles) {
        const vLocal = velocityAtXM(p.x, r1, r2, v1);
        const cx = xMetersToCanvasX(p.x);
        const cy = canvasYMeters(p.y);
        const speedT = clamp(vLocal / maxV, 0, 1);
        const hue = 195 - speedT * 55;
        const pr = Math.max(3, 2.5 + speedT * 2.5);
        ctx.beginPath();
        ctx.fillStyle = `hsla(${hue}, 88%, 62%, 0.9)`;
        ctx.arc(cx, cy, pr, 0, Math.PI * 2);
        ctx.fill();
        const arrowLen = pr * (1.2 + speedT);
        ctx.strokeStyle = `hsla(${hue}, 90%, 75%, 0.5)`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + arrowLen, cy);
        ctx.stroke();
      }

      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px ui-sans-serif, system-ui';
      ctx.fillText('Entrance', PIPE_PAD.left, PIPE_PAD.top - 12);
      ctx.fillText('Exit', CANVAS_W - PIPE_PAD.right - 28, PIPE_PAD.top - 12);
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(`v₁ = ${formatNum(v1)} m/s`, PIPE_PAD.left, CANVAS_H - 14);
      ctx.fillText(`v₂ = ${formatNum(v2)} m/s`, CANVAS_W - PIPE_PAD.right - 72, CANVAS_H - 14);
    },
    [],
  );

  const stepParticles = useCallback((dt: number, r1: number, r2: number, v1: number) => {
    for (const p of particlesRef.current) {
      const vLocal = velocityAtXM(p.x, r1, r2, v1);
      p.x += vLocal * dt;
      const rLocal = radiusAtXM(p.x, r1, r2);
      const limit = rLocal * 0.88;
      if (Math.abs(p.y) > limit) {
        p.y = Math.sign(p.y) * limit;
      }
      if (p.x > PIPE_LENGTH_M + 0.2) {
        const spawned = spawnParticle(p.id, r1);
        p.x = spawned.x;
        p.y = spawned.y;
      }
    }
  }, []);

  const handleReset = () => {
    particlesRef.current = createParticles(r1Ref.current);
    simTimeRef.current = 0;
    streamPhaseRef.current = 0;
    setSnapshot(computeSnapshot());
    updateProfileGraph(r1Ref.current, r2Ref.current, v1Ref.current, graphMode);
  };

  useEffect(() => {
    const tick = (now: number) => {
      rafRef.current = requestAnimationFrame(tick);
      if (!lastFrameRef.current) lastFrameRef.current = now;
      const dt = clamp((now - lastFrameRef.current) / 1000, 0, MAX_SIM_DT_S);
      lastFrameRef.current = now;

      if (runningRef.current && dt > 0) {
        stepParticles(dt, r1Ref.current, r2Ref.current, v1Ref.current);
        simTimeRef.current += dt;
        streamPhaseRef.current += dt;
      }

      drawScene(
        particlesRef.current,
        r1Ref.current,
        r2Ref.current,
        v1Ref.current,
        streamPhaseRef.current,
      );

      if (now - lastUiPushRef.current >= UI_PUSH_MS) {
        lastUiPushRef.current = now;
        const snap = computeSnapshot();
        setSnapshot(snap);
        updateProfileGraph(r1Ref.current, r2Ref.current, v1Ref.current, graphMode);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [computeSnapshot, drawScene, flashHighlight, graphMode, stepParticles, updateProfileGraph]);

  useEffect(() => {
    updateProfileGraph(r1Ref.current, r2Ref.current, v1Ref.current, graphMode);
  }, [graphMode, entranceRadiusM, exitRadiusM, entranceVelocityMps, updateProfileGraph]);

  const hl = (key: HighlightKey) =>
    highlight === key
      ? 'text-amber-300 scale-110 inline-block transition-transform'
      : 'text-sky-300';

  return (
    <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col overflow-hidden px-4 py-8">
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-70">
        <div className="absolute -left-32 top-0 h-72 w-72 rounded-full bg-sky-700/25 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-cyan-600/20 blur-3xl" />
      </div>

      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">
          Mechanics · Pressure
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Fluid Flow Explorer</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">
          Water flows through a pipe that changes width. Watch particles speed up in narrow sections
          and slow down in wide ones — the continuity equation{' '}
          <span className="text-sky-300">A₁v₁ = A₂v₂</span> keeps flow rate constant.
        </p>
        <Link
          to="/dashboard"
          className="mt-3 inline-block text-sm text-cyan-400/90 hover:text-cyan-300"
        >
          ← Dashboard
        </Link>
      </header>

      <div className="mb-4 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl">
        <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} className="block w-full" />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Controls</h2>

          <SliderWithInput
            label="Entrance radius"
            min={MIN_RADIUS_M}
            max={MAX_RADIUS_M}
            step={0.05}
            value={entranceRadiusM}
            onChange={setEntranceRadiusM}
            units="m"
            description="Wider entrance → larger cross-sectional area A₁."
          />
          <SliderWithInput
            label="Exit radius"
            min={MIN_RADIUS_M}
            max={MAX_RADIUS_M}
            step={0.05}
            value={exitRadiusM}
            onChange={setExitRadiusM}
            units="m"
            description="Narrower exit → faster fluid (higher v₂) at the same flow rate."
          />
          <SliderWithInput
            label="Entrance velocity"
            min={MIN_V1_MPS}
            max={MAX_V1_MPS}
            step={0.1}
            value={entranceVelocityMps}
            onChange={setEntranceVelocityMps}
            units="m/s"
            description="Inlet speed v₁ — local speed elsewhere follows A₁v₁ = A(x)v(x)."
          />

          <div className="flex flex-wrap gap-2">
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
              Live equation
            </h2>
            <p className="text-center text-2xl font-semibold text-white sm:text-3xl">
              <span className={hl('A1')}>A₁</span>
              <span className={hl('v1')}>v₁</span>
              <span className="text-slate-400"> = </span>
              <span className={hl('A2')}>A₂</span>
              <span className={hl('v2')}>v₂</span>
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-slate-800/60 p-2">
                <span className="text-slate-400">A₁</span>
                <p className="font-mono text-cyan-200">{formatNum(snapshot.area1M2)} m²</p>
              </div>
              <div className="rounded-lg bg-slate-800/60 p-2">
                <span className="text-slate-400">v₁</span>
                <p className="font-mono text-cyan-200">{formatNum(snapshot.velocity1Mps)} m/s</p>
              </div>
              <div className="rounded-lg bg-slate-800/60 p-2">
                <span className="text-slate-400">A₂</span>
                <p className="font-mono text-cyan-200">{formatNum(snapshot.area2M2)} m²</p>
              </div>
              <div className="rounded-lg bg-slate-800/60 p-2">
                <span className="text-slate-400">v₂</span>
                <p className="font-mono text-cyan-200">{formatNum(snapshot.velocity2Mps)} m/s</p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
              Flow data
            </h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-slate-400">Area 1 (A₁)</dt>
              <dd className="font-mono text-right text-white">{formatNum(snapshot.area1M2)} m²</dd>
              <dt className="text-slate-400">Area 2 (A₂)</dt>
              <dd className="font-mono text-right text-white">{formatNum(snapshot.area2M2)} m²</dd>
              <dt className="text-slate-400">Velocity 1 (v₁)</dt>
              <dd className="font-mono text-right text-white">
                {formatNum(snapshot.velocity1Mps)} m/s
              </dd>
              <dt className="text-slate-400">Velocity 2 (v₂)</dt>
              <dd className="font-mono text-right text-white">
                {formatNum(snapshot.velocity2Mps)} m/s
              </dd>
              <dt className="text-slate-400">Flow rate (Q)</dt>
              <dd className="font-mono text-right text-emerald-300">
                {formatNum(snapshot.flowRate1)} m³/s
              </dd>
              <dt className="text-slate-400">A₁v₁</dt>
              <dd className="font-mono text-right text-emerald-300">
                {formatNum(snapshot.flowRate1)} m³/s
              </dd>
              <dt className="text-slate-400">A₂v₂</dt>
              <dd className="font-mono text-right text-emerald-300">
                {formatNum(snapshot.flowRate2)} m³/s
              </dd>
            </dl>
          </section>
        </div>
      </div>

      <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Profile along pipe
          </h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setGraphMode('velocity')}
              className={`rounded-md px-2.5 py-1 text-xs ${
                graphMode === 'velocity'
                  ? 'bg-violet-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Velocity vs position
            </button>
            <button
              type="button"
              onClick={() => setGraphMode('area')}
              className={`rounded-md px-2.5 py-1 text-xs ${
                graphMode === 'area'
                  ? 'bg-violet-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Area vs position
            </button>
          </div>
        </div>
        <p className="mb-2 text-xs text-slate-500">
          {graphMode === 'velocity'
            ? 'Local speed v(x) = A₁v₁ / A(x) — rises where the pipe narrows.'
            : 'Cross-sectional area A(x) = πr(x)² along the pipe length.'}
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
          <text
            x={8}
            y={CHART_PAD.top + 10}
            fill="#64748b"
            fontSize={10}
            transform={`rotate(-90 8 ${CHART_PAD.top + 10})`}
          >
            {graphMode === 'velocity' ? 'v (m/s)' : 'A (m²)'}
          </text>
          <path
            ref={profilePathRef}
            fill="none"
            stroke="#a78bfa"
            strokeWidth={2}
            strokeLinejoin="round"
          />
        </svg>
      </section>

      <ConceptBox
        heading="Continuity & flow rate"
        items={[
          {
            title: 'Conservation of mass',
            description:
              'For incompressible flow, the same volume of fluid must pass every cross-section each second. Mass in = mass out, so the flow rate Q = Av stays constant.',
          },
          {
            title: 'Continuity equation',
            description:
              'A₁v₁ = A₂v₂. Halving the area doubles the speed (and vice versa). The simulation updates v(x) = A₁v₁/A(x) everywhere along the taper.',
          },
          {
            title: 'Garden hose nozzle',
            description:
              'Covering part of the hose end shrinks the opening. The same water must squeeze through a smaller area, so it exits faster.',
          },
          {
            title: 'River narrowing',
            description:
              'Where a river channel narrows, water speeds up — not because more water appears, but because the same flow rate passes a smaller cross-section.',
          },
          {
            title: 'Nozzles & pipes',
            description:
              'Industrial nozzles, fire hoses, and pipe constrictions all use continuity: smaller A means higher v at fixed Q.',
          },
        ]}
      />
    </div>
  );
}
