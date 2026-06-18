import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CircuitComponent, ComponentKind, Rotation } from '../../lib/circuit/types';
import { componentTerminals, pinKey } from '../../lib/circuit/geometry';
import { computeWireCurrents } from '../../lib/circuit/wireCurrents';
import type { CircuitEngine } from '../../hooks/circuit/useCircuitEngine';
import { ComponentSymbol } from './symbols';

export const GRID = 26;
const VIEW_W = 1200;
const VIEW_H = 760;

export type CanvasTool = 'select' | 'wire' | ComponentKind;

interface Props {
  engine: CircuitEngine;
  tool: CanvasTool;
  setTool: (t: CanvasTool) => void;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  showVoltageColor: boolean;
  showCurrentFlow: boolean;
}

interface Vec {
  x: number;
  y: number;
}

function voltageColor(v: number, vmin: number, vmax: number): string {
  const span = Math.max(vmax - vmin, 1e-6);
  const t = (v - vmin) / span; // 0..1
  // Blue (low) → slate (mid) → red (high).
  const lerp = (a: number, b: number, k: number) => Math.round(a + (b - a) * k);
  if (t < 0.5) {
    const k = t / 0.5;
    return `rgb(${lerp(59, 148, k)},${lerp(130, 163, k)},${lerp(246, 184, k)})`;
  }
  const k = (t - 0.5) / 0.5;
  return `rgb(${lerp(148, 239, k)},${lerp(163, 68, k)},${lerp(184, 68, k)})`;
}

