// id="ideal_gas_law_explorer"
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { SliderWithInput } from '../../../components/system/SliderWithInput';
import { ConceptBox } from '../../../components/system/ConceptBox';

type PressureMode = 'const-volume' | 'const-pressure' | 'free';
type PresetKey = 'smallCold' | 'hotCompressed' | 'largeContainer' | 'earthAtm' | 'highPressure';

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  m: number;
  r: number;
};

type DataSnapshot = {
  pressurePa: number;
  volumeM3: number;
  temperatureK: number;
  moles: number;
  pv: number;
  nrt: number;
  simTime: number;
};

type HighlightKey = 'P' | 'V' | 'n' | 'T' | null;

const R_GAS = 8.314462618;
const MOLAR_MASS_KG = 0.02897;
const PARTICLES_PER_MOLE = 1.5;
const MIN_PARTICLES = 4;
const MAX_PARTICLES = 16;
const VISUAL_SPEED_REF_MPS = 1.6;
const REF_TEMP_K = 300;

const CONTAINER_W_M = 0.36;
const CONTAINER_D_M = 0.1;
const MIN_HEIGHT_M = 0.06;
const MAX_HEIGHT_M = 0.68;
const PARTICLE_R_M = 0.012;
const WALL_INSET_M = PARTICLE_R_M + 0.002;

const CANVAS_W = 760;
const CANVAS_H = 420;
const CONTAINER_PAD = { left: 56, right: 56, bottom: 52, top: 36 };
const INNER_W_PX = CANVAS_W - CONTAINER_PAD.left - CONTAINER_PAD.right;
const INNER_H_PX = CANVAS_H - CONTAINER_PAD.bottom - CONTAINER_PAD.top;

const UI_PUSH_MS = 100;
const MAX_SIM_DT_S = 1 / 45;
const SUBSTEPS = 4;
const HIGHLIGHT_MS = 700;

const MIN_T_K = 50;
const MAX_T_K = 1000;
const MIN_N_MOL = 0.1;
const MAX_N_MOL = 10;

const PRESETS: Record<
  PresetKey,
  { label: string; temperatureK: number; moles: number; heightM: number; mode: PressureMode }
