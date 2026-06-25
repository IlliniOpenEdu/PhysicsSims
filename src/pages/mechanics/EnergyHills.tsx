import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { SliderWithInput } from '../../components/SliderWithInput';

type Vec2 = { x: number; y: number };

type TerrainType = 'smooth' | 'bumpy' | 'cavity';

type ControlsState = {
  massKg: number;
  initialVelocityMps: number;
  terrain: TerrainType;
};

const DEFAULT_CONTROLS: ControlsState = {
  massKg: 2,
  initialVelocityMps: 2,
  terrain: 'smooth',
};

const G = 9.8; // m/s^2

const TARGET_FPS = 60;
const FRAME_INTERVAL_MS = 1000 / TARGET_FPS;
const MAX_SIM_DT_S = 1 / 30;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function length(a: Vec2, b: Vec2) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function normalize(v: Vec2): Vec2 {
  const m = Math.sqrt(v.x * v.x + v.y * v.y) || 1;
  return { x: v.x / m, y: v.y / m };
}

function roundTo2(n: number): number {
  return Math.round(n * 100) / 100;
}

type TrackSample = {
  pts: Vec2[];
  segLen: number[];
  cumLen: number[]; // cumLen[0]=0, cumLen[i] = length to reach pts[i]
  totalLen: number;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  minY: number;
  maxY: number;
};

function computeTrack(pts: Vec2[]): TrackSample {
  const segLen: number[] = [];
  const cumLen: number[] = [0];
  let totalLen = 0;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
    if (i > 0) {
      const l = length(pts[i - 1], pts[i]);
      segLen.push(l);
      totalLen += l;
      cumLen.push(totalLen);
    }
  }

  return {
    pts,
    segLen,
    cumLen,
    totalLen,
    bounds: { minX, maxX, minY, maxY },
    minY,
    maxY,
  };
}

function sampleAtS(track: TrackSample, s: number) {
  const clampedS = clamp(s, 0, track.totalLen);
  const pts = track.pts;
  const cum = track.cumLen;

  let i = 0;
  while (i < cum.length - 1 && cum[i + 1] < clampedS) i++;

  const s0 = cum[i];
  const s1 = cum[i + 1] ?? s0;
  const t = s1 > s0 ? (clampedS - s0) / (s1 - s0) : 0;
  const p0 = pts[i];
  const p1 = pts[i + 1] ?? pts[i];
  const pos = { x: lerp(p0.x, p1.x, t), y: lerp(p0.y, p1.y, t) };

  const tanRaw = { x: p1.x - p0.x, y: p1.y - p0.y };
  const tangent = normalize(tanRaw);
  const normal = normalize({ x: -tangent.y, y: tangent.x });

  return { pos, tangent, normal };
}

function ballRadiusSvgUnits(massKg: number): number {
  return massKg <= 0 ? 3.5 : clamp(3.5 + massKg * 0.12, 3.8, 6.2);
}

/** Ball center height in world coordinates (y up), matching the on-screen ball placement. */
function ballCenterYWorld(
  track: TrackSample,
  s: number,
  massKg: number,
  worldToSvgScale: number
): number {
  const { pos, normal } = sampleAtS(track, s);
  const upNormal = normal.y >= 0 ? normal : { x: -normal.x, y: -normal.y };
  const rWorld = worldToSvgScale > 0 ? ballRadiusSvgUnits(massKg) / worldToSvgScale : 0;
  return pos.y + upNormal.y * rWorld;
}

function trackToSvgMapper(track: TrackSample) {
  // Fit the hill to the full canvas width (left → right) with a small margin.
  // This makes the simulation fill the whole left panel.
  const innerMin = 5;
  const innerMax = 95;
  const innerSpan = innerMax - innerMin;

  const minX = track.bounds.minX;
  const maxX = track.bounds.maxX;
  const minY = track.bounds.minY;
  const maxY = track.bounds.maxY;

  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;

  // Prefer filling width, but cap by height so we don't clip vertically.
  const scaleFromWidth = innerSpan / spanX;
  const scaleFromHeight = innerSpan / spanY;
  const scale = Math.min(scaleFromWidth, scaleFromHeight) * 0.98;

  const usedW = spanX * scale;
  const usedH = spanY * scale;
  const x0 = innerMin + (innerSpan - usedW) / 2;
  const y0 = innerMin + (innerSpan - usedH) / 2;

  const worldToSvg = (p: Vec2): Vec2 => {
    // viewBox 0..100, y down. Map minX->x0, maxX->x0+usedW. For y, map maxY->y0.
    const x = x0 + (p.x - minX) * scale;
    const y = y0 + (maxY - p.y) * scale;
    return { x, y };
  };

  return { worldToSvg, scale };
}

