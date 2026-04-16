import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ConceptBox } from '../../components/ConceptBox';
import { SliderWithInput } from '../../components/SliderWithInput';

type Body = {
  id: number;
  x: number;
  y: number;
  mass: number;
  color: string;
};

type Vec2 = { x: number; y: number };

const CANVAS_W = 860;
const CANVAS_H = 480;
const MIN_BODIES = 2;
const MAX_BODIES = 5;
const MIN_MASS = 0.5;
const MAX_MASS = 20;
const TRAIL_LIMIT = 220;

const COLORS = ['#38bdf8', '#22c55e', '#f97316', '#a78bfa', '#f43f5e'];

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function radiusFromMass(mass: number) {
  return 10 + mass * 1.2;
}

function format2(value: number) {
  return Number(value.toFixed(2));
}

function computeCOM(bodies: Body[]): Vec2 {
  let weightedX = 0;
  let weightedY = 0;
  let totalMass = 0;
  for (const b of bodies) {
    weightedX += b.mass * b.x;
    weightedY += b.mass * b.y;
    totalMass += b.mass;
  }
  if (totalMass <= 0) return { x: CANVAS_W / 2, y: CANVAS_H / 2 };
  return { x: weightedX / totalMass, y: weightedY / totalMass };
}

function buildInitialBodies(): Body[] {
  return [
    { id: 1, x: 220, y: 140, mass: 3, color: COLORS[0] },
    { id: 2, x: 520, y: 190, mass: 5, color: COLORS[1] },
    { id: 3, x: 360, y: 340, mass: 2.5, color: COLORS[2] },
  ];
}

