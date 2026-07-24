import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { clamp } from '../../utils/mathUtils';
import { formatPressure, formatSI } from '../../utils/formatters';
import {
  drawPlotFrame,
  polylineBounds,
  type CycleDiagramSpec,
  type DiagramTransform,
} from '../../lib/thermo/cycleDiagram';
import {
  analyzeBoundary,
  boundaryPressureRange,
  BOUNDARY_KINDS,
  BOUNDARY_PHASES,
  computePhaseDiagram,
  gibbsEnergy,
  nearestTransition,
  PHASE_COLORS,
  PHASE_LABELS,
  PHASES,
  stablePhase,
  SUBSTANCES,
  TRANSITION_LABELS,
  transitionsAtPressure,
  triplePointCheck,
  type BoundaryAnalysis,
  type BoundaryKind,
  type BoundaryPoint,
  type Phase,
  type PhaseDiagram,
  type Substance,
  type Transition,
  type TriplePointCheck,
} from '../../lib/thermo/gibbsPhase';

const GT_SAMPLES = 128;
const REGION_CELL_PX = 6;
const BOUNDARY_HIT_PX = 9;
const MARKER_HIT_PX = 12;

export const SELECTION_COLOR = '#22d3ee';

export type PTSelection =
  | { type: 'boundary'; boundary: BoundaryKind }
  | { type: 'triple' }
  | { type: 'critical' }
  | null;

const GT_SPEC: CycleDiagramSpec = {
  xLabel: 'T (K)',
  yLabel: 'G (kJ/mol)',
  xScale: 1,
  yScale: 1e-3,
  fill: '',
};

// P–T diagram plots log₁₀(P) on the y-axis; ticks show the actual pressure
const makePTSpec = (): CycleDiagramSpec => ({
  xLabel: 'T (K)',
  yLabel: 'P',
  xScale: 1,
  yScale: 1,
  fill: '',
  formatYTick: (logP) => formatPressure(Math.pow(10, logP), 2),
});

/** Phases whose G-lines get emphasized on the G-vs-T plot for a selection. */
function highlightedPhases(selection: PTSelection): Phase[] {
  if (!selection) return [];
  if (selection.type === 'boundary') return BOUNDARY_PHASES[selection.boundary];
  if (selection.type === 'triple') return [...PHASES];
  return ['liquid', 'gas']; // critical point: where those two stop differing
}

// ── G vs T plot (hero) ────────────────────────────────────────────────────────