function smoothstep(t: number) {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

function makeSmoothHillTrack(): Vec2[] {
  const pts: Vec2[] = [];
  const x0 = -14;
  const x1 = 14;
  const yTop = 8.2;
  const yBottom = 0.9;
  const n = 320;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = lerp(x0, x1, t);
    // gentle convex curve (more "hill-like" than a straight ramp)
    const s = smoothstep(t);
    const y = lerp(yTop, yBottom, s);
    pts.push({ x, y });
  }
  return pts;
}

function gaussian(t: number, mu: number, sigma: number) {
  const z = (t - mu) / sigma;
  return Math.exp(-0.5 * z * z);
}

function makeTwoHumpsHillTrack(): Vec2[] {
  const pts: Vec2[] = [];
  const x0 = -14;
  const x1 = 14;
  // Keep the left start as the highest point so the ball
  // has enough PE to make it over both humps.
  const yTop = 10.8;
  const yBottom = 1.0;
  const n = 760;

  const cosineBump = (t: number, center: number, halfWidth: number) => {
    const u = (t - center) / halfWidth;
    if (u <= -1 || u >= 1) return 0;
    // Raised cosine: smooth, wide, well-defined hump.
    return 0.5 * (1 + Math.cos(Math.PI * u));
  };

  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = lerp(x0, x1, t);
    const base = lerp(yTop, yBottom, smoothstep(t));

    // Large, defined humps but with smoother transitions for visually smooth motion.
    const earlyValley = -0.95 * gaussian(t, 0.16, 0.095);
    const bigHump = 2.15 * cosineBump(t, 0.36, 0.19);
    const midValley = -1.35 * gaussian(t, 0.58, 0.12);
    const smallHump = 2.8 * cosineBump(t, 0.77, 0.16);

    // Replace cliff-like end with a smooth drop and long flattening tail.
    const runoutDrop = -1.25 * smoothstep((t - 0.82) / 0.14);
    const tailT = smoothstep((t - 0.86) / 0.14);
    const yRaw = base + earlyValley + bigHump + midValley + smallHump + runoutDrop;
    const yEnd = yBottom - 1.45;
    const y = lerp(yRaw, yEnd, tailT);

    pts.push({ x, y });
  }
  return pts;
}

/**
 * One deep semicircular dip only: lower semicircle from left rim to right rim.
 * Radius chosen so the arc spans the full sim width (no horizontal lead-in/out).
 * Endpoints share the same height so with v₀ = 0 the ball can go KE → max → 0.
 */
function makeCavityTrack(): Vec2[] {
  const pts: Vec2[] = [];
  const cx = 0;
  const yRim = 10;
  const R = 14;
  const nArc = 520;

  for (let i = 0; i <= nArc; i++) {
    const u = i / nArc;
    const theta = Math.PI + u * Math.PI;
    const x = cx + R * Math.cos(theta);
    const y = yRim + R * Math.sin(theta);
    pts.push({ x, y });
  }

  return pts;
}

function terrainLabel(terrain: TerrainType) {
  if (terrain === 'smooth') return 'Smooth hill';
  if (terrain === 'bumpy') return 'Bumpy hill';
  return 'Cavity';
}

type EnergySnapshot = {
  sM: number;
  vMps: number;
  hM: number;
  keJ: number;
  peJ: number;
  teJ: number;
};

