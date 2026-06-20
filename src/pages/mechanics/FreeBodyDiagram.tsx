import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { SliderWithInput } from '../../components/SliderWithInput';
import { ConceptBox } from '../../components/ConceptBox';
import type { ReactNode } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type ObjectType = 'block' | 'circle' | 'beam' | 'inclined_plane' | 'hanging_mass' | 'wall';
type ForceType = 'weight' | 'normal' | 'tension' | 'friction' | 'applied' | 'spring' | 'reaction' | 'custom';

type Force = {
  id: string;
  type: ForceType;
  magnitude: number;
  angleDeg: number;
  label: string;
  anchorX: number;
  anchorY: number;
  color: string;
  visible: boolean;
  showComponents: boolean;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const CANVAS_W = 700;
const CANVAS_H = 460;
const OBJ_CX = 350;
const OBJ_CY = 230;
const FORCE_SCALE = 20;
const MIN_ARROW = 45;
const MAX_ARROW = 155;

const FORCE_COLORS: Record<ForceType, string> = {
  weight:   '#f87171',
  normal:   '#34d399',
  tension:  '#60a5fa',
  friction: '#fb923c',
  applied:  '#c084fc',
  spring:   '#fbbf24',
  reaction: '#22d3ee',
  custom:   '#e2e8f0',
};

const FORCE_DEFAULT_LABELS: Record<ForceType, string> = {
  weight:   'W',
  normal:   'N',
  tension:  'T',
  friction: 'f',
  applied:  'F',
  spring:   'Fs',
  reaction: 'R',
  custom:   'F',
};

const FORCE_DEFAULT_ANGLES: Record<ForceType, number> = {
  weight:   270,
  normal:   90,
  tension:  90,
  friction: 0,
  applied:  0,
  spring:   90,
  reaction: 90,
  custom:   90,
};

const SNAP_ANGLE_BUTTONS = [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 270, 315];

// ─── Math helpers ─────────────────────────────────────────────────────────────

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function arrowLen(magnitude: number): number {
  return Math.min(MAX_ARROW, Math.max(MIN_ARROW, magnitude * FORCE_SCALE));
}

function forceVec(angleDeg: number, magnitude: number): { dx: number; dy: number } {
  const r = degToRad(angleDeg);
  const len = arrowLen(magnitude);
  return { dx: Math.cos(r) * len, dy: -Math.sin(r) * len };
}

function arrowheadPoly(x1: number, y1: number, x2: number, y2: number, size = 11): string {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const a = Math.PI / 6;
  const p1x = x2 - size * Math.cos(angle - a);
  const p1y = y2 - size * Math.sin(angle - a);
  const p2x = x2 - size * Math.cos(angle + a);
  const p2y = y2 - size * Math.sin(angle + a);
  return `${x2.toFixed(1)},${y2.toFixed(1)} ${p1x.toFixed(1)},${p1y.toFixed(1)} ${p2x.toFixed(1)},${p2y.toFixed(1)}`;
}

function roundN(n: number, dec = 2): number {
  const f = Math.pow(10, dec);
  return Math.round(n * f) / f;
}

// ─── Object dimensions ────────────────────────────────────────────────────────

function objHalfDims(type: ObjectType): { hw: number; hh: number } {
  switch (type) {
    case 'block':          return { hw: 60,  hh: 40  };
    case 'circle':         return { hw: 45,  hh: 45  };
    case 'beam':           return { hw: 110, hh: 18  };
    case 'inclined_plane': return { hw: 80,  hh: 60  };
    case 'hanging_mass':   return { hw: 35,  hh: 35  };
    case 'wall':           return { hw: 20,  hh: 75  };
  }
}

function defaultAnchor(type: ForceType, objType: ObjectType): { x: number; y: number } {
  const { hw, hh } = objHalfDims(objType);
  switch (type) {
    case 'weight':   return { x: 0,   y: 0   };
    case 'normal':   return { x: 0,   y: hh  };
    case 'tension':  return { x: 0,   y: -hh };
    case 'friction': return { x: 0,   y: hh  };
    case 'applied':  return { x: 0,   y: 0   };
    case 'spring':   return { x: -hw, y: 0   };
    case 'reaction': return { x: 0,   y: hh  };
    case 'custom':   return { x: 0,   y: 0   };
  }
}

// ─── Force factory ────────────────────────────────────────────────────────────

let _nextId = 1;
function nextId() { return `f${_nextId++}`; }

function makeForce(type: ForceType, magnitude: number, objType: ObjectType, overrides?: Partial<Force>): Force {
  const anchor = defaultAnchor(type, objType);
  return {
    id: nextId(),
    type,
    magnitude,
    angleDeg: FORCE_DEFAULT_ANGLES[type],
    label: FORCE_DEFAULT_LABELS[type],
    anchorX: anchor.x,
    anchorY: anchor.y,
    color: FORCE_COLORS[type],
    visible: true,
    showComponents: false,
    ...overrides,
  };
}

// ─── Presets ──────────────────────────────────────────────────────────────────

type PresetForce = Omit<Force, 'id'>;
type Preset = {
  id: string;
  label: string;
  objectType: ObjectType;
  inclineAngleDeg?: number;
  forces: PresetForce[];
};

function pf(type: ForceType, magnitude: number, angleDeg: number, label: string, anchorX: number, anchorY: number): PresetForce {
  return { type, magnitude, angleDeg, label, anchorX, anchorY, color: FORCE_COLORS[type], visible: true, showComponents: false };
}

const PRESETS: Preset[] = [
  {
    id: 'block_table', label: 'Block on table', objectType: 'block',
    forces: [
      pf('weight', 49, 270, 'W',  0,   0),
      pf('normal', 49, 90,  'N',  0,   40),
    ],
  },
  {
    id: 'block_incline', label: 'Block on incline', objectType: 'block', inclineAngleDeg: 30,
    forces: [
      pf('weight',   49,   270, 'W',  0,  0),
      pf('normal',   42.4, 120, 'N',  0,  40),
      pf('friction', 24.5, 150, 'f',  0,  40),
    ],
  },
  {
    id: 'hanging_mass', label: 'Hanging mass', objectType: 'hanging_mass',
    forces: [
      pf('weight',  49, 270, 'W', 0,  0),
      pf('tension', 49, 90,  'T', 0, -35),
    ],
  },
  {
    id: 'two_rope_sign', label: 'Two-rope sign', objectType: 'block',
    forces: [
      pf('weight',  40,   270, 'W',  0,    0),
      pf('tension', 28.3, 135, 'T₁', -40, -40),
      pf('tension', 28.3, 45,  'T₂', 40,  -40),
    ],
  },
  {
    id: 'beam_supports', label: 'Beam two supports', objectType: 'beam',
    forces: [
      pf('weight',   60, 270, 'W',  0,    0),
      pf('reaction', 30, 90,  'R₁', -90,  18),
      pf('reaction', 30, 90,  'R₂', 90,   18),
    ],
  },
  {
    id: 'ladder_wall', label: 'Ladder against wall', objectType: 'beam',
    forces: [
      pf('weight',   50, 270, 'W',   0,   0),
      pf('normal',   50, 90,  'Nf', -90,  18),
      pf('friction', 20, 0,   'f',  -90,  18),
      pf('normal',   20, 180, 'Nw',  90, -18),
    ],
  },
  {
    id: 'pulley_tension', label: 'Pulley tension', objectType: 'hanging_mass',
    forces: [
      pf('weight',  49, 270, 'W',  0,   0),
      pf('tension', 49, 90,  'T', -15, -35),
    ],
  },
];

// ─── SVG sub-components ───────────────────────────────────────────────────────

function ObjectShape({ type, inclineAngleDeg = 30 }: { type: ObjectType; inclineAngleDeg?: number }) {
  const base = { stroke: '#94a3b8', strokeWidth: 2 as const };

  switch (type) {
    case 'block':
      return <rect x={-60} y={-40} width={120} height={80} rx={4} fill="#1e293b" {...base} />;
    case 'circle':
      return <circle r={45} fill="#1e293b" {...base} />;
    case 'beam':
      return <rect x={-110} y={-18} width={220} height={36} rx={4} fill="#1e293b" {...base} />;
    case 'inclined_plane': {
      const h = 150 * Math.tan(degToRad(inclineAngleDeg));
      const pts = `${-75},${Math.min(h / 2, 60)} ${75},${Math.min(h / 2, 60)} ${-75},${-Math.min(h / 2, 60)}`;
      return <polygon points={pts} fill="#1e293b" {...base} />;
    }
    case 'hanging_mass':
      return (
        <>
          <line x1={0} y1={-35} x2={0} y2={-120} stroke="#94a3b8" strokeWidth={2} strokeDasharray="6 4" />
          <circle r={35} fill="#1e293b" {...base} />
        </>
      );
    case 'wall': {
      const lines = Array.from({ length: 7 }, (_, i) => {
        const y = -65 + i * 22;
        return <line key={i} x1={20} y1={y} x2={35} y2={y - 10} stroke="#475569" strokeWidth={1.5} />;
      });
      return (
        <>
          <rect x={-20} y={-75} width={40} height={150} fill="#334155" {...base} />
          {lines}
        </>
      );
    }
  }
}

function ForceArrow({ force, showComponents }: { force: Force; showComponents: boolean }) {
  if (!force.visible) return null;
  const { dx, dy } = forceVec(force.angleDeg, force.magnitude);
  const ax = force.anchorX, ay = force.anchorY;
  const x2 = ax + dx, y2 = ay + dy;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const shrink = 10 / len;
  const lx2 = ax + dx * (1 - shrink);
  const ly2 = ay + dy * (1 - shrink);

  const Fx = force.magnitude * Math.cos(degToRad(force.angleDeg));
  const Fy = force.magnitude * Math.sin(degToRad(force.angleDeg));
  const fxLen = arrowLen(Math.abs(Fx));
  const fyLen = arrowLen(Math.abs(Fy));
  const fxSign = Fx >= 0 ? 1 : -1;
  const fySign = Fy >= 0 ? -1 : 1;

  const showComp = showComponents;

  return (
    <g>
      {showComp && Math.abs(Fx) > 0.05 && (
        <>
          <line x1={ax} y1={ay} x2={ax + fxSign * fxLen * 0.9} y2={ay}
            stroke={force.color} strokeWidth={1.5} strokeDasharray="5 3" opacity={0.7} />
          <polygon points={arrowheadPoly(ax, ay, ax + fxSign * fxLen, ay, 8)} fill={force.color} opacity={0.7} />
          <text x={ax + fxSign * fxLen * 0.5} y={ay + 16}
            textAnchor="middle" fill={force.color} fontSize={9} opacity={0.85}>
            {force.label}x={roundN(Fx, 1)}N
          </text>
        </>
      )}
      {showComp && Math.abs(Fy) > 0.05 && (
        <>
          <line x1={ax} y1={ay} x2={ax} y2={ay + fySign * fyLen * 0.9}
            stroke={force.color} strokeWidth={1.5} strokeDasharray="5 3" opacity={0.7} />
          <polygon points={arrowheadPoly(ax, ay, ax, ay + fySign * fyLen, 8)} fill={force.color} opacity={0.7} />
          <text x={ax + 14} y={ay + fySign * fyLen * 0.5}
            textAnchor="start" fill={force.color} fontSize={9} opacity={0.85}>
            {force.label}y={roundN(Fy, 1)}N
          </text>
        </>
      )}
      <line x1={ax} y1={ay} x2={lx2} y2={ly2}
        stroke={force.color} strokeWidth={2.5} strokeLinecap="round" />
      <polygon points={arrowheadPoly(ax, ay, x2, y2)} fill={force.color} />
      <text
        x={x2 + (dx / len) * 15} y={y2 + (dy / len) * 15}
        textAnchor="middle" dominantBaseline="middle"
        fill={force.color} fontSize={12} fontWeight={600}
      >
        {force.label}
      </text>
    </g>
  );
}

function NetForceArrow({ forces }: { forces: Force[] }) {
  let sfx = 0, sfy = 0;
  for (const f of forces.filter(f => f.visible)) {
    sfx += f.magnitude * Math.cos(degToRad(f.angleDeg));
    sfy += f.magnitude * Math.sin(degToRad(f.angleDeg));
  }
  const mag = Math.sqrt(sfx * sfx + sfy * sfy);
  if (mag < 0.01) return null;
  const angleDeg = (Math.atan2(sfy, sfx) * 180) / Math.PI;
  const { dx, dy } = forceVec(angleDeg, mag);
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const lx2 = dx * (1 - 10 / len);
  const ly2 = dy * (1 - 10 / len);
  return (
    <g opacity={0.9}>
      <line x1={0} y1={0} x2={lx2} y2={ly2}
        stroke="#fff" strokeWidth={2.5} strokeDasharray="8 4" strokeLinecap="round" />
      <polygon points={arrowheadPoly(0, 0, dx, dy)} fill="#fff" />
      <text x={dx + (dx / len) * 16} y={dy + (dy / len) * 16}
        textAnchor="middle" dominantBaseline="middle" fill="#fff" fontSize={11} fontWeight={600}>
        Fnet
      </text>
    </g>
  );
}

function Grid() {
  const dots = [];
  for (let x = 40; x < CANVAS_W; x += 40)
    for (let y = 40; y < CANVAS_H; y += 40)
      dots.push(<circle key={`${x}-${y}`} cx={x} cy={y} r={1.2} fill="rgba(100,116,139,0.28)" />);
  return <g>{dots}</g>;
}

function PivotMarker({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={9} fill="none" stroke="#fbbf24" strokeWidth={2} strokeDasharray="4 2" />
      <line x1={x - 9} y1={y} x2={x + 9} y2={y} stroke="#fbbf24" strokeWidth={1.5} />
      <line x1={x} y1={y - 9} x2={x} y2={y + 9} stroke="#fbbf24" strokeWidth={1.5} />
    </g>
  );
}

// ─── Physics computations ─────────────────────────────────────────────────────

function computeNet(forces: Force[]) {
  let sfx = 0, sfy = 0;
  for (const f of forces.filter(f => f.visible)) {
    sfx += f.magnitude * Math.cos(degToRad(f.angleDeg));
    sfy += f.magnitude * Math.sin(degToRad(f.angleDeg));
  }
  const mag = Math.sqrt(sfx * sfx + sfy * sfy);
  const dir = (Math.atan2(sfy, sfx) * 180) / Math.PI;
  return { sfx, sfy, mag, dir };
}

function computeTorques(forces: Force[], pivotX: number, pivotY: number) {
  return forces.filter(f => f.visible).map(f => {
    const rx = f.anchorX - pivotX;
    const ry = -(f.anchorY - pivotY);
    const Fx = f.magnitude * Math.cos(degToRad(f.angleDeg));
    const Fy = f.magnitude * Math.sin(degToRad(f.angleDeg));
    return { label: f.label, torque: rx * Fy - ry * Fx, color: f.color };
  });
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

function ToggleBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium transition ${active ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
      {children}
    </button>
  );
}

function StatChip({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-900/70 px-3 py-2">
      <p className="text-[0.66rem] text-slate-400">{label}</p>
      <p className="mt-0.5 font-mono text-[0.78rem]" style={{ color: color ?? '#93c5fd' }}>{value}</p>
    </div>
  );
}

function EqChip({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div className={`rounded-lg border px-4 py-3 ${ok ? 'border-emerald-700/50 bg-emerald-950/30' : 'border-rose-700/50 bg-rose-950/30'}`}>
      <p className={`text-xs font-semibold ${ok ? 'text-emerald-300' : 'text-rose-300'}`}>{label}</p>
      <p className={`mt-0.5 text-sm font-medium ${ok ? 'text-emerald-100' : 'text-rose-200'}`}>
        {ok ? '✓ Equilibrium' : '✗ Not in equilibrium'}
      </p>
      <p className="text-xs text-slate-400 mt-0.5">{detail}</p>
    </div>
  );
}

// ─── State ────────────────────────────────────────────────────────────────────

type AppState = {
  objectType: ObjectType;
  inclineAngleDeg: number;
  forces: Force[];
  selectedForceId: string | null;
  showNetForce: boolean;
  showGrid: boolean;
  globalShowComponents: boolean;
  showTorquePanel: boolean;
  pivotX: number;
  pivotY: number;
};

const INITIAL_STATE: AppState = {
  objectType: 'block',
  inclineAngleDeg: 30,
  forces: [
    { id: 'i1', type: 'weight', magnitude: 49, angleDeg: 270, label: 'W',  anchorX: 0, anchorY: 0,  color: FORCE_COLORS.weight, visible: true, showComponents: false },
    { id: 'i2', type: 'normal', magnitude: 49, angleDeg: 90,  label: 'N',  anchorX: 0, anchorY: 40, color: FORCE_COLORS.normal, visible: true, showComponents: false },
  ],
  selectedForceId: null,
  showNetForce: false,
  showGrid: true,
  globalShowComponents: false,
  showTorquePanel: false,
  pivotX: 0,
  pivotY: 0,
};

// ─── Main component ───────────────────────────────────────────────────────────

export function FreeBodyDiagram() {
  const [state, setState] = useState<AppState>(INITIAL_STATE);

  const patch = (p: Partial<AppState>) => setState(s => ({ ...s, ...p }));
  const patchForce = (id: string, p: Partial<Force>) =>
    setState(s => ({ ...s, forces: s.forces.map(f => f.id === id ? { ...f, ...p } : f) }));

  const selectedForce = state.forces.find(f => f.id === state.selectedForceId) ?? null;

  const addForce = (type: ForceType) => {
    const f = makeForce(type, 10, state.objectType);
    setState(s => ({ ...s, forces: [...s.forces, f], selectedForceId: f.id }));
  };

  const removeForce = (id: string) =>
    setState(s => ({
      ...s,
      forces: s.forces.filter(f => f.id !== id),
      selectedForceId: s.selectedForceId === id ? null : s.selectedForceId,
    }));

  const loadPreset = (preset: Preset) =>
    setState(s => ({
      ...s,
      objectType: preset.objectType,
      inclineAngleDeg: preset.inclineAngleDeg ?? s.inclineAngleDeg,
      forces: preset.forces.map(f => ({ ...f, id: nextId() })),
      selectedForceId: null,
    }));

  const net = useMemo(() => computeNet(state.forces), [state.forces]);
  const torques = useMemo(() => computeTorques(state.forces, state.pivotX, state.pivotY), [state.forces, state.pivotX, state.pivotY]);
  const totalTorque = torques.reduce((s, t) => s + t.torque, 0);

  const transEq = Math.abs(net.sfx) < 0.5 && Math.abs(net.sfy) < 0.5;
  const rotEq = Math.abs(totalTorque) < 0.5;

  let accelNote = '';
  if (!transEq) {
    if (Math.abs(net.sfy) >= Math.abs(net.sfx))
      accelNote = net.sfy > 0 ? 'Accelerates upward' : 'Accelerates downward';
    else
      accelNote = net.sfx > 0 ? 'Accelerates right' : 'Accelerates left';
  }

  const { hh: objHH } = objHalfDims(state.objectType);

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-8 text-slate-100">
      {/* Header */}
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">
            Mechanics · Statics
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
            Free Body Diagram
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-300">
            Build and analyze free body diagrams — add forces, decompose into components, check equilibrium, and compute torques.
          </p>
        </div>
        <Link
          to="/211"
          className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-sky-500 hover:text-sky-100"
        >
          <span className="text-sm">←</span> Back to PHYS211
        </Link>
      </header>

      <main className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        {/* ── Left: canvas ── */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h2 className="text-sm font-semibold text-sky-300">Diagram</h2>
            <div className="flex gap-2 flex-wrap">
              <ToggleBtn active={state.showGrid} onClick={() => patch({ showGrid: !state.showGrid })}>Grid</ToggleBtn>
              <ToggleBtn active={state.globalShowComponents} onClick={() => patch({ globalShowComponents: !state.globalShowComponents })}>Components</ToggleBtn>
              <ToggleBtn active={state.showNetForce} onClick={() => patch({ showNetForce: !state.showNetForce })}>Net force</ToggleBtn>
              <ToggleBtn active={state.showTorquePanel} onClick={() => patch({ showTorquePanel: !state.showTorquePanel })}>Torque</ToggleBtn>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
            <svg viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`} className="w-full h-auto">
              <rect width={CANVAS_W} height={CANVAS_H} fill="#020617" />
              {state.showGrid && <Grid />}

              {/* Ground line */}
              {(state.objectType === 'block' || state.objectType === 'beam') && (
                <line
                  x1={OBJ_CX - 140} y1={OBJ_CY + objHH + 2}
                  x2={OBJ_CX + 140} y2={OBJ_CY + objHH + 2}
                  stroke="#334155" strokeWidth={2}
                />
              )}

              <g transform={`translate(${OBJ_CX},${OBJ_CY})`}>
                <ObjectShape type={state.objectType} inclineAngleDeg={state.inclineAngleDeg} />

                {state.forces.map(f => (
                  <ForceArrow key={f.id} force={f} showComponents={state.globalShowComponents || f.showComponents} />
                ))}

                {state.showNetForce && <NetForceArrow forces={state.forces} />}
                {state.showTorquePanel && <PivotMarker x={state.pivotX} y={state.pivotY} />}

                {/* CoM dot */}
                <circle r={3.5} fill="rgba(255,255,255,0.45)" />
              </g>
            </svg>
          </div>

          {/* Object type selector */}
          <div className="mt-3">
            <p className="text-[0.65rem] text-slate-400 mb-1.5">Object type</p>
            <div className="flex flex-wrap gap-1.5">
              {(['block', 'circle', 'beam', 'inclined_plane', 'hanging_mass', 'wall'] as ObjectType[]).map(t => (
                <button key={t} type="button" onClick={() => patch({ objectType: t })}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition capitalize ${state.objectType === t ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
                  {t.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Incline angle (shown only for inclined_plane) */}
          {state.objectType === 'inclined_plane' && (
            <div className="mt-3">
              <SliderWithInput
                label="Incline angle"
                units="°"
                value={state.inclineAngleDeg}
                min={5}
                max={75}
                step={1}
                onChange={(v) => patch({ inclineAngleDeg: v })}
                syncToUrl={false}
              />
            </div>
          )}
        </section>

        {/* ── Right: controls ── */}
        <section className="flex flex-col gap-4">
          {/* Presets */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
            <h2 className="text-sm font-semibold text-sky-300 mb-2">Presets</h2>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map(p => (
                <button key={p.id} type="button" onClick={() => loadPreset(p)}
                  className="rounded-md bg-slate-800 px-2.5 py-1 text-xs text-slate-200 hover:bg-sky-800 transition">
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Force list */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
            <h2 className="text-sm font-semibold text-sky-300 mb-2">Forces</h2>

            {state.forces.length === 0 && (
              <p className="text-xs text-slate-500 mb-3">No forces. Add one below.</p>
            )}

            <div className="space-y-1 mb-3 max-h-48 overflow-y-auto">
              {state.forces.map(f => (
                <div key={f.id} onClick={() => patch({ selectedForceId: f.id })}
                  className={`flex items-center justify-between rounded-lg px-3 py-2 cursor-pointer transition ${state.selectedForceId === f.id ? 'bg-slate-700 ring-1 ring-sky-500' : 'bg-slate-900 hover:bg-slate-800'}`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: f.color }} />
                    <span className="text-xs font-mono text-slate-200 truncate">{f.label}</span>
                    <span className="text-[0.6rem] text-slate-500 hidden sm:inline">{f.type}</span>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className="text-[0.6rem] font-mono text-slate-400">{roundN(f.magnitude, 1)}N {roundN(f.angleDeg, 0)}°</span>
                    <button type="button" title="Toggle" onClick={e => { e.stopPropagation(); patchForce(f.id, { visible: !f.visible }); }}
                      className="px-1 text-slate-500 hover:text-slate-200 text-xs transition">
                      {f.visible ? '●' : '○'}
                    </button>
                    <button type="button" title="Remove" onClick={e => { e.stopPropagation(); removeForce(f.id); }}
                      className="px-1 text-slate-600 hover:text-red-400 text-xs transition">
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-[0.62rem] text-slate-500 mb-1.5">Add force:</p>
            <div className="flex flex-wrap gap-1.5">
              {(['weight', 'normal', 'tension', 'friction', 'applied', 'spring', 'reaction', 'custom'] as ForceType[]).map(t => (
                <button key={t} type="button" onClick={() => addForce(t)}
                  className="rounded-md px-2 py-0.5 text-[0.65rem] font-medium transition"
                  style={{ backgroundColor: FORCE_COLORS[t] + '22', color: FORCE_COLORS[t], border: `1px solid ${FORCE_COLORS[t]}44` }}>
                  + {t}
                </button>
              ))}
            </div>
          </div>

          {/* Force editor */}
          {selectedForce && (
            <div className="rounded-2xl border border-slate-700 bg-slate-950/80 p-4 ring-1 ring-sky-800">
              <h2 className="text-sm font-semibold mb-3" style={{ color: selectedForce.color }}>
                Edit: {selectedForce.label}
                <span className="ml-2 text-[0.65rem] font-normal text-slate-500">({selectedForce.type})</span>
              </h2>

              <div className="space-y-3">
                <div>
                  <label className="text-[0.65rem] text-slate-400">Label</label>
                  <input type="text" value={selectedForce.label}
                    onChange={e => patchForce(selectedForce.id, { label: e.target.value })}
                    className="mt-0.5 w-full rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-100 border border-slate-700 focus:outline-none focus:border-sky-500" />
                </div>

                <SliderWithInput
                  label="Magnitude"
                  units="N"
                  value={selectedForce.magnitude}
                  min={0.1}
                  max={200}
                  step={0.1}
                  onChange={(v) => patchForce(selectedForce.id, { magnitude: v })}
                  syncToUrl={false}
                />

                {/* Angle */}
                <SliderWithInput
                  label="Angle"
                  units="°"
                  value={selectedForce.angleDeg}
                  min={0}
                  max={360}
                  step={1}
                  onChange={(v) => patchForce(selectedForce.id, { angleDeg: v })}
                  syncToUrl={false}
                />
                <div className="flex flex-wrap gap-1">
                  {SNAP_ANGLE_BUTTONS.map(a => (
                    <button key={a} type="button" onClick={() => patchForce(selectedForce.id, { angleDeg: a })}
                      className={`rounded px-1.5 py-0.5 text-[0.6rem] transition ${Math.abs(selectedForce.angleDeg - a) < 0.5 ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
                      {a}°
                    </button>
                  ))}
                </div>

                <SliderWithInput
                  label="Anchor X"
                  units="px"
                  value={selectedForce.anchorX}
                  min={-130}
                  max={130}
                  step={1}
                  onChange={(v) => patchForce(selectedForce.id, { anchorX: v })}
                  syncToUrl={false}
                />
                <SliderWithInput
                  label="Anchor Y"
                  units="px"
                  value={selectedForce.anchorY}
                  min={-130}
                  max={130}
                  step={1}
                  onChange={(v) => patchForce(selectedForce.id, { anchorY: v })}
                  syncToUrl={false}
                />

                <div className="flex gap-4 flex-wrap">
                  <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                    <input type="checkbox" checked={selectedForce.showComponents}
                      onChange={e => patchForce(selectedForce.id, { showComponents: e.target.checked })}
                      className="accent-sky-400" />
                    Show components
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                    <input type="checkbox" checked={selectedForce.visible}
                      onChange={e => patchForce(selectedForce.id, { visible: e.target.checked })}
                      className="accent-sky-400" />
                    Visible
                  </label>
                </div>

                {/* Fx / Fy readout */}
                <div className="rounded-md bg-slate-900 px-3 py-2 text-xs font-mono space-y-1">
                  <div style={{ color: selectedForce.color }}>
                    Fx = {roundN(selectedForce.magnitude, 2)} cos({roundN(selectedForce.angleDeg, 1)}°)
                    = <strong>{roundN(selectedForce.magnitude * Math.cos(degToRad(selectedForce.angleDeg)), 3)} N</strong>
                  </div>
                  <div style={{ color: selectedForce.color }}>
                    Fy = {roundN(selectedForce.magnitude, 2)} sin({roundN(selectedForce.angleDeg, 1)}°)
                    = <strong>{roundN(selectedForce.magnitude * Math.sin(degToRad(selectedForce.angleDeg)), 3)} N</strong>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Net Force Panel */}
      <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
        <h2 className="text-sm font-semibold text-sky-300 mb-3">Net Force</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <StatChip label="ΣFx" value={`${roundN(net.sfx, 3)} N`} />
          <StatChip label="ΣFy" value={`${roundN(net.sfy, 3)} N`} />
          <StatChip label="|Fnet|" value={`${roundN(net.mag, 3)} N`} />
          <StatChip label="Direction" value={`${roundN(net.dir, 1)}°`} />
        </div>
      </section>

      {/* Torque Panel */}
      {state.showTorquePanel && (
        <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h2 className="text-sm font-semibold text-sky-300">Torques about pivot</h2>
            <div className="flex flex-wrap gap-3 items-center">
              <SliderWithInput
                label="Pivot X"
                units="px"
                value={state.pivotX}
                min={-120}
                max={120}
                step={1}
                onChange={(v) => patch({ pivotX: v })}
                syncToUrl={false}
                accentClass="accent-yellow-400"
              />
              <SliderWithInput
                label="Pivot Y"
                units="px"
                value={state.pivotY}
                min={-120}
                max={120}
                step={1}
                onChange={(v) => patch({ pivotY: v })}
                syncToUrl={false}
                accentClass="accent-yellow-400"
              />
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {torques.map((t, i) => (
              <StatChip key={i} label={`τ(${t.label})`} value={`${roundN(t.torque, 2)} N·m*`} color={t.color} />
            ))}
            <StatChip label="Στ" value={`${roundN(totalTorque, 2)} N·m*`} />
            <StatChip label="Rotation"
              value={totalTorque > 0.5 ? 'CCW ↺' : totalTorque < -0.5 ? 'CW ↻' : 'None'} />
          </div>
          <p className="mt-2 text-[0.65rem] text-slate-500">
            *r uses canvas pixels. τ = r × F; positive = counterclockwise.
          </p>
        </section>
      )}

      {/* Equilibrium */}
      <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
        <h2 className="text-sm font-semibold text-sky-300 mb-3">Equilibrium Check</h2>
        <div className="flex flex-wrap gap-4 items-start">
          <EqChip label="Translational" ok={transEq}
            detail={transEq ? 'ΣFx = ΣFy ≈ 0' : accelNote} />
          {state.showTorquePanel && (
            <EqChip label="Rotational" ok={rotEq}
              detail={rotEq ? 'Στ ≈ 0' : totalTorque > 0 ? 'Net rotation CCW ↺' : 'Net rotation CW ↻'} />
          )}
          {transEq && (!state.showTorquePanel || rotEq) && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-700/50 bg-emerald-950/40 px-4 py-3 self-stretch">
              <span className="text-emerald-300 text-xl">✓</span>
              <span className="text-sm font-semibold text-emerald-200">System balanced</span>
            </div>
          )}
        </div>
      </section>

      <ConceptBox
        heading="Free body diagram concepts"
        items={[
          {
            title: 'Free body diagram',
            description: 'An FBD isolates one object and shows all external forces acting on it. The environment is replaced entirely by force arrows — only the object and its forces remain.',
          },
          {
            title: 'Vector components',
            description: 'Every force F at angle θ has components Fx = F cosθ (horizontal) and Fy = F sinθ (vertical). Net force is found by summing each component independently: ΣFx and ΣFy.',
          },
          {
            title: 'Normal force',
            description: 'Always perpendicular to the contact surface, pointing away from it. For an object on an incline of angle α, the normal equals mg cosα when in equilibrium.',
          },
          {
            title: 'Translational equilibrium',
            description: 'Occurs when ΣFx = 0 and ΣFy = 0 simultaneously, meaning no linear acceleration. This is Newton\'s first law applied to all force directions.',
          },
          {
            title: 'Torque',
            description: 'τ = r × F measures how much a force rotates an object about a pivot. The scalar form is τ = rF sinθ, where θ is the angle between the position vector r and force F. Positive = counterclockwise.',
          },
          {
            title: 'Rotational equilibrium',
            description: 'A system is in rotational equilibrium when Στ = 0 about any pivot point. A completely static object requires both translational (ΣF = 0) and rotational (Στ = 0) equilibrium.',
          },
        ]}
      />
    </div>
  );
}
