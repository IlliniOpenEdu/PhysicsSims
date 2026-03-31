import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

type ControlsState = {
  massKg: number;
  muK: number;
  muS: number;
  ropeForceN: number;
};

const DEFAULT_CONTROLS: ControlsState = {
  massKg: 5,
  muK: 0.25,
  muS: 0.35,
  ropeForceN: 15,
};

type Vec2 = { x: number; y: number };

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function roundTo2(n: number): number {
  return Math.round(n * 100) / 100;
}

function sign(n: number): number {
  if (n > 0) return 1;
  if (n < 0) return -1;
  return 0;
}

type SimBox = {
  pos: Vec2; // px (canvas coords), y down
  vel: Vec2; // px/s
  size: number; // px
  onGround: boolean;
  frictionMode: 'static' | 'kinetic';
};

const SIMULATION_SPEED = 1;
const TARGET_FPS = 60;
const FRAME_INTERVAL_MS = 1000 / TARGET_FPS;

const G_PX = 1200; // px/s^2 (used for N ≈ m g and friction)
const FORCE_TO_PX = 90; // 1 N -> px*kg/s^2 scale for horizontal rope force
const METERS_PER_PX = 0.05; // visualization scale: 1 px ≈ 0.05 m
const WALL_THICKNESS = 14;
const GROUND_THICKNESS = 18;
const BOX_SIZE = 38;

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

