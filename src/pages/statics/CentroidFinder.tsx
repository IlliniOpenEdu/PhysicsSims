import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ConceptBox } from '../../components/ConceptBox';
import { formatSI, toSigFigs } from '../../utils/formatters';
import { clamp, vec2, type Vec2 } from '../../utils/mathUtils';

// ── World / canvas mapping ────────────────────────────────────────────────────

const CANVAS_W = 640;
const CANVAS_H = 480;
const PX_PER_M = 56;
const ORIGIN_PX = { x: 48, y: CANVAS_H - 40 }; // world (0,0) on the canvas, y-up

const toPx = (p: Vec2): Vec2 => ({ x: ORIGIN_PX.x + p.x * PX_PER_M, y: ORIGIN_PX.y - p.y * PX_PER_M });
const toWorld = (p: Vec2): Vec2 => ({ x: (p.x - ORIGIN_PX.x) / PX_PER_M, y: (ORIGIN_PX.y - p.y) / PX_PER_M });

const WORLD_X_MAX = (CANVAS_W - ORIGIN_PX.x - 8) / PX_PER_M;
const WORLD_Y_MAX = (ORIGIN_PX.y - 8) / PX_PER_M;

// ── Shapes & centroid math (composite-area method) ───────────────────────────

type Shape = { id: number; hole: boolean; x: number; y: number } & (
  | { kind: 'rect'; w: number; h: number }
  | { kind: 'circle'; r: number }
);

/** Signed area: holes subtract. Centroid of each primitive is its center. */
function signedArea(s: Shape): number {
  const a = s.kind === 'rect' ? s.w * s.h : Math.PI * s.r * s.r;
  return s.hole ? -a : a;
}

interface Composite {
  totalA: number;
  sumAx: number;
  sumAy: number;
  xBar: number;
  yBar: number;
  defined: boolean; // false when ΣA ≤ 0 — centroid of a net-negative region is meaningless
}

function computeComposite(shapes: Shape[]): Composite {
  let totalA = 0;
  let sumAx = 0;
  let sumAy = 0;
  for (const s of shapes) {
    const a = signedArea(s);
    totalA += a;
    sumAx += a * s.x;
    sumAy += a * s.y;
  }
  const defined = totalA > 1e-9;
  return {
    totalA,
    sumAx,
    sumAy,
    xBar: defined ? sumAx / totalA : 0,
    yBar: defined ? sumAy / totalA : 0,
    defined,
  };
}

/** Resize handle position: rect top-right corner, circle rightmost point. */
function handlePos(s: Shape): Vec2 {
  return s.kind === 'rect' ? { x: s.x + s.w / 2, y: s.y + s.h / 2 } : { x: s.x + s.r, y: s.y };
}

function hitShape(s: Shape, p: Vec2): boolean {
  if (s.kind === 'rect') {
    return Math.abs(p.x - s.x) <= s.w / 2 && Math.abs(p.y - s.y) <= s.h / 2;
  }
  return vec2.dist(p, { x: s.x, y: s.y }) <= s.r;
}

// ── Drawing (on change, not in a RAF loop) ────────────────────────────────────

function traceShape(ctx: CanvasRenderingContext2D, s: Shape): void {
  if (s.kind === 'rect') {
    const tl = toPx({ x: s.x - s.w / 2, y: s.y + s.h / 2 });
    ctx.rect(tl.x, tl.y, s.w * PX_PER_M, s.h * PX_PER_M);
  } else {
    const c = toPx({ x: s.x, y: s.y });
    ctx.arc(c.x, c.y, s.r * PX_PER_M, 0, Math.PI * 2);
  }
}

