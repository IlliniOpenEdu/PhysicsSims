// id="pressure_point_explorer"
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { SliderWithInput } from '../../../components/system/SliderWithInput';
import { ConceptBox } from '../../../components/system/ConceptBox';

type PressurePoint = {
  id: string;
  xNorm: number;
  yNorm: number;
  forceN: number;
  radiusCm: number;
  label: string;
};

type PointMetrics = {
  radiusM: number;
  radiusCm: number;
  areaM2: number;
  pressurePa: number;
};

type PresetKey = 'thumbtack' | 'coin' | 'highHeel' | 'snowshoe';

const MAX_POINTS = 10;
const MIN_FORCE = 1;
const MAX_FORCE = 1000;
const MIN_RADIUS_CM = 0.1;
const MAX_RADIUS_CM = 10;

const CANVAS_W = 820;
const CANVAS_H = 520;
const PAPER_W = 620;
const PAPER_H = 380;
const PAPER_X = (CANVAS_W - PAPER_W) / 2;
const PAPER_Y = (CANVAS_H - PAPER_H) / 2;
const CM_TO_PX = 13.5;

const PAPER_FILL = '#f8faf4';
const PAPER_EDGE = '#cbd5b8';

const PRESETS: Record<PresetKey, { forceN: number; radiusCm: number; label: string }> = {
  thumbtack: { forceN: 50, radiusCm: 0.15, label: 'Thumbtack' },
  coin: { forceN: 50, radiusCm: 1.25, label: 'Coin' },
  highHeel: { forceN: 700, radiusCm: 0.35, label: 'High heel' },
  snowshoe: { forceN: 700, radiusCm: 9, label: 'Snowshoe' },
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function roundTo2(n: number): number {
  return Math.round(n * 100) / 100;
}

function formatPressure(pa: number): string {
  if (pa >= 1e9) return `${roundTo2(pa / 1e9)} GPa`;
  if (pa >= 1e6) return `${roundTo2(pa / 1e6)} MPa`;
  if (pa >= 1e3) return `${roundTo2(pa / 1e3)} kPa`;
  return `${roundTo2(pa)} Pa`;
}

function formatArea(m2: number): string {
  if (m2 < 1e-6) return `${roundTo2(m2 * 1e6)} mm²`;
  if (m2 < 1e-4) return `${roundTo2(m2 * 1e4)} cm²`;
  return `${roundTo2(m2)} m²`;
}

function computeMetrics(forceN: number, radiusCm: number): PointMetrics {
  const radiusM = radiusCm / 100;
  const areaM2 = Math.PI * radiusM * radiusM;
  const pressurePa = areaM2 > 0 ? forceN / areaM2 : 0;
  return { radiusM, radiusCm, areaM2, pressurePa };
}

function forceColor(forceN: number): [number, number, number] {
  const t = clamp((forceN - MIN_FORCE) / (MAX_FORCE - MIN_FORCE), 0, 1);
  const r = Math.round(59 + t * (239 - 59));
  const g = Math.round(130 + t * (68 - 130));
  const b = Math.round(246 + t * (68 - 246));
  return [r, g, b];
}

function nextPointId(): string {
  return `pt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function defaultPoint(index: number): PressurePoint {
  const spots = [
    { x: 0.28, y: 0.42 },
    { x: 0.52, y: 0.55 },
    { x: 0.72, y: 0.38 },
  ];
  const spot = spots[index % spots.length];
  return {
    id: nextPointId(),
    xNorm: spot.x,
    yNorm: spot.y,
    forceN: 120,
    radiusCm: 1.2,
    label: `Point ${index + 1}`,
  };
}

export function PressurePointExplorer() {
  const [points, setPoints] = useState<PressurePoint[]>(() => [defaultPoint(0)]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [uiTick, setUiTick] = useState(0);

  const pointsRef = useRef(points);
  const selectedIdRef = useRef<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const rafRef = useRef<number | null>(null);
  const uiPushRef = useRef(0);

  useEffect(() => {
    pointsRef.current = points;
  }, [points]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    if (selectedId && !points.some((p) => p.id === selectedId)) {
      setSelectedId(points[0]?.id ?? null);
    }
  }, [points, selectedId]);

  const selectedPoint = useMemo(
    () => points.find((p) => p.id === selectedId) ?? points[0] ?? null,
    [points, selectedId],
  );

  const allMetrics = useMemo(
    () =>
      points.map((p) => ({
        point: p,
        metrics: computeMetrics(p.forceN, p.radiusCm),
      })),
    [points, uiTick],
  );

  const summary = useMemo(() => {
    if (allMetrics.length === 0) {
      return { count: 0, maxPa: 0, minPa: 0, avgPa: 0, maxId: '', minId: '' };
    }
    let maxPa = -Infinity;
    let minPa = Infinity;
    let sum = 0;
    let maxId = '';
    let minId = '';
    for (const { point, metrics } of allMetrics) {
      sum += metrics.pressurePa;
      if (metrics.pressurePa > maxPa) {
        maxPa = metrics.pressurePa;
        maxId = point.id;
      }
      if (metrics.pressurePa < minPa) {
        minPa = metrics.pressurePa;
        minId = point.id;
      }
    }
    return {
      count: allMetrics.length,
      maxPa,
      minPa,
      avgPa: sum / allMetrics.length,
      maxId,
      minId,
    };
  }, [allMetrics]);

  const paperToCanvas = useCallback((xNorm: number, yNorm: number) => {
    return {
      x: PAPER_X + xNorm * PAPER_W,
      y: PAPER_Y + yNorm * PAPER_H,
    };
  }, []);

  const canvasToPaperNorm = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    const xNorm = (x - PAPER_X) / PAPER_W;
    const yNorm = (y - PAPER_Y) / PAPER_H;
    if (xNorm < 0 || xNorm > 1 || yNorm < 0 || yNorm > 1) return null;
    return { xNorm: clamp(xNorm, 0.04, 0.96), yNorm: clamp(yNorm, 0.04, 0.96) };
  }, []);

  const drawScene = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pts = pointsRef.current;
    const selected = selectedIdRef.current;

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.fillStyle = PAPER_FILL;
    ctx.strokeStyle = PAPER_EDGE;
    ctx.lineWidth = 2;
    ctx.fillRect(PAPER_X, PAPER_Y, PAPER_W, PAPER_H);
    ctx.strokeRect(PAPER_X, PAPER_Y, PAPER_W, PAPER_H);

    for (const p of pts) {
      const center = paperToCanvas(p.xNorm, p.yNorm);
      const rPx = p.radiusCm * CM_TO_PX;
      const [cr, cg, cb] = forceColor(p.forceN);

      ctx.beginPath();
      ctx.arc(center.x, center.y, rPx, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${cr},${cg},${cb},0.55)`;
      ctx.fill();
      ctx.strokeStyle = p.id === selected ? '#f8fafc' : `rgb(${cr},${cg},${cb})`;
      ctx.lineWidth = p.id === selected ? 3 : 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(center.x, center.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = p.id === selected ? '#f8fafc' : '#0f172a';
      ctx.fill();
    }

    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText('Paper surface — drag points to compare pressure footprints', PAPER_X, PAPER_Y - 12);
    ctx.fillStyle = '#64748b';
    ctx.font = '10px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText('P = F / A', CANVAS_W - PAPER_X - 52, PAPER_Y - 12);
  }, [paperToCanvas]);

  const scheduleDraw = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      drawScene();
      const now = performance.now();
      if (now - uiPushRef.current >= 80) {
        uiPushRef.current = now;
        setUiTick((n) => n + 1);
      }
    });
  }, [drawScene]);

  useEffect(() => {
    drawScene();
  }, [drawScene, points, selectedId]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const hitTestPoint = useCallback(
    (clientX: number, clientY: number): PressurePoint | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const scaleX = CANVAS_W / rect.width;
      const scaleY = CANVAS_H / rect.height;
      const x = (clientX - rect.left) * scaleX;
      const y = (clientY - rect.top) * scaleY;

      const pts = pointsRef.current;
      for (let i = pts.length - 1; i >= 0; i--) {
        const p = pts[i];
        const center = paperToCanvas(p.xNorm, p.yNorm);
        const rPx = Math.max(p.radiusCm * CM_TO_PX, 14);
        const dx = x - center.x;
        const dy = y - center.y;
        if (dx * dx + dy * dy <= rPx * rPx) return p;
      }
      return null;
    },
    [paperToCanvas],
  );

  const updatePoint = useCallback(
    (id: string, patch: Partial<PressurePoint>) => {
      setPoints((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
      scheduleDraw();
    },
    [scheduleDraw],
  );

  const addPoint = useCallback(
    (partial?: Partial<PressurePoint>) => {
      setPoints((prev) => {
        if (prev.length >= MAX_POINTS) return prev;
        const p: PressurePoint = {
          ...defaultPoint(prev.length),
          ...partial,
          id: nextPointId(),
        };
        return [...prev, p];
      });
      scheduleDraw();
    },
    [scheduleDraw],
  );

  const addPreset = (key: PresetKey) => {
    const preset = PRESETS[key];
    if (points.length >= MAX_POINTS) return;
    const angle = points.length * 1.3;
    const xNorm = 0.5 + Math.cos(angle) * 0.22;
    const yNorm = 0.5 + Math.sin(angle) * 0.18;
    const p: PressurePoint = {
      id: nextPointId(),
      xNorm: clamp(xNorm, 0.08, 0.92),
      yNorm: clamp(yNorm, 0.08, 0.92),
      forceN: preset.forceN,
      radiusCm: preset.radiusCm,
      label: preset.label,
    };
    setPoints((prev) => (prev.length >= MAX_POINTS ? prev : [...prev, p]));
    setSelectedId(p.id);
    scheduleDraw();
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    setPoints((prev) => {
      const next = prev.filter((p) => p.id !== selectedId);
      return next.length > 0 ? next : [defaultPoint(0)];
    });
    setSelectedId(null);
    scheduleDraw();
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const hit = hitTestPoint(e.clientX, e.clientY);
    if (hit) {
      setSelectedId(hit.id);
      const center = paperToCanvas(hit.xNorm, hit.yNorm);
      const rect = canvasRef.current!.getBoundingClientRect();
      const scaleX = CANVAS_W / rect.width;
      const scaleY = CANVAS_H / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      dragRef.current = { id: hit.id, offsetX: x - center.x, offsetY: y - center.y };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    const norm = canvasToPaperNorm(e.clientX, e.clientY);
    if (norm && pointsRef.current.length < MAX_POINTS) {
      const p: PressurePoint = {
        id: nextPointId(),
        xNorm: norm.xNorm,
        yNorm: norm.yNorm,
        forceN: 100,
        radiusCm: 1,
        label: `Point ${pointsRef.current.length + 1}`,
      };
      setPoints((prev) => [...prev, p]);
      setSelectedId(p.id);
      scheduleDraw();
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const x = (e.clientX - rect.left) * scaleX - drag.offsetX;
    const y = (e.clientY - rect.top) * scaleY - drag.offsetY;
    const xNorm = clamp((x - PAPER_X) / PAPER_W, 0.04, 0.96);
    const yNorm = clamp((y - PAPER_Y) / PAPER_H, 0.04, 0.96);

    pointsRef.current = pointsRef.current.map((p) =>
      p.id === drag.id ? { ...p, xNorm, yNorm } : p,
    );
    scheduleDraw();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current) {
      setPoints([...pointsRef.current]);
      dragRef.current = null;
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const selectedMetrics = selectedPoint
    ? computeMetrics(selectedPoint.forceN, selectedPoint.radiusCm)
    : null;

  const sortedComparison = [...allMetrics].sort(
    (a, b) => b.metrics.pressurePa - a.metrics.pressurePa,
  );

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-8 text-slate-100">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-400">Pressure</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
            Pressure Point Explorer
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-300">
            Place circular contact patches on a sheet of paper and explore how force and area combine
            into pressure — <span className="font-mono text-amber-200">P = F / A</span>.
          </p>
        </div>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-sky-500 hover:text-sky-100"
        >
          ← Dashboard
        </Link>
      </header>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-lg shadow-slate-950/40">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="mx-auto block h-auto w-full max-w-5xl cursor-crosshair touch-none rounded-xl border border-slate-800 bg-slate-950"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
        <p className="mt-2 text-center text-xs text-slate-500">
          Click empty paper to add a point · drag to move · up to {MAX_POINTS} points
        </p>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold tracking-wide text-amber-300">Pressure points</h2>
            <button
              type="button"
              onClick={() => addPoint()}
              disabled={points.length >= MAX_POINTS}
              className="rounded-full bg-amber-500 px-3 py-1 text-[0.68rem] font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              + Add
            </button>
          </div>
          <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
            {allMetrics.map(({ point, metrics }) => (
              <li key={point.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(point.id)}
                  className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                    point.id === selectedId
                      ? 'border-amber-500/60 bg-amber-950/40'
                      : 'border-slate-800 bg-slate-900/70 hover:border-slate-600'
                  }`}
                >
                  <p className="text-xs font-semibold text-slate-100">{point.label}</p>
                  <p className="mt-0.5 font-mono text-[0.68rem] text-amber-200/90">
                    {formatPressure(metrics.pressurePa)}
                  </p>
                  <p className="text-[0.62rem] text-slate-500">
                    F = {roundTo2(point.forceN)} N · r = {roundTo2(point.radiusCm)} cm
                  </p>
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-4">
            <p className="text-[0.68rem] font-semibold uppercase tracking-wider text-slate-400">
              Real-world presets
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(Object.keys(PRESETS) as PresetKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => addPreset(key)}
                  disabled={points.length >= MAX_POINTS}
                  className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-[0.65rem] font-semibold text-slate-200 transition hover:border-amber-500 disabled:opacity-40"
                >
                  {PRESETS[key].label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-950/80 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-wide text-amber-300">
              Selected point controls
            </h2>
            <button
              type="button"
              onClick={deleteSelected}
              disabled={!selectedPoint || points.length <= 1}
              className="rounded-full border border-red-900/60 px-2.5 py-1 text-[0.65rem] font-semibold text-red-300 transition hover:border-red-500 disabled:opacity-40"
            >
              Delete
            </button>
          </div>

          {selectedPoint ? (
            <>
              <SliderWithInput
                label="Force (F)"
                units="N"
                min={MIN_FORCE}
                max={MAX_FORCE}
                step={1}
                value={selectedPoint.forceN}
                onChange={(v) => updatePoint(selectedPoint.id, { forceN: v })}
                syncToUrl={false}
              />
              <SliderWithInput
                label="Contact radius"
                units="cm"
                min={MIN_RADIUS_CM}
                max={MAX_RADIUS_CM}
                step={0.05}
                value={selectedPoint.radiusCm}
                onChange={(v) => updatePoint(selectedPoint.id, { radiusCm: v })}
                syncToUrl={false}
              />
              <div className="rounded-lg border border-amber-900/40 bg-amber-950/25 p-3 text-center">
                <p className="text-[0.65rem] uppercase tracking-wider text-amber-300/80">
                  Pressure relation
                </p>
                <p className="mt-1 font-mono text-sm text-amber-100">
                  P = F / A = {roundTo2(selectedPoint.forceN)} /{' '}
                  {selectedMetrics ? formatArea(selectedMetrics.areaM2) : '—'} ={' '}
                  {selectedMetrics ? formatPressure(selectedMetrics.pressurePa) : '—'}
                </p>
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-400">Select a pressure point to edit.</p>
          )}
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
        <h2 className="text-sm font-semibold tracking-wide text-amber-300">Selected point data</h2>
        {selectedPoint && selectedMetrics ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <StatChip label="Force" value={`${roundTo2(selectedPoint.forceN)} N`} />
            <StatChip
              label="Radius"
              value={`${roundTo2(selectedMetrics.radiusCm)} cm (${roundTo2(selectedMetrics.radiusM)} m)`}
            />
            <StatChip label="Contact area" value={formatArea(selectedMetrics.areaM2)} />
            <StatChip label="Pressure" value={formatPressure(selectedMetrics.pressurePa)} />
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-400">No point selected.</p>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
        <h2 className="text-sm font-semibold tracking-wide text-amber-300">Multi-point summary</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <StatChip label="Pressure points" value={`${summary.count}`} />
          <StatChip
            label="Highest pressure"
            value={formatPressure(summary.maxPa)}
            hint={allMetrics.find((m) => m.point.id === summary.maxId)?.point.label}
          />
          <StatChip
            label="Lowest pressure"
            value={formatPressure(summary.minPa)}
            hint={allMetrics.find((m) => m.point.id === summary.minId)?.point.label}
          />
          <StatChip label="Average pressure" value={formatPressure(summary.avgPa)} />
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
        <h2 className="text-sm font-semibold tracking-wide text-amber-300">Comparison mode</h2>
        <p className="mt-1 text-xs text-slate-400">
          Side-by-side force, area, and pressure for every point — compare thumbtacks, coins, heels,
          and snowshoes at a glance.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-2 pr-3 font-medium">Point</th>
                <th className="py-2 pr-3 font-medium">Force (N)</th>
                <th className="py-2 pr-3 font-medium">Radius (cm)</th>
                <th className="py-2 pr-3 font-medium">Area</th>
                <th className="py-2 font-medium">Pressure</th>
              </tr>
            </thead>
            <tbody>
              {sortedComparison.map(({ point, metrics }, idx) => (
                <tr
                  key={point.id}
                  className={`border-b border-slate-800/80 ${
                    point.id === selectedId ? 'bg-amber-950/20' : ''
                  }`}
                >
                  <td className="py-2.5 pr-3 text-slate-100">
                    <span className="font-semibold">{point.label}</span>
                    {idx === 0 && sortedComparison.length > 1 && (
                      <span className="ml-2 text-[0.6rem] text-orange-300">highest P</span>
                    )}
                  </td>
                  <td className="py-2.5 pr-3 font-mono text-slate-200">{roundTo2(point.forceN)}</td>
                  <td className="py-2.5 pr-3 font-mono text-slate-200">
                    {roundTo2(metrics.radiusCm)}
                  </td>
                  <td className="py-2.5 pr-3 font-mono text-slate-200">
                    {formatArea(metrics.areaM2)}
                  </td>
                  <td className="py-2.5 font-mono text-amber-200">
                    {formatPressure(metrics.pressurePa)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-6 flex flex-wrap items-center gap-3 text-[0.65rem] text-slate-400">
        <span className="font-semibold text-slate-300">Force color scale:</span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-6 rounded-sm bg-blue-500" /> 1 N
        </span>
        <span className="text-slate-600">→</span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-6 rounded-sm bg-red-500" /> 1000 N
        </span>
      </div>

      <ConceptBox
        heading="Key ideas"
        items={[
          {
            title: 'What is pressure?',
            description:
              'Pressure measures how concentrated a force is over a contact area: P = F/A (pascals, Pa = N/m²). The same push feels sharper when it acts on a smaller patch.',
          },
          {
            title: 'More force → more pressure',
            description:
              'With contact area held fixed, doubling the applied force doubles the pressure. That is why leaning harder with your thumb hurts more than a light touch.',
          },
          {
            title: 'Larger area → less pressure',
            description:
              'Spreading the same force over a wider contact patch lowers the pressure. Area grows with the square of radius (πr²), so small radius changes have a huge effect.',
          },
          {
            title: 'Thumbtacks and sharp tips',
            description:
              'A thumbtack applies moderate force through a tiny tip, producing enormous pressure that can pierce paper or skin. A coin with the same force is harmless because its area is much larger.',
          },
          {
            title: 'Snowshoes and soft ground',
            description:
              'Snowshoes spread your weight over a very large area, reducing pressure so you do not sink as deeply into snow — the same total force, gentler distribution.',
          },
          {
            title: 'High heels on hard floors',
            description:
              'A high heel can deliver a large fraction of body weight through a very small heel pad, creating pressures that can dent wood or mark tile — the same idea as a thumbtack, at larger scale.',
          },
        ]}
      />
    </div>
  );
}

function StatChip({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-900/70 px-3 py-2">
      <p className="text-[0.66rem] text-slate-400">{label}</p>
      <p className="mt-0.5 font-mono text-[0.78rem] text-amber-200">{value}</p>
      {hint ? <p className="mt-0.5 text-[0.6rem] text-slate-500">{hint}</p> : null}
    </div>
  );
}
