// id="5r6p2z"
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

type Vec2 = { x: number; y: number };

const MAX_INCLINE_ANGLE_DEG = 30;

type ControlsState = {
  angleDeg: number; // 0 … 30°
  muS: number; // 0 -> 1
  muK: number; // 0 -> 1
};

const DEFAULT_CONTROLS: ControlsState = {
  angleDeg: 25,
  muS: 0.55,
  muK: 0.35,
};

const MASS_KG = 5;
const G_M_S2 = 9.8;

const BOX_SIZE_PX = 44;
const METERS_PER_PX = 0.05;

/** Matches the rounded-rect + grid inset in `render` (same as stroke at 6,6 … w-12,h-12). */
const GRID_INSET_PX = 6;

/** Canvas stroke width for the incline line — box must sit on the outer surface, not the stroke center. */
const PLANE_STROKE_PX = 16;

/** Extra inset so the full triangle + thick stroke stay inside the rounded view (avoids right-edge clip). */
const TRIANGLE_MARGIN_RIGHT_PX = 28;
const TRIANGLE_MARGIN_TOP_PX = 8;

const SIMULATION_SPEED = 1;
const TARGET_FPS = 60;
const FRAME_INTERVAL_MS = 1000 / TARGET_FPS;

const ARROW_SCALE_PX_PER_N = 1.6;
const ARROW_MAX_LEN_PX = 120;

const vEpsMPerS = 0.01;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function degToRad(deg: number) {
  return (deg * Math.PI) / 180;
}

function roundTo2(n: number) {
  return Math.round(n * 100) / 100;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

// Matches the arrow/vector system used in `ForceSimulator` (same geometry + styling).
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
      <line
        x1={from.x}
        y1={from.y}
        x2={baseX}
        y2={baseY}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <polygon
        points={`${to.x},${to.y} ${leftX},${leftY} ${rightX},${rightY}`}
        fill={color}
        stroke={color}
        strokeWidth={0.8}
      />
    </g>
  );
}

type ControlRowProps = {
  label: React.ReactNode;
  units?: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
};

function ControlRow({
  label,
  units,
  min,
  max,
  step,
  value,
  onChange,
  disabled = false,
}: ControlRowProps) {
  const handleSliderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    onChange(Number(event.target.value));
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const parsed = Number(event.target.value);
    if (Number.isNaN(parsed)) return;
    onChange(clamp(parsed, min, max));
  };

  return (
    <div className={`space-y-1.5 ${disabled ? 'pointer-events-none opacity-60' : ''}`}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-slate-200">{label}</p>
        <span className="text-[0.65rem] text-slate-400">
          {roundTo2(value).toFixed(2)} {units ? units : ''}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleSliderChange}
          disabled={disabled}
          className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-slate-800 accent-sky-400 disabled:cursor-not-allowed"
        />
        <div className="flex items-center gap-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1">
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={roundTo2(value)}
            onChange={handleInputChange}
            disabled={disabled}
            className="w-20 bg-transparent text-right text-[0.7rem] text-slate-100 outline-none disabled:cursor-not-allowed"
          />
          {units ? <span className="text-[0.65rem] text-slate-400">{units}</span> : null}
        </div>
      </div>
      <div className="flex justify-between text-[0.6rem] text-slate-500">
        <span>
          Min: {min} {units ?? ''}
        </span>
        <span>
          Max: {max} {units ?? ''}
        </span>
      </div>
    </div>
  );
}

type MetricRowProps = {
  label: React.ReactNode;
  value: number;
  units?: string;
};

function MetricRow({ label, value, units }: MetricRowProps) {
  return (
    <div className="flex items-baseline justify-between gap-3 rounded-md border border-slate-800 bg-slate-900/80 px-3 py-2">
      <span className="text-[0.7rem] text-slate-300">{label}</span>
      <span className="text-[0.7rem] font-mono text-sky-200">
        {roundTo2(value).toFixed(2)} {units ? <span className="text-[0.65rem] text-slate-400">{units}</span> : null}
      </span>
    </div>
  );
}

