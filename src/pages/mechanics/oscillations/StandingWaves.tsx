// id="standing_waves"
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { SliderWithInput } from '../../../components/SliderWithInput';
import { ConceptBox } from '../../../components/ConceptBox';

type ControlsState = {
  stringLengthM: number;
  waveSpeedMps: number;
  frequencyHz: number;
  amplitude: number;
  showTravelingWaves: boolean;
};

type ResonanceState = {
  harmonicN: number;
  fundamentalHz: number;
  resonantFrequencyHz: number;
  wavelengthM: number;
  isResonance: boolean;
  effectiveAmplitude: number;
  nodeCount: number;
  antinodeCount: number;
  detuningFraction: number;
};

type UiSnapshot = ResonanceState & {
  simTime: number;
  stringLengthM: number;
  waveSpeedMps: number;
  frequencyHz: number;
  driveAmplitude: number;
};

const DEFAULT_CONTROLS: ControlsState = {
  stringLengthM: 6,
  waveSpeedMps: 24,
  frequencyHz: 2,
  amplitude: 1.5,
  showTravelingWaves: false,
};

const MIN_LENGTH = 1;
const MAX_LENGTH = 20;
const MIN_SPEED = 1;
const MAX_SPEED = 100;
const MIN_FREQUENCY = 0.1;
const MAX_FREQUENCY = 20;
const MIN_AMPLITUDE = 0.1;
const MAX_AMPLITUDE = 5;

const CANVAS_W = 720;
const CANVAS_H = 380;
const MARGIN_X = 52;
const EQUILIBRIUM_Y = CANVAS_H / 2;
const Y_SCALE_PX = 26;

const WAVE_POINTS = 240;
const UI_PUSH_MS = 100;
const RESONANCE_TOLERANCE = 0.065;
const RESONANCE_Q = 14;

const CHART_W = 360;
const CHART_H = 160;
const CHART_PAD = { top: 16, right: 12, bottom: 24, left: 42 };

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function roundTo2(n: number): number {
  return Math.round(n * 100) / 100;
}

function computeResonance(
  stringLengthM: number,
  waveSpeedMps: number,
  frequencyHz: number,
  driveAmplitude: number,
): ResonanceState {
  const L = clamp(stringLengthM, MIN_LENGTH, MAX_LENGTH);
  const v = clamp(waveSpeedMps, MIN_SPEED, MAX_SPEED);
  const f = clamp(frequencyHz, MIN_FREQUENCY, MAX_FREQUENCY);
  const A = clamp(driveAmplitude, MIN_AMPLITUDE, MAX_AMPLITUDE);

  const fundamentalHz = L > 0 ? v / (2 * L) : 0;

  let harmonicN = 1;
  let resonantFrequencyHz = fundamentalHz;
  let detuningFraction = 1;
  if (fundamentalHz > 0) {
    for (let n = 1; n <= 12; n++) {
      const fN = n * fundamentalHz;
      const detune = Math.abs(f - fN) / fN;
      if (detune < detuningFraction) {
        detuningFraction = detune;
        harmonicN = n;
        resonantFrequencyHz = fN;
      }
    }
  }

  const wavelengthM = harmonicN > 0 ? (2 * L) / harmonicN : 0;
  const isResonance = detuningFraction < RESONANCE_TOLERANCE;
  const resonanceFactor =
    1 /
    (1 +
      Math.pow(
        (RESONANCE_Q * (f - resonantFrequencyHz)) / Math.max(resonantFrequencyHz, 1e-6),
        2,
      ));
  const effectiveAmplitude = A * (0.1 + 0.9 * resonanceFactor);

  return {
    harmonicN,
    fundamentalHz,
    resonantFrequencyHz,
    wavelengthM,
    isResonance,
    effectiveAmplitude,
    nodeCount: harmonicN + 1,
    antinodeCount: harmonicN,
    detuningFraction,
  };
}

