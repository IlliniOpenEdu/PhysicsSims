// id="wkdyn2"
import React, { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ConceptBox } from '../components/ConceptBox';
import { SliderWithInput } from '../components/SliderWithInput';

type Vec2 = { x: number; y: number };

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function roundTo2(n: number) {
  return Math.round(n * 100) / 100;
}

function degToRad(deg: number) {
  return (deg * Math.PI) / 180;
}

function sign(n: number) {
  if (n > 0) return 1;
  if (n < 0) return -1;
  return 0;
}

const G_M_S2 = 9.8;
const SIMULATION_SPEED = 1;
const TARGET_FPS = 60;
const FRAME_INTERVAL_MS = 1000 / TARGET_FPS;
const MAX_SIM_DT = 1 / 30;

/** Short canvas vs width (~2.5:1) — keeps incline visual compact */
const INCLINE_H_OVER_W = 220 / 560;
/** Rope sim strip height vs width (~3.2:1), similar to SpringEnergy’s 200×640 canvas */
const ROPE_H_OVER_W = 200 / 640;

type ArrowProps = {
  from: Vec2;
  to: Vec2;
  color: string;
  strokeWidth?: number;
  headSize?: number;
  opacity?: number;
};

function Arrow({ from, to, color, strokeWidth = 2.5, headSize = 8, opacity = 1 }: ArrowProps) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const headLength = Math.min(headSize, len * 0.4);
  const baseX = to.x - ux * headLength;
  const baseY = to.y - uy * headLength;
  const halfWidth = headLength * 0.7;
  const leftX = baseX - uy * halfWidth;
  const leftY = baseY + ux * halfWidth;
  const rightX = baseX + uy * halfWidth;
  const rightY = baseY - ux * halfWidth;

  return (
    <g opacity={opacity}>
      <line x1={from.x} y1={from.y} x2={baseX} y2={baseY} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <polygon points={`${to.x},${to.y} ${leftX},${leftY} ${rightX},${rightY}`} fill={color} stroke={color} strokeWidth={0.8} />
    </g>
  );
}