export function CenterOfMass() {
  const [bodiesUi, setBodiesUi] = useState<Body[]>(() => buildInitialBodies());
  const [showTrail, setShowTrail] = useState(true);
  const [comUi, setComUi] = useState<Vec2>(() => computeCOM(buildInitialBodies()));

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const bodiesRef = useRef<Body[]>(bodiesUi);
  const draggingIdRef = useRef<number | null>(null);
  const trailRef = useRef<Vec2[]>([]);
  const lastUiUpdateRef = useRef(0);
  const nextIdRef = useRef(4);

  useEffect(() => {
    bodiesRef.current = bodiesUi;
  }, [bodiesUi]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = (ts: number) => {
      const bodies = bodiesRef.current;
      const com = computeCOM(bodies);

      if (showTrail) {
        trailRef.current.push(com);
        if (trailRef.current.length > TRAIL_LIMIT) {
          trailRef.current.shift();
        }
      } else if (trailRef.current.length > 0) {
        trailRef.current = [];
      }

      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

      const bg = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
      bg.addColorStop(0, 'rgba(2, 6, 23, 0.95)');
      bg.addColorStop(1, 'rgba(15, 23, 42, 0.95)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      ctx.strokeStyle = 'rgba(148, 163, 184, 0.24)';
      ctx.lineWidth = 1;
      for (let x = 20; x < CANVAS_W; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 12);
        ctx.lineTo(x, CANVAS_H - 12);
        ctx.stroke();
      }
      for (let y = 20; y < CANVAS_H; y += 40) {
        ctx.beginPath();
        ctx.moveTo(12, y);
        ctx.lineTo(CANVAS_W - 12, y);
        ctx.stroke();
      }

      if (trailRef.current.length > 1) {
        ctx.beginPath();
        for (let i = 0; i < trailRef.current.length; i += 1) {
          const p = trailRef.current[i];
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        }
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.28)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      for (const body of bodies) {
        const r = radiusFromMass(body.mass);
        ctx.beginPath();
        ctx.arc(body.x, body.y, r, 0, Math.PI * 2);
        ctx.fillStyle = `${body.color}cc`;
        ctx.fill();
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#e2e8f0';
        ctx.font = '12px ui-sans-serif, system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(`${body.mass.toFixed(1)} kg`, body.x, body.y + 4);
      }

      ctx.beginPath();
      ctx.arc(com.x, com.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#facc15';
      ctx.fill();
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(com.x - 14, com.y);
      ctx.lineTo(com.x + 14, com.y);
      ctx.moveTo(com.x, com.y - 14);
      ctx.lineTo(com.x, com.y + 14);
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#fef08a';
      ctx.font = '12px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`COM (${com.x.toFixed(1)}, ${com.y.toFixed(1)})`, 14, 24);

      if (ts - lastUiUpdateRef.current > 50) {
        lastUiUpdateRef.current = ts;
        setComUi(com);
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    animationRef.current = requestAnimationFrame(draw);
    return () => {
      if (animationRef.current != null) cancelAnimationFrame(animationRef.current);
    };
  }, [showTrail]);

  const getCanvasPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const sx = CANVAS_W / rect.width;
    const sy = CANVAS_H / rect.height;
    return {
      x: clamp((e.clientX - rect.left) * sx, 0, CANVAS_W),
      y: clamp((e.clientY - rect.top) * sy, 0, CANVAS_H),
    };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = getCanvasPos(e);
    if (!p) return;
    let closest: { id: number; d2: number } | null = null;
    for (const b of bodiesRef.current) {
      const dx = p.x - b.x;
      const dy = p.y - b.y;
      const d2 = dx * dx + dy * dy;
      const r = radiusFromMass(b.mass) + 6;
      if (d2 <= r * r && (!closest || d2 < closest.d2)) {
        closest = { id: b.id, d2 };
      }
    }
    if (!closest) return;
    draggingIdRef.current = closest.id;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const draggingId = draggingIdRef.current;
    if (draggingId == null) return;
    const p = getCanvasPos(e);
    if (!p) return;
    const next = bodiesRef.current.map((b) => {
      if (b.id !== draggingId) return b;
      const r = radiusFromMass(b.mass);
      return {
        ...b,
        x: clamp(p.x, r, CANVAS_W - r),
        y: clamp(p.y, r, CANVAS_H - r),
      };
    });
    bodiesRef.current = next;
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (draggingIdRef.current != null) {
      setBodiesUi([...bodiesRef.current]);
      draggingIdRef.current = null;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    }
  };

  const totalMass = useMemo(() => bodiesUi.reduce((sum, b) => sum + b.mass, 0), [bodiesUi]);

  const updateMass = (id: number, mass: number) => {
    const next = bodiesRef.current.map((b) =>
      b.id === id ? { ...b, mass: clamp(mass, MIN_MASS, MAX_MASS) } : b
    );
    bodiesRef.current = next;
    setBodiesUi(next);
  };

  const addBody = () => {
    if (bodiesRef.current.length >= MAX_BODIES) return;
    const id = nextIdRef.current++;
    const color = COLORS[(id - 1) % COLORS.length];
    const next = [
      ...bodiesRef.current,
      {
        id,
        x: 140 + bodiesRef.current.length * 120,
        y: 90 + bodiesRef.current.length * 70,
        mass: 3,
        color,
      },
    ];
    bodiesRef.current = next;
    setBodiesUi(next);
  };

  const removeBody = (id: number) => {
    if (bodiesRef.current.length <= MIN_BODIES) return;
    const next = bodiesRef.current.filter((b) => b.id !== id);
    bodiesRef.current = next;
    setBodiesUi(next);
  };

  const explanationItems = useMemo(
    () => [
      {
        title: 'Definition',
        description:
          'The center of mass (COM) is the weighted average position of all masses in a system. Heavier objects pull the COM closer to themselves.',
      },
      {
        title: 'Formula',
        description: (
          <>
            x<sub>cm</sub> = (Σ m<sub>i</sub>x<sub>i</sub>) / (Σ m<sub>i</sub>) and y<sub>cm</sub> = (Σ m<sub>i</sub>y<sub>i</sub>) / (Σ m<sub>i</sub>).
          </>
        ),
      },
      {
        title: 'Why Momentum Uses COM',
        description:
          'In multi-object systems, translational momentum and external-force response are easiest to analyze through COM motion instead of tracking each object separately.',
      },
      {
        title: 'Intuition',
        description:
          'Move a light object and COM shifts a little; move or increase mass of a heavy object and COM shifts much more.',
      },
    ],
    []
  );

  return (
    <div className="mx-auto flex min-h-screen max-w-[90rem] flex-col px-4 py-8 text-slate-100">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">Mechanics · Momentum</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">Center of Mass</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">
            Drag objects, change masses, and watch how the system center of mass updates in real time.
          </p>
        </div>
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-sky-500 hover:text-sky-100"
        >
          ← Home
        </Link>
      </header>

      <div className="mb-5 flex flex-wrap gap-2 border-b border-slate-800 pb-2">
        {['Kinematics', 'Forces', 'Energy', 'Work', 'Momentum'].map((unit) => (
          <span
            key={unit}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold ${
              unit === 'Momentum'
                ? 'bg-sky-600 text-slate-950'
                : 'bg-slate-800/80 text-slate-300'
            }`}
          >
            {unit}
          </span>
        ))}
      </div>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg">
        <h2 className="text-sm font-semibold tracking-wide text-sky-300">Simulation</h2>
        <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(260px,22rem)] lg:items-start">
          <div className="min-w-0">
            <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/60 p-2">
              <canvas
                ref={canvasRef}
                width={CANVAS_W}
                height={CANVAS_H}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerLeave={onPointerUp}
                className="block h-auto w-full rounded-lg touch-none bg-slate-950/60"
              />
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
              <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-sky-300">System</p>
              <div className="mt-2 space-y-1 text-xs text-slate-300">
                <p>Objects: {bodiesUi.length}</p>
                <p>Total mass: {format2(totalMass)} kg</p>
                <p>
                  COM: ({format2(comUi.x)}, {format2(comUi.y)})
                </p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={addBody}
                  disabled={bodiesUi.length >= MAX_BODIES}
                  className="rounded-full bg-sky-500 px-3 py-1.5 text-[0.7rem] font-semibold text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-600"
                >
                  Add object
                </button>
                <button
                  type="button"
                  onClick={() => setShowTrail((v) => !v)}
                  className="rounded-full border border-slate-700 px-3 py-1.5 text-[0.7rem] font-semibold"
                >
                  {showTrail ? 'Hide COM trail' : 'Show COM trail'}
                </button>
              </div>
            </div>

            <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/70 p-3">
              <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-sky-300">Mass Controls</p>
              {bodiesUi.map((body, index) => (
                <div key={body.id} className="rounded-md border border-slate-800 bg-slate-950/40 p-2">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-medium text-slate-200">Object {index + 1}</p>
                    <button
                      type="button"
                      onClick={() => removeBody(body.id)}
                      disabled={bodiesUi.length <= MIN_BODIES}
                      className="text-[0.65rem] text-rose-300 disabled:cursor-not-allowed disabled:text-slate-500"
                    >
                      Remove
                    </button>
                  </div>
                  <SliderWithInput
                    label="Mass"
                    queryKey={`com-mass-${body.id}`}
                    units="kg"
                    min={MIN_MASS}
                    max={MAX_MASS}
                    step={0.1}
                    value={body.mass}
                    onChange={(value) => updateMass(body.id, value)}
                  />
                </div>
              ))}
            </div>
          </aside>
        </div>
      </section>

      <ConceptBox className="mt-8" heading="Explanation" items={explanationItems} />
    </div>
  );
}