> = {
  smallCold: { label: 'Small cold gas', temperatureK: 120, moles: 0.3, heightM: 0.18, mode: 'free' },
  hotCompressed: { label: 'Hot compressed gas', temperatureK: 850, moles: 2.2, heightM: 0.1, mode: 'free' },
  largeContainer: { label: 'Large container', temperatureK: 320, moles: 1.2, heightM: 0.62, mode: 'free' },
  earthAtm: { label: 'Earth atmosphere approx.', temperatureK: 288, moles: 0.95, heightM: 0.64, mode: 'free' },
  highPressure: { label: 'High pressure tank', temperatureK: 310, moles: 9, heightM: 0.08, mode: 'free' },
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function volumeFromHeightM(h: number): number {
  return CONTAINER_W_M * CONTAINER_D_M * h;
}

function heightFromVolumeM3(v: number): number {
  const denom = CONTAINER_W_M * CONTAINER_D_M;
  return denom > 0 ? clamp(v / denom, MIN_HEIGHT_M, MAX_HEIGHT_M) : MIN_HEIGHT_M;
}

function pressureFromIdealGasLaw(moles: number, temperatureK: number, volumeM3: number): number {
  if (volumeM3 <= 0) return 0;
  return (moles * R_GAS * temperatureK) / volumeM3;
}

function particleCountFromMoles(n: number): number {
  return clamp(Math.round(3 + n * PARTICLES_PER_MOLE), MIN_PARTICLES, MAX_PARTICLES);
}

function particleMassKg(n: number, count: number): number {
  if (count <= 0) return 1e-24;
  return (n * MOLAR_MASS_KG) / count;
}

function visualSpeedMps(T: number): number {
  return VISUAL_SPEED_REF_MPS * Math.sqrt(T / REF_TEMP_K);
}

function randomVelocityAtT(T: number): { vx: number; vy: number } {
  const speed = visualSpeedMps(T) * (0.85 + Math.random() * 0.3);
  const angle = Math.random() * Math.PI * 2;
  return { vx: speed * Math.cos(angle), vy: speed * Math.sin(angle) };
}

function createParticles(
  moles: number,
  temperatureK: number,
  heightM: number,
): Particle[] {
  const count = particleCountFromMoles(moles);
  const m = particleMassKg(moles, count);
  const r = PARTICLE_R_M;
  const x0 = WALL_INSET_M;
  const x1 = CONTAINER_W_M - WALL_INSET_M;
  const y0 = WALL_INSET_M;
  const y1 = heightM - WALL_INSET_M;
  const particles: Particle[] = [];

  for (let i = 0; i < count; i++) {
    const x = x0 + Math.random() * (x1 - x0);
    const y = y0 + Math.random() * Math.max(1e-4, y1 - y0);
    const { vx, vy } = randomVelocityAtT(temperatureK);
    particles.push({ x, y, vx, vy, m, r });
  }
  return particles;
}

function rescaleTemperature(particles: Particle[], oldT: number, newT: number): void {
  if (oldT <= 0 || newT <= 0) return;
  const scale = Math.sqrt(newT / oldT);
  for (const p of particles) {
    p.vx *= scale;
    p.vy *= scale;
  }
}

function syncParticleCount(
  particles: Particle[],
  moles: number,
  temperatureK: number,
  heightM: number,
): Particle[] {
  const target = particleCountFromMoles(moles);
  const m = particleMassKg(moles, target);
  if (particles.length === target) {
    for (const p of particles) p.m = m;
    return particles;
  }
  if (particles.length < target) {
    const x0 = WALL_INSET_M;
    const x1 = CONTAINER_W_M - WALL_INSET_M;
    const y0 = WALL_INSET_M;
    const y1 = heightM - WALL_INSET_M;
    const next = particles.map((p) => ({ ...p, m }));
    while (next.length < target) {
      const { vx, vy } = randomVelocityAtT(temperatureK);
      next.push({
        x: x0 + Math.random() * (x1 - x0),
        y: y0 + Math.random() * Math.max(1e-4, y1 - y0),
        vx,
        vy,
        m,
        r: PARTICLE_R_M,
      });
    }
    return next;
  }
  return particles.slice(0, target).map((p) => ({ ...p, m }));
}

function resolveContainerWalls(
  p: Particle,
  bounds: { x0: number; x1: number; y0: number; y1: number },
): void {
  if (p.x - p.r < bounds.x0) {
    p.x = bounds.x0 + p.r;
    p.vx = Math.abs(p.vx);
  } else if (p.x + p.r > bounds.x1) {
    p.x = bounds.x1 - p.r;
    p.vx = -Math.abs(p.vx);
  }

  if (p.y - p.r < bounds.y0) {
    p.y = bounds.y0 + p.r;
    p.vy = Math.abs(p.vy);
  } else if (p.y + p.r > bounds.y1) {
    p.y = bounds.y1 - p.r;
    p.vy = -Math.abs(p.vy);
  }
}

function stepParticles(particles: Particle[], heightM: number, dt: number): void {
  const subDt = dt / SUBSTEPS;
  const bounds = {
    x0: WALL_INSET_M,
    x1: CONTAINER_W_M - WALL_INSET_M,
    y0: WALL_INSET_M,
    y1: heightM - WALL_INSET_M,
  };

  for (let s = 0; s < SUBSTEPS; s++) {
    for (const p of particles) {
      p.x += p.vx * subDt;
      p.y += p.vy * subDt;
    }
    for (const p of particles) {
      resolveContainerWalls(p, bounds);
    }
  }
}

function clampParticlesToBounds(particles: Particle[], heightM: number): void {
  const bounds = {
    x0: WALL_INSET_M,
    x1: CONTAINER_W_M - WALL_INSET_M,
    y0: WALL_INSET_M,
    y1: heightM - WALL_INSET_M,
  };
  for (const p of particles) {
    p.x = clamp(p.x, bounds.x0 + p.r, bounds.x1 - p.r);
    p.y = clamp(p.y, bounds.y0 + p.r, bounds.y1 - p.r);
  }
}

function metersToCanvas(xM: number, yM: number): { x: number; y: number } {
  const x = CONTAINER_PAD.left + (xM / CONTAINER_W_M) * INNER_W_PX;
  const y =
    CANVAS_H - CONTAINER_PAD.bottom - (yM / MAX_HEIGHT_M) * INNER_H_PX;
  return { x, y };
}

function canvasYMeters(yPx: number): number {
  const rel = CANVAS_H - CONTAINER_PAD.bottom - yPx;
  return clamp((rel / INNER_H_PX) * MAX_HEIGHT_M, MIN_HEIGHT_M, MAX_HEIGHT_M);
}

function formatSci(n: number, digits = 3): string {
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 1e5 || (Math.abs(n) > 0 && Math.abs(n) < 0.01)) {
    return n.toExponential(digits);
  }
  return n.toFixed(Math.abs(n) < 10 ? 2 : 1);
}