function responseAmplitudeAt(
  f: number,
  L: number,
  v: number,
  driveAmp: number,
): number {
  const fundamentalHz = L > 0 ? v / (2 * L) : 0;
  if (fundamentalHz <= 0) return 0;
  let peak = 0;
  for (let n = 1; n <= 12; n++) {
    const fN = n * fundamentalHz;
    if (fN > MAX_FREQUENCY * 1.2) break;
    const resonanceFactor =
      1 / (1 + Math.pow((RESONANCE_Q * (f - fN)) / Math.max(fN, 1e-6), 2));
    peak = Math.max(peak, driveAmp * (0.1 + 0.9 * resonanceFactor));
  }
  return peak;
}

function displacementAt(
  xM: number,
  t: number,
  L: number,
  v: number,
  f: number,
  driveAmp: number,
  resonance: ResonanceState,
): number {
  const omega = 2 * Math.PI * f;
  const n = resonance.harmonicN;
  const kMode = (n * Math.PI) / L;
  const standing = resonance.effectiveAmplitude * Math.sin(kMode * xM) * Math.cos(omega * t);

  const offResonance = 1 - 1 / (1 + Math.pow((RESONANCE_Q * (f - resonance.resonantFrequencyHz)) / Math.max(resonance.resonantFrequencyHz, 1e-6), 2));
  const kDrive = v > 0 ? omega / v : 0;
  const traveling =
    driveAmp * offResonance * 0.65 * Math.sin(kDrive * xM - omega * t) * Math.sin((Math.PI * xM) / L);

  return standing + traveling;
}

function rightTravelingComponent(
  xM: number,
  t: number,
  L: number,
  f: number,
  resonance: ResonanceState,
): number {
  const omega = 2 * Math.PI * f;
  const k = (resonance.harmonicN * Math.PI) / L;
  return (resonance.effectiveAmplitude / 2) * Math.sin(k * xM - omega * t);
}

function leftTravelingComponent(
  xM: number,
  t: number,
  L: number,
  f: number,
  resonance: ResonanceState,
): number {
  const omega = 2 * Math.PI * f;
  const k = (resonance.harmonicN * Math.PI) / L;
  return (resonance.effectiveAmplitude / 2) * Math.sin(k * xM + omega * t);
}

function nodePositionsM(L: number, n: number): number[] {
  const xs: number[] = [];
  for (let k = 0; k <= n; k++) xs.push((k * L) / n);
  return xs;
}

function antinodePositionsM(L: number, n: number): number[] {
  const xs: number[] = [];
  for (let k = 0; k < n; k++) xs.push(((2 * k + 1) * L) / (2 * n));
  return xs;
}

function xToCanvas(xM: number, L: number): number {
  const innerW = CANVAS_W - 2 * MARGIN_X;
  return MARGIN_X + (xM / L) * innerW;
}

function yToCanvas(yM: number): number {
  return EQUILIBRIUM_Y - yM * Y_SCALE_PX;
}

function chartInnerDims() {
  return {
    innerW: CHART_W - CHART_PAD.left - CHART_PAD.right,
    innerH: CHART_H - CHART_PAD.top - CHART_PAD.bottom,
  };
}

function rangeFromValues(values: number[], fallbackPad: number): { min: number; max: number } {
  if (values.length === 0) return { min: -fallbackPad, max: fallbackPad };
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const pad = Math.max(fallbackPad * 0.12, (maxV - minV) * 0.12 || fallbackPad);
  return { min: minV - pad, max: maxV + pad };
}