type InclineGeom = {
  angleRad: number;
  sinTheta: number;
  cosTheta: number;
  uDownSlope: Vec2; // unit vector along incline, positive downhill (apex → bottom-right)
  nOutward: Vec2; // unit vector outward normal (from plane into the box)
  topPx: Vec2; // ramp apex (left, high) in canvas CSS pixels
  baseLeftPx: Vec2; // bottom-left (triangle corner, on the base)
  baseRightPx: Vec2; // bottom-right (θ is measured here between base and incline)
  planeLengthPx: number;
  planeLengthM: number;
  effectiveAngleDeg: number; // angle of the drawn ramp vs horizontal (matches physics)
};

type UiSnapshot = {
  angleDeg: number;
  posS_m: number;
  velS_m_s: number;
  frictionMode: 'static' | 'kinetic';
  gravityForceN: number;
  normalForceN: number;
  gravityParallelN: number;
  gravityPerpN: number;
  frictionForceN: number; // magnitude
  netForceParallelN: number;
  boxCenterPx: Vec2;
};

export function BoxOnIncline() {
  const [controls, setControls] = useState<ControlsState>(DEFAULT_CONTROLS);
  const [isRunning, setIsRunning] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [uiSnapshot, setUiSnapshot] = useState<UiSnapshot>(() => ({
    angleDeg: DEFAULT_CONTROLS.angleDeg,
    posS_m: 0,
    velS_m_s: 0,
    frictionMode: 'static',
    gravityForceN: MASS_KG * G_M_S2,
    normalForceN: MASS_KG * G_M_S2,
    gravityParallelN: 0,
    gravityPerpN: MASS_KG * G_M_S2,
    frictionForceN: 0,
    netForceParallelN: 0,
    boxCenterPx: { x: 100, y: 100 },
  }));

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  const animationFrameIdRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);
  const lastVisualUpdateRef = useRef<number | null>(null);

  const controlsRef = useRef<ControlsState>(controls);
  const isRunningRef = useRef(isRunning);

  const viewSizeRef = useRef({ w: 560, h: 420 });
  const [viewSize, setViewSize] = useState(viewSizeRef.current);

  const geomRef = useRef<InclineGeom | null>(null);

  const posS_mRef = useRef<number>(0);
  const velS_m_sRef = useRef<number>(0);

  const frictionModeRef = useRef<'static' | 'kinetic'>('static');
  const derivedForcesRef = useRef<{
    gravityForceN: number;
    normalForceN: number;
    gravityParallelN: number;
    gravityPerpN: number;
    frictionForceN: number;
    netForceParallelN: number;
  }>({
    gravityForceN: MASS_KG * G_M_S2,
    normalForceN: MASS_KG * G_M_S2,
    gravityParallelN: 0,
    gravityPerpN: MASS_KG * G_M_S2,
    frictionForceN: 0,
    netForceParallelN: 0,
  });

  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  useEffect(() => {
    controlsRef.current = controls;
  }, [controls]);

  useEffect(() => {
    // Enforce constraint even if user edits values programmatically.
    setControls((prev) => {
      const nextAngleDeg = clamp(prev.angleDeg, 0, MAX_INCLINE_ANGLE_DEG);
      const nextMuK = clamp(prev.muK, 0, 1);
      const nextMuS = clamp(prev.muS, 0, 1);
      if (nextMuS < nextMuK) {
        return { ...prev, angleDeg: nextAngleDeg, muS: nextMuK, muK: nextMuK };
      }
      return { ...prev, angleDeg: nextAngleDeg, muS: nextMuS, muK: nextMuK };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const computeDerivedForces = (frictionMode: 'static' | 'kinetic') => {
    const geom = geomRef.current;
    if (!geom) {
      return derivedForcesRef.current;
    }

    const { sinTheta, cosTheta } = geom;
    const gravityForceN = MASS_KG * G_M_S2;
    const normalForceN = MASS_KG * G_M_S2 * cosTheta; // N = m g cosθ
    const gravityParallelN = MASS_KG * G_M_S2 * sinTheta; // mg sinθ
    const gravityPerpN = MASS_KG * G_M_S2 * cosTheta; // mg cosθ

    const { muK } = controlsRef.current;
    const fK = muK * normalForceN;

    if (frictionMode === 'static') {
      // Static friction cancels the tendency to slide (up the slope), so net force is ~0.
      return {
        gravityForceN,
        normalForceN,
        gravityParallelN,
        gravityPerpN,
        frictionForceN: gravityParallelN,
        netForceParallelN: 0,
      };
    }

    // Kinetic friction opposes downhill motion.
    const frictionForceN = fK;
    const netForceParallelN = gravityParallelN - frictionForceN;
    return {
      gravityForceN,
      normalForceN,
      gravityParallelN,
      gravityPerpN,
      frictionForceN,
      netForceParallelN,
    };
  };

  const syncSnapshot = () => {
    const geom = geomRef.current;
    if (!geom) return;

    const derived = derivedForcesRef.current;
    const posPx = posS_mRef.current / METERS_PER_PX;
    const contactOnSurfacePx = {
      x: geom.topPx.x + geom.uDownSlope.x * posPx + geom.nOutward.x * (PLANE_STROKE_PX / 2),
      y: geom.topPx.y + geom.uDownSlope.y * posPx + geom.nOutward.y * (PLANE_STROKE_PX / 2),
    };
    const boxCenterPx = {
      x: contactOnSurfacePx.x + geom.nOutward.x * (BOX_SIZE_PX / 2),
      y: contactOnSurfacePx.y + geom.nOutward.y * (BOX_SIZE_PX / 2),
    };

    setUiSnapshot({
      angleDeg: geom.effectiveAngleDeg,
      posS_m: posS_mRef.current,
      velS_m_s: velS_m_sRef.current,
      frictionMode: frictionModeRef.current,
      gravityForceN: derived.gravityForceN,
      normalForceN: derived.normalForceN,
      gravityParallelN: derived.gravityParallelN,
      gravityPerpN: derived.gravityPerpN,
      frictionForceN: derived.frictionForceN,
      netForceParallelN: derived.netForceParallelN,
      boxCenterPx,
    });
  };

  const render = () => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    const geom = geomRef.current;
    if (!canvas || !ctx || !geom) return;

    const w = viewSizeRef.current.w;
    const h = viewSizeRef.current.h;

    ctx.clearRect(0, 0, w, h);

    // Background gradient
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, 'rgba(2,6,23,0.95)');
    bg.addColorStop(1, 'rgba(15,23,42,0.95)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Container boundary
    ctx.save();
    ctx.strokeStyle = 'rgba(148,163,184,0.6)';
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, 6, 6, w - 12, h - 12, 14);
    ctx.stroke();
    ctx.restore();

    // Subtle grid
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = 'rgba(30,64,175,0.6)';
    ctx.lineWidth = 1;
    const step = 28;
    for (let x = 6; x < w - 6; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 6);
      ctx.lineTo(x, h - 6);
      ctx.stroke();
    }
    for (let y = 6; y < h - 6; y += step) {
      ctx.beginPath();
      ctx.moveTo(6, y);
      ctx.lineTo(w - 6, y);
      ctx.stroke();
    }
    ctx.restore();

    // Wedge under the ramp (triangle base along bottom, θ at bottom-right)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(geom.baseLeftPx.x, geom.baseLeftPx.y);
    ctx.lineTo(geom.baseRightPx.x, geom.baseRightPx.y);
    ctx.lineTo(geom.topPx.x, geom.topPx.y);
    ctx.closePath();
    ctx.fillStyle = 'rgba(4,120,87,0.18)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(4,120,87,0.45)';
    ctx.lineWidth = 1.25;
    ctx.stroke();
    ctx.restore();

    // Inclined plane (hypotenuse)
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(4,120,87,0.72)';
    ctx.lineWidth = PLANE_STROKE_PX;
    ctx.beginPath();
    ctx.moveTo(geom.topPx.x, geom.topPx.y);
    ctx.lineTo(geom.baseRightPx.x, geom.baseRightPx.y);
    ctx.stroke();
    ctx.restore();

    // Box (contact on outer surface of ramp stroke, not centerline)
    const posPx = posS_mRef.current / METERS_PER_PX;
    const contactOnSurfacePx = {
      x: geom.topPx.x + geom.uDownSlope.x * posPx + geom.nOutward.x * (PLANE_STROKE_PX / 2),
      y: geom.topPx.y + geom.uDownSlope.y * posPx + geom.nOutward.y * (PLANE_STROKE_PX / 2),
    };
    const centerPx = {
      x: contactOnSurfacePx.x + geom.nOutward.x * (BOX_SIZE_PX / 2),
      y: contactOnSurfacePx.y + geom.nOutward.y * (BOX_SIZE_PX / 2),
    };

    ctx.save();
    ctx.translate(centerPx.x, centerPx.y);
    ctx.rotate(geom.angleRad);
    const x = -BOX_SIZE_PX / 2;
    const y = -BOX_SIZE_PX / 2;
    ctx.fillStyle = '#38bdf8';
    ctx.strokeStyle = '#0ea5e9';
    ctx.lineWidth = 2;
    drawRoundedRect(ctx, x, y, BOX_SIZE_PX, BOX_SIZE_PX, 8);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // HUD labels inside the canvas (keeps arrows visually clean)
    const chipText = frictionModeRef.current === 'kinetic' ? 'Sliding · Kinetic friction' : 'At rest · Static friction';
    ctx.font =
      '12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
    ctx.fillStyle = 'rgba(226,232,240,0.85)';
    ctx.fillText(chipText, 14, 22);
    ctx.fillText(`θ ≈ ${geom.effectiveAngleDeg.toFixed(0)}°`, 14, 38);
    ctx.fillText(`s ≈ ${(posS_mRef.current).toFixed(2)} m`, 14, 54);
    ctx.fillText(`v ≈ ${(velS_m_sRef.current).toFixed(2)} m/s`, 14, 70);
  };

  const resetSimulation = (nextControls?: ControlsState) => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;

    const c = nextControls ?? controlsRef.current;
    const geomW = viewSizeRef.current.w;
    const geomH = viewSizeRef.current.h;

    const thetaRad = degToRad(c.angleDeg);

    // Right triangle: base along the bottom inner edge (left → right), incline from left apex
    // down to bottom-right. The angle at bottom-right between the base and the incline is θ.
    const innerLeft = GRID_INSET_PX;
    const innerRight = geomW - GRID_INSET_PX - TRIANGLE_MARGIN_RIGHT_PX;
    const innerTop = GRID_INSET_PX + TRIANGLE_MARGIN_TOP_PX;
    const innerBottom = geomH - GRID_INSET_PX;
    const baseW = Math.max(1, innerRight - innerLeft);
    const maxRise = Math.max(1, innerBottom - innerTop - 28);

    const risePx =
      thetaRad < 1e-7 ? 0 : Math.min(maxRise, baseW * Math.tan(thetaRad));
    const baseLeftPx = { x: innerLeft, y: innerBottom };
    const baseRightPx = { x: innerRight, y: innerBottom };
    const topPx = { x: innerLeft, y: innerBottom - risePx };

    const runPx = baseRightPx.x - topPx.x;
    const riseAlongPx = baseRightPx.y - topPx.y;
    const planeLengthPx = Math.max(1, Math.hypot(runPx, riseAlongPx));
    const planeLengthM = planeLengthPx * METERS_PER_PX;

    const uDownSlope = { x: runPx / planeLengthPx, y: riseAlongPx / planeLengthPx };
    // Perpendicular to the ramp, pointing from the surface toward the open air above the wedge (screen y decreases).
    const nOutward = { x: uDownSlope.y, y: -uDownSlope.x };
    const sinTheta = riseAlongPx / planeLengthPx;
    const cosTheta = runPx / planeLengthPx;
    const angleRad = Math.atan2(riseAlongPx, runPx);
    const effectiveAngleDeg = (angleRad * 180) / Math.PI;

    geomRef.current = {
      angleRad,
      sinTheta,
      cosTheta,
      uDownSlope,
      nOutward,
      topPx,
      baseLeftPx,
      baseRightPx,
      planeLengthPx,
      planeLengthM,
      effectiveAngleDeg,
    };

    posS_mRef.current = clamp(planeLengthM * 0.25, 0, Math.max(0, planeLengthM - 0.01));
    velS_m_sRef.current = 0;
    frictionModeRef.current = 'static';

    derivedForcesRef.current = computeDerivedForces('static');
    render();
    syncSnapshot();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;

      const rect = parent.getBoundingClientRect();
      const dpr = Math.max(1, window.devicePixelRatio || 1);

      const nextW = Math.max(560, Math.floor(rect.width));
      const nextH = Math.max(420, Math.floor(rect.height));

      canvas.width = Math.floor(nextW * dpr);
      canvas.height = Math.floor(nextH * dpr);
      canvas.style.width = `${nextW}px`;
      canvas.style.height = `${nextH}px`;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      ctxRef.current = ctx;

      const viewW = canvas.clientWidth || nextW;
      const viewH = canvas.clientHeight || nextH;
      viewSizeRef.current = { w: viewW, h: viewH };
      setViewSize({ w: viewW, h: viewH });

      // Reset to keep geometry + visualization consistent.
      resetSimulation(controlsRef.current);
    };

    resize();
    const ro = new ResizeObserver(() => resize());
    ro.observe(canvas.parentElement ?? canvas);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stepPhysics = (dt: number) => {
    const geom = geomRef.current;
    if (!geom) return;

    const { muS, muK } = controlsRef.current;
    const posS = posS_mRef.current;
    const velS = velS_m_sRef.current;

    const gravityParallelN = MASS_KG * G_M_S2 * geom.sinTheta;
    const normalForceN = MASS_KG * G_M_S2 * geom.cosTheta;

    const fSMax = muS * normalForceN;
    const fK = muK * normalForceN;

    // Decide static vs kinetic friction using the current "would-be" downhill tendency.
    let nextFrictionMode: 'static' | 'kinetic' = 'kinetic';
    let frictionForceN = fK; // magnitude
    let netForceParallelN = gravityParallelN - frictionForceN;

    const stoppingNow = Math.abs(velS) <= vEpsMPerS;
    if (stoppingNow && gravityParallelN <= fSMax + 1e-9) {
      nextFrictionMode = 'static';
      frictionForceN = gravityParallelN; // cancels the downhill component
      netForceParallelN = 0;
    }

    const acceleration = nextFrictionMode === 'static' ? 0 : netForceParallelN / MASS_KG;

    let nextVel = velS + acceleration * dt;
    let nextPos = posS + nextVel * dt;

    // Clamp to incline endpoints with an inelastic stop.
    if (nextPos < 0) {
      nextPos = 0;
      nextVel = 0;
    }
    if (nextPos > geom.planeLengthM) {
      nextPos = geom.planeLengthM;
      nextVel = 0;
    }

    posS_mRef.current = nextPos;
    velS_m_sRef.current = nextVel;
    frictionModeRef.current = nextFrictionMode;

    derivedForcesRef.current = computeDerivedForces(nextFrictionMode);
    derivedForcesRef.current.netForceParallelN = netForceParallelN; // preserve computed net

    render();
  };

  const startLoopIfNeeded = () => {
    if (animationFrameIdRef.current != null || !isRunningRef.current) return;
    const loop = (ts: number) => {
      if (!isRunningRef.current) {
        animationFrameIdRef.current = null;
        lastTimestampRef.current = null;
        return;
      }
      if (lastTimestampRef.current == null) {
        lastTimestampRef.current = ts;
        animationFrameIdRef.current = requestAnimationFrame(loop);
        return;
      }

      const realDt = (ts - lastTimestampRef.current) / 1000;
      lastTimestampRef.current = ts;
      const dt = clamp(realDt * SIMULATION_SPEED, 0, 1 / 30);

      stepPhysics(dt);

      const now = performance.now();
      if (lastVisualUpdateRef.current == null || now - lastVisualUpdateRef.current >= FRAME_INTERVAL_MS) {
        lastVisualUpdateRef.current = now;
        syncSnapshot();
      }

      animationFrameIdRef.current = requestAnimationFrame(loop);
    };

    animationFrameIdRef.current = requestAnimationFrame(loop);
  };

  useEffect(() => {
    if (isRunningRef.current) startLoopIfNeeded();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning]);

  useEffect(() => {
    // If the user edits parameters while paused, keep visualization + arrows consistent.
    if (isRunningRef.current) return;
    resetSimulation(controls);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controls.angleDeg, controls.muS, controls.muK]);

  const handleControlChange = (field: keyof ControlsState, value: number) => {
    setControls((prev) => {
      if (field === 'angleDeg') {
        return { ...prev, angleDeg: clamp(value, 0, MAX_INCLINE_ANGLE_DEG) };
      }
      if (field === 'muK') {
        const muK = clamp(value, 0, 1);
        const muS = Math.max(prev.muS, muK); // enforce μs >= μk
        return { ...prev, muK, muS };
      }
      if (field === 'muS') {
        const muS = clamp(value, 0, 1);
        const muK = Math.min(prev.muK, muS); // enforce μs >= μk
        return { ...prev, muS, muK };
      }
      return prev;
    });
  };

  const handleStartOrRestart = () => {
    resetSimulation(controls);
    setHasStarted(true);
    isRunningRef.current = true;
    setIsRunning(true);
    startLoopIfNeeded();
  };

  const handleToggleRunning = () => {
    if (isRunningRef.current) {
      isRunningRef.current = false;
      setIsRunning(false);
      if (animationFrameIdRef.current != null) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
    } else {
      isRunningRef.current = true;
      setIsRunning(true);
      startLoopIfNeeded();
    }
  };

  useEffect(() => {
    return () => {
      if (animationFrameIdRef.current != null) cancelAnimationFrame(animationFrameIdRef.current);
    };
  }, []);

  const frictionChip = useMemo(() => {
    if (uiSnapshot.frictionMode === 'kinetic') return 'Sliding · Kinetic friction';
    return 'At rest · Static friction';
  }, [uiSnapshot.frictionMode]);

  const geom = geomRef.current;
  const boxCenter = uiSnapshot.boxCenterPx;

  const forceGravityDir = { x: 0, y: 1 };
  const frictionDir = geom ? { x: -geom.uDownSlope.x, y: -geom.uDownSlope.y } : { x: 0, y: 0 };
  const normalDir = geom ? geom.nOutward : { x: 0, y: 0 };
  const parallelDir = geom ? geom.uDownSlope : { x: 0, y: 0 };
  const perpGravityDir = geom ? { x: -geom.nOutward.x, y: -geom.nOutward.y } : { x: 0, y: 0 };

  const gravityForceN = uiSnapshot.gravityForceN;
  const normalForceN = uiSnapshot.normalForceN;
  const frictionForceN = uiSnapshot.frictionForceN;

  const makeArrowTip = (dir: Vec2, magnitudeN: number) => {
    const len = Math.min(ARROW_MAX_LEN_PX, magnitudeN * ARROW_SCALE_PX_PER_N);
    return { x: boxCenter.x + dir.x * len, y: boxCenter.y + dir.y * len };
  };

  const gravityArrow =
    gravityForceN > 0 ? (
      <Arrow
        from={boxCenter}
        to={makeArrowTip(forceGravityDir, gravityForceN)}
        color="#a78bfa"
        strokeWidth={2.5}
        headSize={8}
        opacity={0.45}
      />
    ) : null;

  const normalArrow =
    normalForceN > 0 ? (
      <Arrow
        from={boxCenter}
        to={makeArrowTip(normalDir, normalForceN)}
        color="#22c55e"
        strokeWidth={2.3}
        headSize={8}
        opacity={0.75}
      />
    ) : null;

  const frictionArrow =
    frictionForceN > 0 ? (
      <Arrow
        from={boxCenter}
        to={makeArrowTip(frictionDir, frictionForceN)}
        color="#f97316"
        strokeWidth={2.3}
        headSize={8}
        opacity={0.9}
      />
    ) : null;

  const netArrow =
    uiSnapshot.netForceParallelN !== 0 && geom ? (
      <Arrow
        from={boxCenter}
        to={makeArrowTip(parallelDir, Math.abs(uiSnapshot.netForceParallelN))}
        color="#f97373"
        strokeWidth={3}
        headSize={10}
        opacity={0.95}
      />
    ) : null;

  const gravityParallelArrow =
    uiSnapshot.gravityParallelN > 0 && geom ? (
      <Arrow
        from={boxCenter}
        to={makeArrowTip(parallelDir, uiSnapshot.gravityParallelN)}
        color="#38bdf8"
        strokeWidth={2}
        headSize={7}
        opacity={0.28}
      />
    ) : null;

  const gravityPerpArrow =
    uiSnapshot.gravityPerpN > 0 && geom ? (
      <Arrow
        from={boxCenter}
        to={makeArrowTip(perpGravityDir, uiSnapshot.gravityPerpN)}
        color="#eab308"
        strokeWidth={2}
        headSize={7}
        opacity={0.22}
      />
    ) : null;

  return (
    <div className="mx-auto flex min-h-screen max-w-[90rem] flex-col px-4 py-8 text-slate-100">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">
            Incline friction demo
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
            Box on an Incline
          </h1>
          <p className="mt-2 max-w-xl text-sm text-slate-300">
            A box on a tilted plane: gravity is decomposed into parallel/perpendicular components, and
            friction decides whether the box stays put or slides.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-sky-500 hover:text-sky-100"
          >
            <span className="text-sm">←</span>
            Back to welcome
          </Link>
          <span className="inline-flex items-center gap-2 rounded-full border border-sky-700/60 bg-sky-900/60 px-3 py-1 text-[0.7rem] font-medium text-sky-100">
            {frictionChip}
          </span>
        </div>
      </header>

      <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/40">
        <h2 className="text-sm font-semibold tracking-wide text-sky-300">Color key</h2>
        <p className="mt-1 text-xs text-slate-300">
          Arrow colors indicate each force (and gravity components) drawn on the incline canvas.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex items-center gap-2">
            <span
              className="h-3 w-8 shrink-0 rounded border border-slate-500/50 opacity-60"
              style={{ backgroundColor: '#a78bfa' }}
              aria-hidden
            />
            <span className="text-xs text-slate-200">Gravity (mg)</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="h-3 w-8 shrink-0 rounded border border-slate-500/50"
              style={{ backgroundColor: '#22c55e' }}
              aria-hidden
            />
            <span className="text-xs text-slate-200">Normal force (N)</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="h-3 w-8 shrink-0 rounded border border-slate-500/50"
              style={{ backgroundColor: '#f97316' }}
              aria-hidden
            />
            <span className="text-xs text-slate-200">Friction (f)</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="h-3 w-8 shrink-0 rounded border border-slate-500/50"
              style={{ backgroundColor: '#38bdf8' }}
              aria-hidden
            />
            <span className="text-xs text-slate-200">Gravity parallel (mg sinθ)</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="h-3 w-8 shrink-0 rounded border border-slate-500/50"
              style={{ backgroundColor: '#eab308' }}
              aria-hidden
            />
            <span className="text-xs text-slate-200">Gravity perpendicular (mg cosθ)</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="h-3 w-8 shrink-0 rounded border border-red-400/60"
              style={{ backgroundColor: '#f97373' }}
              aria-hidden
            />
            <span className="text-xs text-slate-200">Net force (parallel)</span>
          </div>
        </div>
      </section>

      <main className="grid gap-6 lg:grid-cols-[minmax(0,2.75fr)_minmax(0,1fr)]">
        <section className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/40">
          <div className="pointer-events-none absolute inset-0 -z-10 opacity-70">
            <div className="absolute -left-32 top-0 h-64 w-64 rounded-full bg-sky-700/30 blur-3xl" />
            <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-blue-500/25 blur-3xl" />
          </div>

          <h2 className="text-sm font-semibold tracking-wide text-sky-300">Visualizing incline forces</h2>
          <p className="mt-1 text-xs text-slate-300">
            Gravity points straight down. Its components set the required friction (static) or the net
            acceleration (kinetic). All arrows originate from the box&apos;s center.
          </p>

          <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(10rem,12rem)] lg:items-start">
            <div className="relative isolate min-h-[24rem] h-[30rem] min-w-0 overflow-hidden rounded-xl border border-slate-800 bg-gradient-to-tr from-slate-950 via-slate-950/95 to-slate-900/80 p-4">
              <div className="relative h-full w-full">
                <canvas ref={canvasRef} className="h-full w-full rounded-lg bg-slate-950/60" />
                <svg
                  viewBox={`0 0 ${viewSize.w} ${viewSize.h}`}
                  className="pointer-events-none absolute inset-0 h-full w-full rounded-lg"
                  preserveAspectRatio="none"
                  aria-hidden
                >
                  {gravityParallelArrow}
                  {gravityPerpArrow}
                  {gravityArrow}
                  {normalArrow}
                  {frictionArrow}
                  {netArrow}
                </svg>
              </div>
            </div>

            <aside className="relative z-10 flex min-w-0 w-full flex-col gap-2 self-stretch rounded-xl border border-slate-800 bg-slate-950/80 p-2.5 text-[0.75rem] text-slate-300 lg:w-auto">
              <p className="shrink-0 font-semibold text-sky-200">Live summary</p>
              <div className="space-y-1.5">
                <MetricRow label="θ" value={uiSnapshot.angleDeg} units="°" />
                <MetricRow label="Normal N" value={uiSnapshot.normalForceN} units="N" />
                <MetricRow label="Friction |f|" value={uiSnapshot.frictionForceN} units="N" />
                <MetricRow
                  label="Net (parallel)"
                  value={Math.abs(uiSnapshot.netForceParallelN)}
                  units="N"
                />
                <div className="rounded-md border border-slate-800 bg-slate-900/80 px-3 py-2">
                  <p className="text-[0.7rem] text-slate-300">Friction mode</p>
                  <p className="mt-1 text-[0.7rem] font-mono text-sky-200">
                    {uiSnapshot.frictionMode === 'kinetic' ? 'kinetic (sliding)' : 'static (sticking)'}
                  </p>
                </div>
              </div>
            </aside>
          </div>
        </section>

        <section className="flex min-h-[30rem] flex-col space-y-4 rounded-2xl border border-slate-800 bg-slate-950/80 p-5 shadow-lg shadow-slate-950/40">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold tracking-wide text-sky-300">Controls</h2>
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

          <p className="text-xs text-slate-300">
            Adjust angle and friction coefficients while paused. The simulation enforces the constraint
            μ<sub>s</sub> ≥ μ<sub>k</sub> automatically.
          </p>

          <div className="mt-3 space-y-4 text-xs">
            <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-3">
              <ControlRow
                label={
                  <span>
                    Incline Angle <span>(θ)</span>
                  </span>
                }
                units="°"
                min={0}
                max={MAX_INCLINE_ANGLE_DEG}
                step={1}
                value={controls.angleDeg}
                onChange={(v) => handleControlChange('angleDeg', v)}
                disabled={isRunning}
              />
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-3">
              <ControlRow
                label={<span>Coefficient of Static Friction (μ<sub>s</sub>)</span>}
                units=""
                min={0}
                max={1}
                step={0.01}
                value={controls.muS}
                onChange={(v) => handleControlChange('muS', v)}
                disabled={isRunning}
              />
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-3">
              <ControlRow
                label={<span>Coefficient of Kinetic Friction (μ<sub>k</sub>)</span>}
                units=""
                min={0}
                max={1}
                step={0.01}
                value={controls.muK}
                onChange={(v) => handleControlChange('muK', v)}
                disabled={isRunning}
              />
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/80 p-3 text-[0.7rem] text-slate-300">
            Constraint enforced:
            <span className="mx-1 rounded bg-slate-800 px-1 py-0.5 font-mono text-[0.65rem] text-sky-200">
              μₛ ≥ μₖ
            </span>
            . If you try to violate it, the simulation automatically adjusts the other value to
            maintain consistency.
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/40 lg:col-span-2">
          <h2 className="text-sm font-semibold tracking-wide text-sky-300">Concept explanation</h2>
          <div className="mt-3 grid gap-4 text-sm text-slate-300 md:grid-cols-2">
            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
              <p className="font-semibold text-slate-50">Force decomposition</p>
              <p className="mt-2 text-xs leading-relaxed">
                Weight has two components relative to the incline: parallel to the slope
                \(F_parallel = m g \sin\theta\), and perpendicular to the slope
                \(F_perp = m g \cos\theta\).
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
              <p className="font-semibold text-slate-50">Normal force and friction</p>
              <p className="mt-2 text-xs leading-relaxed">
                The normal force is \(N = m g \cos\theta\). Friction depends on this normal force:
                static friction can scale up to \(F_s \le \mu_s N\), while kinetic friction is
                \(F_k = \mu_k N\) once the box is sliding.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
              <p className="font-semibold text-slate-50">Why it starts or stops</p>
              <p className="mt-2 text-xs leading-relaxed">
                If \(F_parallel \le \mu_s N\), static friction matches the needed value and the
                net force along the incline is ~0, so the box stays at rest. If not, static friction
                can&apos;t hold and kinetic friction takes over, producing a non-zero net force and
                downhill acceleration.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
              <p className="font-semibold text-slate-50">What to look for in the arrows</p>
              <p className="mt-2 text-xs leading-relaxed">
                The violet arrow shows gravity, the green arrow shows the normal force, and the orange
                arrow shows friction (opposite the would-be motion). When the box is stuck, friction
                nearly cancels the gravity-parallel component; when it&apos;s sliding, the net arrow turns
                on and grows.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