function ControlRow(props: {
  label: React.ReactNode;
  queryKey?: string;
  units?: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  const { label, queryKey, units, min, max, step, value, onChange, disabled = false } = props;
  return (
    <div className={`space-y-1.5 ${disabled ? 'pointer-events-none opacity-60' : ''}`}>
      <SliderWithInput
        label={label}
        queryKey={queryKey}
        units={units}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={onChange}
        disabled={disabled}
      />
    </div>
  );
}

function WorkMetricRow({ label, valueJ }: { label: React.ReactNode; valueJ: number }) {
  return (
    <div className="flex items-baseline justify-between gap-2 rounded-md border border-slate-800 bg-slate-900/80 px-2.5 py-1.5">
      <span className="text-[0.65rem] text-slate-400">{label}</span>
      <span className="font-mono text-[0.7rem] text-sky-200">{roundTo2(valueJ).toFixed(2)} J</span>
    </div>
  );
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

// =============================================================================
// Incline
// =============================================================================

const MAX_INCLINE_ANGLE_DEG = 30;
const BOX_SIZE_PX = 44;
const METERS_PER_PX = 0.05;
const GRID_INSET_PX = 6;
const PLANE_STROKE_PX = 16;
const TRI_MARGIN_R = 28;
const TRI_MARGIN_T = 8;
const V_EPS_INC = 0.01;

export type InclineControls = { angleDeg: number; muS: number; muK: number; massKg: number };

type InclineGeom = {
  sinTheta: number;
  cosTheta: number;
  uDownSlope: Vec2;
  nOutward: Vec2;
  topPx: Vec2;
  baseRightPx: Vec2;
  planeLengthM: number;
  angleRad: number;
};

export function InclineWorkSim({
  controls,
  disabled,
  onControlChange,
  isRunning,
  runEpoch,
  active,
  playbackSlot,
}: {
  controls: InclineControls;
  disabled: boolean;
  onControlChange: (field: keyof InclineControls, value: number) => void;
  isRunning: boolean;
  runEpoch: number;
  active: boolean;
  playbackSlot: ReactNode;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const viewSizeRef = useRef({ w: 560, h: 420 });
  const [viewSize, setViewSize] = useState(viewSizeRef.current);

  const geomRef = useRef<InclineGeom | null>(null);
  const posSRef = useRef(0);
  const velSRef = useRef(0);
  const controlsRef = useRef(controls);
  const workRef = useRef({ gravityParallel: 0, friction: 0, normal: 0, net: 0 });
  const [workUi, setWorkUi] = useState(workRef.current);

  const isRunningRef = useRef(false);
  const animRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const lastUiRef = useRef<number | null>(null);

  useEffect(() => {
    controlsRef.current = controls;
  }, [controls]);

  useEffect(() => {
    isRunningRef.current = isRunning && active;
  }, [isRunning, active]);

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    const geom = geomRef.current;
    if (!canvas || !ctx || !geom) return;
    const w = viewSizeRef.current.w;
    const h = viewSizeRef.current.h;
    ctx.clearRect(0, 0, w, h);
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, 'rgba(2,6,23,0.95)');
    bg.addColorStop(1, 'rgba(15,23,42,0.95)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(148,163,184,0.6)';
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, 6, 6, w - 12, h - 12, 14);
    ctx.stroke();

    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = 'rgba(30,64,175,0.6)';
    for (let x = 6; x < w - 6; x += 28) {
      ctx.beginPath();
      ctx.moveTo(x, 6);
      ctx.lineTo(x, h - 6);
      ctx.stroke();
    }
    for (let y = 6; y < h - 6; y += 28) {
      ctx.beginPath();
      ctx.moveTo(6, y);
      ctx.lineTo(w - 6, y);
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(geom.topPx.x - 50, geom.baseRightPx.y);
    ctx.lineTo(geom.baseRightPx.x + 24, geom.baseRightPx.y);
    ctx.lineTo(geom.baseRightPx.x + 24, geom.topPx.y - 24);
    ctx.lineTo(geom.topPx.x - 50, geom.topPx.y - 24);
    ctx.closePath();
    ctx.fillStyle = 'rgba(4,120,87,0.14)';
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(4,120,87,0.72)';
    ctx.lineWidth = PLANE_STROKE_PX;
    ctx.beginPath();
    ctx.moveTo(geom.topPx.x, geom.topPx.y);
    ctx.lineTo(geom.baseRightPx.x, geom.baseRightPx.y);
    ctx.stroke();
    ctx.restore();

    const posPx = posSRef.current / METERS_PER_PX;
    const contact = {
      x: geom.topPx.x + geom.uDownSlope.x * posPx + geom.nOutward.x * (PLANE_STROKE_PX / 2),
      y: geom.topPx.y + geom.uDownSlope.y * posPx + geom.nOutward.y * (PLANE_STROKE_PX / 2),
    };
    const cx = contact.x + geom.nOutward.x * (BOX_SIZE_PX / 2);
    const cy = contact.y + geom.nOutward.y * (BOX_SIZE_PX / 2);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(geom.angleRad);
    ctx.fillStyle = '#38bdf8';
    ctx.strokeStyle = '#0ea5e9';
    ctx.lineWidth = 2;
    drawRoundedRect(ctx, -BOX_SIZE_PX / 2, -BOX_SIZE_PX / 2, BOX_SIZE_PX, BOX_SIZE_PX, 8);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.font = '12px ui-monospace, monospace';
    ctx.fillStyle = 'rgba(226,232,240,0.85)';
    ctx.fillText(`s = ${posSRef.current.toFixed(2)} m  ·  v = ${velSRef.current.toFixed(2)} m/s`, 14, 22);
    ctx.fillText('+s is downhill along the ramp', 14, 40);
  }, []);

  const resetSimulation = useCallback(() => {
    const c = controlsRef.current;
    const geomW = viewSizeRef.current.w;
    const geomH = viewSizeRef.current.h;
    const thetaRad = degToRad(c.angleDeg);
    const innerLeft = GRID_INSET_PX;
    const innerRight = geomW - GRID_INSET_PX - TRI_MARGIN_R;
    const innerTop = GRID_INSET_PX + TRI_MARGIN_T;
    const innerBottom = geomH - GRID_INSET_PX;
    const baseW = Math.max(1, innerRight - innerLeft);
    const maxRise = Math.max(1, innerBottom - innerTop - 28);
    const risePx = thetaRad < 1e-7 ? 0 : Math.min(maxRise, baseW * Math.tan(thetaRad));
    const baseRightPx = { x: innerRight, y: innerBottom };
    const topPx = { x: innerLeft, y: innerBottom - risePx };
    const runPx = baseRightPx.x - topPx.x;
    const riseAlongPx = baseRightPx.y - topPx.y;
    const planeLenPx = Math.max(1, Math.hypot(runPx, riseAlongPx));
    const planeLengthM = planeLenPx * METERS_PER_PX;
    const uDownSlope = { x: runPx / planeLenPx, y: riseAlongPx / planeLenPx };
    const nOutward = { x: uDownSlope.y, y: -uDownSlope.x };
    const sinTheta = riseAlongPx / planeLenPx;
    const cosTheta = runPx / planeLenPx;
    const angleRad = Math.atan2(riseAlongPx, runPx);

    geomRef.current = { sinTheta, cosTheta, uDownSlope, nOutward, topPx, baseRightPx, planeLengthM, angleRad };
    posSRef.current = clamp(planeLengthM * 0.25, 0, Math.max(0, planeLengthM - 0.01));
    velSRef.current = 0;
    workRef.current = { gravityParallel: 0, friction: 0, normal: 0, net: 0 };
    setWorkUi({ ...workRef.current });
    renderCanvas();
  }, [renderCanvas]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const rect = parent.getBoundingClientRect();
      const nextW = Math.max(320, Math.floor(rect.width));
      // Height from width × fixed aspect only (no parent.height — avoids ResizeObserver loop).
      const nextH = Math.max(200, Math.min(280, Math.round(nextW * INCLINE_H_OVER_W)));
      canvas.width = Math.floor(nextW * dpr);
      canvas.height = Math.floor(nextH * dpr);
      canvas.style.width = `${nextW}px`;
      canvas.style.height = `${nextH}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctxRef.current = ctx;
      viewSizeRef.current = { w: canvas.clientWidth || nextW, h: canvas.clientHeight || nextH };
      setViewSize({ ...viewSizeRef.current });
      resetSimulation();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement ?? canvas);
    return () => ro.disconnect();
  }, [resetSimulation]);

  useEffect(() => {
    resetSimulation();
  }, [runEpoch, resetSimulation]);

  useEffect(() => {
    if (isRunning || disabled) return;
    resetSimulation();
  }, [controls.angleDeg, controls.muS, controls.muK, controls.massKg, disabled, isRunning, resetSimulation]);

  const stepPhysics = useCallback(
    (dt: number) => {
      const geom = geomRef.current;
      if (!geom) return;
      const m = controlsRef.current.massKg;
      const { muS, muK } = controlsRef.current;
      const pos0 = posSRef.current;
      const vel0 = velSRef.current;
      const FgPar = m * G_M_S2 * geom.sinTheta;
      const N = m * G_M_S2 * geom.cosTheta;
      const fSMax = muS * N;
      const fK = muK * N;

      let fAlong = -sign(vel0 || 1) * fK;
      let net = FgPar + fAlong;
      const isStatic = Math.abs(vel0) <= V_EPS_INC && FgPar <= fSMax + 1e-9;

      if (isStatic) {
        fAlong = -FgPar;
        net = 0;
      }

      const a = isStatic ? 0 : net / m;
      let v = vel0 + a * dt;
      let s = pos0 + v * dt;
      if (s < 0) {
        s = 0;
        v = 0;
      }
      if (s > geom.planeLengthM) {
        s = geom.planeLengthM;
        v = 0;
      }

      const ds = s - pos0;
      const fFrictionAlong = isStatic ? -FgPar : -sign(v || vel0) * fK;
      workRef.current.gravityParallel += FgPar * ds;
      workRef.current.friction += fFrictionAlong * ds;
      workRef.current.normal += 0;
      workRef.current.net += (FgPar + fFrictionAlong) * ds;

      posSRef.current = s;
      velSRef.current = v;
      renderCanvas();
    },
    [renderCanvas],
  );

  const loop = useCallback(
    (ts: number) => {
      if (!isRunningRef.current) {
        animRef.current = null;
        lastTsRef.current = null;
        return;
      }
      if (lastTsRef.current == null) {
        lastTsRef.current = ts;
        animRef.current = requestAnimationFrame(loop);
        return;
      }
      const realDt = (ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;
      const dt = clamp(realDt * SIMULATION_SPEED, 0, MAX_SIM_DT);
      stepPhysics(dt);
      const now = performance.now();
      if (lastUiRef.current == null || now - lastUiRef.current >= FRAME_INTERVAL_MS) {
        lastUiRef.current = now;
        setWorkUi({ ...workRef.current });
      }
      animRef.current = requestAnimationFrame(loop);
    },
    [stepPhysics],
  );

  useEffect(() => {
    if (!isRunning || !active) {
      if (animRef.current != null) cancelAnimationFrame(animRef.current);
      animRef.current = null;
      lastTsRef.current = null;
      return;
    }
    lastTsRef.current = null;
    animRef.current = requestAnimationFrame(loop);
    return () => {
      if (animRef.current != null) cancelAnimationFrame(animRef.current);
    };
  }, [isRunning, active, loop]);

  const geom = geomRef.current;
  const posPx = geom ? posSRef.current / METERS_PER_PX : 0;
  const contact = geom
    ? {
        x: geom.topPx.x + geom.uDownSlope.x * posPx + geom.nOutward.x * (PLANE_STROKE_PX / 2),
        y: geom.topPx.y + geom.uDownSlope.y * posPx + geom.nOutward.y * (PLANE_STROKE_PX / 2),
      }
    : { x: 100, y: 100 };
  const bc: Vec2 = geom
    ? { x: contact.x + geom.nOutward.x * (BOX_SIZE_PX / 2), y: contact.y + geom.nOutward.y * (BOX_SIZE_PX / 2) }
    : { x: 100, y: 100 };
  const m = controls.massKg;
  const gp = geom ? m * G_M_S2 * geom.sinTheta : 0;
  const nn = geom ? m * G_M_S2 * geom.cosTheta : 0;
  const vs = velSRef.current;
  const fAlong =
    Math.abs(vs) <= V_EPS_INC && gp <= controls.muS * nn + 1e-9 ? -gp : -sign(vs || 1) * controls.muK * nn;

  const tip = (dir: Vec2, mag: number) => {
    const L = Math.min(110, mag * 1.5);
    return { x: bc.x + dir.x * L, y: bc.y + dir.y * L };
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(260px,22rem)] lg:items-start">
      <div className="min-w-0">
        <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-950/60 p-2">
          <canvas ref={canvasRef} className="block w-full max-w-full rounded-lg bg-slate-950/60" />
          <svg
            viewBox={`0 0 ${viewSize.w} ${viewSize.h}`}
            className="pointer-events-none absolute inset-2 rounded-lg"
            preserveAspectRatio="none"
            aria-hidden
          >
            {geom ? (
              <>
                <Arrow from={bc} to={tip(geom.uDownSlope, 20)} color="rgba(251,191,129,0.95)" strokeWidth={2} headSize={7} />
                <Arrow from={bc} to={tip(geom.uDownSlope, gp)} color="#a78bfa" strokeWidth={2.5} headSize={8} opacity={0.85} />
                <Arrow from={bc} to={tip(geom.nOutward, nn)} color="#22c55e" strokeWidth={2.3} headSize={8} opacity={0.75} />
                <Arrow
                  from={bc}
                  to={tip({ x: -sign(vs || 1) * geom.uDownSlope.x, y: -sign(vs || 1) * geom.uDownSlope.y }, Math.abs(fAlong))}
                  color="#f97316"
                  strokeWidth={2.3}
                  headSize={8}
                  opacity={0.9}
                />
              </>
            ) : null}
          </svg>
        </div>
      </div>
      <aside className="flex min-w-0 flex-col gap-4">
        {playbackSlot}
        <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
          <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-sky-300">Work (cumulative)</p>
          <p className="mt-1 text-[0.6rem] text-slate-500">ΔW = F∥ · Δs along +s (downhill)</p>
          <div className="mt-2 space-y-1">
            <WorkMetricRow label="Gravity (parallel)" valueJ={workUi.gravityParallel} />
            <WorkMetricRow label="Friction" valueJ={workUi.friction} />
            <WorkMetricRow label="Normal" valueJ={workUi.normal} />
            <WorkMetricRow label="Net" valueJ={workUi.net} />
          </div>
        </div>
        <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/70 p-3">
          <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-sky-300">Controls</p>
          <ControlRow label="Mass (m)" queryKey="incline-mass" units="kg" min={0.5} max={20} step={0.1} value={controls.massKg} onChange={(v) => onControlChange('massKg', v)} disabled={disabled} />
          <ControlRow label="Angle (θ)" queryKey="incline-angle" units="°" min={0} max={MAX_INCLINE_ANGLE_DEG} step={1} value={controls.angleDeg} onChange={(v) => onControlChange('angleDeg', v)} disabled={disabled} />
          <ControlRow label={<>μₛ</>} queryKey="incline-mus" units="" min={0} max={1} step={0.01} value={controls.muS} onChange={(v) => onControlChange('muS', v)} disabled={disabled} />
          <ControlRow label={<>μₖ</>} queryKey="incline-muk" units="" min={0} max={1} step={0.01} value={controls.muK} onChange={(v) => onControlChange('muK', v)} disabled={disabled} />
        </div>
      </aside>
    </div>
  );
}

// =============================================================================
// Friction + rope
// =============================================================================

const FORCE_TO_PX = 90;
const METERS_PER_PX_H = 0.05;
const WALL_T = 14;
const GROUND_T = 18;
const BOX_PX = 38;
const G_PX = 1200;
const VX_EPS = 4;

export type FrictionControls = { massKg: number; muK: number; muS: number; ropeForceN: number };

export function FrictionWorkSim({
  controls,
  disabled,
  onControlChange,
  isRunning,
  runEpoch,
  active,
  playbackSlot,
}: {
  controls: FrictionControls;
  disabled: boolean;
  onControlChange: (field: keyof FrictionControls, value: number) => void;
  isRunning: boolean;
  runEpoch: number;
  active: boolean;
  playbackSlot: ReactNode;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const controlsRef = useRef(controls);
  const boxRef = useRef({ x: 0, y: 0, vx: 0, mode: 'static' as 'static' | 'kinetic' });
  const workRef = useRef({ applied: 0, friction: 0, normal: 0, gravity: 0, net: 0 });
  const [workUi, setWorkUi] = useState(workRef.current);
  const [viewSize, setViewSize] = useState({ w: 640, h: 400 });
  const isRunningRef = useRef(false);
  const animRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const lastUiRef = useRef<number | null>(null);

  useEffect(() => {
    controlsRef.current = controls;
  }, [controls]);
  useEffect(() => {
    isRunningRef.current = isRunning && active;
  }, [isRunning, active]);

  const render = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.clearRect(0, 0, w, h);
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, 'rgba(2,6,23,0.95)');
    bg.addColorStop(1, 'rgba(15,23,42,0.95)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(148,163,184,0.6)';
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, 6, 6, w - 12, h - 12, 14);
    ctx.stroke();
    ctx.fillStyle = 'rgba(30,41,59,0.85)';
    ctx.fillRect(6, 6, WALL_T, h - 12);
    ctx.fillRect(w - 6 - WALL_T, 6, WALL_T, h - 12);
    ctx.fillStyle = 'rgba(4,120,87,0.55)';
    ctx.fillRect(6, h - 6 - GROUND_T, w - 12, GROUND_T);
    const b = boxRef.current;
    const half = BOX_PX / 2;
    ctx.strokeStyle = 'rgba(56,189,248,0.55)';
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(b.x + half, b.y);
    ctx.lineTo(w - 6 - WALL_T, b.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#38bdf8';
    ctx.strokeStyle = '#0ea5e9';
    ctx.lineWidth = 2;
    drawRoundedRect(ctx, b.x - half, b.y - half, BOX_PX, BOX_PX, 8);
    ctx.fill();
    ctx.stroke();
    ctx.font = '12px monospace';
    ctx.fillStyle = 'rgba(226,232,240,0.85)';
    ctx.fillText(b.mode === 'static' ? 'static friction' : 'kinetic friction', 14, 22);
  }, []);

  const resetSimulation = useCallback(() => {
    const canvas = canvasRef.current;
    const h = canvas?.clientHeight ?? 400;
    const w = canvas?.clientWidth ?? 640;
    boxRef.current = {
      x: 6 + WALL_T + BOX_PX / 2 + 18,
      y: h - 6 - GROUND_T - BOX_PX / 2,
      vx: 0,
      mode: 'static',
    };
    workRef.current = { applied: 0, friction: 0, normal: 0, gravity: 0, net: 0 };
    setWorkUi({ ...workRef.current });
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) render(ctx, w, h);
  }, [render]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const rect = parent.getBoundingClientRect();
      const nw = Math.max(320, Math.floor(rect.width));
      const nh = Math.max(148, Math.min(220, Math.round(nw * ROPE_H_OVER_W)));
      canvas.width = Math.floor(nw * dpr);
      canvas.height = Math.floor(nh * dpr);
      canvas.style.width = `${nw}px`;
      canvas.style.height = `${nh}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      setViewSize({ w: canvas.clientWidth || nw, h: canvas.clientHeight || nh });
      resetSimulation();
      const c2 = canvas.getContext('2d');
      if (c2) render(c2, canvas.clientWidth || nw, canvas.clientHeight || nh);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement ?? canvas);
    return () => ro.disconnect();
  }, [render, resetSimulation]);

  useEffect(() => {
    resetSimulation();
  }, [runEpoch, resetSimulation]);

  const stepPhysics = useCallback(
    (dt: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const b = boxRef.current;
      const half = BOX_PX / 2;
      const leftL = 6 + WALL_T + half;
      const rightL = w - 6 - WALL_T - half;
      const floorY = h - 6 - GROUND_T - half;
      b.y = floorY;

      const { massKg, muK, muS, ropeForceN } = controlsRef.current;
      const mass = Math.max(0.5, massKg);
      const Tpx = ropeForceN * FORCE_TO_PX;
      const x0 = b.x;
      const vx0 = b.vx;
      const spd = Math.abs(vx0);

      const fSMax = muS * mass * G_PX;
      const fK = muK * mass * G_PX;

      if (spd <= VX_EPS) {
        if (Math.abs(Tpx) <= fSMax) {
          b.vx = 0;
          b.mode = 'static';
        } else {
          const net = Tpx - sign(Tpx) * fK;
          b.vx = (net / mass) * dt;
          b.mode = 'kinetic';
        }
      } else {
        const net = Tpx - sign(vx0) * fK;
        b.vx += (net / mass) * dt;
        if (sign(vx0) !== 0 && sign(b.vx) !== sign(vx0) && Math.abs(Tpx) <= fSMax) {
          b.vx = 0;
          b.mode = 'static';
        } else {
          b.mode = 'kinetic';
        }
      }
      b.x += b.vx * dt;
      if (b.x < leftL) {
        b.x = leftL;
        b.vx = 0;
      }
      if (b.x > rightL) {
        b.x = rightL;
        b.vx = 0;
      }

      const dxM = (b.x - x0) * METERS_PER_PX_H;
      const T = ropeForceN;
      const Nn = mass * G_M_S2;
      let FfN = 0;
      if (spd <= VX_EPS && Math.abs(Tpx) <= fSMax) {
        FfN = -T;
      } else {
        FfN = -sign(b.vx || vx0 || sign(Tpx)) * muK * Nn;
      }
      workRef.current.applied += T * dxM;
      workRef.current.friction += FfN * dxM;
      workRef.current.normal += 0;
      workRef.current.gravity += 0;
      workRef.current.net += (T + FfN) * dxM;

      render(ctx, w, h);
    },
    [render],
  );

  const loop = useCallback(
    (ts: number) => {
      if (!isRunningRef.current) {
        animRef.current = null;
        lastTsRef.current = null;
        return;
      }
      if (lastTsRef.current == null) {
        lastTsRef.current = ts;
        animRef.current = requestAnimationFrame(loop);
        return;
      }
      const dt = clamp(((ts - lastTsRef.current) / 1000) * SIMULATION_SPEED, 0, MAX_SIM_DT);
      lastTsRef.current = ts;
      stepPhysics(dt);
      const now = performance.now();
      if (lastUiRef.current == null || now - lastUiRef.current >= FRAME_INTERVAL_MS) {
        lastUiRef.current = now;
        setWorkUi({ ...workRef.current });
      }
      animRef.current = requestAnimationFrame(loop);
    },
    [stepPhysics],
  );

  useEffect(() => {
    if (!isRunning || !active) {
      if (animRef.current != null) cancelAnimationFrame(animRef.current);
      animRef.current = null;
      lastTsRef.current = null;
      return;
    }
    lastTsRef.current = null;
    animRef.current = requestAnimationFrame(loop);
    return () => {
      if (animRef.current != null) cancelAnimationFrame(animRef.current);
    };
  }, [isRunning, active, loop]);

  const bc: Vec2 = { x: boxRef.current.x, y: boxRef.current.y };
  const ropeLen = Math.min(100, controls.ropeForceN * 0.9);
  const muK = controls.muK;
  const m = Math.max(0.5, controls.massKg);
  const fK = muK * m * G_M_S2;
  const fricShow = boxRef.current.mode === 'kinetic' || Math.abs(boxRef.current.vx) > 1;
  const fricLen = Math.min(85, fK * 0.08);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(260px,22rem)] lg:items-start">
      <div className="min-w-0">
        <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-950/60 p-2">
          <canvas ref={canvasRef} className="block w-full max-w-full rounded-lg bg-slate-950/60" />
          <svg viewBox={`0 0 ${viewSize.w} ${viewSize.h}`} className="pointer-events-none absolute inset-2 rounded-lg" preserveAspectRatio="none" aria-hidden>
            <Arrow from={bc} to={{ x: bc.x + ropeLen, y: bc.y }} color="#38bdf8" strokeWidth={3} headSize={9} opacity={0.9} />
            {fricShow ? (
              <Arrow
                from={bc}
                to={{ x: bc.x - sign(boxRef.current.vx || controls.ropeForceN) * fricLen, y: bc.y }}
                color="#f97316"
                strokeWidth={2.5}
                headSize={8}
                opacity={0.85}
              />
            ) : null}
            <Arrow from={bc} to={{ x: bc.x + sign(boxRef.current.vx) * 22, y: bc.y }} color="rgb(251 191 129)" strokeWidth={2} headSize={6} />
          </svg>
        </div>
      </div>
      <aside className="flex min-w-0 flex-col gap-4">
        {playbackSlot}
        <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
          <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-sky-300">Work (cumulative)</p>
          <p className="mt-1 text-[0.6rem] text-slate-500">Horizontal · static friction does no work when Δx = 0</p>
          <div className="mt-2 space-y-1">
            <WorkMetricRow label="Applied (rope)" valueJ={workUi.applied} />
            <WorkMetricRow label="Friction" valueJ={workUi.friction} />
            <WorkMetricRow label="Normal" valueJ={workUi.normal} />
            <WorkMetricRow label="Gravity" valueJ={workUi.gravity} />
            <WorkMetricRow label="Net" valueJ={workUi.net} />
          </div>
        </div>
        <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/70 p-3">
          <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-sky-300">Controls</p>
          <ControlRow label="Rope pull" queryKey="friction-rope-force" units="N" min={0} max={60} step={0.5} value={controls.ropeForceN} onChange={(v) => onControlChange('ropeForceN', v)} disabled={false} />
          <ControlRow label="Mass" queryKey="friction-mass" units="kg" min={0.5} max={20} step={0.1} value={controls.massKg} onChange={(v) => onControlChange('massKg', v)} disabled={disabled} />
          <ControlRow label={<>μₖ</>} queryKey="friction-muk" units="" min={0} max={1} step={0.01} value={controls.muK} onChange={(v) => onControlChange('muK', v)} disabled={disabled} />
          <ControlRow label={<>μₛ</>} queryKey="friction-mus" units="" min={0} max={1} step={0.01} value={controls.muS} onChange={(v) => onControlChange('muS', v)} disabled={disabled} />
        </div>
      </aside>
    </div>
  );
}

