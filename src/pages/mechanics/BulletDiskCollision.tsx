import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { SliderWithInput } from '../../components/system/SliderWithInput';

type LaunchParams = {
  diskMassKg: number;
  diskRadiusM: number;
  diskOmega0: number;
  bulletMassKg: number;
  bulletSpeed: number;
  impactYOffsetM: number;
};

type SimPhase = 'idle' | 'firing' | 'post';

type SimState = {
  phase: SimPhase;
  theta: number;
  omega: number;
  bulletX: number;
  bulletY: number;
  embeddedRadius: number;
  embeddedRelativeAngle: number;
  diskAngularMomentumBefore: number;
  bulletAngularMomentumAtImpact: number;
  totalAngularMomentumBefore: number;
  totalInertiaAfter: number;
};

const CANVAS_W = 760;
const CANVAS_H = 420;
const WORLD_X_MIN = -10;
const WORLD_X_MAX = 10;
const WORLD_Y_MIN = -6;
const WORLD_Y_MAX = 6;
const BULLET_START_X = -9;
const CENTER_X = 0;
const CENTER_Y = 0;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function worldToSvgX(x: number): number {
  return ((x - WORLD_X_MIN) / (WORLD_X_MAX - WORLD_X_MIN)) * CANVAS_W;
}

function worldToSvgY(y: number): number {
  return ((WORLD_Y_MAX - y) / (WORLD_Y_MAX - WORLD_Y_MIN)) * CANVAS_H;
}

function diskInertia(massKg: number, radiusM: number): number {
  return 0.5 * massKg * radiusM * radiusM;
}

function initialSimState(params: LaunchParams): SimState {
  return {
    phase: 'idle',
    theta: 0,
    omega: params.diskOmega0,
    bulletX: BULLET_START_X,
    bulletY: params.impactYOffsetM,
    embeddedRadius: 0,
    embeddedRelativeAngle: 0,
    diskAngularMomentumBefore: 0,
    bulletAngularMomentumAtImpact: 0,
    totalAngularMomentumBefore: 0,
    totalInertiaAfter: 0,
  };
}

