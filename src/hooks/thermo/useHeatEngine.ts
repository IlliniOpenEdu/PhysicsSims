import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { R_GAS } from '../../utils/constants';
import { clamp } from '../../utils/mathUtils';
import {
  drawCycleDiagram,
  type CycleDiagramSpec,
  type DiagramTransform,
} from '../../lib/thermo/cycleDiagram';
import {
  computeEngineCycle,
  ENGINE_PRESETS,
  MAX_LEGS,
  MIN_LEGS,
  PROCESS_COLORS,
  PROCESS_TYPES,
  samplePoint,
  type EngineConfig,
  type EngineCycle,
  type ProcessType,
} from '../../lib/thermo/heatEngine';

export type GasType = 'monatomic' | 'diatomic';

export const GAMMA_BY_GAS: Record<GasType, number> = {
  monatomic: 5 / 3,
  diatomic: 7 / 5,
};

// ── Editable bounds ───────────────────────────────────────────────────────────

export const V_MIN = 5e-4; // m³ (0.5 L)
export const V_MAX = 0.1; // m³ (100 L)
export const T_MIN = 100; // K
export const T_MAX = 3000; // K

const clampV = (v: number) => clamp(v, V_MIN, V_MAX);
const clampT = (t: number) => clamp(t, T_MIN, T_MAX);

const PV_SPEC: CycleDiagramSpec = {
  xLabel: 'V (L)',
  yLabel: 'P (kPa)',
  xScale: 1e3,
  yScale: 1e-3,
  fill: 'rgba(56,189,248,0.07)',
};

const CYCLE_SPEED = 0.45; // legs per second, same pacing as the Carnot module
const HIT_RADIUS_PX = 14;

export interface UseHeatEngineResult {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  isPlaying: boolean;
  togglePlay: () => void;
  resetDot: () => void;
  gasType: GasType;
  setGasType: (g: GasType) => void;
  config: EngineConfig;
  cycle: EngineCycle;
  presetId: string | null;
  loadPreset: (id: string) => void;
  setV1: (v: number) => void;
  setT1: (t: number) => void;
  setLegTarget: (index: number, value: number) => void;
  setLegType: (index: number, type: ProcessType) => void;
  addLeg: () => void;
  removeLeg: (index: number) => void;
}

