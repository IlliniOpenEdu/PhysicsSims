import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SliderWithInput } from '../components/SliderWithInput';

type ControlsState = {
  mass: number;
  k: number;
  x: number;
};

const DEFAULT_CONTROLS: ControlsState = {
  mass: 5,
  k: 10,
  x: 0,
};

const MIN_X = -6;
const MAX_X = 6;
const MIN_K = 1;
const MAX_K = 50;
const MIN_MASS = 1;
const MAX_MASS = 12;
const SPRING_START_PX = 40;

function roundTo2(n: number): number {
  return Math.round(n * 100) / 100;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function springPath(length: number, coils = 9): string {
  const safeLength = Math.max(60, length);
  const startX = 0;
  const endX = safeLength;
  const lead = 12;
  const trail = 12;
  const bodyLength = Math.max(20, safeLength - lead - trail);
  const step = bodyLength / (coils * 2);
  const amp = 12;

  let d = `M ${startX} 30 L ${lead} 30`;
  for (let i = 0; i < coils * 2; i++) {
    const x = lead + step * (i + 1);
    const y = i % 2 === 0 ? 30 - amp : 30 + amp;
    d += ` L ${x} ${y}`;
  }
  d += ` L ${endX} 30`;
  return d;
}


export function SpringForce() {
  const [controls, setControls] = useState<ControlsState>(DEFAULT_CONTROLS);

  const force = -controls.k * controls.x;
  const springPotentialEnergy = 0.5 * controls.k * controls.x * controls.x;
  const springLengthPx = clamp(200 + controls.x * 25, 60, 380);
  const blockSizePx = clamp(34 + controls.mass * 3.6, 36, 78);
  const blockLeftPx = SPRING_START_PX + springLengthPx - blockSizePx / 2;
  const normalizedForce = clamp(Math.abs(force) / (MAX_K * MAX_X), 0, 1);
  const forceRingDash = `${normalizedForce * 100} 100`;
  const equilibriumPosition = 0;

  const graphPoints = useMemo(() => {
    const viewW = 520;
    const viewH = 220;
    const padding = 26;
    const maxForce = MAX_K * MAX_X;

    const mapX = (x: number) => {
      const t = (x - MIN_X) / (MAX_X - MIN_X);
      return padding + t * (viewW - padding * 2);
    };
    const mapY = (f: number) => {
      const t = (f + maxForce) / (maxForce * 2);
      return viewH - (padding + t * (viewH - padding * 2));
    };

    const samples = 60;
    const path = Array.from({ length: samples + 1 }, (_, i) => {
      const x = MIN_X + ((MAX_X - MIN_X) * i) / samples;
      const f = -controls.k * x;
      return `${mapX(x)},${mapY(f)}`;
    }).join(' ');

    return {
      viewW,
      viewH,
      mapX,
      mapY,
      maxForce,
      path,
      currentX: mapX(controls.x),
      currentY: mapY(force),
      zeroX: mapX(0),
      zeroY: mapY(0),
    };
  }, [controls.k, controls.x, force]);

  const restoringDirection =
    controls.x > 0 ? 'left (toward equilibrium)' : controls.x < 0 ? 'right (toward equilibrium)' : 'none';

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-8 text-slate-100">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">
            Forces demo
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
            Spring Force (Hooke’s Law)
          </h1>
          <p className="mt-2 max-w-xl text-sm text-slate-300">
            Explore how restoring force scales with displacement using F = -kx, and see the force-displacement relationship update in real time.
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
            Linear spring model
          </span>
        </div>
      </header>

      <main className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/40">
          <div className="pointer-events-none absolute inset-0 -z-10 opacity-70">
            <div className="absolute -left-24 top-0 h-56 w-56 rounded-full bg-sky-700/25 blur-3xl" />
            <div className="absolute bottom-0 right-0 h-56 w-56 rounded-full bg-blue-500/20 blur-3xl" />
          </div>

          <h2 className="text-sm font-semibold tracking-wide text-sky-300">Spring visualization</h2>

          <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/70 p-4">
            <div className="relative flex h-64 items-center overflow-hidden rounded-lg border border-slate-800/70 bg-slate-900/60">
              <div className="absolute inset-y-0 left-0 w-7 bg-slate-700/80" />
              <div className="absolute inset-y-0 left-7 w-[2px] bg-slate-500/80" />
              <div className="absolute left-5 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full border-2 border-slate-300/80 bg-slate-600/90" />

              <div
                className="absolute top-1/2 -translate-y-1/2"
                style={{ left: `${SPRING_START_PX}px`, width: `${springLengthPx}px` }}
              >
                <svg className="h-16 w-full" viewBox={`0 0 ${springLengthPx + 4} 60`} preserveAspectRatio="none">
                  <path
                    d={springPath(springLengthPx)}
                    fill="none"
                    stroke="rgb(56 189 248)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              <div className="pointer-events-none absolute left-12 right-10 top-1/2 h-px -translate-y-1/2 bg-sky-300/25" />
              <div className="pointer-events-none absolute left-12 right-10 top-1/2 flex -translate-y-1/2 justify-between">
                <span className="h-2.5 w-2.5 rounded-full border border-sky-300/40 bg-sky-400/20" />
                <span className="h-2.5 w-2.5 rounded-full border border-sky-300/40 bg-sky-400/20" />
                <span className="h-2.5 w-2.5 rounded-full border border-sky-300/40 bg-sky-400/20" />
                <span className="h-2.5 w-2.5 rounded-full border border-sky-300/40 bg-sky-400/20" />
              </div>
              <div
                className="pointer-events-none absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-sky-200/80 bg-sky-300/70"
                style={{ left: `${SPRING_START_PX + springLengthPx}px` }}
              />

              <div
                className="absolute top-1/2 -translate-y-1/2 rounded-md border-2 border-emerald-300 bg-emerald-400/90 shadow-lg shadow-emerald-900/30"
                style={{ left: `${blockLeftPx}px`, width: `${blockSizePx}px`, height: `${blockSizePx}px` }}
              >
                <div className="flex h-full items-center justify-center text-[0.65rem] font-semibold text-emerald-950">m</div>
                <div className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-950/50 bg-emerald-200/70" />
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
              <p className="text-[0.65rem] uppercase tracking-[0.14em] text-slate-400">Mass</p>
              <p className="mt-1 text-lg font-semibold text-emerald-200">{roundTo2(controls.mass)} kg</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
              <p className="text-[0.65rem] uppercase tracking-[0.14em] text-slate-400">Displacement</p>
              <p className="mt-1 text-lg font-semibold text-slate-100">{roundTo2(controls.x)} m</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
              <p className="text-[0.65rem] uppercase tracking-[0.14em] text-slate-400">Restoring force</p>
              <p className="mt-1 text-lg font-semibold text-sky-300">{roundTo2(force)} N</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
              <p className="text-[0.65rem] uppercase tracking-[0.14em] text-slate-400">Potential energy</p>
              <p className="mt-1 text-lg font-semibold text-emerald-300">{roundTo2(springPotentialEnergy)} J</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
              <p className="text-[0.65rem] uppercase tracking-[0.14em] text-slate-400">Spring constant</p>
              <p className="mt-1 text-lg font-semibold text-sky-300">{roundTo2(controls.k)} N/m</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
              <p className="text-[0.65rem] uppercase tracking-[0.14em] text-slate-400">Acceleration</p>
              <p className="mt-1 text-lg font-semibold text-sky-300">{roundTo2(force / controls.mass)} m/s²</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
              <p className="text-[0.65rem] uppercase tracking-[0.14em] text-slate-400">Restoring direction</p>
              <p className="mt-1 font-medium text-sky-200">{restoringDirection}</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
              <p className="text-[0.65rem] uppercase tracking-[0.14em] text-slate-400">Equilibrium position</p>
              <p className="mt-1 font-medium text-amber-300">{roundTo2(equilibriumPosition)} m</p>
            </div>
          </div>
        </section>

        <section className="space-y-5 rounded-2xl border border-slate-800 bg-slate-950/80 p-5 shadow-lg shadow-slate-950/40">
          <h2 className="text-sm font-semibold tracking-wide text-sky-300">Controls</h2>

          <SliderWithInput
            label="Mass (m)"
            min={MIN_MASS}
            max={MAX_MASS}
            step={0.5}
            value={controls.mass}
            units="kg"
            onChange={(value) => setControls((prev) => ({ ...prev, mass: value }))}
          />

          <SliderWithInput
            label="Spring constant (k)"
            min={MIN_K}
            max={MAX_K}
            step={1}
            value={controls.k}
            units="N/m"
            onChange={(value) => setControls((prev) => ({ ...prev, k: value }))}
          />

          <SliderWithInput
            label="Displacement (x)"
            min={MIN_X}
            max={MAX_X}
            step={0.1}
            value={controls.x}
            units="m"
            onChange={(value) => setControls((prev) => ({ ...prev, x: value }))}
          />

          <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3 text-sm">
            <p className="text-slate-300">Restoring direction</p>
            <p className="mt-1 font-medium text-sky-200">{restoringDirection}</p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3 text-sm">
            <p className="text-slate-300">Force dial</p>
            <div className="mt-2 flex items-center gap-3">
              <svg viewBox="0 0 42 42" className="h-14 w-14" aria-label="Force magnitude dial">
                <circle cx="21" cy="21" r="15.915" fill="none" stroke="rgba(71,85,105,0.8)" strokeWidth="3.5" />
                <circle
                  cx="21"
                  cy="21"
                  r="15.915"
                  fill="none"
                  stroke="rgb(56 189 248)"
                  strokeWidth="3.5"
                  strokeDasharray={forceRingDash}
                  strokeLinecap="round"
                  transform="rotate(-90 21 21)"
                />
                <circle cx="21" cy="21" r="2.1" fill="rgb(148 163 184)" />
              </svg>
              <div>
                <p className="text-xs text-slate-400">|F| relative to max</p>
                <p className="text-sm font-semibold text-slate-100">{Math.round(normalizedForce * 100)}%</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setControls((prev) => ({ ...prev, x: 1 }))}
              className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 transition hover:border-sky-500 hover:text-sky-200"
            >
              Stretch +1 m
            </button>
            <button
              type="button"
              onClick={() => setControls((prev) => ({ ...prev, x: -1 }))}
              className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 transition hover:border-emerald-500 hover:text-emerald-200"
            >
              Compress -1 m
            </button>
            <button
              type="button"
              onClick={() => setControls((prev) => ({ ...prev, x: 0 }))}
              className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 transition hover:border-slate-500"
            >
              Equilibrium
            </button>
            <button
              type="button"
              onClick={() => setControls(DEFAULT_CONTROLS)}
              className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 transition hover:border-slate-500"
            >
              Reset
            </button>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3 text-sm">
            <p className="text-slate-300">Equation snapshot</p>
            <p className="mt-1 text-slate-100">
              F = -kx = -({controls.k})({roundTo2(controls.x)}) ={' '}
              <span className="font-semibold text-sky-300">{roundTo2(force)} N</span>
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold tracking-wide text-sky-300">Force vs displacement</h2>

          <div className="mt-4 overflow-hidden rounded-xl border border-slate-800 bg-slate-950/70 p-3">
            <svg
              viewBox={`0 0 ${graphPoints.viewW} ${graphPoints.viewH}`}
              className="h-56 w-full"
              role="img"
              aria-label="Force versus displacement graph"
            >
              <defs>
                <linearGradient id="spring-line" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="rgb(16 185 129)" />
                  <stop offset="100%" stopColor="rgb(56 189 248)" />
                </linearGradient>
              </defs>

              <rect x="0" y="0" width={graphPoints.viewW} height={graphPoints.viewH} fill="transparent" />

              <line
                x1={26}
                y1={graphPoints.zeroY}
                x2={graphPoints.viewW - 26}
                y2={graphPoints.zeroY}
                stroke="rgba(148,163,184,0.45)"
                strokeWidth="1"
              />
              <line
                x1={graphPoints.zeroX}
                y1={26}
                x2={graphPoints.zeroX}
                y2={graphPoints.viewH - 26}
                stroke="rgba(148,163,184,0.45)"
                strokeWidth="1"
              />

              <polyline
                points={graphPoints.path}
                fill="none"
                stroke="url(#spring-line)"
                strokeWidth="3"
                strokeLinecap="round"
              />

              <circle cx={graphPoints.currentX} cy={graphPoints.currentY} r="5" fill="rgb(56 189 248)" />

              <text x={32} y={32} fill="rgb(148 163 184)" fontSize="12">F (N)</text>
              <text x={graphPoints.viewW - 70} y={graphPoints.viewH - 12} fill="rgb(148 163 184)" fontSize="12">x (m)</text>
              <text x={34} y={graphPoints.viewH - 34} fill="rgb(148 163 184)" fontSize="11">
                min/max F: +- {graphPoints.maxForce.toFixed(0)}
              </text>
            </svg>
          </div>

          <p className="mt-3 text-xs text-slate-400">
            The straight line through the origin has slope -k. Larger k makes the line steeper, so force changes more rapidly with displacement.
          </p>
          <div className="mt-2 rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-300">
            Current point: ({roundTo2(controls.x)} m, {roundTo2(force)} N)
          </div>
        </section>
      </main>
    </div>
  );
}