export function BulletDiskCollision() {
  const [diskMassKg, setDiskMassKg] = useState(80);
  const [diskRadiusM, setDiskRadiusM] = useState(2.2);
  const [diskOmega0, setDiskOmega0] = useState(2);
  const [bulletMassKg, setBulletMassKg] = useState(1);
  const [bulletSpeed, setBulletSpeed] = useState(30);
  const [impactYOffsetM, setImpactYOffsetM] = useState(1);

  const controlsRef = useRef<LaunchParams>({
    diskMassKg,
    diskRadiusM,
    diskOmega0,
    bulletMassKg,
    bulletSpeed,
    impactYOffsetM,
  });
  const launchParamsRef = useRef<LaunchParams>(controlsRef.current);
  const [sim, setSim] = useState<SimState>(() => initialSimState(controlsRef.current));
  const [isRunning, setIsRunning] = useState(false);
  const lastTsRef = useRef<number | null>(null);

  useEffect(() => {
    controlsRef.current = {
      diskMassKg,
      diskRadiusM,
      diskOmega0,
      bulletMassKg,
      bulletSpeed,
      impactYOffsetM,
    };
  }, [bulletMassKg, bulletSpeed, diskMassKg, diskOmega0, diskRadiusM, impactYOffsetM]);

  useEffect(() => {
    if (!isRunning) {
      lastTsRef.current = null;
      return;
    }

    let rafId: number | null = null;
    const step = (ts: number) => {
      if (lastTsRef.current == null) {
        lastTsRef.current = ts;
      }
      const dt = Math.min(0.033, Math.max(0, (ts - (lastTsRef.current ?? ts)) / 1000));
      lastTsRef.current = ts;

      setSim((prev) => {
        const params = launchParamsRef.current;
        const nextTheta = prev.theta + prev.omega * dt;
        const next: SimState = { ...prev, theta: nextTheta };

        if (prev.phase === 'firing') {
          const bxPrev = prev.bulletX;
          const bx = prev.bulletX + params.bulletSpeed * dt;
          const by = prev.bulletY;
          next.bulletX = bx;
          next.bulletY = by;

          const yRel = by - CENTER_Y;
          const radiusSq = params.diskRadiusM * params.diskRadiusM;
          const hasIntersectionAtThisY = yRel * yRel <= radiusSq;
          if (hasIntersectionAtThisY) {
            // Bullet moves left->right; first contact is the left disk boundary point at this y.
            const xHit = CENTER_X - Math.sqrt(Math.max(0, radiusSq - yRel * yRel));
            const crossedHit = bxPrev < xHit && bx >= xHit;
            if (crossedHit) {
              const dxHit = xHit - CENTER_X;
              const dyHit = yRel;
              const rMag = Math.sqrt(dxHit * dxHit + dyHit * dyHit);
              const diskI = diskInertia(params.diskMassKg, params.diskRadiusM);
              const pX = params.bulletMassKg * params.bulletSpeed;
              // Lz = (r x p)z = x*py - y*px; py = 0 here.
              const bulletL = -dyHit * pX;
              const diskL = diskI * prev.omega;
              const totalL = diskL + bulletL;
              const iAfter = diskI + params.bulletMassKg * rMag * rMag;
              const omegaAfter = iAfter > 1e-9 ? totalL / iAfter : 0;
              const absoluteAngle = Math.atan2(dyHit, dxHit);

              next.phase = 'post';
              next.bulletX = xHit;
              next.bulletY = by;
              next.omega = omegaAfter;
              next.embeddedRadius = rMag;
              next.embeddedRelativeAngle = absoluteAngle - nextTheta;
              next.diskAngularMomentumBefore = diskL;
              next.bulletAngularMomentumAtImpact = bulletL;
              next.totalAngularMomentumBefore = totalL;
              next.totalInertiaAfter = iAfter;
            }
          }
        }

        return next;
      });

      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
    return () => {
      if (rafId != null) cancelAnimationFrame(rafId);
    };
  }, [isRunning]);

  const previewParams = controlsRef.current;
  const activeParams = isRunning ? launchParamsRef.current : previewParams;
  const effectiveImpactY = clamp(
    activeParams.impactYOffsetM,
    -activeParams.diskRadiusM * 0.98,
    activeParams.diskRadiusM * 0.98
  );
  const diskI = diskInertia(activeParams.diskMassKg, activeParams.diskRadiusM);
  const bulletLinearMomentum = activeParams.bulletMassKg * activeParams.bulletSpeed;
  const bulletAngularMomentum = -effectiveImpactY * bulletLinearMomentum;
  const diskAngularMomentum = diskI * sim.omega;
  const totalAngularMomentumLive = diskAngularMomentum + bulletAngularMomentum;
  const iAfterPreview = diskI + activeParams.bulletMassKg * effectiveImpactY * effectiveImpactY;
  const omegaFinalPreview = iAfterPreview > 1e-9 ? totalAngularMomentumLive / iAfterPreview : 0;

  const embeddedPos = useMemo(() => {
    if (sim.phase !== 'post') return null;
    const a = sim.theta + sim.embeddedRelativeAngle;
    return {
      x: CENTER_X + Math.cos(a) * sim.embeddedRadius,
      y: CENTER_Y + Math.sin(a) * sim.embeddedRadius,
    };
  }, [sim.embeddedRadius, sim.embeddedRelativeAngle, sim.phase, sim.theta]);

  const fire = () => {
    const now = controlsRef.current;
    const clampedImpactY = clamp(now.impactYOffsetM, -now.diskRadiusM * 0.98, now.diskRadiusM * 0.98);
    const launch: LaunchParams = { ...now, impactYOffsetM: clampedImpactY };
    launchParamsRef.current = launch;
    setSim({
      ...initialSimState(launch),
      phase: 'firing',
      omega: launch.diskOmega0,
      bulletY: clampedImpactY,
    });
    setIsRunning(true);
  };

  const reset = () => {
    setIsRunning(false);
    const now = controlsRef.current;
    setSim(initialSimState(now));
  };

  const markerAngle = sim.theta;
  const markerEnd = {
    x: CENTER_X + Math.cos(markerAngle) * activeParams.diskRadiusM * 0.9,
    y: CENTER_Y + Math.sin(markerAngle) * activeParams.diskRadiusM * 0.9,
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-8 text-slate-100">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">
            Rotational dynamics
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
            Bullet &amp; Rotating Disk (Angular Momentum Transfer)
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-300">
            A bullet embeds into an off-center point on a rotating disk. Angular momentum about the
            center is conserved, so the post-impact angular speed changes as inertia changes.
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
          <h2 className="text-sm font-semibold tracking-wide text-sky-300">Simulation canvas</h2>
          <p className="mt-1 text-xs text-slate-300">
            The collision is perfectly inelastic: the bullet sticks at impact and rotates with the disk.
          </p>

          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/85 p-3">
            <svg viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`} className="h-[26rem] w-full rounded-lg">
              <rect x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill="#020617" />
              <line
                x1={worldToSvgX(CENTER_X)}
                y1={0}
                x2={worldToSvgX(CENTER_X)}
                y2={CANVAS_H}
                stroke="#334155"
                strokeDasharray="7 7"
                strokeWidth={1.2}
              />
              <line
                x1={0}
                y1={worldToSvgY(CENTER_Y)}
                x2={CANVAS_W}
                y2={worldToSvgY(CENTER_Y)}
                stroke="#334155"
                strokeDasharray="7 7"
                strokeWidth={1.2}
              />

              <circle
                cx={worldToSvgX(CENTER_X)}
                cy={worldToSvgY(CENTER_Y)}
                r={(activeParams.diskRadiusM / (WORLD_X_MAX - WORLD_X_MIN)) * CANVAS_W}
                fill="rgba(14,116,144,0.22)"
                stroke="#22d3ee"
                strokeWidth={2}
              />

              <line
                x1={worldToSvgX(CENTER_X)}
                y1={worldToSvgY(CENTER_Y)}
                x2={worldToSvgX(markerEnd.x)}
                y2={worldToSvgY(markerEnd.y)}
                stroke="#fbbf24"
                strokeWidth={3}
                strokeLinecap="round"
              />

              {sim.phase === 'firing' ? (
                <circle
                  cx={worldToSvgX(sim.bulletX)}
                  cy={worldToSvgY(sim.bulletY)}
                  r={5}
                  fill="#f87171"
                  stroke="#fecaca"
                  strokeWidth={1}
                />
              ) : null}

              {embeddedPos ? (
                <circle
                  cx={worldToSvgX(embeddedPos.x)}
                  cy={worldToSvgY(embeddedPos.y)}
                  r={5}
                  fill="#fb7185"
                  stroke="#fecdd3"
                  strokeWidth={1}
                />
              ) : null}
            </svg>
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-950/80 p-5 shadow-lg shadow-slate-950/40">
          <h2 className="text-sm font-semibold tracking-wide text-sky-300">Controls</h2>

          <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
            <p className="mb-2 text-xs font-medium text-slate-200">Disk controls</p>
            <SliderWithInput
              label="Disk mass"
              units="kg"
              min={1}
              max={500}
              step={1}
              value={diskMassKg}
              onChange={setDiskMassKg}
              syncToUrl={false}
              disabled={isRunning}
            />
            <div className="mt-2" />
            <SliderWithInput
              label="Disk radius"
              units="m"
              min={0.5}
              max={5}
              step={0.1}
              value={diskRadiusM}
              onChange={setDiskRadiusM}
              syncToUrl={false}
              disabled={isRunning}
            />
            <div className="mt-2" />
            <SliderWithInput
              label="Initial angular velocity"
              units="rad/s"
              min={-20}
              max={20}
              step={0.1}
              value={diskOmega0}
              onChange={setDiskOmega0}
              syncToUrl={false}
              disabled={isRunning}
            />
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
            <p className="mb-2 text-xs font-medium text-slate-200">Bullet controls</p>
            <SliderWithInput
              label="Bullet mass"
              units="kg"
              min={0.1}
              max={10}
              step={0.1}
              value={bulletMassKg}
              onChange={setBulletMassKg}
              syncToUrl={false}
              disabled={isRunning}
            />
            <div className="mt-2" />
            <SliderWithInput
              label="Bullet speed"
              units="m/s"
              min={1}
              max={100}
              step={1}
              value={bulletSpeed}
              onChange={setBulletSpeed}
              syncToUrl={false}
              disabled={isRunning}
            />
            <div className="mt-2" />
            <SliderWithInput
              label="Impact y-offset"
              units="m"
              min={-5}
              max={5}
              step={0.1}
              value={impactYOffsetM}
              onChange={setImpactYOffsetM}
              syncToUrl={false}
              disabled={isRunning}
            />
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
            <p className="text-xs text-slate-300">
              Phase:{' '}
              <span className="font-semibold text-sky-200">
                {sim.phase === 'idle' ? 'Ready' : sim.phase === 'firing' ? 'Before impact' : 'After impact'}
              </span>
            </p>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={fire}
                disabled={isRunning}
                className="rounded-full border border-emerald-500/70 bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Fire bullet
              </button>
              <button
                type="button"
                onClick={reset}
                className="rounded-full border border-slate-500/70 bg-slate-700/40 px-3 py-1 text-xs font-semibold text-slate-100 transition hover:bg-slate-600/50"
              >
                Reset
              </button>
            </div>
          </div>
        </section>
      </main>

      <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <h2 className="text-sm font-semibold tracking-wide text-sky-300">
          Momentum and angular momentum calculator
        </h2>
        <div className="mt-3 grid gap-4 lg:grid-cols-3">
          <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
            <p className="text-xs font-medium text-slate-200">Before impact</p>
            <DataRow label="Bullet linear momentum, p = mv" value={`${bulletLinearMomentum.toFixed(3)} kg·m/s`} />
            <DataRow label="Disk angular momentum, Iω" value={`${diskAngularMomentum.toFixed(3)} kg·m²/s`} />
            <DataRow label="Total angular momentum (about center)" value={`${totalAngularMomentumLive.toFixed(3)} kg·m²/s`} />
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
            <p className="text-xs font-medium text-slate-200">Impact term</p>
            <DataRow label="r × p contribution" value={`${bulletAngularMomentum.toFixed(3)} kg·m²/s`} />
            <DataRow label="Impact y-offset used" value={`${effectiveImpactY.toFixed(3)} m`} />
            <DataRow label="Conservation statement" value="L_before = L_after" />
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
            <p className="text-xs font-medium text-slate-200">After impact</p>
            <DataRow
              label="New total inertia, I_total"
              value={`${(sim.phase === 'post' ? sim.totalInertiaAfter : iAfterPreview).toFixed(3)} kg·m²`}
            />
            <DataRow
              label="Final angular speed, ω_final"
              value={`${(sim.phase === 'post' ? sim.omega : omegaFinalPreview).toFixed(3)} rad/s`}
            />
            <DataRow
              label="Angular momentum check"
              value={`${(sim.phase === 'post' ? sim.totalAngularMomentumBefore : totalAngularMomentumLive).toFixed(3)} kg·m²/s`}
            />
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-sky-300">
          Concept explanation
        </h2>
        <div className="mt-3 space-y-2 text-sm text-slate-300">
          <p>
            Angular momentum about the disk center is conserved through the sticking interaction.
            The bullet adds angular momentum through r × p, where the impact offset controls the
            lever arm.
          </p>
          <p>
            Off-center impacts change rotation more strongly because they produce a larger r × p
            term. A center hit has little rotational effect even if the bullet has large linear momentum.
          </p>
          <p>
            After embedding, total inertia increases because the bullet mass is now part of the
            rotating body. The system then rotates as a single rigid object with updated ω_final.
          </p>
        </div>
      </section>
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-2 rounded-md border border-slate-800 bg-slate-900/70 px-3 py-2">
      <p className="text-[0.66rem] text-slate-400">{label}</p>
      <p className="mt-0.5 font-mono text-[0.78rem] text-sky-200">{value}</p>
    </div>
  );
}