export function useHeatEngine(initialPresetId = 'otto'): UseHeatEngineResult {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const uRef = useRef(0); // loop parameter ∈ [0, n): leg index + fraction
  const transformRef = useRef<DiagramTransform | null>(null);
  const dragIdxRef = useRef<number | null>(null);

  const initialConfig =
    ENGINE_PRESETS.find((p) => p.id === initialPresetId)?.config ?? ENGINE_PRESETS[0].config;
  const [config, setConfig] = useState<EngineConfig>(initialConfig);
  const [presetId, setPresetId] = useState<string | null>(initialPresetId);
  const [gasType, setGasType] = useState<GasType>('monatomic');
  const [isPlaying, setIsPlaying] = useState(true);

  const cycle = useMemo(
    () => computeEngineCycle(config, GAMMA_BY_GAS[gasType]),
    [config, gasType],
  );
  const cycleRef = useRef(cycle);

  const draw = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const c = cycleRef.current;

    if (!c.ok) {
      const { width: W, height: H } = ctx.canvas;
      ctx.fillStyle = '#030507';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(248,113,113,0.85)';
      ctx.font = '13px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('cycle invalid — fix the legs to close the loop', W / 2, H / 2);
      transformRef.current = null;
      return;
    }

    const n = c.legs.length;
    const u = uRef.current % n;
    const legIdx = Math.floor(u);
    const leg = c.legs[legIdx];
    const dotState = samplePoint(leg.from, leg.to, leg.type, c.gamma, u - legIdx);

    transformRef.current = drawCycleDiagram(ctx, {
      legs: c.legs.map((l) => ({
        pts: l.pts.map((p) => ({ x: p.V, y: p.P })),
        color: PROCESS_COLORS[l.type],
      })),
      corners: c.states.map((s, i) => ({ x: s.V, y: s.P, label: String(i + 1) })),
      dot: { x: dotState.V, y: dotState.P },
      spec: PV_SPEC,
    });
  }, []);

  // Redraw whenever the cycle changes so the canvas updates even while paused
  useEffect(() => {
    cycleRef.current = cycle;
    uRef.current = uRef.current % Math.max(1, cycle.legs.length);
    draw();
  }, [cycle, draw]);

  // Animate only the cycling point
  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      lastTsRef.current = null;
      return;
    }

    const frame = (ts: number) => {
      if (lastTsRef.current === null) lastTsRef.current = ts;
      const dt = Math.min(0.033, (ts - lastTsRef.current) / 1000);
      lastTsRef.current = ts;

      const n = Math.max(1, cycleRef.current.legs.length);
      uRef.current = (uRef.current + CYCLE_SPEED * dt) % n;
      draw();

      rafRef.current = requestAnimationFrame(frame);
    };

    rafRef.current = requestAnimationFrame(frame);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isPlaying, draw]);

  // ── Dragging state points ─────────────────────────────────────────────────
  //
  // State 1 moves freely (sets V₁, T₁). States 2 … n−1 adjust the free target
  // of the leg arriving at them: horizontally for V-targets, vertically for
  // isochoric T-targets. The last state is auto-solved, so it isn't draggable.

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const toCanvasPx = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return {
        px: ((e.clientX - rect.left) * canvas.width) / rect.width,
        py: ((e.clientY - rect.top) * canvas.height) / rect.height,
      };
    };

    const hitState = (px: number, py: number): number | null => {
      const t = transformRef.current;
      const c = cycleRef.current;
      if (!t || !c.ok) return null;
      const draggableCount = c.states.length - 1; // last state is auto-solved
      for (let i = 0; i < draggableCount; i++) {
        const s = c.states[i];
        const dx = t.toX(s.V) - px;
        const dy = t.toY(s.P) - py;
        if (dx * dx + dy * dy <= HIT_RADIUS_PX * HIT_RADIUS_PX) return i;
      }
      return null;
    };

    const onDown = (e: PointerEvent) => {
      const { px, py } = toCanvasPx(e);
      const idx = hitState(px, py);
      if (idx === null) return;
      dragIdxRef.current = idx;
      canvas.setPointerCapture(e.pointerId);
      e.preventDefault();
    };

    const onMove = (e: PointerEvent) => {
      const { px, py } = toCanvasPx(e);
      const idx = dragIdxRef.current;
      if (idx === null) {
        canvas.style.cursor = hitState(px, py) !== null ? 'grab' : '';
        return;
      }
      const t = transformRef.current;
      const c = cycleRef.current;
      if (!t || !c.ok) return;

      const V = clampV(t.fromX(px));
      const P = Math.max(1, t.fromY(py));

      if (idx === 0) {
        const T1 = clampT((P * V) / R_GAS);
        setConfig((prev) => ({ ...prev, V1: V, T1 }));
      } else {
        const legCfg = c.legs[idx - 1];
        if (legCfg.type === 'isochoric') {
          // vertical drag along the fixed-V line sets the end temperature
          const T = clampT((P * c.states[idx].V) / R_GAS);
          setConfig((prev) => ({
            ...prev,
            legs: prev.legs.map((l, i) => (i === idx - 1 ? { ...l, target: T } : l)),
          }));
        } else {
          setConfig((prev) => ({
            ...prev,
            legs: prev.legs.map((l, i) => (i === idx - 1 ? { ...l, target: V } : l)),
          }));
        }
      }
      e.preventDefault();
    };

    const onUp = (e: PointerEvent) => {
      if (dragIdxRef.current !== null) {
        dragIdxRef.current = null;
        canvas.releasePointerCapture(e.pointerId);
      }
    };

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    return () => {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
    };
  }, []);

  // ── Editing API ───────────────────────────────────────────────────────────

  const loadPreset = useCallback((id: string) => {
    const preset = ENGINE_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    // Deep-copy so slider edits never mutate the preset definition
    setConfig({
      ...preset.config,
      legs: preset.config.legs.map((l) => ({ ...l })),
    });
    setPresetId(id);
    uRef.current = 0;
  }, []);

  const setV1 = useCallback((v: number) => {
    setConfig((prev) => ({ ...prev, V1: clampV(v) }));
  }, []);

  const setT1 = useCallback((t: number) => {
    setConfig((prev) => ({ ...prev, T1: clampT(t) }));
  }, []);

  const setLegTarget = useCallback((index: number, value: number) => {
    setConfig((prev) => ({
      ...prev,
      legs: prev.legs.map((l, i) =>
        i === index
          ? { ...l, target: l.type === 'isochoric' ? clampT(value) : clampV(value) }
          : l,
      ),
    }));
  }, []);

  const setLegType = useCallback((index: number, type: ProcessType) => {
    setPresetId(null);
    // Re-seed the target from the leg's current endpoint so the loop stays sensible
    const c = cycleRef.current;
    const endState = c.ok ? c.states[(index + 1) % c.states.length] : undefined;
    setConfig((prev) => {
      const old = prev.legs[index];
      if (!old || old.type === type) return prev;
      const target = endState
        ? type === 'isochoric'
          ? clampT(endState.T)
          : clampV(endState.V)
        : old.target;
      return {
        ...prev,
        legs: prev.legs.map((l, i) => (i === index ? { type, target } : l)),
      };
    });
  }, []);

  const addLeg = useCallback(() => {
    setPresetId(null);
    setConfig((prev) => {
      if (prev.legs.length >= MAX_LEGS) return prev;
      const c = computeEngineCycle(prev, GAMMA_BY_GAS[gasType]);
      const insertAt = prev.legs.length - 2; // just before the auto-solved leg
      const before = prev.legs[insertAt - 1].type;
      const after = prev.legs[insertAt].type;
      const type = PROCESS_TYPES.find((t) => t !== before && t !== after) ?? 'isothermal';
      const base = c.ok ? c.states[insertAt] : { V: prev.V1, T: prev.T1 };
      const target = type === 'isochoric' ? clampT(base.T * 1.3) : clampV(base.V * 1.4);
      const legs = [...prev.legs];
      legs.splice(insertAt, 0, { type, target });
      return { ...prev, legs };
    });
  }, [gasType]);

  const removeLeg = useCallback((index: number) => {
    setPresetId(null);
    setConfig((prev) => {
      if (prev.legs.length <= MIN_LEGS) return prev;
      return { ...prev, legs: prev.legs.filter((_, i) => i !== index) };
    });
  }, []);

  const togglePlay = useCallback(() => setIsPlaying((prev) => !prev), []);

  const resetDot = useCallback(() => {
    uRef.current = 0;
    draw();
  }, [draw]);

  return {
    canvasRef,
    isPlaying,
    togglePlay,
    resetDot,
    gasType,
    setGasType,
    config,
    cycle,
    presetId,
    loadPreset,
    setV1,
    setT1,
    setLegTarget,
    setLegType,
    addLeg,
    removeLeg,
  };
}
