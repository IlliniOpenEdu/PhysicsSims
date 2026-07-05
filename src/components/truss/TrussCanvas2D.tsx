// ─────────────────────────────────────────────
//  2D truss viewport — canvas editor + renderer.
//  Draw-on-change (no RAF loop): the truss is static until edited, so the
//  scene redraws from a useEffect whenever structure/solution/view change.
// ─────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from 'react';
import { clamp, vec2, type Vec2 } from '../../utils/mathUtils';
import { formatSI } from '../../utils/formatters';
import type { EditorMember, EditorNode, Tool } from './editorState';
import type { Selection } from './editorState';
import { memberColor, memberIntensity, type SolutionView } from './renderModel';

const CANVAS_W = 960;
const CANVAS_H = 600;
const ADD_SNAP = 0.5; // m
const DRAG_SNAP = 0.25; // m
const NODE_HIT_PX = 12;
const MEMBER_HIT_PX = 7;

interface View {
  s: number; // px per m
  ox: number; // px of world x = 0
  oy: number; // px of world y = 0
}

interface Props {
  nodes: EditorNode[];
  members: EditorMember[];
  selection: Selection;
  pendingNode: number | null;
  tool: Tool;
  view3dHint?: never;
  solutionView: SolutionView | null;
  /** Ghost displacement multiplier (dimensionless, already computed). */
  ghostScale: number;
  showGhost: boolean;
  fitKey: number;
  onNodeClick: (id: number) => void;
  onMemberClick: (id: number) => void;
  onMiss: () => void;
  onAddNode: (x: number, y: number) => void;
  onMoveNode: (id: number, x: number, y: number) => void;
}

type Drag =
  | { kind: 'node'; id: number; offset: Vec2 }
  | { kind: 'pan'; startPx: Vec2; startView: View }
  | null;

const snap = (v: number, step: number): number => Math.round(v / step) * step;

const CURSOR_BY_TOOL: Record<Tool, string> = {
  select: 'default',
  'add-node': 'crosshair',
  member: 'crosshair',
  delete: 'not-allowed',
};

// ── Drawing helpers ──────────────────────────

