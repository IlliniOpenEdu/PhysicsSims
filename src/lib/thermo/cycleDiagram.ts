import { toSigFigs } from '../../utils/formatters';

// Generic thermodynamic-cycle diagram renderer, extracted from the Carnot module
// so any cycle (Carnot, Otto, Diesel, …) can share the same axes, leg tracing,
// area shading, corner markers, and cycling-point animation.

export interface DiagramPoint {
  x: number;
  y: number;
}

export interface DiagramLeg {
  pts: DiagramPoint[];
  color: string;
  /** Optional dash pattern (e.g. for a not-yet-closed loop connector). */
  dash?: number[];
}

export interface DiagramCorner extends DiagramPoint {
  label: string;
}

export interface CycleDiagramSpec {
  xLabel: string;
  yLabel: string;
  xScale: number; // multiplies raw value for tick display (m³ → L, Pa → kPa)
  yScale: number;
  fill: string; // shade color for the enclosed area
  /** Override tick text (e.g. log axes); defaults to toSigFigs(value·scale, 3). */
  formatXTick?: (value: number) => string;
  formatYTick?: (value: number) => string;
}

export interface PlotBounds {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

/** Maps between data coordinates and canvas pixels (fromX/fromY for pointer hit-testing). */
export interface DiagramTransform {
  toX: (x: number) => number;
  toY: (y: number) => number;
  fromX: (px: number) => number;
  fromY: (py: number) => number;
}

export interface CycleDiagramOptions {
  legs: DiagramLeg[];
  corners: DiagramCorner[];
  dot: DiagramPoint | null;
  spec: CycleDiagramSpec;
}

const MARGIN = { left: 54, right: 14, top: 16, bottom: 34 };

/** Padded bounds over a set of polylines (8% margin, matching the Carnot look). */
export function polylineBounds(polylines: DiagramPoint[][]): PlotBounds {
  let xMin = Infinity,
    xMax = -Infinity,
    yMin = Infinity,
    yMax = -Infinity;
  for (const pts of polylines) {
    for (const p of pts) {
      if (p.x < xMin) xMin = p.x;
      if (p.x > xMax) xMax = p.x;
      if (p.y < yMin) yMin = p.y;
      if (p.y > yMax) yMax = p.y;
    }
  }
  const xPad = (xMax - xMin) * 0.08 || 1;
  const yPad = (yMax - yMin) * 0.08 || 1;
  return { xMin: xMin - xPad, xMax: xMax + xPad, yMin: yMin - yPad, yMax: yMax + yPad };
}

/**
 * Draw the shared plot frame — background, gridlines, ticks, axis lines and
 * labels — and return the data↔pixel transform for whatever gets drawn on top.
 */
export function drawPlotFrame(
  ctx: CanvasRenderingContext2D,
  bounds: PlotBounds,
  spec: CycleDiagramSpec,
  ticks = 4,
): DiagramTransform {
  const { width: W, height: H } = ctx.canvas;
  const { xMin, xMax, yMin, yMax } = bounds;

  const plotW = W - MARGIN.left - MARGIN.right;
  const plotH = H - MARGIN.top - MARGIN.bottom;
  const toX = (x: number) => MARGIN.left + ((x - xMin) / (xMax - xMin)) * plotW;
  const toY = (y: number) => H - MARGIN.bottom - ((y - yMin) / (yMax - yMin)) * plotH;
  const fromX = (px: number) => xMin + ((px - MARGIN.left) / plotW) * (xMax - xMin);
  const fromY = (py: number) => yMin + ((H - MARGIN.bottom - py) / plotH) * (yMax - yMin);

  const formatX = spec.formatXTick ?? ((v: number) => String(toSigFigs(v * spec.xScale, 3)));
  const formatY = spec.formatYTick ?? ((v: number) => String(toSigFigs(v * spec.yScale, 3)));

  // Background
  ctx.fillStyle = '#030507';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(148,163,184,0.12)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

  // Gridlines + tick labels
  ctx.font = '10px monospace';
  for (let i = 0; i <= ticks; i++) {
    const fx = xMin + ((xMax - xMin) * i) / ticks;
    const fy = yMin + ((yMax - yMin) * i) / ticks;
    const px = toX(fx);
    const py = toY(fy);

    ctx.strokeStyle = 'rgba(148,163,184,0.08)';
    ctx.beginPath();
    ctx.moveTo(px, MARGIN.top);
    ctx.lineTo(px, H - MARGIN.bottom);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(MARGIN.left, py);
    ctx.lineTo(W - MARGIN.right, py);
    ctx.stroke();

    ctx.fillStyle = 'rgba(148,163,184,0.6)';
    ctx.textAlign = 'center';
    ctx.fillText(formatX(fx), px, H - MARGIN.bottom + 14);
    ctx.textAlign = 'right';
    ctx.fillText(formatY(fy), MARGIN.left - 6, py + 3);
  }

  // Axis lines
  ctx.strokeStyle = 'rgba(148,163,184,0.35)';
  ctx.beginPath();
  ctx.moveTo(MARGIN.left, MARGIN.top);
  ctx.lineTo(MARGIN.left, H - MARGIN.bottom);
  ctx.lineTo(W - MARGIN.right, H - MARGIN.bottom);
  ctx.stroke();

  // Axis labels
  ctx.fillStyle = 'rgba(148,163,184,0.75)';
  ctx.textAlign = 'left';
  ctx.fillText(spec.yLabel, 6, 12);
  ctx.textAlign = 'right';
  ctx.fillText(spec.xLabel, W - MARGIN.right, H - 6);

  return { toX, toY, fromX, fromY };
}

export function drawCycleDiagram(
  ctx: CanvasRenderingContext2D,
  { legs, corners, dot, spec }: CycleDiagramOptions,
): DiagramTransform {
  const transform = drawPlotFrame(ctx, polylineBounds(legs.map((l) => l.pts)), spec);
  const { toX, toY } = transform;

  // Shaded enclosed area (= net work per cycle)
  ctx.beginPath();
  legs.forEach((leg, li) => {
    leg.pts.forEach((p, pi) => {
      const px = toX(p.x);
      const py = toY(p.y);
      if (li === 0 && pi === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
  });
  ctx.closePath();
  ctx.fillStyle = spec.fill;
  ctx.fill();

  // Legs + direction arrows
  legs.forEach((leg) => {
    ctx.strokeStyle = leg.color;
    ctx.lineWidth = 2;
    ctx.setLineDash(leg.dash ?? []);
    ctx.beginPath();
    leg.pts.forEach((p, pi) => {
      const px = toX(p.x);
      const py = toY(p.y);
      if (pi === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
    ctx.setLineDash([]);

    // Arrowhead at leg midpoint showing traversal direction
    const midIdx = Math.floor(leg.pts.length / 2);
    const mid = leg.pts[midIdx];
    const next = leg.pts[Math.min(midIdx + 1, leg.pts.length - 1)];
    if (!mid || !next || (mid.x === next.x && mid.y === next.y)) return;
    const mx = toX(mid.x);
    const my = toY(mid.y);
    const angle = Math.atan2(toY(next.y) - my, toX(next.x) - mx);
    ctx.fillStyle = leg.color;
    ctx.save();
    ctx.translate(mx, my);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(5, 0);
    ctx.lineTo(-4, 4);
    ctx.lineTo(-4, -4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });

  // Corner markers + state labels
  ctx.font = '11px monospace';
  corners.forEach((c) => {
    const px = toX(c.x);
    const py = toY(c.y);
    ctx.beginPath();
    ctx.arc(px, py, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#e2e8f0';
    ctx.fill();
    ctx.fillStyle = 'rgba(226,232,240,0.8)';
    ctx.textAlign = 'left';
    ctx.fillText(c.label, px + 6, py - 6);
  });

  // Animated cycling point
  if (dot) {
    const dx = toX(dot.x);
    const dy = toY(dot.y);
    ctx.beginPath();
    ctx.arc(dx, dy, 8, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(dx, dy, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }

  return transform;
}