function positionSeriesPathD(
  L: number,
  t: number,
  v: number,
  f: number,
  driveAmp: number,
  resonance: ResonanceState,
  yMin: number,
  yMax: number,
): string {
  const { innerW, innerH } = chartInnerDims();
  const ySpan = Math.max(1e-6, yMax - yMin);
  const xChart = (xM: number) => CHART_PAD.left + (xM / L) * innerW;
  const yChart = (yM: number) => CHART_PAD.top + innerH - ((yM - yMin) / ySpan) * innerH;

  const parts: string[] = [];
  for (let i = 0; i <= WAVE_POINTS; i++) {
    const xM = (i / WAVE_POINTS) * L;
    const yM = displacementAt(xM, t, L, v, f, driveAmp, resonance);
    parts.push(`${i === 0 ? 'M' : 'L'} ${xChart(xM).toFixed(1)} ${yChart(yM).toFixed(1)}`);
  }
  return parts.join(' ');
}

function resonanceCurvePathD(
  L: number,
  v: number,
  driveAmp: number,
  fMax: number,
  yMax: number,
): string {
  const { innerW, innerH } = chartInnerDims();
  const samples = 120;
  const xChart = (f: number) => CHART_PAD.left + (f / fMax) * innerW;
  const yChart = (a: number) => CHART_PAD.top + innerH - (a / Math.max(yMax, 1e-6)) * innerH;

  const parts: string[] = [];
  for (let i = 0; i <= samples; i++) {
    const f = (i / samples) * fMax;
    const amp = responseAmplitudeAt(f, L, v, driveAmp);
    parts.push(`${i === 0 ? 'M' : 'L'} ${xChart(f).toFixed(1)} ${yChart(amp).toFixed(1)}`);
  }
  return parts.join(' ');
}

function harmonicLabel(n: number): string {
  if (n === 1) return 'Fundamental Mode (n = 1)';
  if (n === 2) return 'Second Harmonic (n = 2)';
  if (n === 3) return 'Third Harmonic (n = 3)';
  return `${n}th Harmonic (n = ${n})`;
}