// =============================================================================
// Spring + friction
// =============================================================================

const WALL_RX = 22;
const NATURAL_PX = 200;
const PX_PER_M = 24;
const CVW = 640;
const CVH = 200;
const GROUND_Y = CVH - 28;
const BLK = 52;
const BCY = GROUND_Y - BLK / 2;

function springPathCoils(length: number, coils = 9): string {
  const L = Math.max(60, length);
  const lead = 12;
  const trail = 12;
  const body = Math.max(20, L - lead - trail);
  const step = body / (coils * 2);
  const amp = 12;
  let d = `M 0 30 L ${lead} 30`;
  for (let i = 0; i < coils * 2; i++) {
    const x = lead + step * (i + 1);
    const y = i % 2 === 0 ? 30 - amp : 30 + amp;
    d += ` L ${x} ${y}`;
  }
  d += ` L ${L} 30`;
  return d;
}

export type SpringControls = {
  massKg: number;
  springKNm: number;
  initialDisplacementM: number;
  muS: number;
  muK: number;
};

export function SpringWorkSim({
  controls,
  disabled,
  onControlChange,
  isRunning,
  runEpoch,
  active,
  playbackSlot,
}: {
  controls: SpringControls;
  disabled: boolean;
  onControlChange: (field: keyof SpringControls, value: number) => void;
  isRunning: boolean;
  runEpoch: number;
  active: boolean;
  playbackSlot: ReactNode;
}) {
  const cRef = useRef(controls);
  const xRef = useRef(0);
  const vRef = useRef(0);
  const workRef = useRef({ spring: 0, friction: 0, net: 0 });
  const [workUi, setWorkUi] = useState(workRef.current);
  const [ui, setUi] = useState({ x: 0, v: 0, Fsp: 0, Ff: 0, te: 0 });
  const isRunningRef = useRef(false);
  const animRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const lastUiRef = useRef<number | null>(null);

  useEffect(() => {
    cRef.current = controls;
  }, [controls]);
  useEffect(() => {
    isRunningRef.current = isRunning && active;
  }, [isRunning, active]);

  const resetSimulation = useCallback(() => {
    const c = cRef.current;
    xRef.current = clamp(c.initialDisplacementM, -5, 5);
    vRef.current = 0;
    workRef.current = { spring: 0, friction: 0, net: 0 };
    setWorkUi({ ...workRef.current });
    const m = c.massKg;
    const k = c.springKNm;
    const x = xRef.current;
    const v = 0;
    setUi({
      x,
      v,
      Fsp: -k * x,
      Ff: Math.abs(-k * x) <= c.muS * m * G_M_S2 ? k * x : -sign(x) * c.muK * m * G_M_S2,
      te: 0.5 * k * x * x,
    });
  }, []);

  useEffect(() => {
    resetSimulation();
  }, [runEpoch, resetSimulation]);

  const stepOnce = useCallback((dt: number) => {
    const c = cRef.current;
    const m = Math.max(0.5, c.massKg);
    const k = c.springKNm;
    const fs = c.muS * m * G_M_S2;
    const fk = c.muK * m * G_M_S2;
    const vEps = 1e-3;

    let x = xRef.current;
    let v = vRef.current;
    const x0 = x;
    const Fsp = -k * x;
    let Ff = 0;

    if (Math.abs(v) < vEps && Math.abs(Fsp) <= fs) {
      Ff = -Fsp;
      v = 0;
    } else {
      if (Math.abs(v) < vEps) {
        Ff = Math.sign(x) * fk;
      } else {
        Ff = -sign(v) * fk;
      }
      const a = (Fsp + Ff) / m;
      v += a * dt;
      x += v * dt;
    }

    const dx = x - x0;
    workRef.current.spring += Fsp * dx;
    workRef.current.friction += Ff * dx;
    workRef.current.net += (Fsp + Ff) * dx;

    xRef.current = x;
    vRef.current = v;

    const ke = 0.5 * m * v * v;
    const pe = 0.5 * k * x * x;
    setUi({ x, v, Fsp: -k * x, Ff, te: ke + pe });
  }, []);

  const loop = useCallback(
    (ts: number) => {
      if (!isRunningRef.current) {
        animRef.current = null;
        lastTsRef.current = null;
        return;
      }
      if (lastTsRef.current == null) {
        lastTsRef.current = ts;
        animRef.current = requestAnimationFrame(loop);
        return;
      }
      const dt = clamp(((ts - lastTsRef.current) / 1000) * SIMULATION_SPEED, 0, MAX_SIM_DT);
      lastTsRef.current = ts;
      stepOnce(dt);
      const now = performance.now();
      if (lastUiRef.current == null || now - lastUiRef.current >= FRAME_INTERVAL_MS) {
        lastUiRef.current = now;
        setWorkUi({ ...workRef.current });
      }
      animRef.current = requestAnimationFrame(loop);
    },
    [stepOnce],
  );

  useEffect(() => {
    if (!isRunning || !active) {
      if (animRef.current != null) cancelAnimationFrame(animRef.current);
      animRef.current = null;
      lastTsRef.current = null;
      return;
    }
    lastTsRef.current = null;
    animRef.current = requestAnimationFrame(loop);
    return () => {
      if (animRef.current != null) cancelAnimationFrame(animRef.current);
    };
  }, [isRunning, active, loop]);

  const springLen = clamp(NATURAL_PX + ui.x * PX_PER_M, 70, 420);
  const boxCx = WALL_RX + springLen;
  const eqX = WALL_RX + NATURAL_PX;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(260px,22rem)] lg:items-start">
      <div className="min-w-0 overflow-hidden rounded-xl border border-slate-800 bg-slate-950/70 p-2">
        <svg viewBox={`0 0 ${CVW} ${CVH}`} className="h-auto w-full max-h-[13rem]" aria-hidden>
          <rect width={CVW} height={CVH} fill="rgba(2,6,23,0.5)" />
          <line x1="0" y1={GROUND_Y} x2={CVW} y2={GROUND_Y} stroke="rgba(148,163,184,0.55)" strokeWidth="3" />
          <text x="8" y={CVH - 8} fill="rgba(148,163,184,0.85)" fontSize="11">
            Horizontal surface with friction
          </text>
          <rect x="0" y="48" width={WALL_RX} height={GROUND_Y - 48} fill="rgba(51,65,85,0.85)" />
          <line x1={eqX} y1="42" x2={eqX} y2={GROUND_Y} stroke="rgba(251,191,36,0.35)" strokeWidth="2" strokeDasharray="6 5" />
          <g transform={`translate(${WALL_RX}, ${BCY - 30})`}>
            <svg width={springLen + 4} height="60" viewBox={`0 0 ${springLen + 4} 60`} preserveAspectRatio="none">
              <path d={springPathCoils(springLen)} fill="none" stroke="rgb(56 189 248)" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </g>
          <rect
            x={boxCx - BLK / 2}
            y={GROUND_Y - BLK}
            width={BLK}
            height={BLK}
            rx="5"
            fill="rgba(52,211,153,0.92)"
            stroke="rgba(6,95,70,0.95)"
            strokeWidth="2"
          />
          <circle cx={boxCx} cy={BCY} r="4" fill="rgba(167,243,208,0.9)" />
          {ui.Fsp !== 0 ? (
            <Arrow from={{ x: boxCx, y: BCY }} to={{ x: boxCx + clamp(ui.Fsp * 0.45, -95, 95), y: BCY }} color="rgb(248 113 113)" strokeWidth={4} headSize={10} />
          ) : null}
          {Math.abs(ui.Ff) > 1e-5 ? (
            <Arrow from={{ x: boxCx, y: BCY + 16 }} to={{ x: boxCx + clamp(ui.Ff * 0.5, -80, 80), y: BCY + 16 }} color="#f97316" strokeWidth={3} headSize={8} />
          ) : null}
        </svg>
        <div className="mt-2 grid grid-cols-2 gap-2 text-[0.65rem] text-slate-400 sm:grid-cols-2">
          <span>x = {roundTo2(ui.x)} m</span>
          <span>v = {roundTo2(ui.v)} m/s</span>
          <span>TE ≈ {roundTo2(ui.te)} J</span>
          <span>|F_f| max ≈ {roundTo2(cRef.current.muK * cRef.current.massKg * G_M_S2)} N</span>
        </div>
      </div>
      <aside className="flex min-w-0 flex-col gap-4">
        {playbackSlot}
        <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
          <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-sky-300">Work (cumulative)</p>
          <p className="mt-1 text-[0.6rem] text-slate-500">Friction does negative work over a cycle; total mechanical energy decreases.</p>
          <div className="mt-2 space-y-1">
            <WorkMetricRow label="Spring" valueJ={workUi.spring} />
            <WorkMetricRow label="Friction" valueJ={workUi.friction} />
            <WorkMetricRow label="Net" valueJ={workUi.net} />
          </div>
        </div>
        <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/70 p-3">
          <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-sky-300">Controls</p>
          <ControlRow label="Mass" queryKey="spring-mass" units="kg" min={0.5} max={20} step={0.5} value={controls.massKg} onChange={(v) => onControlChange('massKg', v)} disabled={disabled} />
          <ControlRow label="k" queryKey="spring-k" units="N/m" min={1} max={50} step={1} value={controls.springKNm} onChange={(v) => onControlChange('springKNm', v)} disabled={disabled} />
          <ControlRow label="x₀" queryKey="spring-x0" units="m" min={-5} max={5} step={0.1} value={controls.initialDisplacementM} onChange={(v) => onControlChange('initialDisplacementM', v)} disabled={disabled} />
          <ControlRow label={<>μₛ</>} queryKey="spring-mus" units="" min={0} max={1} step={0.01} value={controls.muS} onChange={(v) => onControlChange('muS', v)} disabled={disabled} />
          <ControlRow label={<>μₖ</>} queryKey="spring-muk" units="" min={0} max={1} step={0.01} value={controls.muK} onChange={(v) => onControlChange('muK', v)} disabled={disabled} />
        </div>
      </aside>
    </div>
  );
}