export function CircuitCanvas({
  engine,
  tool,
  setTool,
  setSelectedId,
  showVoltageColor,
  showCurrentFlow,
}: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [view, setView] = useState({ ox: 80, oy: 60, scale: 1 });
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [hoverWireId, setHoverWireId] = useState<string | null>(null);
  const [selComps, setSelComps] = useState<Set<string>>(() => new Set());
  const [selWires, setSelWires] = useState<Set<string>>(() => new Set());
  const [pointerGrid, setPointerGrid] = useState<Vec | null>(null);
  const [wireStart, setWireStart] = useState<Vec | null>(null);
  const [placeStart, setPlaceStart] = useState<Vec | null>(null);
  const [marquee, setMarquee] = useState<{ a: Vec; b: Vec } | null>(null);

  const dragRef = useRef<
    | { kind: 'component'; id: string; grabDx: number; grabDy: number; moved: boolean }
    | { kind: 'pan'; startX: number; startY: number; ox: number; oy: number }
    | { kind: 'marquee'; startWorld: Vec }
    | null
  >(null);

  const worldToSvg = useCallback(
    (p: Vec): Vec => ({ x: p.x * view.scale + view.ox, y: p.y * view.scale + view.oy }),
    [view],
  );

  const { schematic, result } = engine;

  // Per-wire current (for flow animation); recomputed when the solution changes.
  const wireCurrents = useMemo(
    () => (showCurrentFlow ? computeWireCurrents(schematic, result) : new Map<string, number>()),
    [showCurrentFlow, schematic, result],
  );

  const toSvg = useCallback((clientX: number, clientY: number): Vec => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const local = pt.matrixTransform(ctm.inverse());
    return { x: local.x, y: local.y };
  }, []);

  const svgToWorld = useCallback((s: Vec): Vec => ({ x: (s.x - view.ox) / view.scale, y: (s.y - view.oy) / view.scale }), [view]);
  const gridToSvg = useCallback((gx: number, gy: number): Vec => ({ x: gx * GRID * view.scale + view.ox, y: gy * GRID * view.scale + view.oy }), [view]);
  const snapToGrid = (w: Vec): Vec => ({ x: Math.round(w.x / GRID), y: Math.round(w.y / GRID) });

  // Voltage range for coloring.
  let vmin = Infinity;
  let vmax = -Infinity;
  if (result.ok) {
    for (const v of result.nodeVoltages) {
      if (v < vmin) vmin = v;
      if (v > vmax) vmax = v;
    }
  }
  if (!Number.isFinite(vmin)) {
    vmin = 0;
    vmax = 1;
  }

  const nodeVoltageAt = (gx: number, gy: number): number | null => {
    if (!result.ok) return null;
    const node = result.nodeOfKey.get(pinKey(gx, gy));
    if (node === undefined) return null;
    return result.nodeVoltages[node];
  };

  const colorForPoint = (gx: number, gy: number): string => {
    if (!showVoltageColor) return '#64748b';
    const v = nodeVoltageAt(gx, gy);
    if (v === null) return '#475569';
    return voltageColor(v, vmin, vmax);
  };

  const selectOnly = (id: string) => {
    setSelComps(new Set([id]));
    setSelWires(new Set());
    setSelectedId(id);
  };

  // ── Pointer handlers ───────────────────────────────────────────────────────
  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    if (e.button === 1) {
      e.preventDefault();
      e.stopPropagation();
    }
    const svgPt = toSvg(e.clientX, e.clientY);
    const world = svgToWorld(svgPt);
    const g = snapToGrid(world);

    if (tool !== 'select' && tool !== 'wire') {
      // Ground is a single-terminal device — one click places it.
      if (tool === 'ground') {
        const id = engine.addComponent(tool, g.x, g.y);
        selectOnly(id);
        return;
      }
      // Two-terminal devices: first click anchors terminal A, second click sets
      // terminal B (orientation + length). Placement does not auto-chain.
      if (!placeStart) {
        setPlaceStart(g);
      } else {
        const span = orientationFromPoints(placeStart, g);
        if (span) {
          const id = engine.addComponent(tool, placeStart.x, placeStart.y, span.rotation, span.length);
          selectOnly(id);
        }
        setPlaceStart(null);
      }
      return;
    }

    if (tool === 'wire') {
      if (!wireStart) {
        setWireStart(g);
      } else if (g.x === wireStart.x && g.y === wireStart.y) {
        // Clicking the same point again ends the wire chain.
        setWireStart(null);
      } else {
        engine.addWire({ x: wireStart.x, y: wireStart.y }, { x: g.x, y: g.y });
        setWireStart(g); // chain wires
      }
      return;
    }

    // Select tool: hit-test a terminal first (start wire), then component, then pan.
    const term = hitTerminal(svgPt);
    if (term) {
      setWireStart(term);
      setTool('wire');
      return;
    }

    const comp = hitComponent(svgPt);
    if (comp) {
      // Keep an existing multi-selection if the grabbed component is part of it,
      // so you can drag a whole group; otherwise select just this one.
      if (!selComps.has(comp.id)) {
        setSelComps(new Set([comp.id]));
        setSelWires(new Set());
        setSelectedId(comp.id);
      }
      dragRef.current = {
        kind: 'component',
        id: comp.id,
        grabDx: world.x - comp.x * GRID,
        grabDy: world.y - comp.y * GRID,
        moved: false,
      };
      return;
    }

    const wireId = hitWire(svgPt);
    if (wireId) {
      setSelWires(new Set([wireId]));
      setSelComps(new Set());
      setSelectedId(null);
      return;
    }

    // Empty space: Shift / middle-mouse pans, plain drag starts a marquee select.
    if (e.shiftKey || e.button === 1) {
      setSelComps(new Set());
      setSelWires(new Set());
      setSelectedId(null);
      dragRef.current = { kind: 'pan', startX: e.clientX, startY: e.clientY, ox: view.ox, oy: view.oy };
      return;
    }
    setSelComps(new Set());
    setSelWires(new Set());
    setSelectedId(null);
    setMarquee({ a: world, b: world });
    dragRef.current = { kind: 'marquee', startWorld: world };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const svgPt = toSvg(e.clientX, e.clientY);
    const world = svgToWorld(svgPt);
    const g = snapToGrid(world);
    setPointerGrid(g);

    const drag = dragRef.current;
    if (!drag) {
      const comp = hitComponent(svgPt);
      setHoverId(comp ? comp.id : null);
      setHoverWireId(tool === 'select' && !comp ? hitWire(svgPt) : null);
      return;
    }
    if (drag.kind === 'pan') {
      setView((v) => ({ ...v, ox: drag.ox + (e.clientX - drag.startX), oy: drag.oy + (e.clientY - drag.startY) }));
      return;
    }
    if (drag.kind === 'marquee') {
      const box = { a: drag.startWorld, b: world };
      setMarquee(box);
      const { comps, wires } = itemsInBox(box);
      setSelComps(comps);
      setSelWires(wires);
      setSelectedId(comps.size === 1 && wires.size === 0 ? [...comps][0] : null);
      return;
    }
    if (drag.kind === 'component') {
      const nx = Math.round((world.x - drag.grabDx) / GRID);
      const ny = Math.round((world.y - drag.grabDy) / GRID);
      const comp = schematic.components.find((c) => c.id === drag.id);
      if (comp && (comp.x !== nx || comp.y !== ny)) {
        const dx = nx - comp.x;
        const dy = ny - comp.y;
        drag.moved = true;
        if (selComps.size > 1 && selComps.has(drag.id)) {
          // Move the whole selected group by the same delta.
          for (const c of schematic.components) {
            if (selComps.has(c.id)) engine.moveComponent(c.id, c.x + dx, c.y + dy);
          }
        } else {
          engine.moveComponent(drag.id, nx, ny);
        }
      }
    }
  };

  const onPointerUp = () => {
    if (dragRef.current?.kind === 'marquee') setMarquee(null);
    dragRef.current = null;
  };

  const onMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button === 1) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const deleteSelection = () => {
    if (selComps.size === 0 && selWires.size === 0) return false;
    for (const id of selComps) engine.removeComponent(id);
    for (const id of selWires) engine.removeWire(id);
    setSelComps(new Set());
    setSelWires(new Set());
    setSelectedId(null);
    return true;
  };

  // Right-click: delete the active (possibly multi-) selection if any; otherwise
  // cancel an in-progress action, quick-delete a wire under the cursor, or
  // deselect and return to the select tool.
  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (wireStart) {
      setWireStart(null);
      return;
    }
    if (placeStart) {
      setPlaceStart(null);
      return;
    }
    if (deleteSelection()) return;
    // Quick-delete a wire directly under the cursor.
    const wireId = hitWire(toSvg(e.clientX, e.clientY));
    if (wireId) {
      engine.removeWire(wireId);
      return;
    }
    setSelectedId(null);
    if (tool !== 'select') setTool('select');
  };

  // Select every component / wire whose geometry falls inside a world-space box.
  const itemsInBox = (box: { a: Vec; b: Vec }): { comps: Set<string>; wires: Set<string> } => {
    const minX = Math.min(box.a.x, box.b.x);
    const maxX = Math.max(box.a.x, box.b.x);
    const minY = Math.min(box.a.y, box.b.y);
    const maxY = Math.max(box.a.y, box.b.y);
    const inside = (px: number, py: number) => px >= minX && px <= maxX && py >= minY && py <= maxY;
    const comps = new Set<string>();
    for (const c of schematic.components) {
      const terms = componentTerminals(c);
      const hit = terms.some((t) => inside(t.x * GRID, t.y * GRID));
      const mid =
        terms.length === 2
          ? inside(((terms[0].x + terms[1].x) / 2) * GRID, ((terms[0].y + terms[1].y) / 2) * GRID)
          : false;
      if (hit || mid) comps.add(c.id);
    }
    const wires = new Set<string>();
    for (const w of schematic.wires) {
      if (
        inside(w.a.x * GRID, w.a.y * GRID) ||
        inside(w.b.x * GRID, w.b.y * GRID) ||
        inside(((w.a.x + w.b.x) / 2) * GRID, ((w.a.y + w.b.y) / 2) * GRID)
      ) {
        wires.add(w.id);
      }
    }
    return { comps, wires };
  };

  const hitWire = (svgPt: Vec): string | null => {
    const world = svgToWorld(svgPt);
    const threshold = 8 / view.scale;
    let best: string | null = null;
    let bestDist = threshold;
    for (const w of schematic.wires) {
      const a = { x: w.a.x * GRID, y: w.a.y * GRID };
      const b = { x: w.b.x * GRID, y: w.b.y * GRID };
      const d = distToSegment(world, a, b);
      if (d < bestDist) {
        bestDist = d;
        best = w.id;
      }
    }
    return best;
  };

  // Hit testing in svg-user units.
  const hitComponent = (svgPt: Vec): CircuitComponent | null => {
    const world = svgToWorld(svgPt);
    let best: CircuitComponent | null = null;
    let bestDist = 18 / view.scale;
    for (const c of schematic.components) {
      const terms = componentTerminals(c);
      if (terms.length === 1) {
        const d = Math.hypot(world.x - terms[0].x * GRID, world.y - terms[0].y * GRID);
        if (d < bestDist) {
          bestDist = d;
          best = c;
        }
        continue;
      }
      const a = { x: terms[0].x * GRID, y: terms[0].y * GRID };
      const b = { x: terms[1].x * GRID, y: terms[1].y * GRID };
      const d = distToSegment(world, a, b);
      if (d < bestDist) {
        bestDist = d;
        best = c;
      }
    }
    return best;
  };

  const hitTerminal = (svgPt: Vec): Vec | null => {
    const world = svgToWorld(svgPt);
    const threshold = 10 / view.scale;
    for (const c of schematic.components) {
      for (const t of componentTerminals(c)) {
        const d = Math.hypot(world.x - t.x * GRID, world.y - t.y * GRID);
        if (d < threshold) return { x: t.x, y: t.y };
      }
    }
    for (const w of schematic.wires) {
      for (const t of [w.a, w.b]) {
        const d = Math.hypot(world.x - t.x * GRID, world.y - t.y * GRID);
        if (d < threshold) return { x: t.x, y: t.y };
      }
    }
    return null;
  };

  const zoomFromWheel = useCallback(
    (clientX: number, clientY: number, deltaY: number) => {
      const svgPt = toSvg(clientX, clientY);
      const factor = deltaY < 0 ? 1.12 : 1 / 1.12;
      setView((v) => {
        const newScale = Math.min(2.6, Math.max(0.4, v.scale * factor));
        // Keep the point under the cursor stationary.
        const wx = (svgPt.x - v.ox) / v.scale;
        const wy = (svgPt.y - v.oy) / v.scale;
        return { scale: newScale, ox: svgPt.x - wx * newScale, oy: svgPt.y - wy * newScale };
      });
    },
    [toSvg],
  );

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const onNativeWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      zoomFromWheel(e.clientX, e.clientY, e.deltaY);
    };

    svg.addEventListener('wheel', onNativeWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onNativeWheel);
  }, [zoomFromWheel]);

  // Keyboard: rotate (R), delete (Del/Backspace), escape tool.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (e.key === 'Escape') {
        setTool('select');
        setWireStart(null);
        setPlaceStart(null);
        setMarquee(null);
        setSelComps(new Set());
        setSelWires(new Set());
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteSelection();
        return;
      }
      if (e.key === 'r' || e.key === 'R') {
        for (const id of selComps) engine.rotateComponent(id, 90);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, selComps, selWires, setSelectedId, setTool]);

  // Reset the in-progress placement anchor whenever the active tool changes.
  useEffect(() => {
    setPlaceStart(null);
  }, [tool]);

  // Drop selected ids that no longer exist (after deletes / preset loads).
  useEffect(() => {
    setSelComps((prev) => {
      const next = new Set([...prev].filter((id) => schematic.components.some((c) => c.id === id)));
      return next.size === prev.size ? prev : next;
    });
    setSelWires((prev) => {
      const next = new Set([...prev].filter((id) => schematic.wires.some((w) => w.id === id)));
      return next.size === prev.size ? prev : next;
    });
  }, [schematic]);

  const cursorClass = tool === 'select' ? 'cursor-grab' : 'cursor-crosshair';

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      className={`h-full w-full touch-none select-none ${cursorClass}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      onMouseDown={onMouseDown}
      onContextMenu={onContextMenu}
    >
      <defs>
        <pattern
          id="circuit-grid"
          width={GRID * view.scale}
          height={GRID * view.scale}
          patternUnits="userSpaceOnUse"
          x={view.ox}
          y={view.oy}
        >
          <circle cx={0} cy={0} r={1} fill="rgba(148,163,184,0.22)" />
        </pattern>
        <marker id="flow-arrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <path d="M0 0 L6 3 L0 6 Z" fill="#fde68a" />
        </marker>
      </defs>

      <rect x={0} y={0} width={VIEW_W} height={VIEW_H} fill="#060a14" />
      <rect x={0} y={0} width={VIEW_W} height={VIEW_H} fill="url(#circuit-grid)" />

      {/* Wires */}
      {schematic.wires.map((w) => {
        const a = gridToSvg(w.a.x, w.a.y);
        const b = gridToSvg(w.b.x, w.b.y);
        const color = colorForPoint(w.a.x, w.a.y);
        const isSelected = selWires.has(w.id);
        const isHovered = w.id === hoverWireId;
        return (
          <g key={w.id}>
            {(isSelected || isHovered) && (
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={isSelected ? '#38bdf8' : 'rgba(148,163,184,0.6)'}
                strokeWidth={(isSelected ? 8 : 7) * view.scale}
                strokeLinecap="round"
                opacity={0.4}
              />
            )}
            <line
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={color}
              strokeWidth={3 * view.scale}
              strokeLinecap="round"
            />
          </g>
        );
      })}

      {/* Current flow dots on wires */}
      {showCurrentFlow &&
        result.ok &&
        schematic.wires.map((w) => {
          const current = wireCurrents.get(w.id) ?? 0;
          if (Math.abs(current) < 1e-9) return null;
          return (
            <FlowDots
              key={`wflow-${w.id}`}
              a={gridToSvg(w.a.x, w.a.y)}
              b={gridToSvg(w.b.x, w.b.y)}
              current={current}
              time={engine.time}
            />
          );
        })}

      {/* Current flow dots on components */}
      {showCurrentFlow &&
        result.ok &&
        schematic.components.map((c) => {
          const res = result.components.get(c.id);
          if (!res || Math.abs(res.current) < 1e-9) return null;
          const terms = componentTerminals(c);
          if (terms.length < 2) return null;
          return (
            <FlowDots
              key={`flow-${c.id}`}
              a={gridToSvg(terms[0].x, terms[0].y)}
              b={gridToSvg(terms[1].x, terms[1].y)}
              current={res.current}
              time={engine.time}
            />
          );
        })}

      {/* Components */}
      {schematic.components.map((c) => {
        const terms = componentTerminals(c);
        const a = gridToSvg(terms[0].x, terms[0].y);
        const b = terms[1] ? gridToSvg(terms[1].x, terms[1].y) : a;
        const res = result.components.get(c.id);
        let glow = 0;
        if (c.kind === 'resistor' && res) glow = Math.min(1, Math.abs(res.power) / 0.5);
        const baseStroke =
          showVoltageColor && c.kind !== 'ground'
            ? colorForPoint(terms[0].x, terms[0].y)
            : '#e2e8f0';
        const label = res
          ? c.kind === 'resistor' || c.kind === 'ammeter'
            ? `${formatSigned(res.current, 'A')}`
            : c.kind === 'voltmeter' || c.kind === 'capacitor' || c.kind === 'inductor'
              ? `${formatSigned(res.voltage, 'V')}`
              : undefined
          : undefined;
        return (
          <ComponentSymbol
            key={c.id}
            comp={c}
            visual={{
              ax: a.x,
              ay: a.y,
              bx: b.x,
              by: b.y,
              selected: selComps.has(c.id),
              hovered: c.id === hoverId,
              glow,
              stroke: c.kind === 'ground' ? '#94a3b8' : baseStroke,
              label,
            }}
          />
        );
      })}

      {/* Wire-in-progress preview */}
      {wireStart && pointerGrid && (
        <line
          x1={gridToSvg(wireStart.x, wireStart.y).x}
          y1={gridToSvg(wireStart.x, wireStart.y).y}
          x2={gridToSvg(pointerGrid.x, pointerGrid.y).x}
          y2={gridToSvg(pointerGrid.x, pointerGrid.y).y}
          stroke="#38bdf8"
          strokeWidth={2.4}
          strokeDasharray="5 4"
        />
      )}

      {/* Marquee selection box */}
      {marquee && (() => {
        const a = worldToSvg(marquee.a);
        const b = worldToSvg(marquee.b);
        return (
          <rect
            x={Math.min(a.x, b.x)}
            y={Math.min(a.y, b.y)}
            width={Math.abs(b.x - a.x)}
            height={Math.abs(b.y - a.y)}
            fill="rgba(56,189,248,0.10)"
            stroke="#38bdf8"
            strokeWidth={1.2}
            strokeDasharray="4 3"
          />
        );
      })()}

      {/* Placement: dashed rubber-band between terminal A and the cursor */}
      {placeStart && pointerGrid && (
        <g>
          <line
            x1={gridToSvg(placeStart.x, placeStart.y).x}
            y1={gridToSvg(placeStart.x, placeStart.y).y}
            x2={gridToSvg(pointerGrid.x, pointerGrid.y).x}
            y2={gridToSvg(pointerGrid.x, pointerGrid.y).y}
            stroke="#34d399"
            strokeWidth={2.4}
            strokeDasharray="5 4"
          />
          <circle cx={gridToSvg(placeStart.x, placeStart.y).x} cy={gridToSvg(placeStart.x, placeStart.y).y} r={5} fill="#34d399" />
          <circle cx={gridToSvg(pointerGrid.x, pointerGrid.y).x} cy={gridToSvg(pointerGrid.x, pointerGrid.y).y} r={4} fill="#34d399" opacity={0.7} />
        </g>
      )}

      {/* Placement: ghost dot showing where the first terminal will land */}
      {tool !== 'select' && tool !== 'wire' && !placeStart && pointerGrid && (
        <circle cx={gridToSvg(pointerGrid.x, pointerGrid.y).x} cy={gridToSvg(pointerGrid.x, pointerGrid.y).y} r={5} fill="#34d399" opacity={0.6} />
      )}
    </svg>
  );
}

function formatSigned(value: number, unit: string): string {
  const abs = Math.abs(value);
  let scaled = abs;
  let prefix = '';
  if (abs !== 0 && abs < 1e-3) {
    scaled = abs * 1e6;
    prefix = 'µ';
  } else if (abs < 1) {
    scaled = abs * 1e3;
    prefix = 'm';
  } else if (abs >= 1e3) {
    scaled = abs / 1e3;
    prefix = 'k';
  }
  const sign = value < 0 ? '-' : '';
  return `${sign}${scaled.toPrecision(3)} ${prefix}${unit}`;
}

function FlowDots({ a, b, current, time }: { a: Vec; b: Vec; current: number; time: number }) {
  const dir = current >= 0 ? 1 : -1;
  const speed = Math.min(2.5, 0.25 + Math.log10(1 + Math.abs(current) * 1000) * 0.6);
  const phase = ((time * speed * dir) % 1 + 1) % 1;
  const dots = 4;
  const pts = [];
  for (let i = 0; i < dots; i += 1) {
    const f = (i / dots + phase) % 1;
    pts.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });
  }
  return (
    <g>
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={2.6} fill="#fde68a" opacity={0.9} />
      ))}
    </g>
  );
}

// Snap a two-point drag to an axis-aligned component orientation + length.
function orientationFromPoints(a: Vec, b: Vec): { rotation: Rotation; length: number } | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) return null;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return { rotation: dx >= 0 ? 0 : 180, length: Math.max(1, Math.abs(dx)) };
  }
  return { rotation: dy >= 0 ? 90 : 270, length: Math.max(1, Math.abs(dy)) };
}

function distToSegment(p: Vec, a: Vec, b: Vec): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}