export function SimpleGravityAndFriction() {
  const [controls, setControls] = useState<ControlsState>(DEFAULT_CONTROLS);
  const [isRunning, setIsRunning] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);
  const lastVisualUpdateRef = useRef<number | null>(null);

  const isRunningRef = useRef(isRunning);
  const controlsRef = useRef(controls);

  const boxRef = useRef<SimBox>({
    pos: { x: 0, y: 0 },
    vel: { x: 0, y: 0 },
    size: BOX_SIZE,
    onGround: true,
    frictionMode: 'static',
  });

  const [uiSnapshot, setUiSnapshot] = useState(() => ({
    pos: boxRef.current.pos,
    vel: boxRef.current.vel,
    onGround: boxRef.current.onGround,
    frictionMode: boxRef.current.frictionMode,
  }));

  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  useEffect(() => {
    controlsRef.current = controls;
  }, [controls]);

  useEffect(() => {
    return () => {
      if (animationFrameIdRef.current != null) cancelAnimationFrame(animationFrameIdRef.current);
    };
  }, []);

  const resetSimulation = () => {
    const canvas = canvasRef.current;
    const viewH = canvas?.clientHeight ?? 480;

    boxRef.current = {
      pos: {
        x: 6 + WALL_THICKNESS + BOX_SIZE / 2 + 18,
        y: viewH - 6 - GROUND_THICKNESS - BOX_SIZE / 2,
      },
      vel: { x: 0, y: 0 },
      size: BOX_SIZE,
      onGround: true,
      frictionMode: 'static',
    };

    lastTimestampRef.current = null;
    lastVisualUpdateRef.current = null;
    setUiSnapshot({
      pos: boxRef.current.pos,
      vel: boxRef.current.vel,
      onGround: boxRef.current.onGround,
      frictionMode: boxRef.current.frictionMode,
    });
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
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      resetSimulation();
      if (ctx) {
        const viewW = canvas.clientWidth || nextW;
        const viewH2 = canvas.clientHeight || nextH;
        render(ctx, viewW, viewH2);
      }
    };

    resize();
    const ro = new ResizeObserver(() => resize());
    ro.observe(canvas.parentElement ?? canvas);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const render = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
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

    // Walls + ground
    ctx.save();
    ctx.fillStyle = 'rgba(30,41,59,0.85)';
    ctx.fillRect(6, 6, WALL_THICKNESS, h - 12);
    ctx.fillRect(w - 6 - WALL_THICKNESS, 6, WALL_THICKNESS, h - 12);
    ctx.fillStyle = 'rgba(4,120,87,0.55)';
    ctx.fillRect(6, h - 6 - GROUND_THICKNESS, w - 12, GROUND_THICKNESS);
    ctx.restore();

    // Subtle grid
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = 'rgba(30,64,175,0.6)';
    ctx.lineWidth = 1;
    const step = 28;
    for (let x = 6 + WALL_THICKNESS; x < w - 6 - WALL_THICKNESS; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 6);
      ctx.lineTo(x, h - 6);
      ctx.stroke();
    }
    for (let y = 6; y < h - 6 - GROUND_THICKNESS; y += step) {
      ctx.beginPath();
      ctx.moveTo(6, y);
      ctx.lineTo(w - 6, y);
      ctx.stroke();
    }
    ctx.restore();

    // Rope (from box to right wall)
    const box = boxRef.current;
    const half = box.size / 2;
    const ropeY = box.pos.y;
    const ropeStartX = box.pos.x + half;
    const ropeEndX = w - 6 - WALL_THICKNESS;
    ctx.save();
    ctx.strokeStyle = 'rgba(56,189,248,0.55)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(ropeStartX, ropeY);
    ctx.lineTo(ropeEndX, ropeY);
    ctx.stroke();
    ctx.restore();

    // Box
    const x = box.pos.x - half;
    const y = box.pos.y - half;
    ctx.save();
    ctx.fillStyle = '#38bdf8';
    ctx.strokeStyle = '#0ea5e9';
    ctx.lineWidth = 2;
    drawRoundedRect(ctx, x, y, box.size, box.size, 8);
    ctx.fill();
    ctx.stroke();

    // Rope + friction labels
    const label =
      box.frictionMode === 'static' ? 'static friction' : 'kinetic friction';
    ctx.font = '12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
    ctx.fillStyle = 'rgba(226,232,240,0.85)';
    ctx.fillText(label, 14, 22);
    ctx.fillText(`rope = ${controlsRef.current.ropeForceN.toFixed(1)} N →`, 14, 38);
    ctx.restore();
  };

  const stepPhysics = (dt: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    const box = boxRef.current;
    const half = box.size / 2;

    const leftLimit = 6 + WALL_THICKNESS + half;
    const rightLimit = w - 6 - WALL_THICKNESS - half;
    const floorY = h - 6 - GROUND_THICKNESS - half;

    // Box is always on the ground in this demo
    box.onGround = true;
    box.pos.y = floorY;
    box.vel.y = 0;

    const { massKg, muK, muS, ropeForceN } = controlsRef.current;
    const mass = Math.max(0.5, massKg);
    const forcePx = ropeForceN * FORCE_TO_PX; // px*kg/s^2 (so a = F/m works)

    const vX = box.vel.x;
    const speedX = Math.abs(vX);
    const vxEps = 4; // px/s threshold for "stopped"

    // Friction limits based on N ≈ m g
    const fSMax = muS * mass * G_PX;
    const fK = muK * mass * G_PX;

    if (speedX <= vxEps) {
      // Try to hold still using static friction.
      if (Math.abs(forcePx) <= fSMax) {
        box.vel.x = 0;
        box.frictionMode = 'static';
      } else {
        // Static friction breaks: start moving.
        const net = forcePx - sign(forcePx) * fK;
        const ax = net / mass;
        box.vel.x = ax * dt;
        box.frictionMode = 'kinetic';
      }
    } else {
      // Sliding: kinetic friction opposes velocity direction.
      const net = forcePx - sign(vX) * fK;
      const ax = net / mass;
      box.vel.x += ax * dt;
      // If friction over-corrects and would reverse direction, stop instead (captures sticking).
      if (sign(vX) !== 0 && sign(box.vel.x) !== sign(vX) && Math.abs(forcePx) <= fSMax) {
        box.vel.x = 0;
        box.frictionMode = 'static';
      } else {
        box.frictionMode = 'kinetic';
      }
    }

    box.pos.x += box.vel.x * dt;

    // Wall collisions (inelastic stop)
    if (box.pos.x < leftLimit) {
      box.pos.x = leftLimit;
      box.vel.x = 0;
    }
    if (box.pos.x > rightLimit) {
      box.pos.x = rightLimit;
      box.vel.x = 0;
    }

    render(ctx, w, h);
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
        const box = boxRef.current;
        setUiSnapshot({
          pos: { ...box.pos },
          vel: { ...box.vel },
          onGround: box.onGround,
          frictionMode: box.frictionMode,
        });
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
    // Ensure constraint always holds even if controls are edited elsewhere.
    setControls((prev) => {
      const muK = clamp(prev.muK, 0, 1);
      const muS = clamp(prev.muS, 0, 1);
      if (muS < muK) return { ...prev, muK, muS: muK };
      return { ...prev, muK, muS };
    });
  }, []);

  const handleControlChange = (field: keyof ControlsState, value: number) => {
    setControls((prev) => {
      if (field === 'muK') {
        const muK = clamp(value, 0, 1);
        const muS = Math.max(prev.muS, muK);
        return { ...prev, muK, muS };
      }
      if (field === 'muS') {
        const muS = clamp(value, 0, 1);
        const muK = Math.min(prev.muK, muS);
        return { ...prev, muS, muK };
      }
      if (field === 'massKg') {
        return { ...prev, massKg: clamp(value, 0.5, 20) };
      }
      if (field === 'ropeForceN') {
        return { ...prev, ropeForceN: clamp(value, 0, 60) };
      }
      return prev;
    });
  };

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

  const frictionChip = useMemo(() => {
    const mode = uiSnapshot.frictionMode;
    if (mode === 'kinetic') {
      return 'Sliding · Kinetic friction';
    }
    if (mode === 'static') {
      return 'At rest · Static friction';
    }
  }, [uiSnapshot.frictionMode]);

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-8 text-slate-100">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">
            Friction demo
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
            Simple Friction (Rope Pull)
          </h1>
          <p className="mt-2 max-w-xl text-sm text-slate-300">
            A box rests on the ground and is pulled to the right by a rope. Friction can keep the
            box stuck (static friction) or oppose motion while it slides (kinetic friction).
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

      <main className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/40">
          <div className="pointer-events-none absolute inset-0 -z-10 opacity-70">
            <div className="absolute -left-32 top-0 h-64 w-64 rounded-full bg-sky-700/30 blur-3xl" />
            <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-blue-500/25 blur-3xl" />
          </div>

          <h2 className="text-sm font-semibold tracking-wide text-sky-300">
            Visualizing rope pull + friction
          </h2>
          <p className="mt-1 text-xs text-slate-300">
            The rope pulls from the right (to the right). The left/right walls constrain the box to
            remain inside the container. The ground provides the normal force that makes friction
            possible.
          </p>

          <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-stretch">
            <div className="relative flex min-w-0 h-[30rem] flex-[2] rounded-xl border border-slate-800 bg-gradient-to-t from-slate-950 via-slate-950/95 to-slate-900/80 p-4">
              <canvas ref={canvasRef} className="h-full w-full rounded-lg bg-slate-950/60" />

              <div className="absolute left-3 top-3 rounded-md bg-slate-950/80 px-2 py-1 text-[0.6rem] text-slate-300 shadow">
                <p className="font-mono text-[0.6rem] text-slate-200">
                  contact = {uiSnapshot.onGround ? 'ground' : 'none'}
                </p>
                <p className="font-mono text-[0.6rem] text-sky-200">
                  x ≈ {(uiSnapshot.pos.x * METERS_PER_PX).toFixed(2)} m, y ≈{' '}
                  {(uiSnapshot.pos.y * METERS_PER_PX).toFixed(2)} m
                </p>
                <p className="font-mono text-[0.6rem] text-sky-200">
                  v ≈ ({(uiSnapshot.vel.x * METERS_PER_PX).toFixed(2)},{' '}
                  {(uiSnapshot.vel.y * METERS_PER_PX).toFixed(2)}) m/s
                </p>
              </div>
            </div>

            <div className="flex min-w-0 flex-1 max-w-[220px] flex-col gap-2 rounded-xl border border-slate-800 bg-slate-950/80 p-2.5 text-[0.75rem] text-slate-300">
              <p className="shrink-0 font-semibold text-sky-200">Live summary</p>
              <div className="space-y-1.5">
                <MetricRow label="Mass" value={controls.massKg} units="kg" />
                <MetricRow label="μₖ" value={controls.muK} units="" />
                <MetricRow label="μₛ" value={controls.muS} units="" />
                <MetricRow label="Rope force" value={controls.ropeForceN} units="N" />
                <MetricRow
                  label="Friction mode"
                  valueText={
                    uiSnapshot.frictionMode === 'kinetic'
                      ? 'kinetic'
                      : uiSnapshot.frictionMode === 'static'
                        ? 'static'
                        : 'none'
                  }
                />
              </div>
            </div>
          </div>
        </section>

        <section className="flex min-h-[30rem] flex-col space-y-4 rounded-2xl border border-slate-800 bg-slate-950/80 p-5 shadow-lg shadow-slate-950/40">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold tracking-wide text-sky-300">
              Controls
            </h2>
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
            Only the rope force can be changed while the simulation is running. Pause to adjust mass
            or friction coefficients. The simulation enforces the constraint μ<sub>s</sub> ≥ μ<sub>k</sub>.
          </p>

          <div className="mt-3 space-y-4 text-xs">
            <ControlRow
              label="Rope pull force"
              units="N"
              min={0}
              max={60}
              step={0.5}
              value={controls.ropeForceN}
              onChange={(v) => handleControlChange('ropeForceN', v)}
              disabled={false}
            />
            <ControlRow
              label="Mass"
              units="kg"
              min={0.5}
              max={20}
              step={0.1}
              value={controls.massKg}
              onChange={(v) => handleControlChange('massKg', v)}
              disabled={isRunning}
            />
            <ControlRow
              label={<><span>Kinetic friction </span>(μ<sub>k</sub>)</>}
              units=""
              min={0}
              max={1}
              step={0.01}
              value={controls.muK}
              onChange={(v) => handleControlChange('muK', v)}
              disabled={isRunning}
            />
            <ControlRow
              label={<><span>Static friction </span>(μ<sub>s</sub>)</>}
              units=""
              min={0}
              max={1}
              step={0.01}
              value={controls.muS}
              onChange={(v) => handleControlChange('muS', v)}
              disabled={isRunning}
            />
          </div>

          <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/80 p-3 text-[0.7rem] text-slate-300">
            Constraint enforced:
            <span className="mx-1 rounded bg-slate-800 px-1 py-0.5 font-mono text-[0.65rem] text-sky-200">
              μₛ ≥ μₖ
            </span>
            . If you raise μₖ above μₛ, the simulation automatically raises μₛ to match. If you
            lower μₛ below μₖ, μₖ is clamped down to μₛ.
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/40 lg:col-span-2">
          <h2 className="text-sm font-semibold tracking-wide text-sky-300">
            Concept explanation
          </h2>
          <div className="mt-3 grid gap-4 text-sm text-slate-300 md:grid-cols-2">
            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
              <p className="font-semibold text-slate-50">Normal force and friction</p>
              <p className="mt-2 text-xs leading-relaxed">
                The box rests on the ground, so the surface pushes back with a
                <span className="text-slate-100"> normal force</span> \(N\). Coulomb friction depends on
                this normal force: larger \(N\) means friction can be larger.
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
              <p className="font-semibold text-slate-50">Static vs. kinetic friction</p>
              <p className="mt-2 text-xs leading-relaxed">
                When the box is already sliding, the friction force magnitude is approximately
                \(F_k = μ_k N\) and points opposite the direction of motion. When the box is at rest,
                static friction can take on any value up to \(F_s \le μ_s N\) to prevent motion from
                starting.
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
              <p className="font-semibold text-slate-50">Why μₛ ≥ μₖ?</p>
              <p className="mt-2 text-xs leading-relaxed">
                It is typically harder to <span className="text-slate-100">start</span> motion than to
                <span className="text-slate-100"> keep</span> sliding once surfaces are already moving
                relative to each other. That&apos;s why the maximum static friction coefficient is
                usually greater than or equal to the kinetic friction coefficient.
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
              <p className="font-semibold text-slate-50">What to look for in the sim</p>
              <p className="mt-2 text-xs leading-relaxed">
                Increase the rope force slowly: if it stays below the maximum static friction, the
                box won&apos;t move. Once it exceeds that threshold, the box starts sliding and kinetic
                friction opposes the motion.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

type MetricRowProps = {
  label: React.ReactNode;
  value?: number;
  valueText?: string;
  units?: string;
};

function MetricRow({ label, value, valueText, units }: MetricRowProps) {
  const text = valueText ?? (value != null ? roundTo2(value).toFixed(2) : '—');
  return (
    <div className="flex items-baseline justify-between gap-3 rounded-md border border-slate-800 bg-slate-900/80 px-3 py-2">
      <span className="text-[0.7rem] text-slate-300">{label}</span>
      <span className="text-[0.7rem] font-mono text-sky-200">
        {text}
        {units ? <span className="text-[0.65rem] text-slate-400"> {units}</span> : null}
      </span>
    </div>
  );
}

type ControlRowProps = {
  label: React.ReactNode;
  units: string;
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
          {roundTo2(value).toFixed(2)} {units}
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
          <span className="text-[0.65rem] text-slate-400">{units}</span>
        </div>
      </div>
      <div className="flex justify-between text-[0.6rem] text-slate-500">
        <span>
          Min: {min} {units}
        </span>
        <span>
          Max: {max} {units}
        </span>
      </div>
    </div>
  );
}

