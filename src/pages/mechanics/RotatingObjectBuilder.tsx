import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { Link } from 'react-router-dom';
import { SliderWithInput } from '../../components/SliderWithInput';
import { formatSI } from '@/utils/formatters'

type ComponentType = 'point' | 'sphere' | 'rod' | 'ring';

type BaseComponent = {
  id: string;
  type: ComponentType;
  name: string;
  massKg: number;
  branchAngleDeg: number;
  connectorLengthM: number;
  connectorMassKg: number;
};

type PointComponent = BaseComponent & {
  type: 'point';
};

type SphereComponent = BaseComponent & {
  type: 'sphere';
  radiusM: number;
};

type RodComponent = BaseComponent & {
  type: 'rod';
  lengthM: number;
  bodyAngleDeg: number;
};

type RingComponent = BaseComponent & {
  type: 'ring';
  radiusM: number;
};

type BuilderComponent = PointComponent | SphereComponent | RodComponent | RingComponent;

type Contribution = {
  id: string;
  name: string;
  type: ComponentType;
  distanceToAxis: number;
  connectorInertia: number;
  bodyInertia: number;
  totalInertia: number;
};

type RotationInputMode = 'angular_speed' | 'angular_momentum';

const CANVAS_PX = 560;
const WORLD_HALF_SPAN_M = 12;
const AXIS_DEFAULT_X_M = 0;
const AXIS_Y_M = 0;
const MASS_MIN = 0.5;
const MASS_MAX = 50;

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function worldToSvg(valueM: number): number {
  return ((valueM + WORLD_HALF_SPAN_M) / (2 * WORLD_HALF_SPAN_M)) * CANVAS_PX;
}

function svgToWorld(valuePx: number): number {
  return (valuePx / CANVAS_PX) * (2 * WORLD_HALF_SPAN_M) - WORLD_HALF_SPAN_M;
}

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function colorForType(type: ComponentType): string {
  if (type === 'point') return '#f59e0b';
  if (type === 'sphere') return '#38bdf8';
  if (type === 'ring') return '#22d3ee';
  return '#a78bfa';
}

function endpointFromBranch(c: BuilderComponent, axisX: number) {
  const a = degToRad(c.branchAngleDeg);
  return {
    x: axisX + Math.cos(a) * c.connectorLengthM,
    y: AXIS_Y_M + Math.sin(a) * c.connectorLengthM,
  };
}

function inertiaForComponent(c: BuilderComponent): {
  distance: number;
  connectorInertia: number;
  bodyInertia: number;
  totalInertia: number;
} {
  const d = c.connectorLengthM;
  const connectorInertia = (1 / 3) * c.connectorMassKg * d * d;

  let bodyInertia = 0;
  if (c.type === 'point') {
    bodyInertia = c.massKg * d * d;
  } else if (c.type === 'sphere') {
    const iCm = (2 / 5) * c.massKg * c.radiusM * c.radiusM;
    bodyInertia = iCm + c.massKg * d * d;
  } else if (c.type === 'ring') {
    const iCm = c.massKg * c.radiusM * c.radiusM;
    bodyInertia = iCm + c.massKg * d * d;
  } else {
    const iCm = (1 / 12) * c.massKg * c.lengthM * c.lengthM;
    bodyInertia = iCm + c.massKg * d * d;
  }

  return {
    distance: d,
    connectorInertia,
    bodyInertia,
    totalInertia: connectorInertia + bodyInertia,
  };
}