export function IdealGasLawExplorer() {
  const [temperatureK, setTemperatureK] = useState(300);
  const [moles, setMoles] = useState(1);
  const [heightM, setHeightM] = useState(0.35);
  const [mode, setMode] = useState<PressureMode>('free');
  const [isRunning, setIsRunning] = useState(true);
  const [snapshot, setSnapshot] = useState<DataSnapshot>(() => {
    const V = volumeFromHeightM(0.35);
    const n = 1;
    const T = 300;
    const P = pressureFromIdealGasLaw(n, T, V);
    return {
      pressurePa: P,
      volumeM3: V,
      temperatureK: T,
      moles: n,
      pv: P * V,
      nrt: n * R_GAS * T,
      simTime: 0,
    };
  });
  const [highlight, setHighlight] = useState<HighlightKey>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>(createParticles(1, 300, 0.35));
  const heightRef = useRef(0.35);
  const temperatureRef = useRef(300);
  const molesRef = useRef(1);
  const modeRef = useRef<PressureMode>('free');
  const runningRef = useRef(true);
  const simTimeRef = useRef(0);
  const lockedHeightRef = useRef(0.35);
  const targetPressureRef = useRef(101325);
  const lastUiPushRef = useRef(0);
  const highlightTimerRef = useRef<number | null>(null);
  const draggingPistonRef = useRef(false);
  const rafRef = useRef(0);
  const lastFrameRef = useRef(0);

  const flashHighlight = useCallback((key: HighlightKey) => {
    setHighlight(key);
    if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = window.setTimeout(() => setHighlight(null), HIGHLIGHT_MS);
  }, []);

  const applyHeight = useCallback(
    (h: number, flash = true) => {
      const clamped = clamp(h, MIN_HEIGHT_M, MAX_HEIGHT_M);
      heightRef.current = clamped;
      setHeightM(clamped);
      clampParticlesToBounds(particlesRef.current, clamped);
      if (flash) flashHighlight('V');
    },
    [flashHighlight],
  );

  const applyTemperature = useCallback(
    (T: number, flash = true) => {
      const clamped = clamp(T, MIN_T_K, MAX_T_K);
      rescaleTemperature(particlesRef.current, temperatureRef.current, clamped);
      temperatureRef.current = clamped;
      setTemperatureK(clamped);
      if (flash) flashHighlight('T');
    },
    [flashHighlight],
  );

  const applyMoles = useCallback(
    (n: number, flash = true) => {
      const clamped = clamp(n, MIN_N_MOL, MAX_N_MOL);
      particlesRef.current = syncParticleCount(
        particlesRef.current,
        clamped,
        temperatureRef.current,
        heightRef.current,
      );
      molesRef.current = clamped;
      setMoles(clamped);
      if (flash) flashHighlight('n');
    },
    [flashHighlight],
  );

  const reinitGas = useCallback(() => {
    particlesRef.current = createParticles(
      molesRef.current,
      temperatureRef.current,
      heightRef.current,
    );
    simTimeRef.current = 0;
  }, []);

  const adjustConstPressureVolume = useCallback(() => {
    if (modeRef.current !== 'const-pressure') return;
    const V = (molesRef.current * R_GAS * temperatureRef.current) / Math.max(1, targetPressureRef.current);
    applyHeight(heightFromVolumeM3(V), false);
  }, [applyHeight]);

  useEffect(() => {
    modeRef.current = mode;
    if (mode === 'const-volume') {
      lockedHeightRef.current = heightRef.current;
    } else if (mode === 'const-pressure') {
      const V = volumeFromHeightM(heightRef.current);
      targetPressureRef.current = pressureFromIdealGasLaw(
        molesRef.current,
        temperatureRef.current,
        V,
      );
      adjustConstPressureVolume();
    }
  }, [mode, adjustConstPressureVolume]);

  useEffect(() => {
    runningRef.current = isRunning;
  }, [isRunning]);

  useEffect(() => {
    heightRef.current = heightM;
  }, [heightM]);

  const handleReset = () => {
    reinitGas();
    const V = volumeFromHeightM(heightRef.current);
    const n = molesRef.current;
    const T = temperatureRef.current;
    const P = pressureFromIdealGasLaw(n, T, V);
    setSnapshot({
      pressurePa: P,
      volumeM3: V,
      temperatureK: T,
      moles: n,
      pv: P * V,
      nrt: n * R_GAS * T,
      simTime: 0,
    });
  };

  const applyPreset = (key: PresetKey) => {
    const p = PRESETS[key];
    applyTemperature(p.temperatureK, false);
    applyMoles(p.moles, false);
    applyHeight(p.heightM, false);
    setMode(p.mode);
    reinitGas();
  };

  const drawScene = useCallback((particles: Particle[], hM: number, P: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    const bl = metersToCanvas(0, 0);
    const tr = metersToCanvas(CONTAINER_W_M, hM);
    const containerW = tr.x - bl.x;
    const containerH = bl.y - tr.y;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(
      CONTAINER_PAD.left - 8,
      CONTAINER_PAD.top - 8,
      INNER_W_PX + 16,
      INNER_H_PX + 16,
    );
    ctx.setLineDash([]);

    const gasGrad = ctx.createLinearGradient(0, tr.y, 0, bl.y);
    gasGrad.addColorStop(0, 'rgba(56, 189, 248, 0.08)');
    gasGrad.addColorStop(1, 'rgba(14, 165, 233, 0.14)');
    ctx.fillStyle = gasGrad;
    ctx.fillRect(bl.x, tr.y, containerW, containerH);

    for (const p of particles) {
      const { x, y } = metersToCanvas(p.x, p.y);
      const speed = Math.hypot(p.vx, p.vy);
      const vmax = visualSpeedMps(temperatureRef.current) * 1.4;
      const t = clamp(speed / Math.max(0.1, vmax), 0, 1);
      const hue = 200 - t * 120;
      const radiusPx = Math.max(5, (p.r / CONTAINER_W_M) * INNER_W_PX);
      ctx.beginPath();
      ctx.fillStyle = `hsla(${hue}, 85%, 62%, 0.92)`;
      ctx.arc(x, y, radiusPx, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `hsla(${hue}, 90%, 75%, 0.35)`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (p.vx / vmax) * radiusPx * 2.2, y - (p.vy / vmax) * radiusPx * 2.2);
      ctx.stroke();
    }

    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(bl.x, bl.y);
    ctx.lineTo(bl.x + containerW, bl.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(bl.x, bl.y);
    ctx.lineTo(bl.x, tr.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(bl.x + containerW, bl.y);
    ctx.lineTo(bl.x + containerW, tr.y);
    ctx.stroke();

    const pistonY = tr.y;
    ctx.fillStyle = '#64748b';
    ctx.fillRect(bl.x - 6, pistonY - 10, containerW + 12, 12);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(bl.x + containerW * 0.42, pistonY - 22, containerW * 0.16, 14);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px ui-sans-serif, system-ui';
    ctx.fillText('Piston (drag)', bl.x + containerW * 0.38, pistonY - 26);
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`P = ${formatSci(P)} Pa`, bl.x, CONTAINER_PAD.top - 10);
  }, []);

  useEffect(() => {
    const tick = (now: number) => {
      rafRef.current = requestAnimationFrame(tick);
      if (!lastFrameRef.current) lastFrameRef.current = now;
      const dt = clamp((now - lastFrameRef.current) / 1000, 0, MAX_SIM_DT_S);
      lastFrameRef.current = now;

      if (runningRef.current && dt > 0) {
        stepParticles(particlesRef.current, heightRef.current, dt);
        simTimeRef.current += dt;
      }

      const V = volumeFromHeightM(heightRef.current);
      const n = molesRef.current;
      const T = temperatureRef.current;
      const P = pressureFromIdealGasLaw(n, T, V);

      drawScene(particlesRef.current, heightRef.current, P);

      if (now - lastUiPushRef.current >= UI_PUSH_MS) {
        lastUiPushRef.current = now;
        const pv = P * V;
        const nrt = n * R_GAS * T;

        setSnapshot({
          pressurePa: P,
          volumeM3: V,
          temperatureK: T,
          moles: n,
          pv,
          nrt,
          simTime: simTimeRef.current,
        });
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [drawScene, flashHighlight]);

  const onTemperatureChange = (T: number) => {
    applyTemperature(T);
    if (modeRef.current === 'const-pressure') adjustConstPressureVolume();
  };

  const onMolesChange = (n: number) => {
    applyMoles(n);
    if (modeRef.current === 'const-pressure') adjustConstPressureVolume();
  };

  const onHeightSlider = (h: number) => {
    if (modeRef.current === 'const-volume') return;
    applyHeight(h);
    if (modeRef.current === 'const-pressure') {
      targetPressureRef.current = pressureFromIdealGasLaw(
        molesRef.current,
        temperatureRef.current,
        volumeFromHeightM(h),
      );
    }
  };

  const pointerToHeight = (clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return heightRef.current;
    const rect = canvas.getBoundingClientRect();
    const yPx = ((clientY - rect.top) / rect.height) * CANVAS_H;
    return canvasYMeters(yPx);
  };

  const onCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (modeRef.current === 'const-volume') return;
    const h = pointerToHeight(e.clientY);
    const pistonCanvasY = metersToCanvas(0, heightRef.current).y;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const yPx = ((e.clientY - rect.top) / rect.height) * CANVAS_H;
    if (Math.abs(yPx - pistonCanvasY) < 28) {
      draggingPistonRef.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      applyHeight(h);
    }
  };

  const onCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!draggingPistonRef.current) return;
    applyHeight(pointerToHeight(e.clientY));
  };

  const onCanvasPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!draggingPistonRef.current) return;
    draggingPistonRef.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
    if (modeRef.current === 'const-pressure') {
      targetPressureRef.current = pressureFromIdealGasLaw(
        molesRef.current,
        temperatureRef.current,
        volumeFromHeightM(heightRef.current),
      );
    }
  };

  const hl = (key: HighlightKey) =>
    highlight === key ? 'text-amber-300 scale-110 inline-block transition-transform' : 'text-sky-300';

  return (
    <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col overflow-hidden px-4 py-8">
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-70">
        <div className="absolute -left-32 top-0 h-72 w-72 rounded-full bg-cyan-700/25 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-violet-600/20 blur-3xl" />
      </div>

      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">
          Mechanics · Pressure
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Ideal Gas Law Explorer</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">
          Watch gas particles bounce off the walls and piston while macroscopic variables
          follow <span className="text-sky-300">PV = nRT</span> — pressure is{' '}
          <span className="text-sky-300">P = nRT/V</span>.
        </p>
        <Link
          to="/dashboard"
          className="mt-3 inline-block text-sm text-cyan-400/90 hover:text-cyan-300"
        >
          ← Dashboard
        </Link>
      </header>

      <div className="mb-4 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="block w-full cursor-ns-resize touch-none"
          onPointerDown={onCanvasPointerDown}
          onPointerMove={onCanvasPointerMove}
          onPointerUp={onCanvasPointerUp}
          onPointerCancel={onCanvasPointerUp}
        />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Controls</h2>

          <SliderWithInput
            label="Temperature"
            min={MIN_T_K}
            max={MAX_T_K}
            step={5}
            value={temperatureK}
            onChange={onTemperatureChange}
            units="K"
            description="Higher T → faster particles (kinetic energy ∝ T)."
          />
          <SliderWithInput
            label="Number of moles"
            min={MIN_N_MOL}
            max={MAX_N_MOL}
            step={0.1}
            value={moles}
            onChange={onMolesChange}
            units="mol"
            description="More moles → a few more representative particles (4–16)."
          />
          <SliderWithInput
            label="Container height (volume)"
            min={MIN_HEIGHT_M}
            max={MAX_HEIGHT_M}
            step={0.01}
            value={heightM}
            onChange={onHeightSlider}
            units="m"
            description={`Volume ≈ ${formatSci(volumeFromHeightM(heightM))} m³ (fixed width × depth).`}
            disabled={mode === 'const-volume'}
          />

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Pressure mode
            </p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['const-volume', 'Constant volume'],
                  ['const-pressure', 'Constant pressure'],
                  ['free', 'Free exploration'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setMode(id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    mode === id
                      ? 'bg-cyan-600 text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {mode === 'const-volume' &&
                'Piston locked — vary T and n to see pressure change at fixed V.'}
              {mode === 'const-pressure' &&
                'Piston auto-adjusts so V follows nRT/P as you change T (and n).'}
              {mode === 'free' && 'All variables adjustable, including piston drag on the canvas.'}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setIsRunning((r) => !r)}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
            >
              {isRunning ? 'Pause' : 'Start'}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-600"
            >
              Reset
            </button>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Presets
            </p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(PRESETS) as PresetKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => applyPreset(key)}
                  className="rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs text-slate-200 hover:border-cyan-600/50"
                >
                  {PRESETS[key].label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <div className="space-y-4">
          <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
              Live equation
            </h2>
            <p className="text-center text-2xl font-semibold text-white sm:text-3xl">
              <span className={hl('P')}>P</span>
              <span className="text-slate-500"> </span>
              <span className={hl('V')}>V</span>
              <span className="text-slate-400"> = </span>
              <span className={hl('n')}>n</span>
              <span className={hl('T')}>T</span>
              <span className="text-slate-500 text-lg"> · R</span>
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-slate-800/60 p-2">
                <span className="text-slate-400">P</span>
                <p className="font-mono text-cyan-200">{formatSci(snapshot.pressurePa)} Pa</p>
              </div>
              <div className="rounded-lg bg-slate-800/60 p-2">
                <span className="text-slate-400">V</span>
                <p className="font-mono text-cyan-200">{formatSci(snapshot.volumeM3)} m³</p>
              </div>
              <div className="rounded-lg bg-slate-800/60 p-2">
                <span className="text-slate-400">n</span>
                <p className="font-mono text-cyan-200">{snapshot.moles.toFixed(2)} mol</p>
              </div>
              <div className="rounded-lg bg-slate-800/60 p-2">
                <span className="text-slate-400">T</span>
                <p className="font-mono text-cyan-200">{snapshot.temperatureK.toFixed(0)} K</p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
              Real-time data
            </h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-slate-400">Pressure</dt>
              <dd className="font-mono text-right text-white">{formatSci(snapshot.pressurePa)} Pa</dd>
              <dt className="text-slate-400">Volume</dt>
              <dd className="font-mono text-right text-white">{formatSci(snapshot.volumeM3)} m³</dd>
              <dt className="text-slate-400">Temperature</dt>
              <dd className="font-mono text-right text-white">{snapshot.temperatureK.toFixed(1)} K</dd>
              <dt className="text-slate-400">Moles</dt>
              <dd className="font-mono text-right text-white">{snapshot.moles.toFixed(2)} mol</dd>
              <dt className="text-slate-400">PV</dt>
              <dd className="font-mono text-right text-emerald-300">{formatSci(snapshot.pv)} J</dd>
              <dt className="text-slate-400">nRT</dt>
              <dd className="font-mono text-right text-emerald-300">{formatSci(snapshot.nrt)} J</dd>
            </dl>
            <p className="mt-3 text-xs text-slate-500">
              Pressure is computed from the ideal gas law: P = nRT/V.
            </p>
          </section>
        </div>
      </div>

      <ConceptBox
        heading="Ideal gas law & particle picture"
        items={[
          {
            title: 'Ideal gas law',
            description:
              'PV = nRT links pressure, volume, amount of gas, and temperature. Pressure is P = nRT/V from the current n, T, and V.',
          },
          {
            title: 'Particles and walls',
            description:
              'Animated particles bounce elastically off the walls and piston. Their motion illustrates how temperature sets speed; macroscopic P comes from the gas law.',
          },
          {
            title: 'Temperature and particle speed',
            description:
              'Higher T means faster particles (√T scaling in the visualization), so collisions with the walls become more energetic.',
          },
          {
            title: 'Volume and moles',
            description:
              'Smaller volume crowds particles (Boyle’s law at fixed T, n). More moles add particles and increase wall collision rate at the same V and T.',
          },
          {
            title: 'Bicycle pump & tires',
            description:
              'Compressing a pump reduces V and raises P. Car tires hold high-pressure gas in a relatively small volume.',
          },
          {
            title: 'Scuba tanks & hot air balloons',
            description:
              'Scuba tanks store dense, high-P gas. Heating balloon air lets it expand (lower density at ~constant atmospheric P), so buoyancy increases.',
          },
        ]}
      />
    </div>
  );
}
