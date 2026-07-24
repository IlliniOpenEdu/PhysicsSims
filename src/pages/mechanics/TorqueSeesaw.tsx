import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { SliderWithInput } from '../../components/system/SliderWithInput';

type SeesawMass = {
  id: string;
  massKg: number;
  positionM: number;
};

const G = 9.8;
const BEAM_HALF_LENGTH_M = 5;
const CANVAS_W = 780;
const CANVAS_H = 360;
const PX_PER_M = 48;
const MAX_TILT_RAD = Math.PI / 7;
const ROTATIONAL_DAMPING = 0.95;
const ALPHA_SCALE = 0.00042;
const BEAM_INERTIA_EQ = 25;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function TorqueSeesaw() {
  const [masses, setMasses] = useState<SeesawMass[]>([
    { id: 'm1', massKg: 10, positionM: -2.5 },
    { id: 'm2', massKg: 10, positionM: 2.5 },
  ]);
  const [nextId, setNextId] = useState(3);
  const [dynamicMode, setDynamicMode] = useState(true);
  const [beamAngleRad, setBeamAngleRad] = useState(0);

  const omegaRef = useRef(0);
  const lastTsRef = useRef<number | null>(null);
  const massesRef = useRef(masses);
  const dynamicRef = useRef(dynamicMode);

  useEffect(() => {
    massesRef.current = masses;
  }, [masses]);

  useEffect(() => {
    dynamicRef.current = dynamicMode;
  }, [dynamicMode]);

  const leftTorque = useMemo(
    () =>
      masses
        .filter((m) => m.positionM < 0)
        .reduce((sum, m) => sum + m.massKg * G * Math.abs(m.positionM), 0),
    [masses]
  );

  const rightTorque = useMemo(
    () =>
      masses
        .filter((m) => m.positionM > 0)
        .reduce((sum, m) => sum + m.massKg * G * Math.abs(m.positionM), 0),
    [masses]
  );

  const netTorque = rightTorque - leftTorque; // + means clockwise/right-heavy

  useEffect(() => {
    if (!dynamicMode) {
      omegaRef.current = 0;
      setBeamAngleRad(0);
      return;
    }

    let rafId: number | null = null;
    const step = (ts: number) => {
      if (lastTsRef.current == null) {
        lastTsRef.current = ts;
      }
      const dt = Math.min(0.033, Math.max(0, (ts - (lastTsRef.current ?? ts)) / 1000));
      lastTsRef.current = ts;

      const currentMasses = massesRef.current;
      const tauL = currentMasses
        .filter((m) => m.positionM < 0)
        .reduce((sum, m) => sum + m.massKg * G * Math.abs(m.positionM), 0);
      const tauR = currentMasses
        .filter((m) => m.positionM > 0)
        .reduce((sum, m) => sum + m.massKg * G * Math.abs(m.positionM), 0);
      const tauNet = tauR - tauL;

      setBeamAngleRad((prev) => {
        const alpha = (tauNet * ALPHA_SCALE) / BEAM_INERTIA_EQ;
        const nextOmega = omegaRef.current + alpha * dt;
        omegaRef.current = nextOmega * ROTATIONAL_DAMPING;
        return clamp(prev + omegaRef.current * dt, -MAX_TILT_RAD, MAX_TILT_RAD);
      });

      if (dynamicRef.current) {
        rafId = requestAnimationFrame(step);
      }
    };

    rafId = requestAnimationFrame(step);
    return () => {
      if (rafId != null) cancelAnimationFrame(rafId);
      lastTsRef.current = null;
    };
  }, [dynamicMode]);

  const addMass = () => {
    const side = masses.length % 2 === 0 ? -1 : 1;
    const id = `m${nextId}`;
    setMasses((prev) => [...prev, { id, massKg: 8, positionM: side * 2 }]);
    setNextId((n) => n + 1);
  };

  const updateMass = (id: string, patch: Partial<SeesawMass>) => {
    setMasses((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  };

  const removeMass = (id: string) => {
    setMasses((prev) => (prev.length <= 1 ? prev : prev.filter((m) => m.id !== id)));
  };

  const status =
    Math.abs(netTorque) < 1e-6
      ? 'Balanced'
      : netTorque > 0
        ? 'Rotating clockwise'
        : 'Rotating counterclockwise';

  const cx = CANVAS_W / 2;
  const cy = CANVAS_H / 2 + 10;

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-8 text-slate-100">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">
            Rotational dynamics
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
            Torque Visualizer (Seesaw Balance)
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-300">
            Explore how torque τ = rF governs rotational equilibrium. Adjust masses and lever-arm
            positions to balance the beam or create rotation.
          </p>
        </div>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-sky-500 hover:text-sky-100"
        >
          ← Dashboard
        </Link>
      </header>

      <main className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/40">
          <h2 className="text-sm font-semibold tracking-wide text-sky-300">Seesaw canvas</h2>
          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/85 p-3">
            <svg viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`} className="h-[25rem] w-full rounded-lg">
              <rect x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill="#020617" />

              <line x1={cx} y1={0} x2={cx} y2={CANVAS_H} stroke="#334155" strokeDasharray="8 8" />
              <polygon
                points={`${cx - 20},${cy + 30} ${cx + 20},${cy + 30} ${cx},${cy + 2}`}
                fill="#475569"
              />

              <g transform={`translate(${cx}, ${cy}) rotate(${(beamAngleRad * 180) / Math.PI})`}>
                <rect
                  x={-BEAM_HALF_LENGTH_M * PX_PER_M}
                  y={-7}
                  width={BEAM_HALF_LENGTH_M * 2 * PX_PER_M}
                  height={14}
                  rx={7}
                  fill="#0f172a"
                  stroke="#22d3ee"
                />

                {masses.map((m) => {
                  const x = m.positionM * PX_PER_M;
                  const rAbs = Math.abs(m.positionM);
                  const torque = m.massKg * G * rAbs;
                  return (
                    <g key={m.id}>
                      <line
                        x1={0}
                        y1={0}
                        x2={x}
                        y2={0}
                        stroke={m.positionM < 0 ? '#fb7185' : '#60a5fa'}
                        strokeWidth={1.5}
                        strokeDasharray="5 4"
                      />
                      <line x1={x} y1={-24} x2={x} y2={22} stroke="#f59e0b" strokeWidth={2.2} />
                      <polygon
                        points={`${x - 5},22 ${x + 5},22 ${x},31`}
                        fill="#f59e0b"
                      />
                      <circle cx={x} cy={-16} r={11} fill={m.positionM < 0 ? '#fb7185' : '#60a5fa'} />
                      <text x={x + 14} y={-18} fill="#e2e8f0" fontSize={11}>
                        {m.massKg.toFixed(1)} kg
                      </text>
                      <text x={x + 14} y={-4} fill="#94a3b8" fontSize={10}>
                        τ={torque.toFixed(1)} N*m
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-950/80 p-5 shadow-lg shadow-slate-950/40">
          <h2 className="text-sm font-semibold tracking-wide text-sky-300">Controls</h2>

          <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-slate-200">Mass objects</p>
              <button
                type="button"
                onClick={addMass}
                className="rounded-full border border-sky-500/70 bg-sky-500/20 px-3 py-1 text-[0.7rem] font-semibold text-sky-100 transition hover:bg-sky-500/30"
              >
                + Add mass
              </button>
            </div>

            <div className="mt-3 space-y-3">
              {masses.map((m, idx) => (
                <div key={m.id} className="rounded-md border border-slate-800 bg-slate-950/70 p-2">
                  <div className="mb-1 flex items-center justify-between">
                    <p className="text-[0.72rem] font-semibold text-slate-200">Mass {idx + 1}</p>
                    <button
                      type="button"
                      onClick={() => removeMass(m.id)}
                      disabled={masses.length <= 1}
                      className="rounded-full border border-rose-500/70 bg-rose-500/20 px-2 py-0.5 text-[0.62rem] font-semibold text-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Remove
                    </button>
                  </div>
                  <SliderWithInput
                    label="Mass"
                    units="kg"
                    min={0.5}
                    max={50}
                    step={0.5}
                    value={m.massKg}
                    onChange={(v) => updateMass(m.id, { massKg: v })}
                    syncToUrl={false}
                  />
                  <div className="mt-2" />
                  <SliderWithInput
                    label="Position"
                    units="m"
                    min={-5}
                    max={5}
                    step={0.1}
                    value={m.positionM}
                    onChange={(v) => updateMass(m.id, { positionM: v })}
                    syncToUrl={false}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
            <p className="text-xs font-medium text-slate-200">Dynamics mode</p>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDynamicMode(true)}
                className={`rounded-full px-3 py-1 text-[0.7rem] font-semibold transition ${
                  dynamicMode
                    ? 'bg-emerald-500 text-slate-950'
                    : 'border border-slate-700 bg-slate-900 text-slate-300'
                }`}
              >
                Dynamic
              </button>
              <button
                type="button"
                onClick={() => setDynamicMode(false)}
                className={`rounded-full px-3 py-1 text-[0.7rem] font-semibold transition ${
                  !dynamicMode
                    ? 'bg-sky-500 text-slate-950'
                    : 'border border-slate-700 bg-slate-900 text-slate-300'
                }`}
              >
                Static balance view
              </button>
            </div>
          </div>
        </section>
      </main>

      <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <h2 className="text-sm font-semibold tracking-wide text-sky-300">Torque readout</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="τ_left" value={`${leftTorque.toFixed(2)} N*m`} />
          <Metric label="τ_right" value={`${rightTorque.toFixed(2)} N*m`} />
          <Metric label="τ_net (right-left)" value={`${netTorque.toFixed(2)} N*m`} />
          <Metric label="Status" value={status} />
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-sky-300">
          Concept explanation
        </h2>
        <div className="mt-3 space-y-2 text-sm text-slate-300">
          <p>
            Torque measures rotational effect: τ = rF. For each mass on the beam, F is weight
            (mg), so contribution grows with both mass and lever arm distance.
          </p>
          <p>
            Rotational equilibrium occurs when left and right torques are equal, so net torque is
            zero and the seesaw can remain level.
          </p>
          <p>
            Increasing distance from the pivot can be just as influential as increasing mass, because
            torque scales linearly with r.
          </p>
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-950/70 px-3 py-2">
      <p className="text-[0.66rem] text-slate-400">{label}</p>
      <p className="mt-0.5 font-mono text-[0.82rem] text-sky-200">{value}</p>
    </div>
  );
}
