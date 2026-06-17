import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  CircuitComponent,
  ComponentKind,
  ReactiveState,
  Rotation,
  Schematic,
  SolveResult,
  Wire,
} from '../../lib/circuit/types';
import { createReactiveState, DEFAULT_LENGTH, defaultParamsFor } from '../../lib/circuit/types';
import { solveStep } from '../../lib/circuit/solver';
import { rotate } from '../../lib/circuit/geometry';
import { emptySchematic } from '../../lib/circuit/presets';

export type ProbeSignal = 'voltage' | 'current' | 'power' | 'energy';

export interface Probe {
  id: string;
  componentId: string;
  signal: ProbeSignal;
  color: string;
}

export interface TracePoint {
  t: number;
  value: number;
}

const MAX_TRACE = 700;
const MAX_DT = 2e-4; // s, stability cap for the trapezoidal integrator
const MAX_SUBSTEPS = 80;

let idCounter = 0;
const makeId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(idCounter += 1)}`;

function cloneReactive(state: ReactiveState): ReactiveState {
  return {
    capVoltage: new Map(state.capVoltage),
    capCurrent: new Map(state.capCurrent),
    indCurrent: new Map(state.indCurrent),
    indVoltage: new Map(state.indVoltage),
  };
}

function seedReactiveState(schematic: Schematic): ReactiveState {
  const state = createReactiveState();
  for (const c of schematic.components) {
    if (c.kind === 'capacitor' && typeof c.initialVoltage === 'number') {
      state.capVoltage.set(c.id, c.initialVoltage);
    }
    if (c.kind === 'inductor' && typeof c.initialCurrent === 'number') {
      state.indCurrent.set(c.id, c.initialCurrent);
    }
  }
  return state;
}

export interface CircuitEngine {
  schematic: Schematic;
  result: SolveResult;
  running: boolean;
  time: number;
  timeScale: number;
  probes: Probe[];
  traces: Map<string, TracePoint[]>;
  setRunning: (v: boolean) => void;
  toggleRunning: () => void;
  setTimeScale: (v: number) => void;
  reset: () => void;
  loadSchematic: (s: Schematic) => void;
  addComponent: (kind: ComponentKind, x: number, y: number, rotation?: Rotation, length?: number) => string;
  updateComponent: (id: string, patch: Partial<CircuitComponent>) => void;
  moveComponent: (id: string, x: number, y: number) => void;
  rotateComponent: (id: string, delta: number) => void;
  removeComponent: (id: string) => void;
  addWire: (a: Wire['a'], b: Wire['b']) => void;
  removeWire: (id: string) => void;
  setSettings: (patch: Partial<Schematic['settings']>) => void;
  addProbe: (componentId: string, signal: ProbeSignal) => void;
  removeProbe: (id: string) => void;
  clearTraces: () => void;
}

const PROBE_COLORS = ['#38bdf8', '#f472b6', '#34d399', '#fbbf24', '#a78bfa', '#fb7185'];

export function useCircuitEngine(initial?: Schematic): CircuitEngine {
  const [schematic, setSchematic] = useState<Schematic>(() => initial ?? emptySchematic());
  const [running, setRunning] = useState(true);
  const [timeScale, setTimeScale] = useState(1);
  const [time, setTime] = useState(0);
  const [probes, setProbes] = useState<Probe[]>([]);
  const [result, setResult] = useState<SolveResult>(() =>
    solveStep(initial ?? emptySchematic(), createReactiveState(), { dt: MAX_DT, time: 0 }),
  );

  const reactiveRef = useRef<ReactiveState>(seedReactiveState(initial ?? emptySchematic()));
  const schematicRef = useRef(schematic);
  const runningRef = useRef(running);
  const timeScaleRef = useRef(timeScale);
  const timeRef = useRef(0);
  const probesRef = useRef(probes);
  const tracesRef = useRef<Map<string, TracePoint[]>>(new Map());
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const [, forceFrame] = useState(0);

  useEffect(() => {
    schematicRef.current = schematic;
  }, [schematic]);
  useEffect(() => {
    runningRef.current = running;
  }, [running]);
  useEffect(() => {
    timeScaleRef.current = timeScale;
  }, [timeScale]);
  useEffect(() => {
    probesRef.current = probes;
  }, [probes]);

  const recordTraces = useCallback((res: SolveResult, t: number) => {
    for (const probe of probesRef.current) {
      const comp = res.components.get(probe.componentId);
      if (!comp) continue;
      const value =
        probe.signal === 'voltage'
          ? comp.voltage
          : probe.signal === 'current'
            ? comp.current
            : probe.signal === 'power'
              ? comp.power
              : (comp.energy ?? 0);
      let buf = tracesRef.current.get(probe.id);
      if (!buf) {
        buf = [];
        tracesRef.current.set(probe.id, buf);
      }
      buf.push({ t, value });
      if (buf.length > MAX_TRACE) buf.splice(0, buf.length - MAX_TRACE);
    }
  }, []);

  // Static (paused) solve: clone state so we never advance it.
  const solveStatic = useCallback(() => {
    const clone = cloneReactive(reactiveRef.current);
    const res = solveStep(schematicRef.current, clone, { dt: MAX_DT, time: timeRef.current });
    setResult(res);
  }, []);

  // Re-solve when the schematic changes while paused.
  useEffect(() => {
    if (!runningRef.current) solveStatic();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schematic, solveStatic]);

  useEffect(() => {
    const loop = (ts: number) => {
      rafRef.current = requestAnimationFrame(loop);
      if (!runningRef.current) {
        lastTsRef.current = ts;
        return;
      }
      const last = lastTsRef.current ?? ts;
      lastTsRef.current = ts;
      const realDt = Math.min((ts - last) / 1000, 0.05); // clamp big gaps
      const simDt = realDt * timeScaleRef.current;
      if (simDt <= 0) return;

      const nSteps = Math.min(Math.max(Math.ceil(simDt / MAX_DT), 1), MAX_SUBSTEPS);
      const stepDt = simDt / nSteps;
      let res = result;
      for (let i = 0; i < nSteps; i += 1) {
        timeRef.current += stepDt;
        res = solveStep(schematicRef.current, reactiveRef.current, {
          dt: stepDt,
          time: timeRef.current,
        });
        recordTraces(res, timeRef.current);
      }
      setResult(res);
      setTime(timeRef.current);
      forceFrame((f) => (f + 1) % 1_000_000);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordTraces]);

  const reset = useCallback(() => {
    reactiveRef.current = seedReactiveState(schematicRef.current);
    timeRef.current = 0;
    tracesRef.current = new Map();
    setTime(0);
    const clone = cloneReactive(reactiveRef.current);
    setResult(solveStep(schematicRef.current, clone, { dt: MAX_DT, time: 0 }));
  }, []);

  const loadSchematic = useCallback((s: Schematic) => {
    setSchematic(s);
    schematicRef.current = s;
    reactiveRef.current = seedReactiveState(s);
    timeRef.current = 0;
    tracesRef.current = new Map();
    setTime(0);
    setProbes([]);
    const clone = cloneReactive(reactiveRef.current);
    setResult(solveStep(s, clone, { dt: MAX_DT, time: 0 }));
  }, []);

  const addComponent = useCallback(
    (kind: ComponentKind, x: number, y: number, rotation: Rotation = 0, length?: number): string => {
      const id = makeId(kind);
      const params = defaultParamsFor(kind);
      const comp: CircuitComponent = {
        id,
        kind,
        x,
        y,
        rotation,
        length: kind === 'ground' ? 0 : (length ?? DEFAULT_LENGTH),
        ...params,
      };
      setSchematic((prev) => ({ ...prev, components: [...prev.components, comp] }));
      return id;
    },
    [],
  );

  const updateComponent = useCallback((id: string, patch: Partial<CircuitComponent>) => {
    setSchematic((prev) => ({
      ...prev,
      components: prev.components.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
  }, []);

  const moveComponent = useCallback((id: string, x: number, y: number) => {
    setSchematic((prev) => ({
      ...prev,
      components: prev.components.map((c) => (c.id === id ? { ...c, x, y } : c)),
    }));
  }, []);

  const rotateComponent = useCallback((id: string, delta: number) => {
    setSchematic((prev) => ({
      ...prev,
      components: prev.components.map((c) =>
        c.id === id ? { ...c, rotation: rotate(c.rotation, delta) as Rotation } : c,
      ),
    }));
  }, []);

  const removeComponent = useCallback((id: string) => {
    setSchematic((prev) => ({
      ...prev,
      components: prev.components.filter((c) => c.id !== id),
    }));
    setProbes((prev) => prev.filter((p) => p.componentId !== id));
  }, []);

  const addWire = useCallback((a: Wire['a'], b: Wire['b']) => {
    if (a.x === b.x && a.y === b.y) return;
    setSchematic((prev) => ({
      ...prev,
      wires: [...prev.wires, { id: makeId('wire'), a, b }],
    }));
  }, []);

  const removeWire = useCallback((id: string) => {
    setSchematic((prev) => ({ ...prev, wires: prev.wires.filter((w) => w.id !== id) }));
  }, []);

  const setSettings = useCallback((patch: Partial<Schematic['settings']>) => {
    setSchematic((prev) => ({ ...prev, settings: { ...prev.settings, ...patch } }));
  }, []);

  const addProbe = useCallback((componentId: string, signal: ProbeSignal) => {
    setProbes((prev) => {
      if (prev.some((p) => p.componentId === componentId && p.signal === signal)) return prev;
      const color = PROBE_COLORS[prev.length % PROBE_COLORS.length];
      return [...prev, { id: makeId('probe'), componentId, signal, color }];
    });
  }, []);

  const removeProbe = useCallback((id: string) => {
    setProbes((prev) => prev.filter((p) => p.id !== id));
    tracesRef.current.delete(id);
  }, []);

  const clearTraces = useCallback(() => {
    tracesRef.current = new Map();
  }, []);

  const toggleRunning = useCallback(() => setRunning((r) => !r), []);

  const traces = useMemo(() => {
    // Recreated each render so consumers see the latest ring buffers.
    const snapshot = new Map<string, TracePoint[]>();
    for (const [k, v] of tracesRef.current) snapshot.set(k, v.slice());
    return snapshot;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, probes]);

  return {
    schematic,
    result,
    running,
    time,
    timeScale,
    probes,
    traces,
    setRunning,
    toggleRunning,
    setTimeScale,
    reset,
    loadSchematic,
    addComponent,
    updateComponent,
    moveComponent,
    rotateComponent,
    removeComponent,
    addWire,
    removeWire,
    setSettings,
    addProbe,
    removeProbe,
    clearTraces,
  };
}