export function RotatingObjectBuilder() {
  const [components, setComponents] = useState<BuilderComponent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [axisX, setAxisX] = useState(AXIS_DEFAULT_X_M);
  const [idCounter, setIdCounter] = useState(1);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [rotationInputMode, setRotationInputMode] =
    useState<RotationInputMode>('angular_speed');
  const [launchOmegaRadPerS, setLaunchOmegaRadPerS] = useState(1.5);
  const [targetAngularMomentum, setTargetAngularMomentum] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinOffsetDeg, setSpinOffsetDeg] = useState(0);
  const lastTimestampRef = useRef<number | null>(null);

  const selected = useMemo(
    () => components.find((c) => c.id === selectedId) ?? null,
    [components, selectedId]
  );

  const contributions = useMemo<Contribution[]>(
    () =>
      components.map((c) => {
        const calc = inertiaForComponent(c);
        return {
          id: c.id,
          name: c.name,
          type: c.type,
          distanceToAxis: calc.distance,
          connectorInertia: calc.connectorInertia,
          bodyInertia: calc.bodyInertia,
          totalInertia: calc.totalInertia,
        };
      }),
    [components]
  );

  const totalInertia = useMemo(
    () => contributions.reduce((sum, c) => sum + c.totalInertia, 0),
    [contributions]
  );
  const effectiveOmegaRadPerS = useMemo(() => {
    if (rotationInputMode === 'angular_speed') return launchOmegaRadPerS;
    if (totalInertia <= 1e-9) return 0;
    return targetAngularMomentum / totalInertia;
  }, [launchOmegaRadPerS, rotationInputMode, targetAngularMomentum, totalInertia]);

  const totalAngularMomentum = useMemo(
    () => totalInertia * effectiveOmegaRadPerS,
    [effectiveOmegaRadPerS, totalInertia]
  );

  const totalRotationalEnergy = useMemo(
    () => 0.5 * totalInertia * effectiveOmegaRadPerS * effectiveOmegaRadPerS,
    [effectiveOmegaRadPerS, totalInertia]
  );

  const maxContribution = useMemo(
    () => Math.max(1e-6, ...contributions.map((c) => c.totalInertia)),
    [contributions]
  );

  const addComponent = (type: ComponentType) => {
    const id = `comp-${idCounter}`;
    const branchAngleDeg = ((components.length * 45) % 360) - 90;
    let component: BuilderComponent;
    if (type === 'point') {
      component = {
        id,
        type,
        name: `Point Mass ${idCounter}`,
        massKg: 5,
        branchAngleDeg,
        connectorLengthM: 5,
        connectorMassKg: 1,
      };
    } else if (type === 'sphere') {
      component = {
        id,
        type,
        name: `Sphere ${idCounter}`,
        massKg: 5,
        branchAngleDeg,
        connectorLengthM: 5,
        connectorMassKg: 1,
        radiusM: 1,
      };
    } else if (type === 'rod') {
      component = {
        id,
        type,
        name: `Rod ${idCounter}`,
        massKg: 5,
        branchAngleDeg,
        connectorLengthM: 5,
        connectorMassKg: 1,
        lengthM: 4,
        bodyAngleDeg: 0,
      };
    } else {
      component = {
        id,
        type,
        name: `Ring ${idCounter}`,
        massKg: 5,
        branchAngleDeg,
        connectorLengthM: 5,
        connectorMassKg: 1,
        radiusM: 1.4,
      };
    }
    setComponents((prev) => [...prev, component]);
    setSelectedId(id);
    setIdCounter((n) => n + 1);
  };

  const updateSelected = (updater: (current: BuilderComponent) => BuilderComponent) => {
    if (!selectedId) return;
    setComponents((prev) => prev.map((c) => (c.id === selectedId ? updater(c) : c)));
  };

  const removeSelected = () => {
    if (!selectedId) return;
    setComponents((prev) => prev.filter((c) => c.id !== selectedId));
    setSelectedId(null);
  };

  const onCanvasPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!draggingId) return;
    const bounds = e.currentTarget.getBoundingClientRect();
    const x = clamp(e.clientX - bounds.left, 0, bounds.width);
    const y = clamp(e.clientY - bounds.top, 0, bounds.height);
    const wx = svgToWorld((x / bounds.width) * CANVAS_PX);
    const wy = svgToWorld((y / bounds.height) * CANVAS_PX);

    const dx = wx - axisX;
    const dy = wy - AXIS_Y_M;
    const len = clamp(Math.sqrt(dx * dx + dy * dy), 0, 12);
    const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

    setComponents((prev) =>
      prev.map((c) =>
        c.id === draggingId
          ? {
              ...c,
              connectorLengthM: len,
              branchAngleDeg: angleDeg,
            }
          : c
      )
    );
  };

  useEffect(() => {
    let rafId: number | null = null;
    const step = (ts: number) => {
      if (!isSpinning) {
        lastTimestampRef.current = null;
        return;
      }
      if (lastTimestampRef.current == null) {
        lastTimestampRef.current = ts;
      } else {
        const dt = (ts - lastTimestampRef.current) / 1000;
        lastTimestampRef.current = ts;
        const deltaDeg = (effectiveOmegaRadPerS * 180 * dt) / Math.PI;
        setSpinOffsetDeg((prev) => (prev + deltaDeg) % 360);
      }
      rafId = requestAnimationFrame(step);
    };

    if (isSpinning) {
      rafId = requestAnimationFrame(step);
    } else {
      lastTimestampRef.current = null;
    }

    return () => {
      if (rafId != null) cancelAnimationFrame(rafId);
    };
  }, [effectiveOmegaRadPerS, isSpinning]);

  const axisPx = worldToSvg(axisX);
  const pivotYpx = worldToSvg(AXIS_Y_M);

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-8 text-slate-100">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">
            Rotational dynamics
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
            Rotating Object Builder (Moment of Inertia Explorer)
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-300">
            Every object branches from one shared rotation center. Each branch has a thin connector
            rod with editable length and mass, and both connector and object contribute to I.
          </p>
        </div>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-sky-500 hover:text-sky-100"
        >
          ← Dashboard
        </Link>
      </header>

      <main className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/40">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold tracking-wide text-sky-300">Workspace canvas</h2>
            <p className="text-[0.72rem] text-slate-400">
              Shared center axis at x = {axisX.toFixed(2)} m
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3">
            <svg
              viewBox={`0 0 ${CANVAS_PX} ${CANVAS_PX}`}
              className="h-[32rem] w-full rounded-lg"
              onPointerMove={onCanvasPointerMove}
              onPointerUp={() => setDraggingId(null)}
              onPointerLeave={() => setDraggingId(null)}
            >
              <rect x={0} y={0} width={CANVAS_PX} height={CANVAS_PX} fill="#020617" />
              <g opacity={0.16}>
                {Array.from({ length: 13 }).map((_, i) => {
                  const p = (CANVAS_PX / 12) * i;
                  return (
                    <g key={`grid-${i}`}>
                      <line x1={p} y1={0} x2={p} y2={CANVAS_PX} stroke="#94a3b8" strokeWidth={1} />
                      <line x1={0} y1={p} x2={CANVAS_PX} y2={p} stroke="#94a3b8" strokeWidth={1} />
                    </g>
                  );
                })}
              </g>

              <line
                x1={axisPx}
                y1={0}
                x2={axisPx}
                y2={CANVAS_PX}
                stroke="#f43f5e"
                strokeWidth={3}
                strokeDasharray="8 8"
              />
              <circle cx={axisPx} cy={pivotYpx} r={6} fill="#f43f5e" stroke="#fecdd3" strokeWidth={1.8} />

              {components.map((c) => {
                const effectiveBranch = { ...c, branchAngleDeg: c.branchAngleDeg + spinOffsetDeg };
                const end = endpointFromBranch(effectiveBranch, axisX);
                const sx = worldToSvg(end.x);
                const sy = worldToSvg(end.y);
                const isSelected = c.id === selectedId;
                const color = colorForType(c.type);
                return (
                  <g
                    key={c.id}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      setSelectedId(c.id);
                      setDraggingId(c.id);
                    }}
                    style={{ cursor: 'grab' }}
                  >
                    <line
                      x1={axisPx}
                      y1={pivotYpx}
                      x2={sx}
                      y2={sy}
                      stroke="#cbd5e1"
                      strokeWidth={Math.max(1.4, c.connectorMassKg * 0.25)}
                      opacity={0.9}
                    />
                    <line
                      x1={sx}
                      y1={sy}
                      x2={axisPx}
                      y2={pivotYpx}
                      stroke="#94a3b8"
                      strokeDasharray="6 4"
                      strokeWidth={1}
                      opacity={0.55}
                    />

                    {c.type === 'point' ? (
                      <circle
                        cx={sx}
                        cy={sy}
                        r={8}
                        fill={color}
                        stroke={isSelected ? '#f8fafc' : '#0f172a'}
                        strokeWidth={isSelected ? 2.5 : 1.5}
                      />
                    ) : null}
                    {c.type === 'sphere' ? (
                      <circle
                        cx={sx}
                        cy={sy}
                        r={Math.max(8, c.radiusM * 9)}
                        fill={color}
                        fillOpacity={0.7}
                        stroke={isSelected ? '#f8fafc' : '#0f172a'}
                        strokeWidth={isSelected ? 2.5 : 1.5}
                      />
                    ) : null}
                    {c.type === 'ring' ? (
                      <circle
                        cx={sx}
                        cy={sy}
                        r={Math.max(8, c.radiusM * 9)}
                        fill="none"
                        stroke={color}
                        strokeWidth={Math.max(2, c.radiusM * 1.2)}
                        opacity={0.95}
                      />
                    ) : null}
                    {c.type === 'rod' ? (
                      <g transform={`translate(${sx}, ${sy}) rotate(${c.bodyAngleDeg + spinOffsetDeg})`}>
                        <rect
                          x={-(c.lengthM * 9) / 2}
                          y={-5}
                          width={Math.max(16, c.lengthM * 9)}
                          height={10}
                          rx={4}
                          fill={color}
                          fillOpacity={0.8}
                          stroke={isSelected ? '#f8fafc' : '#0f172a'}
                          strokeWidth={isSelected ? 2.5 : 1.5}
                        />
                      </g>
                    ) : null}
                    <text x={sx + 10} y={sy - 10} fill="#e2e8f0" fontSize={11}>
                      {c.name}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-950/80 p-5 shadow-lg shadow-slate-950/40">
          <h2 className="text-sm font-semibold tracking-wide text-sky-300">Builder controls</h2>

          <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
            <p className="text-xs font-medium text-slate-200">Add components</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => addComponent('point')}
                className="rounded-full border border-amber-400/70 bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-100 transition hover:bg-amber-500/30"
              >
                + Point Mass
              </button>
              <button
                type="button"
                onClick={() => addComponent('sphere')}
                className="rounded-full border border-sky-400/70 bg-sky-500/20 px-3 py-1 text-xs font-semibold text-sky-100 transition hover:bg-sky-500/30"
              >
                + Solid Sphere
              </button>
              <button
                type="button"
                onClick={() => addComponent('rod')}
                className="rounded-full border border-violet-400/70 bg-violet-500/20 px-3 py-1 text-xs font-semibold text-violet-100 transition hover:bg-violet-500/30"
              >
                + Thin Rod
              </button>
              <button
                type="button"
                onClick={() => addComponent('ring')}
                className="rounded-full border border-cyan-400/70 bg-cyan-500/20 px-3 py-1 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/30"
              >
                + Ring
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
            <SliderWithInput
              label="Axis x-position"
              units="m"
              min={-10}
              max={10}
              step={0.1}
              value={axisX}
              onChange={(v) => setAxisX(v)}
              syncToUrl={false}
            />
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
            <p className="text-xs font-medium text-slate-200">Launch controls</p>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setRotationInputMode('angular_speed')}
                className={`rounded-full px-2.5 py-1 text-[0.65rem] font-semibold transition ${
                  rotationInputMode === 'angular_speed'
                    ? 'bg-sky-500 text-slate-950'
                    : 'border border-slate-700 bg-slate-900 text-slate-300 hover:border-sky-500'
                }`}
              >
                Set ω
              </button>
              <button
                type="button"
                onClick={() => setRotationInputMode('angular_momentum')}
                className={`rounded-full px-2.5 py-1 text-[0.65rem] font-semibold transition ${
                  rotationInputMode === 'angular_momentum'
                    ? 'bg-emerald-400 text-slate-950'
                    : 'border border-slate-700 bg-slate-900 text-slate-300 hover:border-emerald-500'
                }`}
              >
                Set L
              </button>
            </div>
            <div className="mt-2">
              {rotationInputMode === 'angular_speed' ? (
                <SliderWithInput
                  label="Angular speed"
                  units="rad/s"
                  min={-12}
                  max={12}
                  step={0.1}
                  value={launchOmegaRadPerS}
                  onChange={(v) => setLaunchOmegaRadPerS(v)}
                  syncToUrl={false}
                />
              ) : (
                <SliderWithInput
                  label="Angular momentum"
                  units="kg·m²/s"
                  min={-500}
                  max={500}
                  step={0.5}
                  value={targetAngularMomentum}
                  onChange={(v) => setTargetAngularMomentum(v)}
                  syncToUrl={false}
                />
              )}
              <p className="mt-2 text-[0.68rem] text-slate-400">
                Effective ω: {formatSI(effectiveOmegaRadPerS, 'rad/s', 3)}
              </p>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsSpinning(true)}
                className="rounded-full border border-emerald-500/70 bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/30"
              >
                Launch
              </button>
              <button
                type="button"
                onClick={() => setIsSpinning(false)}
                className="rounded-full border border-slate-500/70 bg-slate-700/40 px-3 py-1 text-xs font-semibold text-slate-100 transition hover:bg-slate-600/50"
              >
                Stop
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsSpinning(false);
                  setSpinOffsetDeg(0);
                }}
                className="rounded-full border border-sky-500/70 bg-sky-500/20 px-3 py-1 text-xs font-semibold text-sky-100 transition hover:bg-sky-500/30"
              >
                Reset angle
              </button>
              <span className="text-[0.68rem] text-slate-400">
                {isSpinning ? 'Spinning' : 'Idle'}
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium text-slate-200">Selected branch</p>
              <button
                type="button"
                onClick={removeSelected}
                disabled={!selected}
                className="rounded-full border border-rose-500/70 bg-rose-500/20 px-2.5 py-1 text-[0.7rem] font-semibold text-rose-100 transition hover:bg-rose-500/30 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Delete
              </button>
            </div>
            {!selected ? (
              <p className="text-xs text-slate-400">Click an object in the canvas to edit its branch.</p>
            ) : (
              <div className="space-y-2">
                <p className="text-[0.78rem] font-semibold text-slate-100">{selected.name}</p>
                <SliderWithInput
                  label="Object mass"
                  units="kg"
                  min={MASS_MIN}
                  max={MASS_MAX}
                  step={0.5}
                  value={selected.massKg}
                  onChange={(v) => updateSelected((c) => ({ ...c, massKg: v }))}
                  syncToUrl={false}
                />
                <SliderWithInput
                  label="Branch angle"
                  units="deg"
                  min={-180}
                  max={180}
                  step={1}
                  value={selected.branchAngleDeg}
                  onChange={(v) => updateSelected((c) => ({ ...c, branchAngleDeg: v }))}
                  syncToUrl={false}
                />
                <SliderWithInput
                  label="Connector rod length"
                  units="m"
                  min={0}
                  max={12}
                  step={0.1}
                  value={selected.connectorLengthM}
                  onChange={(v) =>
                    updateSelected((c) => ({ ...c, connectorLengthM: v }))
                  }
                  syncToUrl={false}
                />
                <SliderWithInput
                  label="Connector rod mass"
                  units="kg"
                  min={0}
                  max={MASS_MAX}
                  step={0.5}
                  value={selected.connectorMassKg}
                  onChange={(v) =>
                    updateSelected((c) => ({ ...c, connectorMassKg: v }))
                  }
                  syncToUrl={false}
                />
                {selected.type === 'sphere' ? (
                  <SliderWithInput
                    label="Sphere radius"
                    units="m"
                    min={0.2}
                    max={5}
                    step={0.1}
                    value={selected.radiusM}
                    onChange={(v) =>
                      updateSelected((c) => (c.type === 'sphere' ? { ...c, radiusM: v } : c))
                    }
                    syncToUrl={false}
                  />
                ) : null}
                {selected.type === 'ring' ? (
                  <SliderWithInput
                    label="Ring radius"
                    units="m"
                    min={0}
                    max={5}
                    step={0.1}
                    value={selected.radiusM}
                    onChange={(v) =>
                      updateSelected((c) => (c.type === 'ring' ? { ...c, radiusM: v } : c))
                    }
                    syncToUrl={false}
                  />
                ) : null}
                {selected.type === 'rod' ? (
                  <>
                    <SliderWithInput
                      label="Rod length"
                      units="m"
                      min={0.5}
                      max={10}
                      step={0.1}
                      value={selected.lengthM}
                      onChange={(v) =>
                        updateSelected((c) => (c.type === 'rod' ? { ...c, lengthM: v } : c))
                      }
                      syncToUrl={false}
                    />
                    <SliderWithInput
                      label="Rod orientation"
                      units="deg"
                      min={0}
                      max={360}
                      step={1}
                      value={selected.bodyAngleDeg}
                      onChange={(v) =>
                        updateSelected((c) => (c.type === 'rod' ? { ...c, bodyAngleDeg: v } : c))
                      }
                      syncToUrl={false}
                    />
                  </>
                ) : null}
              </div>
            )}
          </div>
        </section>
      </main>

      <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <h2 className="text-sm font-semibold tracking-wide text-sky-300">
          Moment of inertia, angular momentum, and rotational energy
        </h2>
        <div className="mt-3 grid gap-4 lg:grid-cols-3">
          <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
            <p className="text-xs text-slate-400">Total moment of inertia</p>
            <p className="mt-1 font-mono text-xl text-sky-200">{totalInertia.toFixed(4)} kg·m²</p>
            <p className="mt-2 text-[0.75rem] text-slate-400">
              I<sub>total</sub> = Σ(I<sub>connector</sub> + I<sub>object</sub>) with parallel-axis shifts.
            </p>
            <p className="mt-3 text-xs font-medium text-slate-200">Contribution breakdown</p>
            <div className="mt-2 space-y-2">
              {contributions.length === 0 ? (
                <p className="text-xs text-slate-400">No branches yet. Add one to start.</p>
              ) : (
                contributions.map((item) => (
                  <div key={item.id} className="rounded-md border border-slate-800 bg-slate-900/70 p-2">
                    <div className="flex items-center justify-between gap-2 text-[0.72rem]">
                      <span className="text-slate-200">{item.name}</span>
                      <span className="font-mono text-sky-200">{item.totalInertia.toFixed(4)} kg·m²</span>
                    </div>
                    <p className="mt-1 text-[0.68rem] text-slate-400">
                      d = {item.distanceToAxis.toFixed(2)} m | connector = {item.connectorInertia.toFixed(3)} |
                      body = {item.bodyInertia.toFixed(3)}
                    </p>
                    <div className="mt-1 h-2 overflow-hidden rounded bg-slate-800">
                      <div
                        className="h-full rounded bg-sky-400"
                        style={{ width: `${(item.totalInertia / maxContribution) * 100}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
            <p className="text-xs text-slate-400">Total angular momentum</p>
            <p className="mt-1 font-mono text-xl text-emerald-200">
              {totalAngularMomentum.toFixed(4)} kg·m²/s
            </p>
            <p className="mt-2 text-[0.75rem] text-slate-400">
              L = Iω using current ω = {effectiveOmegaRadPerS.toFixed(2)} rad/s.
            </p>
            <div className="mt-3 space-y-2">
              {contributions.length === 0 ? (
                <p className="text-xs text-slate-400">No components yet. Add one to start.</p>
              ) : (
                contributions.map((item) => {
                  const componentL = item.totalInertia * effectiveOmegaRadPerS;
                  return (
                    <div key={`L-${item.id}`} className="rounded-md border border-slate-800 bg-slate-900/70 p-2">
                      <div className="flex items-center justify-between gap-2 text-[0.72rem]">
                        <span className="text-slate-200">{item.name}</span>
                        <span className="font-mono text-emerald-200">
                          {componentL.toFixed(4)} kg·m²/s
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
            <p className="text-xs text-slate-400">Total rotational kinetic energy</p>
            <p className="mt-1 font-mono text-xl text-violet-200">
              {totalRotationalEnergy.toFixed(4)} J
            </p>
            <p className="mt-2 text-[0.75rem] text-slate-400">
              K<sub>rot</sub> = ½Iω² using current ω = {effectiveOmegaRadPerS.toFixed(2)} rad/s.
            </p>
            <div className="mt-3 space-y-2">
              {contributions.length === 0 ? (
                <p className="text-xs text-slate-400">No components yet. Add one to start.</p>
              ) : (
                contributions.map((item) => {
                  const componentK =
                    0.5 * item.totalInertia * effectiveOmegaRadPerS * effectiveOmegaRadPerS;
                  return (
                    <div key={`K-${item.id}`} className="rounded-md border border-slate-800 bg-slate-900/70 p-2">
                      <div className="flex items-center justify-between gap-2 text-[0.72rem]">
                        <span className="text-slate-200">{item.name}</span>
                        <span className="font-mono text-violet-200">{componentK.toFixed(4)} J</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-sky-300">
          Concept explanation
        </h2>
        <div className="mt-3 space-y-2 text-sm text-slate-300">
          <p>
            All objects share one rotation center. Each branch includes a connector rod and an end
            object, so both masses contribute to total rotational inertia.
          </p>
          <p>
            Mass farther from the axis has a stronger effect because contributions scale with r².
            Increasing connector length typically raises I much faster than increasing mass alone.
          </p>
          <p>
            Extended bodies use I = I<sub>cm</sub> + md², while connector rods are modeled as thin
            rods attached at one end: I = (1/3)mL².
          </p>
          <p>
            Rotational kinetic energy K<sub>rot</sub> = ½Iω² grows with the square of angular speed,
            so doubling ω quadruples stored rotational energy for the same object geometry.
          </p>
        </div>
      </section>
    </div>
  );
}