function drawScene(
  ctx: CanvasRenderingContext2D,
  shapes: Shape[],
  selectedId: number | null,
  composite: Composite,
): void {
  const W = CANVAS_W;
  const H = CANVAS_H;

  ctx.fillStyle = '#030507';
  ctx.fillRect(0, 0, W, H);

  // Grid (1 m spacing) + labeled axes through the origin
  ctx.font = '10px monospace';
  for (let gx = 0; gx <= Math.floor(WORLD_X_MAX); gx++) {
    const px = toPx({ x: gx, y: 0 }).x;
    ctx.strokeStyle = gx === 0 ? 'rgba(148,163,184,0.45)' : 'rgba(148,163,184,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, H);
    ctx.stroke();
    if (gx > 0) {
      ctx.fillStyle = 'rgba(148,163,184,0.55)';
      ctx.textAlign = 'center';
      ctx.fillText(String(gx), px, ORIGIN_PX.y + 14);
    }
  }
  for (let gy = 0; gy <= Math.floor(WORLD_Y_MAX); gy++) {
    const py = toPx({ x: 0, y: gy }).y;
    ctx.strokeStyle = gy === 0 ? 'rgba(148,163,184,0.45)' : 'rgba(148,163,184,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, py);
    ctx.lineTo(W, py);
    ctx.stroke();
    if (gy > 0) {
      ctx.fillStyle = 'rgba(148,163,184,0.55)';
      ctx.textAlign = 'right';
      ctx.fillText(String(gy), ORIGIN_PX.x - 6, py + 3);
    }
  }
  ctx.fillStyle = 'rgba(148,163,184,0.7)';
  ctx.textAlign = 'left';
  ctx.fillText('0', ORIGIN_PX.x - 12, ORIGIN_PX.y + 14);
  ctx.fillText('x (m)', W - 40, ORIGIN_PX.y + 14);
  ctx.fillText('y (m)', ORIGIN_PX.x + 6, 14);

  // Shapes — positive areas translucent sky, holes hatched rose with dashed outline
  shapes.forEach((s, i) => {
    const selected = s.id === selectedId;

    ctx.beginPath();
    traceShape(ctx, s);
    if (s.hole) {
      ctx.fillStyle = 'rgba(2,6,23,0.6)';
      ctx.fill();
      // Diagonal hatching clipped to the hole
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = 'rgba(251,113,133,0.4)';
      ctx.lineWidth = 1;
      for (let d = -H; d < W; d += 9) {
        ctx.beginPath();
        ctx.moveTo(d, 0);
        ctx.lineTo(d + H, H);
        ctx.stroke();
      }
      ctx.restore();
      ctx.beginPath();
      traceShape(ctx, s);
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = selected ? '#fda4af' : 'rgba(251,113,133,0.85)';
      ctx.lineWidth = selected ? 2 : 1.5;
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      ctx.fillStyle = 'rgba(56,189,248,0.16)';
      ctx.fill();
      ctx.strokeStyle = selected ? '#7dd3fc' : 'rgba(56,189,248,0.8)';
      ctx.lineWidth = selected ? 2 : 1.5;
      ctx.stroke();
    }

    // Per-shape centroid: small, muted cross + row number linking to the table
    const c = toPx({ x: s.x, y: s.y });
    ctx.strokeStyle = 'rgba(148,163,184,0.85)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(c.x - 5, c.y);
    ctx.lineTo(c.x + 5, c.y);
    ctx.moveTo(c.x, c.y - 5);
    ctx.lineTo(c.x, c.y + 5);
    ctx.stroke();
    ctx.fillStyle = 'rgba(148,163,184,0.9)';
    ctx.textAlign = 'left';
    ctx.fillText(String(i + 1), c.x + 7, c.y - 7);

    // Resize handle on the selected shape
    if (selected) {
      const hp = toPx(handlePos(s));
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(hp.x - 4, hp.y - 4, 8, 8);
      ctx.strokeStyle = '#0f172a';
      ctx.strokeRect(hp.x - 4.5, hp.y - 4.5, 9, 9);
    }
  });

  // Composite centroid — the hero crosshair, amber and unmistakable
  if (composite.defined) {
    const c = toPx({ x: composite.xBar, y: composite.yBar });
    const glow = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, 24);
    glow.addColorStop(0, 'rgba(251,191,36,0.35)');
    glow.addColorStop(1, 'rgba(251,191,36,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(c.x, c.y, 24, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(c.x - 15, c.y);
    ctx.lineTo(c.x + 15, c.y);
    ctx.moveTo(c.x, c.y - 15);
    ctx.lineTo(c.x, c.y + 15);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(c.x, c.y, 7, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#fbbf24';
    ctx.textAlign = 'left';
    ctx.fillText(
      `C (${toSigFigs(composite.xBar, 3)}, ${toSigFigs(composite.yBar, 3)})`,
      c.x + 12,
      c.y - 12,
    );
  } else if (shapes.length > 0) {
    ctx.fillStyle = 'rgba(251,113,133,0.8)';
    ctx.textAlign = 'center';
    ctx.fillText('ΣA ≤ 0 — composite centroid undefined', W / 2, 24);
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

// The canonical problem: a rectangular plate with a circular hole
const INITIAL_SHAPES: Shape[] = [
  { id: 1, hole: false, kind: 'rect', x: 4, y: 3, w: 6, h: 4 },
  { id: 2, hole: true, kind: 'circle', x: 5.5, y: 3.5, r: 1 },
];

type DragState =
  | { id: number; mode: 'move'; offset: Vec2 }
  | { id: number; mode: 'resize' }
  | null;

function shapeLabel(s: Shape): string {
  if (s.hole) return s.kind === 'rect' ? 'rect hole' : 'hole';
  return s.kind === 'rect' ? 'rect' : 'circle';
}

export function CentroidFinder() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<DragState>(null);
  const nextIdRef = useRef(3);

  const [shapes, setShapes] = useState<Shape[]>(INITIAL_SHAPES);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const composite = useMemo(() => computeComposite(shapes), [shapes]);

  // Static solve: redraw when shapes or selection change — no animation loop
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) drawScene(ctx, shapes, selectedId, composite);
  }, [shapes, selectedId, composite]);

  const pointerWorld = (e: React.PointerEvent<HTMLCanvasElement>): Vec2 => {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return toWorld({
      x: ((e.clientX - rect.left) * canvas.width) / rect.width,
      y: ((e.clientY - rect.top) * canvas.height) / rect.height,
    });
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = pointerWorld(e);
    e.currentTarget.setPointerCapture(e.pointerId);

    // Resize handle of the selected shape wins over body hits
    const selected = shapes.find((s) => s.id === selectedId);
    if (selected && vec2.dist(p, handlePos(selected)) * PX_PER_M < 10) {
      dragRef.current = { id: selected.id, mode: 'resize' };
      return;
    }

    // Topmost shape under the pointer (last drawn = last in array)
    for (let i = shapes.length - 1; i >= 0; i--) {
      const s = shapes[i];
      if (hitShape(s, p)) {
        setSelectedId(s.id);
        dragRef.current = { id: s.id, mode: 'move', offset: { x: p.x - s.x, y: p.y - s.y } };
        return;
      }
    }
    setSelectedId(null);
    dragRef.current = null;
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const p = pointerWorld(e);

    setShapes((prev) =>
      prev.map((s) => {
        if (s.id !== drag.id) return s;
        if (drag.mode === 'move') {
          return {
            ...s,
            x: clamp(p.x - drag.offset.x, 0, WORLD_X_MAX),
            y: clamp(p.y - drag.offset.y, 0, WORLD_Y_MAX),
          };
        }
        if (s.kind === 'rect') {
          return {
            ...s,
            w: clamp(2 * Math.abs(p.x - s.x), 0.3, 2 * WORLD_X_MAX),
            h: clamp(2 * Math.abs(p.y - s.y), 0.3, 2 * WORLD_Y_MAX),
          };
        }
        return { ...s, r: clamp(vec2.dist(p, { x: s.x, y: s.y }), 0.2, WORLD_Y_MAX) };
      }),
    );
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  const addShape = (kind: 'rect' | 'circle', hole: boolean) => {
    const n = shapes.length;
    const x = clamp(3 + (n % 5) * 0.6, 1, WORLD_X_MAX - 1);
    const y = clamp(2.5 + (n % 3) * 0.5, 1, WORLD_Y_MAX - 1);
    const id = nextIdRef.current++;
    const shape: Shape =
      kind === 'rect'
        ? { id, hole, kind: 'rect', x, y, w: 2, h: 1.5 }
        : { id, hole, kind: 'circle', x, y, r: hole ? 0.8 : 1 };
    setShapes((prev) => [...prev, shape]);
    setSelectedId(id);
  };

  const deleteShape = (id: number) => {
    setShapes((prev) => prev.filter((s) => s.id !== id));
    setSelectedId((cur) => (cur === id ? null : cur));
  };

  const clearAll = () => {
    setShapes([]);
    setSelectedId(null);
  };

  const num = (v: number) => toSigFigs(v, 3);

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-7xl flex-col px-3 py-6 text-slate-100 sm:px-4 sm:py-8">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-4 sm:mb-6 sm:items-center sm:gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-400">
            Statics demo
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
            Centroid Finder
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">
            Build a composite shape and find its centroid by the weighted-area method
            <span className="mx-1 rounded bg-slate-800 px-1 py-0.5 font-mono text-[0.72rem] text-rose-200">
              x̄ = Σ(Aᵢ·x̄ᵢ) / ΣAᵢ
            </span>
            — holes count as negative area.
          </p>
        </div>

        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-rose-500 hover:text-rose-100"
        >
          ← Dashboard
        </Link>
      </header>

      <main className="grid items-start gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
        {/* Canvas — the hero */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-lg shadow-slate-950/40 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => addShape('rect', false)}
              className="rounded-full border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-200 transition hover:border-sky-400 hover:bg-sky-500/20"
            >
              + Rectangle
            </button>
            <button
              type="button"
              onClick={() => addShape('circle', false)}
              className="rounded-full border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-200 transition hover:border-sky-400 hover:bg-sky-500/20"
            >
              + Circle
            </button>
            <button
              type="button"
              onClick={() => addShape('circle', true)}
              className="rounded-full border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-200 transition hover:border-rose-400 hover:bg-rose-500/20"
            >
              + Hole
            </button>
            <button
              type="button"
              onClick={() => addShape('rect', true)}
              className="rounded-full border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-200 transition hover:border-rose-400 hover:bg-rose-500/20"
            >
              + Rect hole
            </button>
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                onClick={() => selectedId !== null && deleteShape(selectedId)}
                disabled={selectedId === null}
                className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 transition enabled:hover:border-rose-500 enabled:hover:text-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Delete selected
              </button>
              <button
                type="button"
                onClick={clearAll}
                className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-slate-400"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-800">
            <canvas
              ref={canvasRef}
              width={CANVAS_W}
              height={CANVAS_H}
              className="w-full"
              style={{ display: 'block', touchAction: 'none' }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            />
          </div>

          <p className="mt-3 text-xs text-slate-500">
            Click a shape to select it, drag to move, drag the square handle to resize. Hatched
            regions are holes (negative area). The amber crosshair is the composite centroid.
          </p>
        </section>

        {/* Readouts + weighted-sum table */}
        <aside className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                label: 'x̄',
                value: composite.defined ? formatSI(composite.xBar, 'm', 3) : '—',
              },
              {
                label: 'ȳ',
                value: composite.defined ? formatSI(composite.yBar, 'm', 3) : '—',
              },
              { label: 'ΣA', value: formatSI(composite.totalA, 'm²', 3) },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="rounded-xl border border-white/[0.07] bg-slate-950/55 p-3 text-center"
              >
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {label}
                </p>
                <p className="mt-1 text-sm font-semibold text-amber-300">{value}</p>
              </div>
            ))}
          </div>

          {/* The table is the teaching: every term of the weighted sum */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
            <h2 className="text-sm font-semibold tracking-wide text-rose-300">Weighted-area table</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full font-mono text-[0.68rem] text-slate-300">
                <thead>
                  <tr className="text-slate-500">
                    <th className="pb-1 pr-2 text-left font-normal">#</th>
                    <th className="pb-1 pr-2 text-left font-normal">shape</th>
                    <th className="pb-1 pr-2 text-right font-normal">Aᵢ (m²)</th>
                    <th className="pb-1 pr-2 text-right font-normal">x̄ᵢ (m)</th>
                    <th className="pb-1 pr-2 text-right font-normal">ȳᵢ (m)</th>
                    <th className="pb-1 pr-2 text-right font-normal">Aᵢx̄ᵢ</th>
                    <th className="pb-1 pr-2 text-right font-normal">Aᵢȳᵢ</th>
                    <th className="pb-1" />
                  </tr>
                </thead>
                <tbody>
                  {shapes.map((s, i) => {
                    const a = signedArea(s);
                    return (
                      <tr
                        key={s.id}
                        onClick={() => setSelectedId(s.id)}
                        className={`cursor-pointer border-t border-slate-800/70 ${
                          s.id === selectedId ? 'bg-slate-800/50 text-white' : 'hover:bg-slate-800/30'
                        }`}
                      >
                        <td className="py-1 pr-2">{i + 1}</td>
                        <td className={`py-1 pr-2 ${s.hole ? 'text-rose-300' : 'text-sky-300'}`}>
                          {shapeLabel(s)}
                        </td>
                        <td className="py-1 pr-2 text-right">{num(a)}</td>
                        <td className="py-1 pr-2 text-right">{num(s.x)}</td>
                        <td className="py-1 pr-2 text-right">{num(s.y)}</td>
                        <td className="py-1 pr-2 text-right">{num(a * s.x)}</td>
                        <td className="py-1 pr-2 text-right">{num(a * s.y)}</td>
                        <td className="py-1 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteShape(s.id);
                            }}
                            className="text-slate-600 transition hover:text-rose-400"
                            aria-label={`Delete shape ${i + 1}`}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {shapes.length === 0 && (
                    <tr className="border-t border-slate-800/70 text-slate-600">
                      <td colSpan={8} className="py-2 text-center">
                        no shapes — add one above
                      </td>
                    </tr>
                  )}
                </tbody>
                {shapes.length > 0 && (
                  <tfoot>
                    <tr className="border-t border-slate-700 font-semibold text-slate-100">
                      <td className="py-1 pr-2" colSpan={2}>
                        Σ
                      </td>
                      <td className="py-1 pr-2 text-right">{num(composite.totalA)}</td>
                      <td className="py-1 pr-2 text-right text-slate-600">—</td>
                      <td className="py-1 pr-2 text-right text-slate-600">—</td>
                      <td className="py-1 pr-2 text-right">{num(composite.sumAx)}</td>
                      <td className="py-1 pr-2 text-right">{num(composite.sumAy)}</td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Equation box with the live division */}
          <div className="rounded-2xl border border-rose-300/15 bg-rose-300/[0.045] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-200/80">
              The weighted sum, spelled out
            </p>
            <p className="mt-3 font-mono text-xs leading-relaxed text-rose-100/80">
              {composite.defined ? (
                <>
                  {`x̄ = Σ(Aᵢx̄ᵢ)/ΣA = ${num(composite.sumAx)} / ${num(composite.totalA)} = ${formatSI(composite.xBar, 'm', 3)}`}
                  <br />
                  {`ȳ = Σ(Aᵢȳᵢ)/ΣA = ${num(composite.sumAy)} / ${num(composite.totalA)} = ${formatSI(composite.yBar, 'm', 3)}`}
                </>
              ) : (
                'ΣA ≤ 0 — add positive area to define a centroid.'
              )}
            </p>
          </div>
        </aside>
      </main>

      <ConceptBox
        className="mt-6"
        heading="What to notice"
        items={[
          {
            title: 'Holes are just negative areas',
            description:
              'A subtracted region enters the sum with −Aᵢ at its own centroid. Drag the hole toward one edge of the plate and watch the composite centroid move the other way — removing material repels the centroid.',
          },
          {
            title: 'The centroid can leave the material',
            description:
              'Make an L or a C from rectangles: the crosshair can sit in empty space. The centroid is a property of the area distribution, not a point that must lie on the body.',
          },
          {
            title: 'The table is the method',
            description:
              'Each row is one term of Σ(Aᵢ·x̄ᵢ). The footer sums are the numerator, ΣA is the denominator — exactly the two numbers you would tabulate solving this by hand.',
          },
          {
            title: 'Symmetry is free information',
            description:
              'Any axis of symmetry contains the centroid. Center a hole on the plate’s horizontal midline and ȳ stops moving no matter how big you make it — only x̄ responds.',
          },
        ]}
      />
    </div>
  );
}