function drawGTPlot(
  ctx: CanvasRenderingContext2D,
  sub: Substance,
  T: number,
  P: number,
  transitions: Transition[],
  selection: PTSelection,
): DiagramTransform {
  const lines = PHASES.map((phase) => {
    const pts = [];
    for (let i = 0; i <= GT_SAMPLES; i++) {
      const t = sub.TMin + ((sub.TMax - sub.TMin) * i) / GT_SAMPLES;
      pts.push({ x: t, y: gibbsEnergy(sub, phase, t, P) });
    }
    return { phase, pts };
  });

  const bounds = polylineBounds(lines.map((l) => l.pts));
  const transform = drawPlotFrame(ctx, bounds, GT_SPEC);
  const { toX, toY } = transform;

  // All three G-lines; when a boundary is selected, its two phases pop out —
  // the boundary IS the crossing of these two lines
  const highlight = highlightedPhases(selection);
  for (const line of lines) {
    const emphasized = highlight.includes(line.phase);
    ctx.strokeStyle = PHASE_COLORS[line.phase];
    ctx.globalAlpha = highlight.length === 0 ? 0.4 : emphasized ? 0.9 : 0.12;
    ctx.lineWidth = emphasized ? 2.5 : 1.5;
    ctx.beginPath();
    line.pts.forEach((p, i) => {
      if (i === 0) ctx.moveTo(toX(p.x), toY(p.y));
      else ctx.lineTo(toX(p.x), toY(p.y));
    });
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Lower envelope, thick — the stable phase is the lowest line
  ctx.lineWidth = 3;
  let prev: { px: number; py: number } | null = null;
  for (let i = 0; i <= GT_SAMPLES; i++) {
    const t = sub.TMin + ((sub.TMax - sub.TMin) * i) / GT_SAMPLES;
    const phase = stablePhase(sub, t, P);
    const px = toX(t);
    const py = toY(gibbsEnergy(sub, phase, t, P));
    if (prev) {
      ctx.strokeStyle = PHASE_COLORS[phase];
      ctx.beginPath();
      ctx.moveTo(prev.px, prev.py);
      ctx.lineTo(px, py);
      ctx.stroke();
    }
    prev = { px, py };
  }

  // Crossing markers — each transition is where two G-lines intersect
  ctx.font = '11px monospace';
  for (const tr of transitions) {
    if (tr.T < sub.TMin || tr.T > sub.TMax) continue;
    const G = gibbsEnergy(sub, stablePhase(sub, tr.T - 0.01, P), tr.T, P);
    const px = toX(tr.T);
    const py = toY(G);
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#e2e8f0';
    ctx.fill();
    ctx.fillStyle = 'rgba(226,232,240,0.85)';
    ctx.textAlign = 'center';
    ctx.fillText(TRANSITION_LABELS[tr.kind].toLowerCase(), px, py - 18);
    ctx.fillText(formatSI(tr.T, 'K', 4), px, py - 7);
  }

  // Current-T marker: dashed vertical line, a dot on each G-line, ring on the stable one
  const stable = stablePhase(sub, T, P);
  const tx = toX(T);
  ctx.strokeStyle = 'rgba(226,232,240,0.4)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(tx, toY(bounds.yMax));
  ctx.lineTo(tx, ctx.canvas.height - 34);
  ctx.stroke();
  ctx.setLineDash([]);

  for (const phase of PHASES) {
    const py = toY(gibbsEnergy(sub, phase, T, P));
    ctx.beginPath();
    ctx.arc(tx, py, phase === stable ? 5.5 : 3.5, 0, Math.PI * 2);
    ctx.fillStyle = PHASE_COLORS[phase];
    ctx.fill();
    if (phase === stable) {
      ctx.beginPath();
      ctx.arc(tx, py, 9, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  return transform;
}

// ── P–T phase diagram (companion) ─────────────────────────────────────────────

interface PTBackground {
  key: string;
  canvas: HTMLCanvasElement;
  transform: DiagramTransform;
}

/** Static layer: frame, region tint, region labels. Boundaries and markers are
 *  drawn in the foreground so selection highlights don't invalidate the cache. */
function buildPTBackground(sub: Substance, W: number, H: number): PTBackground | null {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const bounds = {
    xMin: sub.TMin,
    xMax: sub.TMax,
    yMin: Math.log10(sub.PMin),
    yMax: Math.log10(sub.PMax),
  };
  const transform = drawPlotFrame(ctx, bounds, makePTSpec());
  const { toX, toY } = transform;

  // Region tint: color each cell by the phase with the lowest G there, and
  // accumulate centroids for the region labels
  const x0 = toX(bounds.xMin);
  const x1 = toX(bounds.xMax);
  const y1 = toY(bounds.yMin); // bottom (low P)
  const y0 = toY(bounds.yMax); // top (high P)
  const acc: Record<Phase, { sx: number; sy: number; count: number }> = {
    solid: { sx: 0, sy: 0, count: 0 },
    liquid: { sx: 0, sy: 0, count: 0 },
    gas: { sx: 0, sy: 0, count: 0 },
  };
  for (let px = x0; px < x1; px += REGION_CELL_PX) {
    for (let py = y0; py < y1; py += REGION_CELL_PX) {
      const T = transform.fromX(px + REGION_CELL_PX / 2);
      const P = Math.pow(10, transform.fromY(py + REGION_CELL_PX / 2));
      const phase = stablePhase(sub, T, P);
      ctx.fillStyle = PHASE_COLORS[phase];
      ctx.globalAlpha = 0.1;
      ctx.fillRect(px, py, REGION_CELL_PX, REGION_CELL_PX);
      ctx.globalAlpha = 1;
      const a = acc[phase];
      a.sx += px;
      a.sy += py;
      a.count++;
    }
  }

  // Region labels at the tinted-cell centroids
  ctx.font = '600 12px sans-serif';
  ctx.textAlign = 'center';
  for (const phase of PHASES) {
    const a = acc[phase];
    if (a.count === 0) continue;
    ctx.fillStyle = PHASE_COLORS[phase];
    ctx.fillText(PHASE_LABELS[phase], a.sx / a.count + REGION_CELL_PX / 2, a.sy / a.count + 4);
  }

  return { key: '', canvas, transform };
}

const boundaryCurve = (diagram: PhaseDiagram, kind: BoundaryKind): BoundaryPoint[] =>
  kind === 'sublimation'
    ? diagram.sublimation
    : kind === 'vaporization'
      ? diagram.vaporization
      : diagram.fusion;

function drawPTForeground(
  ctx: CanvasRenderingContext2D,
  sub: Substance,
  diagram: PhaseDiagram,
  transform: DiagramTransform,
  T: number,
  P: number,
  stable: Phase,
  selection: PTSelection,
): void {
  const { toX, toY } = transform;
  const { width: W, height: H } = ctx.canvas;
  const selectedKind = selection?.type === 'boundary' ? selection.boundary : null;

  // Boundary curves; the selected one pops, the others recede
  for (const kind of BOUNDARY_KINDS) {
    const isSelected = kind === selectedKind;
    ctx.strokeStyle = isSelected ? SELECTION_COLOR : 'rgba(226,232,240,0.85)';
    ctx.globalAlpha = selectedKind !== null && !isSelected ? 0.3 : 1;
    ctx.lineWidth = isSelected ? 3.5 : 2;
    ctx.beginPath();
    boundaryCurve(diagram, kind).forEach((p, i) => {
      const px = toX(p.T);
      const py = toY(Math.log10(p.P));
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Tangent on the selected boundary at the current pressure: dP/dT made visible
  if (selectedKind) {
    const { PLo, PHi } = boundaryPressureRange(sub, diagram, selectedKind);
    const Pb = clamp(P, PLo, PHi);
    const info = analyzeBoundary(sub, selectedKind, Pb);
    if (info) {
      const bx = toX(info.T);
      const by = toY(Math.log10(Pb));
      // slope in plot coordinates: d(log₁₀P)/dT = (dP/dT)/(P·ln10)
      const eps = (sub.TMax - sub.TMin) / 100;
      const vx = toX(info.T + eps) - bx;
      const vy = toY(Math.log10(Pb) + (info.slope * eps) / (Pb * Math.LN10)) - by;
      const len = Math.hypot(vx, vy) || 1;
      ctx.strokeStyle = SELECTION_COLOR;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(bx - (36 * vx) / len, by - (36 * vy) / len);
      ctx.lineTo(bx + (36 * vx) / len, by + (36 * vy) / len);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(bx, by, 4, 0, Math.PI * 2);
      ctx.fillStyle = SELECTION_COLOR;
      ctx.fill();
    }
  }

  // Triple + critical point markers (clickable)
  ctx.font = '10px monospace';
  const mark = (
    Tm: number,
    Pm: number,
    label: string,
    align: CanvasTextAlign,
    dx: number,
    isSelected: boolean,
  ) => {
    const px = toX(Tm);
    const py = toY(Math.log10(Pm));
    ctx.beginPath();
    ctx.arc(px, py, isSelected ? 4.5 : 3.5, 0, Math.PI * 2);
    ctx.fillStyle = '#facc15';
    ctx.fill();
    if (isSelected) {
      ctx.beginPath();
      ctx.arc(px, py, 9, 0, Math.PI * 2);
      ctx.strokeStyle = SELECTION_COLOR;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(250,204,21,0.9)';
    ctx.textAlign = align;
    ctx.fillText(label, px + dx, py + 14);
  };
  mark(diagram.TTriple, diagram.PTriple, 'triple point', 'left', 6, selection?.type === 'triple');
  if (diagram.PCrit <= sub.PMax) {
    mark(sub.Tcrit, diagram.PCrit, 'critical point', 'right', -6, selection?.type === 'critical');
  }

  // Crosshair + state point at (T, P)
  const px = toX(T);
  const py = toY(Math.log10(P));
  ctx.strokeStyle = 'rgba(226,232,240,0.25)';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 5]);
  ctx.beginPath();
  ctx.moveTo(px, 16);
  ctx.lineTo(px, H - 34);
  ctx.moveTo(54, py);
  ctx.lineTo(W - 14, py);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(px, py, 7, 0, Math.PI * 2);
  ctx.fillStyle = PHASE_COLORS[stable];
  ctx.fill();
  ctx.beginPath();
  ctx.arc(px, py, 7, 0, Math.PI * 2);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.stroke();
}

/** Closest point on a boundary polyline to a canvas pixel, in data coordinates. */
function nearestOnCurve(
  curve: BoundaryPoint[],
  transform: DiagramTransform,
  x: number,
  y: number,
): { dist: number; T: number; P: number } {
  let best = { dist: Infinity, T: 0, P: 0 };
  let prev: { px: number; py: number; T: number; lp: number } | null = null;
  for (const p of curve) {
    const cur = { px: transform.toX(p.T), py: transform.toY(Math.log10(p.P)), T: p.T, lp: Math.log10(p.P) };
    if (prev) {
      const dx = cur.px - prev.px;
      const dy = cur.py - prev.py;
      const l2 = dx * dx + dy * dy || 1e-9;
      const t = clamp(((x - prev.px) * dx + (y - prev.py) * dy) / l2, 0, 1);
      const qx = prev.px + t * dx;
      const qy = prev.py + t * dy;
      const dist = Math.hypot(x - qx, y - qy);
      if (dist < best.dist) {
        best = {
          dist,
          T: prev.T + t * (cur.T - prev.T),
          P: Math.pow(10, prev.lp + t * (cur.lp - prev.lp)),
        };
      }
    }
    prev = cur;
  }
  return best;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface GibbsReadouts {
  G: Record<Phase, number>; // J/mol at the current (T, P)
  stable: Phase;
  transitions: Transition[];
  nearest: Transition | null;
}

export interface UseGibbsPhaseResult {
  gtCanvasRef: React.RefObject<HTMLCanvasElement>;
  ptCanvasRef: React.RefObject<HTMLCanvasElement>;
  substance: Substance;
  setSubstanceId: (id: string) => void;
  diagram: PhaseDiagram;
  T: number;
  setT: (t: number) => void;
  P: number;
  setP: (p: number) => void;
  readouts: GibbsReadouts;
  selection: PTSelection;
  select: (sel: PTSelection) => void;
  /** Clausius–Clapeyron analysis of the selected boundary at the current P. */
  boundaryInfo: BoundaryAnalysis | null;
  tripleCheck: TriplePointCheck | null;
}

export function useGibbsPhase(initialSubstanceId = 'water'): UseGibbsPhaseResult {
  const gtCanvasRef = useRef<HTMLCanvasElement>(null);
  const ptCanvasRef = useRef<HTMLCanvasElement>(null);
  const gtTransformRef = useRef<DiagramTransform | null>(null);
  const ptBackgroundRef = useRef<PTBackground | null>(null);
  const dragRef = useRef<'gt' | 'pt' | 'slide' | null>(null);

  const initial = SUBSTANCES.find((s) => s.id === initialSubstanceId) ?? SUBSTANCES[0];
  const [substanceId, setSubstanceIdState] = useState(initial.id);
  const [T, setTState] = useState(initial.TDefault);
  const [P, setPState] = useState(initial.PDefault);
  const [selection, setSelection] = useState<PTSelection>(null);

  const substance = useMemo(
    () => SUBSTANCES.find((s) => s.id === substanceId) ?? SUBSTANCES[0],
    [substanceId],
  );
  const diagram = useMemo(() => computePhaseDiagram(substance), [substance]);
  const tripleCheck = useMemo(() => triplePointCheck(substance, diagram), [substance, diagram]);

  const readouts = useMemo<GibbsReadouts>(() => {
    const transitions = transitionsAtPressure(substance, diagram, P);
    return {
      G: {
        solid: gibbsEnergy(substance, 'solid', T, P),
        liquid: gibbsEnergy(substance, 'liquid', T, P),
        gas: gibbsEnergy(substance, 'gas', T, P),
      },
      stable: stablePhase(substance, T, P),
      transitions,
      nearest: nearestTransition(transitions, T),
    };
  }, [substance, diagram, T, P]);

  const boundaryInfo = useMemo(() => {
    if (selection?.type !== 'boundary') return null;
    const { PLo, PHi } = boundaryPressureRange(substance, diagram, selection.boundary);
    return analyzeBoundary(substance, selection.boundary, clamp(P, PLo, PHi));
  }, [selection, substance, diagram, P]);

  const setT = useCallback(
    (t: number) => setTState(clamp(t, substance.TMin, substance.TMax)),
    [substance],
  );
  const setP = useCallback(
    (p: number) => setPState(clamp(p, substance.PMin, substance.PMax)),
    [substance],
  );

  /** Select a boundary/marker and snap the state point to it (null clears). */
  const select = useCallback(
    (sel: PTSelection) => {
      setSelection(sel);
      if (!sel) return;
      if (sel.type === 'triple') {
        setTState(clamp(diagram.TTriple, substance.TMin, substance.TMax));
        setPState(clamp(diagram.PTriple, substance.PMin, substance.PMax));
      } else if (sel.type === 'critical') {
        setTState(clamp(substance.Tcrit, substance.TMin, substance.TMax));
        setPState(clamp(diagram.PCrit, substance.PMin, substance.PMax));
      } else {
        const { PLo, PHi } = boundaryPressureRange(substance, diagram, sel.boundary);
        const Pb = clamp(P, PLo, PHi);
        const info = analyzeBoundary(substance, sel.boundary, Pb);
        if (info) {
          setTState(clamp(info.T, substance.TMin, substance.TMax));
          setPState(clamp(Pb, substance.PMin, substance.PMax));
        }
      }
    },
    [substance, diagram, P],
  );

  const setSubstanceId = useCallback((id: string) => {
    const sub = SUBSTANCES.find((s) => s.id === id);
    if (!sub) return;
    setSubstanceIdState(sub.id);
    setTState(sub.TDefault);
    setPState(sub.PDefault);
    setSelection(null);
  }, []);

  // Redraw both plots whenever anything changes (no RAF loop)
  useEffect(() => {
    const gtCtx = gtCanvasRef.current?.getContext('2d');
    if (gtCtx) {
      gtTransformRef.current = drawGTPlot(gtCtx, substance, T, P, readouts.transitions, selection);
    }

    const ptCanvas = ptCanvasRef.current;
    const ptCtx = ptCanvas?.getContext('2d');
    if (ptCanvas && ptCtx) {
      const key = `${substance.id}:${ptCanvas.width}x${ptCanvas.height}`;
      if (ptBackgroundRef.current?.key !== key) {
        const bg = buildPTBackground(substance, ptCanvas.width, ptCanvas.height);
        if (bg) ptBackgroundRef.current = { ...bg, key };
      }
      const bg = ptBackgroundRef.current;
      if (bg) {
        ptCtx.drawImage(bg.canvas, 0, 0);
        drawPTForeground(ptCtx, substance, diagram, bg.transform, T, P, readouts.stable, selection);
      }
    }
  }, [substance, diagram, T, P, readouts, selection]);

  // Pointer interaction. G–T plot: drag sets T. P–T diagram: pointerdown on a
  // boundary selects it and dragging slides the state point ALONG it (watch
  // dP/dT change); the triple/critical markers are clickable; empty space
  // clears the selection and moves the state point freely.
  const pointerCtx = useRef({ substance, diagram, setT, setP, select });
  pointerCtx.current = { substance, diagram, setT, setP, select };

  useEffect(() => {
    const gt = gtCanvasRef.current;
    const pt = ptCanvasRef.current;
    if (!gt || !pt) return;

    const canvasPx = (canvas: HTMLCanvasElement, e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return {
        px: ((e.clientX - rect.left) * canvas.width) / rect.width,
        py: ((e.clientY - rect.top) * canvas.height) / rect.height,
      };
    };

    const applyGT = (e: PointerEvent) => {
      const t = gtTransformRef.current;
      if (!t) return;
      pointerCtx.current.setT(t.fromX(canvasPx(gt, e).px));
    };

    const applyPTFree = (e: PointerEvent) => {
      const bg = ptBackgroundRef.current;
      if (!bg) return;
      const { px, py } = canvasPx(pt, e);
      pointerCtx.current.setT(bg.transform.fromX(px));
      pointerCtx.current.setP(Math.pow(10, bg.transform.fromY(py)));
    };

    const applyPTSlide = (e: PointerEvent, kind: BoundaryKind) => {
      const bg = ptBackgroundRef.current;
      if (!bg) return;
      const { px, py } = canvasPx(pt, e);
      const { diagram: d, setT: sT, setP: sP } = pointerCtx.current;
      const hit = nearestOnCurve(boundaryCurve(d, kind), bg.transform, px, py);
      sT(hit.T);
      sP(hit.P);
    };

    const gtDown = (e: PointerEvent) => {
      dragRef.current = 'gt';
      gt.setPointerCapture(e.pointerId);
      applyGT(e);
      e.preventDefault();
    };
    const gtMove = (e: PointerEvent) => {
      if (dragRef.current === 'gt') applyGT(e);
    };

    const ptDown = (e: PointerEvent) => {
      const bg = ptBackgroundRef.current;
      if (!bg) return;
      const { px, py } = canvasPx(pt, e);
      const { substance: sub, diagram: d, select: sel } = pointerCtx.current;
      e.preventDefault();
      pt.setPointerCapture(e.pointerId);

      // Special markers first
      const near = (Tm: number, Pm: number) =>
        Math.hypot(bg.transform.toX(Tm) - px, bg.transform.toY(Math.log10(Pm)) - py) <=
        MARKER_HIT_PX;
      if (near(d.TTriple, d.PTriple)) {
        sel({ type: 'triple' });
        dragRef.current = null;
        return;
      }
      if (d.PCrit <= sub.PMax && near(sub.Tcrit, d.PCrit)) {
        sel({ type: 'critical' });
        dragRef.current = null;
        return;
      }

      // Then boundaries: select the nearest within reach and start sliding
      let bestKind: BoundaryKind | null = null;
      let bestDist = BOUNDARY_HIT_PX;
      for (const kind of BOUNDARY_KINDS) {
        const hit = nearestOnCurve(boundaryCurve(d, kind), bg.transform, px, py);
        if (hit.dist <= bestDist) {
          bestDist = hit.dist;
          bestKind = kind;
        }
      }
      if (bestKind) {
        sel({ type: 'boundary', boundary: bestKind });
        dragRef.current = 'slide';
        applyPTSlide(e, bestKind);
        return;
      }

      // Empty space: clear selection, move the state point freely
      sel(null);
      dragRef.current = 'pt';
      applyPTFree(e);
    };

    const ptMove = (e: PointerEvent) => {
      if (dragRef.current === 'pt') applyPTFree(e);
      else if (dragRef.current === 'slide') {
        const s = selectionRef.current;
        if (s?.type === 'boundary') applyPTSlide(e, s.boundary);
      }
    };

    const up = () => {
      dragRef.current = null;
    };

    gt.addEventListener('pointerdown', gtDown);
    gt.addEventListener('pointermove', gtMove);
    pt.addEventListener('pointerdown', ptDown);
    pt.addEventListener('pointermove', ptMove);
    window.addEventListener('pointerup', up);
    return () => {
      gt.removeEventListener('pointerdown', gtDown);
      gt.removeEventListener('pointermove', gtMove);
      pt.removeEventListener('pointerdown', ptDown);
      pt.removeEventListener('pointermove', ptMove);
      window.removeEventListener('pointerup', up);
    };
  }, []);

  const selectionRef = useRef(selection);
  selectionRef.current = selection;

  return {
    gtCanvasRef,
    ptCanvasRef,
    substance,
    setSubstanceId,
    diagram,
    T,
    setT,
    P,
    setP,
    readouts,
    selection,
    select,
    boundaryInfo,
    tripleCheck,
  };
}