export function StandingWaves() {
  const [controls, setControls] = useState<ControlsState>(DEFAULT_CONTROLS);
  const [isRunning, setIsRunning] = useState(true);

  const controlsRef = useRef(controls);
  const isRunningRef = useRef(true);
  const simTimeRef = useRef(0);
  const animationFrameIdRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);
  const lastUiPushRef = useRef(0);

  const stringPathRef = useRef<SVGPathElement | null>(null);
  const rightWavePathRef = useRef<SVGPathElement | null>(null);
  const leftWavePathRef = useRef<SVGPathElement | null>(null);
  const equilibriumLineRef = useRef<SVGLineElement | null>(null);
  const anchorLeftRef = useRef<SVGRectElement | null>(null);
  const anchorRightRef = useRef<SVGRectElement | null>(null);
  const nodeGroupRef = useRef<SVGGElement | null>(null);
  const antinodeGroupRef = useRef<SVGGElement | null>(null);
  const positionGraphPathRef = useRef<SVGPathElement | null>(null);
  const resonanceGraphPathRef = useRef<SVGPathElement | null>(null);
  const resonanceMarkerRef = useRef<SVGCircleElement | null>(null);

  const initialResonance = computeResonance(
    DEFAULT_CONTROLS.stringLengthM,
    DEFAULT_CONTROLS.waveSpeedMps,
    DEFAULT_CONTROLS.frequencyHz,
    DEFAULT_CONTROLS.amplitude,
  );
  const [ui, setUi] = useState<UiSnapshot>(() => ({
    ...initialResonance,
    simTime: 0,
    stringLengthM: DEFAULT_CONTROLS.stringLengthM,
    waveSpeedMps: DEFAULT_CONTROLS.waveSpeedMps,
    frequencyHz: DEFAULT_CONTROLS.frequencyHz,
    driveAmplitude: DEFAULT_CONTROLS.amplitude,
  }));

  useEffect(() => {
    controlsRef.current = controls;
  }, [controls]);

  useEffect(() => {
    return () => {
      if (animationFrameIdRef.current !== null) cancelAnimationFrame(animationFrameIdRef.current);
    };
  }, []);

  const updateMarkerGroup = useCallback(
    (
      group: SVGGElement | null,
      xs: number[],
      L: number,
      fill: string,
      label: string,
      radius: number,
    ) => {
      if (!group) return;
      while (group.firstChild) group.removeChild(group.firstChild);
      for (const xM of xs) {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', xToCanvas(xM, L).toFixed(1));
        line.setAttribute('x2', xToCanvas(xM, L).toFixed(1));
        line.setAttribute('y1', (EQUILIBRIUM_Y - 18).toFixed(1));
        line.setAttribute('y2', (EQUILIBRIUM_Y + 18).toFixed(1));
        line.setAttribute('stroke', fill);
        line.setAttribute('stroke-width', '2');
        line.setAttribute('stroke-linecap', 'round');
        g.appendChild(line);

        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', xToCanvas(xM, L).toFixed(1));
        circle.setAttribute('cy', EQUILIBRIUM_Y.toFixed(1));
        circle.setAttribute('r', radius.toFixed(1));
        circle.setAttribute('fill', fill);
        circle.setAttribute('stroke', '#0f172a');
        circle.setAttribute('stroke-width', '1');
        g.appendChild(circle);

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', xToCanvas(xM, L).toFixed(1));
        text.setAttribute('y', (EQUILIBRIUM_Y + 34).toFixed(1));
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('fill', fill);
        text.setAttribute('font-size', '9');
        text.textContent = label;
        g.appendChild(text);

        group.appendChild(g);
      }
    },
    [],
  );

  const buildWavePath = useCallback(
    (
      sampleFn: (xM: number) => number,
      L: number,
    ): string => {
      const parts: string[] = [];
      for (let i = 0; i <= WAVE_POINTS; i++) {
        const xM = (i / WAVE_POINTS) * L;
        const yM = sampleFn(xM);
        parts.push(
          `${i === 0 ? 'M' : 'L'} ${xToCanvas(xM, L).toFixed(1)} ${yToCanvas(yM).toFixed(1)}`,
        );
      }
      return parts.join(' ');
    },
    [],
  );

  const updateCanvasVisual = useCallback(() => {
    const c = controlsRef.current;
    const L = c.stringLengthM;
    const t = simTimeRef.current;
    const resonance = computeResonance(L, c.waveSpeedMps, c.frequencyHz, c.amplitude);

    stringPathRef.current?.setAttribute(
      'd',
      buildWavePath(
        (xM) => displacementAt(xM, t, L, c.waveSpeedMps, c.frequencyHz, c.amplitude, resonance),
        L,
      ),
    );

    if (c.showTravelingWaves) {
      rightWavePathRef.current?.setAttribute('visibility', 'visible');
      leftWavePathRef.current?.setAttribute('visibility', 'visible');
      rightWavePathRef.current?.setAttribute(
        'd',
        buildWavePath((xM) => rightTravelingComponent(xM, t, L, c.frequencyHz, resonance), L),
      );
      leftWavePathRef.current?.setAttribute(
        'd',
        buildWavePath((xM) => leftTravelingComponent(xM, t, L, c.frequencyHz, resonance), L),
      );
    } else {
      rightWavePathRef.current?.setAttribute('visibility', 'hidden');
      leftWavePathRef.current?.setAttribute('visibility', 'hidden');
    }

    equilibriumLineRef.current?.setAttribute('x1', xToCanvas(0, L).toFixed(1));
    equilibriumLineRef.current?.setAttribute('x2', xToCanvas(L, L).toFixed(1));
    equilibriumLineRef.current?.setAttribute('y1', EQUILIBRIUM_Y.toFixed(1));
    equilibriumLineRef.current?.setAttribute('y2', EQUILIBRIUM_Y.toFixed(1));

    const anchorW = 10;
    const anchorH = 22;
    anchorLeftRef.current?.setAttribute('x', (xToCanvas(0, L) - anchorW / 2).toFixed(1));
    anchorLeftRef.current?.setAttribute('y', (EQUILIBRIUM_Y - anchorH / 2).toFixed(1));
    anchorRightRef.current?.setAttribute('x', (xToCanvas(L, L) - anchorW / 2).toFixed(1));
    anchorRightRef.current?.setAttribute('y', (EQUILIBRIUM_Y - anchorH / 2).toFixed(1));

    updateMarkerGroup(
      nodeGroupRef.current,
      nodePositionsM(L, resonance.harmonicN),
      L,
      '#94a3b8',
      'N',
      4,
    );
    updateMarkerGroup(
      antinodeGroupRef.current,
      antinodePositionsM(L, resonance.harmonicN),
      L,
      '#fbbf24',
      'A',
      5,
    );

    const posYs: number[] = [];
    for (let i = 0; i <= 80; i++) {
      const xM = (i / 80) * L;
      posYs.push(displacementAt(xM, t, L, c.waveSpeedMps, c.frequencyHz, c.amplitude, resonance));
    }
    const posRange = rangeFromValues(posYs, c.amplitude || 1);
    positionGraphPathRef.current?.setAttribute(
      'd',
      positionSeriesPathD(
        L,
        t,
        c.waveSpeedMps,
        c.frequencyHz,
        c.amplitude,
        resonance,
        posRange.min,
        posRange.max,
      ),
    );
  }, [buildWavePath, updateMarkerGroup]);

  const updateResonanceGraph = useCallback(() => {
    const c = controlsRef.current;
    const L = c.stringLengthM;
    const fMax = MAX_FREQUENCY;
    const yMax = c.amplitude * 1.05;
    resonanceGraphPathRef.current?.setAttribute(
      'd',
      resonanceCurvePathD(L, c.waveSpeedMps, c.amplitude, fMax, yMax),
    );
    const markerAmp = responseAmplitudeAt(c.frequencyHz, L, c.waveSpeedMps, c.amplitude);
    const { innerW, innerH } = chartInnerDims();
    const cx = CHART_PAD.left + (c.frequencyHz / fMax) * innerW;
    const cy = CHART_PAD.top + innerH - (markerAmp / Math.max(yMax, 1e-6)) * innerH;
    resonanceMarkerRef.current?.setAttribute('cx', cx.toFixed(1));
    resonanceMarkerRef.current?.setAttribute('cy', cy.toFixed(1));
  }, []);

  const pushThrottledUpdates = useCallback(() => {
    const c = controlsRef.current;
    const resonance = computeResonance(
      c.stringLengthM,
      c.waveSpeedMps,
      c.frequencyHz,
      c.amplitude,
    );
    setUi({
      ...resonance,
      simTime: simTimeRef.current,
      stringLengthM: c.stringLengthM,
      waveSpeedMps: c.waveSpeedMps,
      frequencyHz: c.frequencyHz,
      driveAmplitude: c.amplitude,
    });
    updateResonanceGraph();
  }, [updateResonanceGraph]);

  const resetSimulation = useCallback(() => {
    simTimeRef.current = 0;
    lastUiPushRef.current = 0;
    const c = controlsRef.current;
    const resonance = computeResonance(
      c.stringLengthM,
      c.waveSpeedMps,
      c.frequencyHz,
      c.amplitude,
    );
    setUi({
      ...resonance,
      simTime: 0,
      stringLengthM: c.stringLengthM,
      waveSpeedMps: c.waveSpeedMps,
      frequencyHz: c.frequencyHz,
      driveAmplitude: c.amplitude,
    });
    requestAnimationFrame(() => {
      updateCanvasVisual();
      updateResonanceGraph();
    });
  }, [updateCanvasVisual, updateResonanceGraph]);

  const startLoopIfNeeded = useCallback(() => {
    if (animationFrameIdRef.current !== null) return;

    const step = (timestamp: number) => {
      if (!isRunningRef.current) {
        animationFrameIdRef.current = null;
        lastTimestampRef.current = null;
        return;
      }

      if (lastTimestampRef.current === null) {
        lastTimestampRef.current = timestamp;
        animationFrameIdRef.current = requestAnimationFrame(step);
        return;
      }

      const dt = (timestamp - lastTimestampRef.current) / 1000;
      lastTimestampRef.current = timestamp;
      simTimeRef.current += dt;

      updateCanvasVisual();

      const now = performance.now();
      if (now - lastUiPushRef.current >= UI_PUSH_MS) {
        lastUiPushRef.current = now;
        pushThrottledUpdates();
      }

      animationFrameIdRef.current = requestAnimationFrame(step);
    };

    animationFrameIdRef.current = requestAnimationFrame(step);
  }, [pushThrottledUpdates, updateCanvasVisual]);

  useEffect(() => {
    isRunningRef.current = isRunning;
    if (isRunning) startLoopIfNeeded();
  }, [isRunning, startLoopIfNeeded]);

  useEffect(() => {
    updateCanvasVisual();
    updateResonanceGraph();
  }, [controls, updateCanvasVisual, updateResonanceGraph]);

  const handleControlChange = (patch: Partial<ControlsState>) => {
    const next = { ...controlsRef.current, ...patch };
    setControls(next);
    controlsRef.current = next;
    updateCanvasVisual();
    updateResonanceGraph();
    pushThrottledUpdates();
  };

  const handleToggleRunning = () => {
    if (isRunningRef.current) {
      isRunningRef.current = false;
      setIsRunning(false);
      if (animationFrameIdRef.current !== null) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
      pushThrottledUpdates();
      return;
    }
    isRunningRef.current = true;
    setIsRunning(true);
  };

  const viewResonance = computeResonance(
    controls.stringLengthM,
    controls.waveSpeedMps,
    controls.frequencyHz,
    controls.amplitude,
  );

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-8 text-slate-100">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-400">
            Oscillations &amp; waves
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
            Standing Waves
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-300">
            A string fixed at both ends driven at selectable frequencies — watch nodes, antinodes,
            and resonance when the wavelength fits the length as a harmonic.
          </p>
        </div>
        <Link
          to="/211"
          className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-sky-500 hover:text-sky-100"
        >
          <span className="text-sm">←</span>
          Back to PHYS211
        </Link>
      </header>

      <main className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/40">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold tracking-wide text-rose-300">String canvas</h2>
              <p className="mt-1 text-xs text-slate-400">
                Fixed ends · N = node · A = antinode
                {controls.showTravelingWaves ? ' · dashed = component traveling waves' : ''}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleToggleRunning}
                className="rounded-full bg-rose-500 px-4 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-rose-400"
              >
                {isRunning ? 'Pause' : 'Play'}
              </button>
              <button
                type="button"
                onClick={resetSimulation}
                className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-[0.7rem] font-semibold text-slate-100 transition hover:border-slate-500"
              >
                Reset
              </button>
            </div>
          </div>

          {viewResonance.isResonance && (
            <div className="mt-3 rounded-lg border border-emerald-700/50 bg-emerald-950/40 px-4 py-2 text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
                Resonance detected
              </p>
              <p className="mt-0.5 text-sm text-emerald-100">{harmonicLabel(viewResonance.harmonicN)}</p>
            </div>
          )}

          <div className="mt-4 overflow-hidden rounded-xl border border-slate-800 bg-slate-950/80 p-3">
            <svg viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`} className="mx-auto h-auto w-full max-h-[24rem]">
              <rect x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill="#020617" />
              <line
                ref={equilibriumLineRef}
                stroke="rgba(100,116,139,0.4)"
                strokeWidth={1.5}
                strokeDasharray="6 5"
              />
              <rect
                ref={anchorLeftRef}
                width={10}
                height={22}
                rx={2}
                fill="#64748b"
                stroke="#cbd5e1"
                strokeWidth={1.5}
              />
              <rect
                ref={anchorRightRef}
                width={10}
                height={22}
                rx={2}
                fill="#64748b"
                stroke="#cbd5e1"
                strokeWidth={1.5}
              />
              <path
                ref={rightWavePathRef}
                fill="none"
                stroke="rgba(56,189,248,0.55)"
                strokeWidth={1.8}
                strokeDasharray="5 4"
                strokeLinecap="round"
                visibility="hidden"
              />
              <path
                ref={leftWavePathRef}
                fill="none"
                stroke="rgba(167,139,250,0.55)"
                strokeWidth={1.8}
                strokeDasharray="5 4"
                strokeLinecap="round"
                visibility="hidden"
              />
              <path
                ref={stringPathRef}
                fill="none"
                stroke="#fb7185"
                strokeWidth={2.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <g ref={nodeGroupRef} />
              <g ref={antinodeGroupRef} />
              <text x={MARGIN_X} y={28} fill="#94a3b8" fontSize={10}>
                fixed
              </text>
              <text x={CANVAS_W - MARGIN_X} y={28} textAnchor="end" fill="#94a3b8" fontSize={10}>
                fixed
              </text>
            </svg>
          </div>

          <p className="mt-3 text-center font-mono text-sm text-rose-200/90">
            f<sub>n</sub> = n · v / (2L) &nbsp;·&nbsp; λ<sub>n</sub> = 2L / n
          </p>
        </section>

        <section className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-950/80 p-5 shadow-lg shadow-slate-950/40">
          <h2 className="text-sm font-semibold tracking-wide text-rose-300">Controls</h2>

          <SliderWithInput
            label="String length (L)"
            units="m"
            min={MIN_LENGTH}
            max={MAX_LENGTH}
            step={0.1}
            value={controls.stringLengthM}
            onChange={(v) => handleControlChange({ stringLengthM: v })}
            queryKey="L"
          />
          <SliderWithInput
            label="Wave speed (v)"
            units="m/s"
            min={MIN_SPEED}
            max={MAX_SPEED}
            step={1}
            value={controls.waveSpeedMps}
            onChange={(v) => handleControlChange({ waveSpeedMps: v })}
            queryKey="v"
          />
          <SliderWithInput
            label="Driving frequency (f)"
            units="Hz"
            min={MIN_FREQUENCY}
            max={MAX_FREQUENCY}
            step={0.05}
            value={controls.frequencyHz}
            onChange={(v) => handleControlChange({ frequencyHz: v })}
            queryKey="f"
          />
          <SliderWithInput
            label="Drive amplitude"
            units="m"
            min={MIN_AMPLITUDE}
            max={MAX_AMPLITUDE}
            step={0.1}
            value={controls.amplitude}
            onChange={(v) => handleControlChange({ amplitude: v })}
            queryKey="amp"
          />

          <label className="inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={controls.showTravelingWaves}
              onChange={(e) => handleControlChange({ showTravelingWaves: e.target.checked })}
              className="rounded border-slate-600 bg-slate-900"
            />
            Show traveling waves (two counter-propagating components)
          </label>
        </section>
      </main>

      <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
        <h2 className="text-sm font-semibold tracking-wide text-rose-300">Real-time data</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <StatChip label="String length L" value={`${roundTo2(ui.stringLengthM)} m`} />
          <StatChip label="Wave speed v" value={`${roundTo2(ui.waveSpeedMps)} m/s`} />
          <StatChip label="Driving frequency f" value={`${roundTo2(ui.frequencyHz)} Hz`} />
          <StatChip label="Wavelength λ" value={`${roundTo2(ui.wavelengthM)} m`} />
          <StatChip label="Harmonic number n" value={`${ui.harmonicN}`} />
          <StatChip label="Nodes" value={`${ui.nodeCount}`} />
          <StatChip label="Antinodes" value={`${ui.antinodeCount}`} />
          <StatChip
            label="Response amplitude"
            value={`${roundTo2(ui.effectiveAmplitude)} m`}
          />
        </div>
        <p className="mt-3 text-xs text-slate-400">
          Nearest harmonic: {harmonicLabel(ui.harmonicN)} at f = {roundTo2(ui.resonantFrequencyHz)} Hz
          {ui.isResonance ? ' (matched)' : ` (off by ${roundTo2(ui.detuningFraction * 100)}%)`}
        </p>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
        <h2 className="text-sm font-semibold tracking-wide text-rose-300">Graphs</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
            <p className="text-xs font-semibold text-slate-200">Displacement vs position</p>
            <p className="mt-0.5 text-[0.65rem] text-slate-400">y(x) snapshot along the string</p>
            <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="mt-2 h-auto w-full">
              <line
                x1={CHART_PAD.left}
                y1={CHART_PAD.top}
                x2={CHART_PAD.left}
                y2={CHART_H - CHART_PAD.bottom}
                stroke="#475569"
                strokeWidth={0.7}
              />
              <line
                x1={CHART_PAD.left}
                y1={CHART_H - CHART_PAD.bottom}
                x2={CHART_W - CHART_PAD.right}
                y2={CHART_H - CHART_PAD.bottom}
                stroke="#475569"
                strokeWidth={0.7}
              />
              <path
                ref={positionGraphPathRef}
                fill="none"
                stroke="#fb7185"
                strokeWidth={1.7}
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
            <p className="text-xs font-semibold text-slate-200">Amplitude vs frequency</p>
            <p className="mt-0.5 text-[0.65rem] text-slate-400">
              Resonance peaks at f<sub>n</sub> = nv/(2L) · dot = current drive
            </p>
            <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="mt-2 h-auto w-full">
              <line
                x1={CHART_PAD.left}
                y1={CHART_PAD.top}
                x2={CHART_PAD.left}
                y2={CHART_H - CHART_PAD.bottom}
                stroke="#475569"
                strokeWidth={0.7}
              />
              <line
                x1={CHART_PAD.left}
                y1={CHART_H - CHART_PAD.bottom}
                x2={CHART_W - CHART_PAD.right}
                y2={CHART_H - CHART_PAD.bottom}
                stroke="#475569"
                strokeWidth={0.7}
              />
              <path
                ref={resonanceGraphPathRef}
                fill="none"
                stroke="#34d399"
                strokeWidth={1.5}
                strokeLinecap="round"
              />
              <circle ref={resonanceMarkerRef} r={5} fill="#fbbf24" stroke="#0f172a" strokeWidth={1} />
            </svg>
          </div>
        </div>
      </section>

      <ConceptBox
        heading="Key ideas"
        items={[
          {
            title: 'Standing waves',
            description:
              'A standing wave forms when two identical waves travel in opposite directions and interfere. The pattern oscillates in place instead of drifting along the string.',
          },
          {
            title: 'Nodes',
            description:
              'Nodes are positions that stay at equilibrium. On a string fixed at both ends, the ends are always nodes, and additional nodes appear between them for higher harmonics.',
          },
          {
            title: 'Antinodes',
            description:
              'Antinodes are points of maximum oscillation amplitude. They sit halfway between adjacent nodes for each resonant mode.',
          },
          {
            title: 'Resonance',
            description:
              'When the driving frequency matches a natural harmonic fₙ = nv/(2L), energy builds efficiently and a large stable standing wave appears. Off-resonance drives produce irregular, beating motion.',
          },
          {
            title: 'Harmonics and allowed wavelengths',
            description:
              'Fixed ends require y = 0 at x = 0 and x = L, so only wavelengths λₙ = 2L/n fit on the string. That is why only discrete frequencies resonate — the fundamental is f₁ = v/(2L), and higher harmonics are integer multiples.',
          },
        ]}
      />
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-900/70 px-3 py-2">
      <p className="text-[0.66rem] text-slate-400">{label}</p>
      <p className="mt-0.5 font-mono text-[0.78rem] text-rose-200">{value}</p>
    </div>
  );
}