// =============================================================================
// Page
// =============================================================================

type TabId = 'incline' | 'friction' | 'spring';

const DEF_I: InclineControls = { angleDeg: 25, muS: 0.55, muK: 0.35, massKg: 5 };
const DEF_F: FrictionControls = { massKg: 5, muK: 0.25, muS: 0.35, ropeForceN: 15 };
const DEF_S: SpringControls = { massKg: 5, springKNm: 10, initialDisplacementM: 2, muS: 0.35, muK: 0.25 };

export function WorkInDynamics() {
  const [tab, setTab] = useState<TabId>('incline');
  const [isRunning, setIsRunning] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [runEpoch, setRunEpoch] = useState(0);

  const [inclineC, setInclineC] = useState(DEF_I);
  const [frictionC, setFrictionC] = useState(DEF_F);
  const [springC, setSpringC] = useState(DEF_S);

  const handleStart = () => {
    setHasStarted(true);
    setRunEpoch((e) => e + 1);
    setIsRunning(true);
  };

  const handlePauseResume = () => {
    setIsRunning((r) => !r);
  };

  const workConceptItems = useMemo(
    () => [
      {
        title: 'Work as a dot product',
        description: (
          <>
            Each frame uses ΔW ≈ <span className="font-mono text-sky-200">F · Δr</span>. In 1-D motion, that is the force
            component along the displacement times the signed step. Forces with no component along the motion (like the
            normal on a straight path) contribute essentially zero work.
          </>
        ),
      },
      {
        title: 'Sign of the work',
        description: (
          <>
            Forces that have a component in the direction of motion do positive work; forces that oppose motion do
            negative work. Net work over an interval matches the change in kinetic energy (work–energy theorem).
          </>
        ),
      },
      {
        title: 'Static friction and zero displacement',
        description: (
          <>
            If there is no displacement at the contact patch, Δr = 0 and the work from static friction is zero—even when
            it balances other forces. On the rope tab, that is why pulling below the static threshold does not
            accumulate applied work on the block.
          </>
        ),
      },
      {
        title: 'Friction and mechanical energy',
        description: (
          <>
            Kinetic friction opposes sliding and does negative work whenever there is motion, removing mechanical energy
            from the macroscopic motion (often as heat). On the spring tab, watch total energy drift down while friction
            work accumulates negatively over many oscillations.
          </>
        ),
      },
    ],
    [],
  );

  const playbackSlot = (
    <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[0.65rem] font-semibold uppercase tracking-wide text-sky-300">Playback</h3>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={isRunning}
            onClick={handleStart}
            className="rounded-full bg-sky-500 px-3 py-1.5 text-[0.7rem] font-semibold text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-600"
          >
            {hasStarted && !isRunning ? 'Restart' : 'Start'}
          </button>
          <button
            type="button"
            disabled={!hasStarted}
            onClick={handlePauseResume}
            className="rounded-full border border-slate-700 px-3 py-1.5 text-[0.7rem] font-semibold disabled:opacity-40"
          >
            {isRunning ? 'Pause' : 'Resume'}
          </button>
        </div>
      </div>
      <p className="mt-2 text-[0.65rem] leading-relaxed text-slate-500">
        Start resets the active tab and zeroes work. Pause to edit sliders.
      </p>
    </div>
  );

  return (
    <div className="mx-auto flex min-h-screen max-w-[90rem] flex-col px-4 py-8 text-slate-100">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">Mechanics · Work</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">Work in Dynamics</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">
            Three classic setups in one view: integrate power into work with ΔW = F · Δr, tracked per force and summed over time.
          </p>
        </div>
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-sky-500 hover:text-sky-100"
        >
          ← Home
        </Link>
      </header>

      <div className="mb-6 flex flex-wrap gap-2 border-b border-slate-800 pb-2">
        {(
          [
            ['incline', 'Incline'],
            ['friction', 'Friction (rope)'],
            ['spring', 'Spring'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
              tab === id ? 'bg-sky-600 text-slate-950' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <main>
        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg">
          <h2 className="text-sm font-semibold tracking-wide text-sky-300">Simulation</h2>
          <div className="mt-4">
            {tab === 'incline' ? (
              <InclineWorkSim
                playbackSlot={playbackSlot}
                controls={inclineC}
                disabled={isRunning}
                onControlChange={(f, v) =>
                  setInclineC((p) => {
                    if (f === 'angleDeg') return { ...p, angleDeg: clamp(v, 0, MAX_INCLINE_ANGLE_DEG) };
                    if (f === 'muK') {
                      const muK = clamp(v, 0, 1);
                      return { ...p, muK, muS: Math.max(p.muS, muK) };
                    }
                    if (f === 'muS') {
                      const muS = clamp(v, 0, 1);
                      return { ...p, muS, muK: Math.min(p.muK, muS) };
                    }
                    return { ...p, massKg: clamp(v, 0.5, 20) };
                  })
                }
                isRunning={isRunning}
                runEpoch={runEpoch}
                active={tab === 'incline'}
              />
            ) : null}
            {tab === 'friction' ? (
              <FrictionWorkSim
                playbackSlot={playbackSlot}
                controls={frictionC}
                disabled={isRunning}
                onControlChange={(f, v) =>
                  setFrictionC((p) => {
                    if (f === 'muK') {
                      const muK = clamp(v, 0, 1);
                      return { ...p, muK, muS: Math.max(p.muS, muK) };
                    }
                    if (f === 'muS') {
                      const muS = clamp(v, 0, 1);
                      return { ...p, muS, muK: Math.min(p.muK, muS) };
                    }
                    if (f === 'massKg') return { ...p, massKg: clamp(v, 0.5, 20) };
                    return { ...p, ropeForceN: clamp(v, 0, 60) };
                  })
                }
                isRunning={isRunning}
                runEpoch={runEpoch}
                active={tab === 'friction'}
              />
            ) : null}
            {tab === 'spring' ? (
              <SpringWorkSim
                playbackSlot={playbackSlot}
                controls={springC}
                disabled={isRunning}
                onControlChange={(f, v) =>
                  setSpringC((p) => {
                    if (f === 'muS') {
                      const muS = clamp(v, 0, 1);
                      return { ...p, muS, muK: Math.min(p.muK, muS) };
                    }
                    if (f === 'muK') {
                      const muK = clamp(v, 0, 1);
                      return { ...p, muK, muS: Math.max(p.muS, muK) };
                    }
                    if (f === 'massKg') return { ...p, massKg: clamp(v, 0.5, 20) };
                    if (f === 'springKNm') return { ...p, springKNm: clamp(v, 1, 50) };
                    return { ...p, initialDisplacementM: clamp(v, -5, 5) };
                  })
                }
                isRunning={isRunning}
                runEpoch={runEpoch}
                active={tab === 'spring'}
              />
            ) : null}
          </div>
        </section>
      </main>

      <ConceptBox className="mt-8" heading="Explanation" items={workConceptItems} />
    </div>
  );
}
