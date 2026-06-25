import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { SliderWithInput } from '../../components/SliderWithInput';

const CANVAS_W = 700;
const CANVAS_H = 420;
const WORLD_HALF_SPAN_M = 7;
const DISK_MASS_KG = 100;
const DISK_RADIUS_M = 5;
const INITIAL_OMEGA = 0;

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function diskInertia(massKg: number, radiusM: number): number {
  return 0.5 * massKg * radiusM * radiusM;
}

export function ActiveTorqueDisk() {
  const [forceN, setForceN] = useState(30);
  const [applyRadiusM, setApplyRadiusM] = useState(1.2);
  const [torqueDirection, setTorqueDirection] = useState<1 | -1>(1);
  const [isHolding, setIsHolding] = useState(false);

  const [thetaDisplay, setThetaDisplay] = useState(0);
  const [omegaDisplay, setOmegaDisplay] = useState(INITIAL_OMEGA);
  const [lDisplay, setLDisplay] = useState(0);
  const [deltaLDisplay, setDeltaLDisplay] = useState(0);
  const [holdTimeDisplay, setHoldTimeDisplay] = useState(0);

  const stateRef = useRef({
    theta: 0,
    omega: INITIAL_OMEGA,
    L: 0,
    deltaL: 0,
    holdTime: 0,
  });
  const controlsRef = useRef({
    forceN,
    applyRadiusM,
    torqueDirection,
    isHolding,
  });
  const lastTsRef = useRef<number | null>(null);
  const lastUiRef = useRef(0);

  useEffect(() => {
    controlsRef.current = {
      forceN,
      applyRadiusM,
      torqueDirection,
      isHolding,
    };
  }, [forceN, applyRadiusM, torqueDirection, isHolding]);

  useEffect(() => {
    const I = diskInertia(DISK_MASS_KG, DISK_RADIUS_M);
    stateRef.current.omega = INITIAL_OMEGA;
    stateRef.current.L = I * INITIAL_OMEGA;
    stateRef.current.deltaL = 0;
    stateRef.current.holdTime = 0;
    setOmegaDisplay(stateRef.current.omega);
    setLDisplay(stateRef.current.L);
    setDeltaLDisplay(0);
    setHoldTimeDisplay(0);
  }, []);

  useEffect(() => {
    let rafId: number | null = null;
    const step = (ts: number) => {
      if (lastTsRef.current == null) {
        lastTsRef.current = ts;
      }
      const dt = Math.min(0.033, Math.max(0, (ts - (lastTsRef.current ?? ts)) / 1000));
      lastTsRef.current = ts;

      const s = stateRef.current;
      const c = controlsRef.current;
      const I = Math.max(1e-6, diskInertia(DISK_MASS_KG, DISK_RADIUS_M));
      const r = clamp(c.applyRadiusM, 0, DISK_RADIUS_M);
      const tau = c.isHolding ? c.torqueDirection * c.forceN * r : 0;
      const alpha = tau / I;

      s.omega += alpha * dt;
      s.theta += s.omega * dt;
      s.L = I * s.omega;
      if (c.isHolding) {
        s.deltaL += tau * dt;
        s.holdTime += dt;
      }

      if (ts - lastUiRef.current > 16) {
        setThetaDisplay(s.theta);
        setOmegaDisplay(s.omega);
        setLDisplay(s.L);
        setDeltaLDisplay(s.deltaL);
        setHoldTimeDisplay(s.holdTime);
        lastUiRef.current = ts;
      }

      rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
    return () => {
      if (rafId != null) cancelAnimationFrame(rafId);
      lastTsRef.current = null;
    };
  }, []);

  const torqueNow = useMemo(() => {
    const r = clamp(applyRadiusM, 0, DISK_RADIUS_M);
    return (isHolding ? torqueDirection : 0) * forceN * r;
  }, [applyRadiusM, forceN, isHolding, torqueDirection]);
  const inertiaNow = useMemo(() => diskInertia(DISK_MASS_KG, DISK_RADIUS_M), []);
  const alphaNow = inertiaNow > 1e-9 ? torqueNow / inertiaNow : 0;

  // SVG y-axis points downward, so use -theta for physically conventional CCW-positive rotation.
  const renderTheta = -thetaDisplay;
  const diskRadiusPx = (DISK_RADIUS_M / (2 * WORLD_HALF_SPAN_M)) * CANVAS_W * 0.8;
  const cx = CANVAS_W / 2;
  const cy = CANVAS_H / 2;
  const markerLenPx = diskRadiusPx * 0.9;
  const markerX = cx + Math.cos(renderTheta) * markerLenPx;
  const markerY = cy + Math.sin(renderTheta) * markerLenPx;

  const appAngle = renderTheta;
  const appRadiusPx = (clamp(applyRadiusM, 0, DISK_RADIUS_M) / DISK_RADIUS_M) * diskRadiusPx;
  const appX = cx + Math.cos(appAngle) * appRadiusPx;
  const appY = cy + Math.sin(appAngle) * appRadiusPx;
  const tangentBase = { x: Math.sin(appAngle), y: -Math.cos(appAngle) };
  const tangent = {
    x: tangentBase.x * torqueDirection,
    y: tangentBase.y * torqueDirection,
  };
  const forceArrowLen = Math.max(0, Math.min(80, forceN * 0.8));
  const forceTipX = appX + tangent.x * forceArrowLen;
  const forceTipY = appY + tangent.y * forceArrowLen;

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-8 text-slate-100">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">Rotational dynamics</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
            Active Torque Disk Simulator (Hold-to-Apply Torque)
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-300">
            Hold torque to inject angular momentum into a rotating disk. Releasing sets τ to zero so angular momentum stays constant.
          </p>
        </div>
        <Link to="/dashboard" className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-sky-500 hover:text-sky-100">
          ← Dashboard
        </Link>
      </header>

      <main className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/40">
          <h2 className="text-sm font-semibold tracking-wide text-sky-300">Disk canvas</h2>
          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/85 p-3">
            <svg viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`} className="h-[32rem] w-full rounded-lg">
              <rect x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill="#020617" />
              <circle cx={cx} cy={cy} r={diskRadiusPx} fill="rgba(14,165,233,0.20)" stroke="#22d3ee" strokeWidth={2.2} />
              <line x1={cx} y1={cy} x2={markerX} y2={markerY} stroke="#fbbf24" strokeWidth={3} strokeLinecap="round" />
              <circle cx={cx} cy={cy} r={4} fill="#f8fafc" />

              {isHolding ? (
                <g>
                  <line x1={appX} y1={appY} x2={forceTipX} y2={forceTipY} stroke="#22c55e" strokeWidth={3} />
                  <polygon
                    points={`${forceTipX},${forceTipY} ${forceTipX - tangent.x * 8 - tangent.y * 5},${forceTipY - tangent.y * 8 + tangent.x * 5} ${forceTipX - tangent.x * 8 + tangent.y * 5},${forceTipY - tangent.y * 8 - tangent.x * 5}`}
                    fill="#22c55e"
                  />
                  <path
                    d={`M ${cx + 55} ${cy - 45} A 70 70 0 0 ${torqueDirection > 0 ? 1 : 0} ${cx + 55} ${cy + 45}`}
                    fill="none"
                    stroke="#f472b6"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                  />
                </g>
              ) : null}
            </svg>
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-950/80 p-5 shadow-lg shadow-slate-950/40">
          <h2 className="text-sm font-semibold tracking-wide text-sky-300">Controls</h2>
          <SliderWithInput label="Force magnitude" units="N" min={0} max={100} step={1} value={forceN} onChange={setForceN} syncToUrl={false} />
          <div className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-[0.78rem] text-slate-300">
            Disk mass fixed: <span className="font-mono text-sky-200">{DISK_MASS_KG} kg</span> | Radius fixed:{' '}
            <span className="font-mono text-sky-200">{DISK_RADIUS_M} m</span> | Initial ω fixed:{' '}
            <span className="font-mono text-sky-200">{INITIAL_OMEGA} rad/s</span>
          </div>
          <SliderWithInput label="Force application radius" units="m" min={0} max={DISK_RADIUS_M} step={0.1} value={applyRadiusM} onChange={(v) => setApplyRadiusM(clamp(v, 0, DISK_RADIUS_M))} syncToUrl={false} />

          <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
            <p className="text-xs font-medium text-slate-200">Torque direction</p>
            <div className="mt-2 flex items-center gap-2">
              <button type="button" onClick={() => setTorqueDirection(1)} className={`rounded-full px-3 py-1 text-[0.72rem] font-semibold ${torqueDirection === 1 ? 'bg-emerald-500 text-slate-950' : 'border border-slate-700 bg-slate-900 text-slate-300'}`}>Counterclockwise</button>
              <button type="button" onClick={() => setTorqueDirection(-1)} className={`rounded-full px-3 py-1 text-[0.72rem] font-semibold ${torqueDirection === -1 ? 'bg-rose-400 text-slate-950' : 'border border-slate-700 bg-slate-900 text-slate-300'}`}>Clockwise</button>
            </div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
            <p className="text-xs font-medium text-slate-200">Apply torque</p>
            <button
              type="button"
              onMouseDown={() => setIsHolding(true)}
              onMouseUp={() => setIsHolding(false)}
              onMouseLeave={() => setIsHolding(false)}
              onTouchStart={() => setIsHolding(true)}
              onTouchEnd={() => setIsHolding(false)}
              className={`mt-2 w-full rounded-lg px-3 py-2 text-sm font-semibold transition ${isHolding ? 'bg-emerald-500 text-slate-950' : 'border border-emerald-500/70 bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30'}`}
            >
              {isHolding ? 'Applying torque...' : 'Hold to Apply Torque'}
            </button>
          </div>
        </section>
      </main>

      <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <h2 className="text-sm font-semibold tracking-wide text-sky-300">Real-time rotational data</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Force, F" value={`${forceN.toFixed(2)} N`} />
          <Metric label="Radius, r" value={`${clamp(applyRadiusM, 0, DISK_RADIUS_M).toFixed(2)} m`} />
          <Metric label="Torque, τ = rF" value={`${torqueNow.toFixed(3)} N*m`} />
          <Metric label="Angular acceleration, α" value={`${alphaNow.toFixed(4)} rad/s²`} />
          <Metric label="Angular velocity, ω" value={`${omegaDisplay.toFixed(4)} rad/s`} />
          <Metric label="Angular momentum, L" value={`${lDisplay.toFixed(4)} kg*m²/s`} />
          <Metric label="ΔL = ∫τdt" value={`${deltaLDisplay.toFixed(4)} kg*m²/s`} />
          <Metric label="Hold time" value={`${holdTimeDisplay.toFixed(3)} s`} />
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-sky-300">Concept explanation</h2>
        <div className="mt-3 space-y-2 text-sm text-slate-300">
          <p>
            Torque is rotational cause-and-effect: applying tangential force at radius r creates τ = rF.
          </p>
          <p>
            While you hold the button, torque is nonzero, so angular momentum changes continuously by ΔL = τΔt.
          </p>
          <p>
            Releasing the button sets τ to zero; then ω and L remain constant (ideal no-friction case), analogous to linear impulse FΔt.
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