export function EnergyHills() {
  const [controls, setControls] = useState<ControlsState>(DEFAULT_CONTROLS);
  const [isRunning, setIsRunning] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  const track = useMemo(() => {
    const pts =
      controls.terrain === 'smooth'
        ? makeSmoothHillTrack()
        : controls.terrain === 'bumpy'
          ? makeTwoHumpsHillTrack()
          : makeCavityTrack();
    return computeTrack(pts);
  }, [controls.terrain]);

  const { worldToSvg, scale: worldToSvgScale } = useMemo(() => trackToSvgMapper(track), [track]);
  const worldToSvgScaleRef = useRef(worldToSvgScale);
  worldToSvgScaleRef.current = worldToSvgScale;

  const controlsRef = useRef(controls);
  const isRunningRef = useRef(isRunning);
  const animationFrameIdRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);
  const lastVisualUpdateRef = useRef<number | null>(null);

  const sRef = useRef(0);
  const vRef = useRef(0);
  const totalEnergyRef = useRef(0);

  const [ui, setUi] = useState<EnergySnapshot>(() => {
    const scale = trackToSvgMapper(track).scale;
    const yBall = ballCenterYWorld(track, 0, DEFAULT_CONTROLS.massKg, scale);
    const h = yBall - track.minY;
    const ke =
      0.5 * DEFAULT_CONTROLS.massKg * DEFAULT_CONTROLS.initialVelocityMps * DEFAULT_CONTROLS.initialVelocityMps;
    const pe = DEFAULT_CONTROLS.massKg * G * h;
    return {
      sM: 0,
      vMps: DEFAULT_CONTROLS.initialVelocityMps,
      hM: h,
      keJ: ke,
      peJ: pe,
      teJ: ke + pe,
    };
  });

  useEffect(() => {
    controlsRef.current = controls;
  }, [controls]);

  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  useEffect(() => {
    return () => {
      if (animationFrameIdRef.current !== null) cancelAnimationFrame(animationFrameIdRef.current);
    };
  }, []);

  const pushUiSnapshot = () => {
    const { massKg } = controlsRef.current;
    const s = sRef.current;
    const v = vRef.current;
    const yBall = ballCenterYWorld(track, s, massKg, worldToSvgScale);
    const h = yBall - track.minY;
    const ke = 0.5 * massKg * v * v;
    const pe = massKg * G * h;
    setUi({ sM: s, vMps: v, hM: h, keJ: ke, peJ: pe, teJ: ke + pe });
  };

  const resetSimulation = (nextControls?: ControlsState) => {
    const c = nextControls ?? controlsRef.current;
    // Stop any in-flight loop so UI does not get stuck with Start disabled (isRunning) and
    // Pause disabled (!hasStarted) after changing terrain or resetting.
    isRunningRef.current = false;
    setIsRunning(false);
    if (animationFrameIdRef.current !== null) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }
    lastTimestampRef.current = null;
    lastVisualUpdateRef.current = null;
    sRef.current = 0;
    vRef.current = clamp(c.initialVelocityMps, 0, 50);
    {
      const yBall = ballCenterYWorld(track, 0, c.massKg, worldToSvgScale);
      const h = yBall - track.minY;
      const ke = 0.5 * c.massKg * vRef.current * vRef.current;
      const pe = c.massKg * G * h;
      totalEnergyRef.current = ke + pe;
    }
    setHasStarted(false);
    controlsRef.current = c;
    pushUiSnapshot();
  };

  const startLoopIfNeeded = () => {
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

      const realDt = (timestamp - lastTimestampRef.current) / 1000;
      lastTimestampRef.current = timestamp;
      const dt = Math.min(MAX_SIM_DT_S, realDt);

      const { massKg } = controlsRef.current;

      // Advance along the hill using current speed, then enforce energy conservation using height (y).
      let nextS = sRef.current + vRef.current * dt;

      // End stops: clamp, zero velocity if pushing past end.
      if (nextS <= 0) {
        nextS = 0;
      }
      if (nextS >= track.totalLen) {
        nextS = track.totalLen;
      }

      let nextV = vRef.current;
      if (massKg > 0) {
        const scale = worldToSvgScaleRef.current;
        const yBall = ballCenterYWorld(track, nextS, massKg, scale);
        const h = yBall - track.minY;
        const pe = massKg * G * h;
        const ke = Math.max(0, totalEnergyRef.current - pe);
        const vMag = Math.sqrt((2 * ke) / massKg);
        // Keep moving "downhill" (forward along the hill). If energy isn't enough to climb a hump, it stops.
        nextV = vMag;
        if (vMag < 1e-4) nextV = 0;
      } else {
        nextV = 0;
      }

      sRef.current = nextS;
      vRef.current = nextV;

      const now = performance.now();
      if (lastVisualUpdateRef.current === null || now - lastVisualUpdateRef.current >= FRAME_INTERVAL_MS) {
        lastVisualUpdateRef.current = now;
        pushUiSnapshot();
      }

      animationFrameIdRef.current = requestAnimationFrame(step);
    };

    animationFrameIdRef.current = requestAnimationFrame(step);
  };

  useEffect(() => {
    // When terrain changes, reset but keep mass/v sliders.
    resetSimulation(controlsRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track]);

  useEffect(() => {
    if (isRunningRef.current) startLoopIfNeeded();
  }, [isRunning]);

  const handleStartOrRestart = () => {
    resetSimulation();
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
      return;
    }
    setHasStarted(true);
    isRunningRef.current = true;
    setIsRunning(true);
    startLoopIfNeeded();
  };

  const ball = useMemo(() => {
    const { pos, normal } = sampleAtS(track, ui.sM);
    // Ensure the normal points "up" in world coordinates.
    const upNormal = normal.y >= 0 ? normal : { x: -normal.x, y: -normal.y };
    return { pos, normal: upNormal };
  }, [track, ui.sM]);

  const trackPathD = useMemo(() => {
    const pts = track.pts.map(worldToSvg);
    if (pts.length === 0) return '';
    let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
    for (let i = 1; i < pts.length; i++) {
      d += ` L ${pts[i].x.toFixed(2)} ${pts[i].y.toFixed(2)}`;
    }
    return d;
  }, [track, worldToSvg]);

  // Ball should sit on top of the track: center offset along surface normal by its radius.
  const ballR = ballRadiusSvgUnits(controls.massKg);
  const ballRsvg = ballR;
  const ballRworld = worldToSvgScale > 0 ? ballRsvg / worldToSvgScale : 0;
  const ballCenterWorld: Vec2 = {
    x: ball.pos.x + ball.normal.x * ballRworld,
    y: ball.pos.y + ball.normal.y * ballRworld,
  };
  const ballSvg = worldToSvg(ballCenterWorld);

  const energyMax = useMemo(() => {
    // Scale bars relative to the highest plausible total energy for current setup.
    const m = Math.max(0.5, controls.massKg);
    const v0 = clamp(controls.initialVelocityMps, 0, 20);
    const rWorld = worldToSvgScale > 0 ? ballRadiusSvgUnits(m) / worldToSvgScale : 0;
    const highestH = track.maxY - track.minY + rWorld;
    const peMax = m * G * highestH;
    const keMax = 0.5 * m * v0 * v0;
    return Math.max(1, peMax + keMax);
  }, [controls.massKg, controls.initialVelocityMps, track.maxY, track.minY, worldToSvgScale]);

  const kePct = clamp(ui.keJ / energyMax, 0, 1);
  const pePct = clamp(ui.peJ / energyMax, 0, 1);
  const tePct = clamp(ui.teJ / energyMax, 0, 1);

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-8 text-slate-100">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">Energy unit</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
            Energy Hills: Potential, Kinetic, and Total Energy
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">
            A ball rolls downhill under gravity. As its height drops, potential energy decreases and kinetic energy
            increases — with total mechanical energy staying nearly constant (no friction).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-sky-500 hover:text-sky-100"
          >
            ← Dashboard
          </Link>
          <span className="inline-flex items-center gap-2 rounded-full border border-sky-700/60 bg-sky-900/60 px-3 py-1 text-[0.7rem] font-medium text-sky-100">
            Gravity only · No friction
          </span>
        </div>
      </header>

      <main className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/40">
          <div className="pointer-events-none absolute inset-0 -z-10 opacity-70">
            <div className="absolute -left-28 top-0 h-60 w-60 rounded-full bg-sky-700/25 blur-3xl" />
            <div className="absolute bottom-0 right-0 h-60 w-60 rounded-full bg-blue-500/20 blur-3xl" />
          </div>

          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold tracking-wide text-sky-300">Simulation canvas</h2>
              <p className="mt-1 text-xs text-slate-300">
                Track: <span className="font-medium text-slate-100">{terrainLabel(controls.terrain)}</span>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleStartOrRestart}
                disabled={isRunning}
                className="inline-flex items-center gap-2 rounded-full bg-sky-500 px-4 py-1.5 text-xs font-semibold text-slate-950 shadow-md shadow-sky-900/50 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-200"
              >
                {hasStarted && !isRunning ? 'Restart' : 'Start'}
              </button>
              <button
                type="button"
                onClick={handleToggleRunning}
                disabled={!hasStarted}
                className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-[0.7rem] font-semibold text-slate-100 shadow-sm transition hover:border-sky-500 hover:text-sky-100 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-800 disabled:text-slate-500"
              >
                {isRunning ? 'Pause' : 'Resume'}
              </button>
            </div>
          </div>

          <div className="mt-5 relative flex h-[28rem] min-w-0 overflow-hidden rounded-xl border border-slate-800 bg-gradient-to-tr from-slate-950 via-slate-950/95 to-slate-900/80">
            <svg
              viewBox="0 0 100 100"
              className="h-full w-full bg-slate-950/60"
              preserveAspectRatio="xMidYMid meet"
            >
              <defs>
                <linearGradient id="hill-track" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="rgb(56 189 248)" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="rgb(16 185 129)" stopOpacity="0.95" />
                </linearGradient>
              </defs>

              <rect
                x={3}
                y={3}
                width={94}
                height={94}
                rx={5}
                ry={5}
                fill="rgba(2,6,23,0.35)"
                stroke="rgba(148,163,184,0.5)"
                strokeWidth={0.6}
              />

              {/* "Ground" fill under the hill */}
              <path d={`${trackPathD} L 95 95 L 5 95 Z`} fill="rgba(16,185,129,0.06)" />

              {/* Thinner hill strokes */}
              <path
                d={trackPathD}
                fill="none"
                stroke="rgba(2,6,23,0.55)"
                strokeWidth={3.2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d={trackPathD}
                fill="none"
                stroke="url(#hill-track)"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Ball */}
              <circle cx={ballSvg.x} cy={ballSvg.y} r={ballR} fill="#38bdf8" stroke="#0ea5e9" strokeWidth={0.8} />
              <circle cx={ballSvg.x - ballR * 0.25} cy={ballSvg.y - ballR * 0.25} r={ballR * 0.18} fill="rgba(255,255,255,0.65)" />

            </svg>

            <div className="absolute left-4 top-4 rounded-md bg-slate-950/80 px-2 py-1 text-[0.6rem] text-slate-300 shadow">
              <p className="font-mono text-[0.6rem] text-slate-200">v ≈ {ui.vMps.toFixed(2)} m/s</p>
              <p className="font-mono text-[0.6rem] text-slate-200">h (ball) ≈ {ui.hM.toFixed(2)} m</p>
            </div>

            <div className="absolute bottom-4 left-4 rounded-md bg-slate-950/80 px-2 py-1 text-[0.6rem] text-slate-300 shadow">
              <p className="font-mono text-[0.6rem] text-sky-200">KE = {ui.keJ.toFixed(1)} J</p>
              <p className="font-mono text-[0.6rem] text-emerald-200">PE = {ui.peJ.toFixed(1)} J</p>
              <p className="font-mono text-[0.6rem] text-fuchsia-200">TE = {ui.teJ.toFixed(1)} J</p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
            <p className="text-xs font-semibold text-slate-100">Energy (live)</p>
            <p className="mt-1 text-[0.7rem] text-slate-400">
              Using KE = ½mv² and PE = mgh with g = 9.8 m/s².
            </p>

            <div className="mt-3 space-y-2">
              <EnergyRow label="Kinetic (KE)" value={ui.keJ} pct={kePct} barClass="bg-sky-400" valueClass="text-sky-200" />
              <EnergyRow
                label="Potential (PE)"
                value={ui.peJ}
                pct={pePct}
                barClass="bg-emerald-400"
                valueClass="text-emerald-200"
              />
              <EnergyRow
                label="Total (TE)"
                value={ui.teJ}
                pct={tePct}
                barClass="bg-fuchsia-400"
                valueClass="text-fuchsia-200"
              />
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-300">
            <p className="font-medium text-slate-100">Snapshot</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <StatChip label="Height (h)" value={`${roundTo2(ui.hM)} m`} />
              <StatChip label="Speed (v)" value={`${roundTo2(ui.vMps)} m/s`} />
              <StatChip label="Mass (m)" value={`${roundTo2(controls.massKg)} kg`} />
              <StatChip label="g" value="9.8 m/s²" />
            </div>
          </div>
        </section>

        <section className="flex min-h-[28rem] flex-col space-y-5 rounded-2xl border border-slate-800 bg-slate-950/80 p-5 shadow-lg shadow-slate-950/40">
          <h2 className="text-sm font-semibold tracking-wide text-sky-300">Controls</h2>

          <SliderWithInput
            label="Mass (m)"
            min={0.5}
            max={20}
            step={0.5}
            value={controls.massKg}
            units="kg"
            onChange={(value) => {
              setControls((prev) => ({ ...prev, massKg: value }));
              controlsRef.current = { ...controlsRef.current, massKg: value };
              pushUiSnapshot();
            }}
            queryKey="m"
          />

          <SliderWithInput
            label="Initial velocity (v₀)"
            min={0}
            max={20}
            step={0.25}
            value={controls.initialVelocityMps}
            units="m/s"
            description="Applied along the track at the start position."
            onChange={(value) => {
              setControls((prev) => ({ ...prev, initialVelocityMps: value }));
              controlsRef.current = { ...controlsRef.current, initialVelocityMps: value };
              if (!hasStarted) {
                vRef.current = value;
              }
              pushUiSnapshot();
            }}
            queryKey="Vo"
          />

          <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
            <p className="text-xs font-medium text-slate-100">Terrain type</p>
            <select
              value={controls.terrain}
              onChange={(e) => setControls((prev) => ({ ...prev, terrain: e.target.value as TerrainType }))}
              className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-xs text-slate-100 outline-none transition focus:border-sky-500"
            >
              <option value="smooth">Smooth Hill</option>
              <option value="bumpy">Two-hump Hill</option>
              <option value="cavity">Cavity</option>
            </select>
            <p className="text-[0.65rem] text-slate-400">
              Smooth: steady downhill · Two-hump: two large peaks/valleys · Cavity: one semicircular dip (try v₀ = 0 for
              KE → max → 0).
            </p>
          </div>

          <div className="mt-auto flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                resetSimulation();
                pushUiSnapshot();
              }}
              className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-[0.7rem] font-semibold text-slate-100 shadow-sm transition hover:border-slate-500"
            >
              Reset position
            </button>
            <button
              type="button"
              onClick={() => {
                const next = DEFAULT_CONTROLS;
                setControls(next);
                controlsRef.current = next;
                resetSimulation(next);
              }}
              className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-[0.7rem] font-semibold text-slate-100 shadow-sm transition hover:border-slate-500"
            >
              Reset all
            </button>
          </div>
        
          
        </section>
      </main>

      <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/40">
        <h2 className="text-sm font-semibold tracking-wide text-sky-300">Explanation</h2>
        <div className="mt-3 grid gap-4 md:grid-cols-3">
          <ExplainCard
            title="Potential ↔ kinetic conversion"
            body="As the ball moves downward, height h decreases so PE = mgh drops. That energy appears as increasing KE = ½mv², so the ball speeds up. When it climbs, the opposite happens."
          />
          <ExplainCard
            title="Total energy conservation"
            body="With only gravity doing work (and no friction), total mechanical energy TE = KE + PE stays roughly constant. Small changes you might see are from numerical integration (Euler steps)."
          />
          <ExplainCard
            title="Terrain differences"
            body="A smooth hill changes energy steadily. Bumps create rapid small exchanges because height fluctuates. A cavity has symmetric ends: with no friction and v₀ = 0, kinetic energy is smallest at the rims and largest at the bottom of the dip."
          />
        </div>
      </section>
    </div>
  );
}

function EnergyRow({
  label,
  value,
  pct,
  barClass,
  valueClass,
}: {
  label: string;
  value: number;
  pct: number;
  barClass: string;
  valueClass: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[0.72rem] text-slate-300">{label}</span>
        <span className={`text-[0.72rem] font-mono ${valueClass}`}>{value.toFixed(1)} J</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full border border-slate-800 bg-slate-950/70">
        <div className={`h-full ${barClass}`} style={{ width: `${clamp(pct, 0, 1) * 100}%`, opacity: 0.9 }} />
      </div>
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2">
      <p className="text-[0.65rem] uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 text-[0.8rem] font-medium text-slate-100">{value}</p>
    </div>
  );
}

function ExplainCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <p className="text-xs font-semibold text-slate-100">{title}</p>
      <p className="mt-2 text-xs leading-relaxed text-slate-300">{body}</p>
    </div>
  );
}