function drawArrow(
  ctx: CanvasRenderingContext2D,
  tip: Vec2,
  dir: Vec2, // unit vector, arrow points along dir into tip
  len: number,
  color: string,
  label?: string,
): void {
  const tail = { x: tip.x - dir.x * len, y: tip.y - dir.y * len };
  const headLen = 9;
  const back = { x: tip.x - dir.x * headLen, y: tip.y - dir.y * headLen };
  const perp = { x: -dir.y, y: dir.x };

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(tail.x, tail.y);
  ctx.lineTo(back.x, back.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(tip.x, tip.y);
  ctx.lineTo(back.x + perp.x * 4.5, back.y + perp.y * 4.5);
  ctx.lineTo(back.x - perp.x * 4.5, back.y - perp.y * 4.5);
  ctx.closePath();
  ctx.fill();

  if (label) {
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(label, tail.x + 5, tail.y - 4);
  }
}

function drawSupportGlyph(
  ctx: CanvasRenderingContext2D,
  p: Vec2,
  kind: 'pin' | 'roller',
): void {
  const w = 9;
  const h = 12;
  ctx.strokeStyle = '#94a3b8';
  ctx.fillStyle = 'rgba(148,163,184,0.25)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x - w, p.y + h);
  ctx.lineTo(p.x + w, p.y + h);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  if (kind === 'roller') {
    for (const dx of [-5, 0, 5]) {
      ctx.beginPath();
      ctx.arc(p.x + dx, p.y + h + 3.5, 2.6, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(p.x - w - 3, p.y + h + 7.5);
    ctx.lineTo(p.x + w + 3, p.y + h + 7.5);
    ctx.stroke();
  } else {
    // hatched ground line under the pin
    ctx.beginPath();
    ctx.moveTo(p.x - w - 3, p.y + h);
    ctx.lineTo(p.x + w + 3, p.y + h);
    ctx.stroke();
    for (let dx = -w; dx <= w; dx += 5) {
      ctx.beginPath();
      ctx.moveTo(p.x + dx, p.y + h);
      ctx.lineTo(p.x + dx - 4, p.y + h + 5);
      ctx.stroke();
    }
  }
}

export function TrussCanvas2D({
  nodes,
  members,
  selection,
  pendingNode,
  tool,
  solutionView,
  ghostScale,
  showGhost,
  fitKey,
  onNodeClick,
  onMemberClick,
  onMiss,
  onAddNode,
  onMoveNode,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<Drag>(null);
  const movedRef = useRef(false);
  const [view, setView] = useState<View>({ s: 72, ox: 140, oy: CANVAS_H - 120 });
  const [cursorWorld, setCursorWorld] = useState<Vec2 | null>(null);

  const toPx = useCallback(
    (w: Vec2): Vec2 => ({ x: view.ox + w.x * view.s, y: view.oy - w.y * view.s }),
    [view],
  );
  const toWorld = useCallback(
    (p: Vec2): Vec2 => ({ x: (p.x - view.ox) / view.s, y: (view.oy - p.y) / view.s }),
    [view],
  );

  // Fit the structure into the viewport when a preset loads / mode switches
  useEffect(() => {
    if (nodes.length === 0) return;
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    for (const n of nodes) {
      minX = Math.min(minX, n.x);
      maxX = Math.max(maxX, n.x);
      minY = Math.min(minY, n.y);
      maxY = Math.max(maxY, n.y);
    }
    const pad = 110;
    const s = clamp(
      Math.min(
        (CANVAS_W - 2 * pad) / Math.max(maxX - minX, 1),
        (CANVAS_H - 2 * pad) / Math.max(maxY - minY, 1),
      ),
      12,
      110,
    );
    setView({
      s,
      ox: (CANVAS_W - (minX + maxX) * s) / 2,
      oy: (CANVAS_H + (minY + maxY) * s) / 2,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);

  // Wheel zoom about the cursor (native listener — React's is passive)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const px = {
        x: ((e.clientX - rect.left) * CANVAS_W) / rect.width,
        y: ((e.clientY - rect.top) * CANVAS_H) / rect.height,
      };
      setView((v) => {
        const w = { x: (px.x - v.ox) / v.s, y: (v.oy - px.y) / v.s };
        const s = clamp(v.s * (e.deltaY < 0 ? 1.12 : 1 / 1.12), 6, 300);
        return { s, ox: px.x - w.x * s, oy: px.y + w.y * s };
      });
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, []);

  // ── Scene drawing (on change, not in a RAF loop) ────────────────────────
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#030507';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Grid — spacing adapts to zoom so labels stay legible
    const step = view.s < 14 ? 5 : view.s < 30 ? 2 : view.s > 150 ? 0.5 : 1;
    const wMin = toWorld({ x: 0, y: CANVAS_H });
    const wMax = toWorld({ x: CANVAS_W, y: 0 });
    ctx.font = '10px monospace';
    for (let gx = Math.ceil(wMin.x / step) * step; gx <= wMax.x; gx += step) {
      const px = toPx({ x: gx, y: 0 }).x;
      const onAxis = Math.abs(gx) < 1e-9;
      ctx.strokeStyle = onAxis ? 'rgba(148,163,184,0.4)' : 'rgba(148,163,184,0.07)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, CANVAS_H);
      ctx.stroke();
    }
    for (let gy = Math.ceil(wMin.y / step) * step; gy <= wMax.y; gy += step) {
      const py = toPx({ x: 0, y: gy }).y;
      const onAxis = Math.abs(gy) < 1e-9;
      ctx.strokeStyle = onAxis ? 'rgba(148,163,184,0.4)' : 'rgba(148,163,184,0.07)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(CANVAS_W, py);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(148,163,184,0.6)';
    ctx.textAlign = 'left';
    ctx.fillText(`grid ${step} m`, 10, CANVAS_H - 10);

    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const nodePx = (id: number): Vec2 | null => {
      const n = nodeById.get(id);
      return n ? toPx({ x: n.x, y: n.y }) : null;
    };

    // Deflected-shape ghost — the payoff of having displacements
    if (showGhost && solutionView && ghostScale > 0) {
      const ghostPx = (id: number): Vec2 | null => {
        const n = nodeById.get(id);
        if (!n) return null;
        const d = solutionView.dispByNode.get(id) ?? { x: 0, y: 0, z: 0 };
        return toPx({ x: n.x + d.x * ghostScale, y: n.y + d.y * ghostScale });
      };
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = 'rgba(226,232,240,0.5)';
      ctx.lineWidth = 1.5;
      for (const m of members) {
        const a = ghostPx(m.i);
        const b = ghostPx(m.j);
        if (!a || !b) continue;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(226,232,240,0.55)';
      for (const n of nodes) {
        if (!solutionView.dispByNode.has(n.id)) continue;
        const g = ghostPx(n.id)!;
        ctx.beginPath();
        ctx.arc(g.x, g.y, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Members — color by tension/compression/failure, width by |force|
    for (const m of members) {
      const a = nodePx(m.i);
      const b = nodePx(m.j);
      if (!a || !b) continue;
      const isSelected = selection?.kind === 'member' && selection.id === m.id;
      if (isSelected) {
        ctx.strokeStyle = 'rgba(251,191,36,0.9)';
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.strokeStyle = memberColor(solutionView, m.id);
      ctx.lineWidth = 2 + 2.5 * memberIntensity(solutionView, m.id);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();

      if (solutionView?.failureByMember.get(m.id)?.fails) {
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        ctx.fillStyle = '#f43f5e';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('!', mid.x, mid.y - 6);
      }
    }

    // Rubber band while connecting a member
    if (tool === 'member' && pendingNode !== null && cursorWorld) {
      const a = nodePx(pendingNode);
      if (a) {
        const b = toPx(cursorWorld);
        ctx.setLineDash([6, 5]);
        ctx.strokeStyle = 'rgba(34,211,238,0.8)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Support glyphs
    for (const n of nodes) {
      if (n.support === 'none') continue;
      drawSupportGlyph(ctx, toPx({ x: n.x, y: n.y }), n.support);
    }

    // Nodes
    for (const n of nodes) {
      const p = toPx({ x: n.x, y: n.y });
      const isSelected = selection?.kind === 'node' && selection.id === n.id;
      const isPending = pendingNode === n.id;
      const connected = solutionView === null || solutionView.dispByNode.has(n.id);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5.5, 0, Math.PI * 2);
      ctx.fillStyle = connected ? '#e2e8f0' : 'rgba(148,163,184,0.5)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = isPending ? '#22d3ee' : isSelected ? '#fbbf24' : '#0f172a';
      ctx.stroke();
      if (isSelected || isPending) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 9.5, 0, Math.PI * 2);
        ctx.strokeStyle = isPending ? 'rgba(34,211,238,0.65)' : 'rgba(251,191,36,0.65)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    // Load arrows (rose) — head at the node, pointing along the force
    for (const n of nodes) {
      const mag = Math.hypot(n.load.fx, n.load.fy);
      if (mag === 0) continue;
      const dir = { x: n.load.fx / mag, y: -n.load.fy / mag }; // canvas y is down
      drawArrow(
        ctx,
        toPx({ x: n.x, y: n.y }),
        dir,
        46,
        '#fb7185',
        formatSI(mag / 1e3, 'kN', 3),
      );
    }

    // Reaction arrows (emerald) at supports
    if (solutionView) {
      for (const n of nodes) {
        const r = solutionView.reactionByNode.get(n.id);
        if (!r) continue;
        const mag = Math.hypot(r.x, r.y);
        if (mag < 1) continue;
        const dir = { x: r.x / mag, y: -r.y / mag };
        const p = toPx({ x: n.x, y: n.y });
        // offset the tip slightly so reactions don't sit on the load arrow
        drawArrow(
          ctx,
          { x: p.x + dir.x * 12, y: p.y + dir.y * 12 },
          dir,
          40,
          '#34d399',
          formatSI(mag / 1e3, 'kN', 3),
        );
      }
    }

    if (nodes.length === 0) {
      ctx.fillStyle = 'rgba(148,163,184,0.7)';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Pick “Add node” and click to start building', CANVAS_W / 2, CANVAS_H / 2);
    }
  }, [
    nodes,
    members,
    selection,
    pendingNode,
    tool,
    solutionView,
    ghostScale,
    showGhost,
    view,
    cursorWorld,
    toPx,
    toWorld,
  ]);

  // ── Pointer interaction ─────────────────────────────────────────────────

  const pointerPx = (e: React.PointerEvent<HTMLCanvasElement>): Vec2 => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) * CANVAS_W) / rect.width,
      y: ((e.clientY - rect.top) * CANVAS_H) / rect.height,
    };
  };

  const hitNode = (px: Vec2): EditorNode | null => {
    for (let i = nodes.length - 1; i >= 0; i--) {
      if (vec2.dist(px, toPx({ x: nodes[i].x, y: nodes[i].y })) <= NODE_HIT_PX) return nodes[i];
    }
    return null;
  };

  const hitMember = (px: Vec2): EditorMember | null => {
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    for (let k = members.length - 1; k >= 0; k--) {
      const m = members[k];
      const na = nodeById.get(m.i);
      const nb = nodeById.get(m.j);
      if (!na || !nb) continue;
      const a = toPx({ x: na.x, y: na.y });
      const b = toPx({ x: nb.x, y: nb.y });
      const ab = vec2.sub(b, a);
      const len2 = vec2.dot(ab, ab);
      if (len2 === 0) continue;
      const t = clamp(vec2.dot(vec2.sub(px, a), ab) / len2, 0, 1);
      const closest = vec2.add(a, vec2.scale(ab, t));
      if (vec2.dist(px, closest) <= MEMBER_HIT_PX) return m;
    }
    return null;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const px = pointerPx(e);
    const w = toWorld(px);
    e.currentTarget.setPointerCapture(e.pointerId);
    movedRef.current = false;

    if (tool === 'add-node') {
      onAddNode(snap(w.x, ADD_SNAP), snap(w.y, ADD_SNAP));
      return;
    }

    const node = hitNode(px);
    if (tool === 'member' || tool === 'delete') {
      if (node) {
        onNodeClick(node.id);
        return;
      }
      const member = hitMember(px);
      if (member) {
        onMemberClick(member.id);
        return;
      }
      if (tool === 'member') onMiss();
      return;
    }

    // select tool
    if (node) {
      onNodeClick(node.id);
      dragRef.current = {
        kind: 'node',
        id: node.id,
        offset: { x: w.x - node.x, y: w.y - node.y },
      };
      return;
    }
    const member = hitMember(px);
    if (member) {
      onMemberClick(member.id);
      return;
    }
    dragRef.current = { kind: 'pan', startPx: px, startView: view };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const px = pointerPx(e);
    if (tool === 'member') setCursorWorld(toWorld(px));

    const drag = dragRef.current;
    if (!drag) return;
    movedRef.current = true;
    if (drag.kind === 'node') {
      const w = toWorld(px);
      onMoveNode(
        drag.id,
        snap(w.x - drag.offset.x, DRAG_SNAP),
        snap(w.y - drag.offset.y, DRAG_SNAP),
      );
    } else {
      setView({
        ...drag.startView,
        ox: drag.startView.ox + (px.x - drag.startPx.x),
        oy: drag.startView.oy + (px.y - drag.startPx.y),
      });
    }
  };

  const onPointerUp = () => {
    const drag = dragRef.current;
    dragRef.current = null;
    // A click (not a drag) on empty space deselects
    if (drag?.kind === 'pan' && !movedRef.current) onMiss();
  };

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_W}
      height={CANVAS_H}
      className="w-full"
      style={{ display: 'block', touchAction: 'none', cursor: CURSOR_BY_TOOL[tool] }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    />
  );
}
