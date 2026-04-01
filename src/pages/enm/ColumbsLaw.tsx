import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SliderWithInput } from '../../components/SliderWithInput';

type ControlsState = {
  q1: number; // microcoulombs
  q2: number; // microcoulombs
  r: number; // meters
};

const K = 8.99e9;

const DEFAULT_CONTROLS: ControlsState = {
  q1: 3,
  q2: -4,
  r: 1.2,
};

const MIN_Q = -10;
const MAX_Q = 10;
const MIN_R = 0.2;
const MAX_R = 5;

function roundTo2(n: number): number {
  return Math.round(n * 100) / 100;
}

function chargeColor(q: number): string {
  return q >= 0 ? '#38bdf8' : '#f87171';
}

export function ColumbsLaw() {
  const [controls, setControls] = useState<ControlsState>(DEFAULT_CONTROLS);

  const q1C = controls.q1 * 1e-6;
  const q2C = controls.q2 * 1e-6;
  const forceMag = (K * Math.abs(q1C * q2C)) / (controls.r * controls.r);
  const likeCharges = controls.q1 * controls.q2 > 0;
  const direction =
    controls.q1 === 0 || controls.q2 === 0
      ? 'none (zero charge)'
      : likeCharges
        ? 'repulsive'
        : 'attractive';

  const graph = useMemo(() => {
    const viewW = 520;
    const viewH = 220;
    const pad = 26;

    const maxF = (K * Math.abs(q1C * q2C)) / (MIN_R * MIN_R);
    const safeMaxF = Math.max(maxF, 0.01);

    const mapX = (r: number) => pad + ((r - MIN_R) / (MAX_R - MIN_R)) * (viewW - pad * 2);
    const mapY = (f: number) => viewH - (pad + (f / safeMaxF) * (viewH - pad * 2));

    const samples = 80;
    const points = Array.from({ length: samples + 1 }, (_, i) => {
      const r = MIN_R + ((MAX_R - MIN_R) * i) / samples;
      const f = (K * Math.abs(q1C * q2C)) / (r * r);
      return `${mapX(r)},${mapY(f)}`;
    }).join(' ');

    return {
      viewW,
      viewH,
      points,
      currentX: mapX(controls.r),
      currentY: mapY(forceMag),
      axisX0: mapX(MIN_R),
      axisY0: mapY(0),
      maxF: safeMaxF,
    };
  }, [controls.r, forceMag, q1C, q2C]);

  const leftX = 26;
  const rightX = 86;
  const separationScale = ((controls.r - MIN_R) / (MAX_R - MIN_R)) * 46 + 14;
  const charge1X = 50 - separationScale / 2;
  const charge2X = 50 + separationScale / 2;
  const arrowLen = Math.min(14, 4 + forceMag * 2.5);
  const q1ForceDir = direction === 'none (zero charge)' ? 0 : likeCharges ? -1 : 1;
  const q2ForceDir = direction === 'none (zero charge)' ? 0 : likeCharges ? 1 : -1;

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-8 text-slate-100">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">ENM demo</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
            Coulomb&apos;s Law
          </h1>
          <p className="mt-2 max-w-xl text-sm text-slate-300">
            Adjust two point charges and their distance to explore electrostatic force magnitude and whether interaction is attractive or repulsive.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-emerald-500 hover:text-emerald-100"
          >
            <span className="text-sm">←</span>
            Back to welcome
          </Link>
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-700/60 bg-emerald-900/50 px-3 py-1 text-[0.7rem] font-medium text-emerald-100">
            Point charges · Vacuum model
          </span>
        </div>
      </header>

      <main className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/40">
          <div className="pointer-events-none absolute inset-0 -z-10 opacity-70">
            <div className="absolute -left-24 top-0 h-56 w-56 rounded-full bg-emerald-600/20 blur-3xl" />
            <div className="absolute bottom-0 right-0 h-56 w-56 rounded-full bg-sky-500/20 blur-3xl" />
          </div>

          <h2 className="text-sm font-semibold tracking-wide text-emerald-300">Charge interaction visualization</h2>

          <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/70 p-4">
            <svg viewBox="0 0 100 46" className="h-52 w-full rounded-lg border border-slate-800/70 bg-slate-900/70">
              <defs>
                <marker
                  id="force-arrowhead"
                  markerWidth="4"
                  markerHeight="4"
                  refX="3.2"
                  refY="2"
                  orient="auto"
                  markerUnits="strokeWidth"
                >
                  <path d="M 0 0 L 4 2 L 0 4 z" fill="#f59e0b" />
                </marker>
              </defs>

              <line x1={leftX} y1={23} x2={rightX} y2={23} stroke="rgba(148,163,184,0.4)" strokeDasharray="1.5 1.5" />

              <circle cx={charge1X} cy={23} r={4.5} fill={chargeColor(controls.q1)} />
              <circle cx={charge2X} cy={23} r={4.5} fill={chargeColor(controls.q2)} />

              <text x={charge1X} y={24.3} textAnchor="middle" fontSize="3" fill="#020617">
                {controls.q1 >= 0 ? '+' : '-'}
              </text>
              <text x={charge2X} y={24.3} textAnchor="middle" fontSize="3" fill="#020617">
                {controls.q2 >= 0 ? '+' : '-'}
              </text>

              {direction !== 'none (zero charge)' && (
                <>
                  <line
                    x1={charge1X + q1ForceDir * 4.8}
                    y1={16}
                    x2={charge1X + q1ForceDir * (4.8 + arrowLen)}
                    y2={16}
                    stroke="#f59e0b"
                    strokeWidth="1.4"
                    markerEnd="url(#force-arrowhead)"
                  />
                  <line
                    x1={charge2X + q2ForceDir * 4.8}
                    y1={16}
                    x2={charge2X + q2ForceDir * (4.8 + arrowLen)}
                    y2={16}
                    stroke="#f59e0b"
                    strokeWidth="1.4"
                    markerEnd="url(#force-arrowhead)"
                  />
                </>
              )}

              <text x="50" y="37" textAnchor="middle" fontSize="2.8" fill="rgb(148 163 184)">
                Separation r = {controls.r.toFixed(2)} m
              </text>
            </svg>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
              <p className="text-[0.65rem] uppercase tracking-[0.14em] text-slate-400">Charge 1</p>
              <p className="mt-1 text-lg font-semibold text-slate-300">{roundTo2(controls.q1)} uC</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
              <p className="text-[0.65rem] uppercase tracking-[0.14em] text-slate-400">Charge 2</p>
              <p className="mt-1 text-lg font-semibold text-slate-300">{roundTo2(controls.q2)} uC</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
              <p className="text-[0.65rem] uppercase tracking-[0.14em] text-slate-400">Distance</p>
              <p className="mt-1 text-lg font-semibold text-emerald-300">{roundTo2(controls.r)} m</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
              <p className="text-[0.65rem] uppercase tracking-[0.14em] text-slate-400">|Force|</p>
              <p className="mt-1 text-lg font-semibold text-amber-300">{forceMag.toExponential(2)} N</p>
            </div>
          </div>
        </section>

        <section className="space-y-5 rounded-2xl border border-slate-800 bg-slate-950/80 p-5 shadow-lg shadow-slate-950/40">
          <h2 className="text-sm font-semibold tracking-wide text-emerald-300">Controls</h2>

          <SliderWithInput
            label="Charge q1"
            min={MIN_Q}
            max={MAX_Q}
            step={0.1}
            value={controls.q1}
            units="uC"
            onChange={(value) => setControls((prev) => ({ ...prev, q1: value }))}
          />

          <SliderWithInput
            label="Charge q2"
            min={MIN_Q}
            max={MAX_Q}
            step={0.1}
            value={controls.q2}
            units="uC"
            onChange={(value) => setControls((prev) => ({ ...prev, q2: value }))}
          />

          <SliderWithInput
            label="Separation r"
            min={MIN_R}
            max={MAX_R}
            step={0.1}
            value={controls.r}
            units="m"
            onChange={(value) => setControls((prev) => ({ ...prev, r: value }))}
          />

          <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3 text-sm">
            <p className="text-slate-300">Interaction type</p>
            <p className="mt-1 font-medium text-emerald-200">{direction}</p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3 text-sm">
            <p className="text-slate-300">Equation snapshot</p>
            <p className="mt-1 text-slate-100">
              F = k|q1q2|/r^2 ={' '}
              <span className="font-semibold text-amber-300">{forceMag.toExponential(2)} N</span>
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold tracking-wide text-emerald-300">Force vs distance</h2>

          <div className="mt-4 overflow-hidden rounded-xl border border-slate-800 bg-slate-950/70 p-3">
            <svg viewBox={`0 0 ${graph.viewW} ${graph.viewH}`} className="h-56 w-full" role="img" aria-label="Coulomb force versus distance graph">
              <defs>
                <linearGradient id="enm-line" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="rgb(16 185 129)" />
                  <stop offset="100%" stopColor="rgb(56 189 248)" />
                </linearGradient>
              </defs>

              <line x1={26} y1={graph.axisY0} x2={graph.viewW - 26} y2={graph.axisY0} stroke="rgba(148,163,184,0.45)" strokeWidth="1" />
              <line x1={graph.axisX0} y1={26} x2={graph.axisX0} y2={graph.viewH - 26} stroke="rgba(148,163,184,0.45)" strokeWidth="1" />

              <polyline points={graph.points} fill="none" stroke="url(#enm-line)" strokeWidth="3" strokeLinecap="round" />
              <circle cx={graph.currentX} cy={graph.currentY} r="5" fill="rgb(16 185 129)" />

              <text x={32} y={32} fill="rgb(148 163 184)" fontSize="12">|F| (N)</text>
              <text x={graph.viewW - 72} y={graph.viewH - 12} fill="rgb(148 163 184)" fontSize="12">r (m)</text>
              <text x={34} y={graph.viewH - 34} fill="rgb(148 163 184)" fontSize="11">
                max F ~ {graph.maxF.toExponential(2)}
              </text>
            </svg>
          </div>
        </section>
      </main>
    </div>
  );
}
