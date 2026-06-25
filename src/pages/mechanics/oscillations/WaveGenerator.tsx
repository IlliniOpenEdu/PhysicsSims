// id="wave_generator"
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { SliderWithInput } from '../../../components/SliderWithInput';
import { ConceptBox } from '../../../components/ConceptBox';

type ControlsState = {
  amplitude: number;
  frequencyHz: number;
  waveSpeedMps: number;
  probeXM: number;
};

type WaveParams = {
  amplitude: number;
  frequencyHz: number;
  waveSpeedMps: number;
  periodS: number;
  wavelengthM: number;
  omega: number;
  k: number;
};

type UiSnapshot = WaveParams & {
  simTime: number;
  probeDisplacement: number;
};

type TimeHistoryPoint = { t: number; y: number };

const DEFAULT_CONTROLS: ControlsState = {
  amplitude: 1.2,
  frequencyHz: 2,
  waveSpeedMps: 10,
  probeXM: 5,
};

const MIN_AMPLITUDE = 0.1;
const MAX_AMPLITUDE = 5;
const MIN_FREQUENCY = 0.1;
const MAX_FREQUENCY = 10;
const MIN_SPEED = 1;
const MAX_SPEED = 50;

const STRING_LENGTH_M = 14;
const CANVAS_W = 720;
const CANVAS_H = 360;
const MARGIN_X = 48;
const EQUILIBRIUM_Y = CANVAS_H / 2;
const Y_SCALE_PX = 28;

const WAVE_POINTS = 220;
const UI_PUSH_MS = 100;
const HISTORY_WINDOW_S = 6;
const MAX_HISTORY_POINTS = Math.ceil((HISTORY_WINDOW_S * 1000) / UI_PUSH_MS) + 2;

const CHART_W = 360;
const CHART_H = 160;
const CHART_PAD = { top: 16, right: 12, bottom: 24, left: 42 };

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function roundTo2(n: number): number {
  return Math.round(n * 100) / 100;
}

function waveParamsFromControls(c: ControlsState): WaveParams {
  const frequencyHz = clamp(c.frequencyHz, MIN_FREQUENCY, MAX_FREQUENCY);
  const waveSpeedMps = clamp(c.waveSpeedMps, MIN_SPEED, MAX_SPEED);
  const amplitude = clamp(c.amplitude, MIN_AMPLITUDE, MAX_AMPLITUDE);
  const periodS = frequencyHz > 0 ? 1 / frequencyHz : 0;
  const wavelengthM = frequencyHz > 0 ? waveSpeedMps / frequencyHz : 0;
  const omega = 2 * Math.PI * frequencyHz;
  const k = waveSpeedMps > 0 ? omega / waveSpeedMps : 0;
  return { amplitude, frequencyHz, waveSpeedMps, periodS, wavelengthM, omega, k };
}

function displacementAt(xM: number, t: number, p: WaveParams): number {
  return p.amplitude * Math.sin(p.k * xM - p.omega * t);
}

function xToCanvas(xM: number): number {
  const innerW = CANVAS_W - 2 * MARGIN_X;
  return MARGIN_X + (xM / STRING_LENGTH_M) * innerW;
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
  p: WaveParams,
  t: number,
  yMin: number,
  yMax: number,
): string {
  const { innerW, innerH } = chartInnerDims();
  const ySpan = Math.max(1e-6, yMax - yMin);
  const xChart = (xM: number) => CHART_PAD.left + (xM / STRING_LENGTH_M) * innerW;
  const yChart = (yM: number) => CHART_PAD.top + innerH - ((yM - yMin) / ySpan) * innerH;

  const parts: string[] = [];
  for (let i = 0; i <= WAVE_POINTS; i++) {
    const xM = (i / WAVE_POINTS) * STRING_LENGTH_M;
    const yM = displacementAt(xM, t, p);
    parts.push(`${i === 0 ? 'M' : 'L'} ${xChart(xM).toFixed(1)} ${yChart(yM).toFixed(1)}`);
  }
  return parts.join(' ');
}

function timeSeriesPathD(
  series: TimeHistoryPoint[],
  windowS: number,
  yMin: number,
  yMax: number,
): string {
  if (series.length === 0) return '';
  const tEnd = series[series.length - 1].t;
  const tStart = Math.max(0, tEnd - windowS);
  const windowSeries = series.filter((pt) => pt.t >= tStart);
  if (windowSeries.length === 0) return '';

  const { innerW, innerH } = chartInnerDims();
  const ySpan = Math.max(1e-6, yMax - yMin);
  const tSpan = Math.max(0.25, tEnd - tStart);
  const x = (t: number) => CHART_PAD.left + ((t - tStart) / tSpan) * innerW;
  const y = (v: number) => CHART_PAD.top + innerH - ((v - yMin) / ySpan) * innerH;

  return windowSeries
    .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${x(pt.t).toFixed(1)} ${y(pt.y).toFixed(1)}`)
    .join(' ');
}

function markerPositions(
  p: WaveParams,
  t: number,
  kind: 'crest' | 'trough',
): number[] {
  if (p.k <= 0) return [];
  const phase = kind === 'crest' ? Math.PI / 2 : (3 * Math.PI) / 2;
  const xs: number[] = [];
  const nMin = Math.floor((p.k * 0 - p.omega * t - phase) / (2 * Math.PI)) - 1;
  const nMax = Math.ceil((p.k * STRING_LENGTH_M - p.omega * t - phase) / (2 * Math.PI)) + 1;
  for (let n = nMin; n <= nMax; n++) {
    const xM = (phase + p.omega * t + 2 * Math.PI * n) / p.k;
    if (xM >= 0 && xM <= STRING_LENGTH_M) xs.push(xM);
  }
  return xs;
}

export function WaveGenerator() {
  const [controls, setControls] = useState<ControlsState>(DEFAULT_CONTROLS);
  const [isRunning, setIsRunning] = useState(true);

  const controlsRef = useRef(controls);
  const isRunningRef = useRef(true);
  const simTimeRef = useRef(0);
  const animationFrameIdRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);
  const lastUiPushRef = useRef(0);

  const wavePathRef = useRef<SVGPathElement | null>(null);
  const equilibriumLineRef = useRef<SVGLineElement | null>(null);
  const sourceMarkerRef = useRef<SVGCircleElement | null>(null);
  const probeCircleRef = useRef<SVGCircleElement | null>(null);
  const probeLineRef = useRef<SVGLineElement | null>(null);
  const crestGroupRef = useRef<SVGGElement | null>(null);
  const troughGroupRef = useRef<SVGGElement | null>(null);
  const positionGraphPathRef = useRef<SVGPathElement | null>(null);
  const timeGraphPathRef = useRef<SVGPathElement | null>(null);

  const timeHistoryRef = useRef<TimeHistoryPoint[]>([]);

  const initialParams = waveParamsFromControls(DEFAULT_CONTROLS);
  const [ui, setUi] = useState<UiSnapshot>(() => ({
    ...initialParams,
    simTime: 0,
    probeDisplacement: displacementAt(DEFAULT_CONTROLS.probeXM, 0, initialParams),
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
    (group: SVGGElement | null, xs: number[], t: number, p: WaveParams, fill: string) => {
      if (!group) return;
      while (group.firstChild) group.removeChild(group.firstChild);
      for (const xM of xs) {
        const yM = displacementAt(xM, t, p);
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', xToCanvas(xM).toFixed(1));
        circle.setAttribute('cy', yToCanvas(yM).toFixed(1));
        circle.setAttribute('r', '5');
        circle.setAttribute('fill', fill);
        circle.setAttribute('stroke', '#0f172a');
        circle.setAttribute('stroke-width', '1');
        group.appendChild(circle);
      }
    },
    [],
  );

  const updateCanvasVisual = useCallback(() => {
    const c = controlsRef.current;
    const p = waveParamsFromControls(c);
    const t = simTimeRef.current;
    const probeX = clamp(c.probeXM, 0, STRING_LENGTH_M);
    const probeY = displacementAt(probeX, t, p);

    const parts: string[] = [];
    for (let i = 0; i <= WAVE_POINTS; i++) {
      const xM = (i / WAVE_POINTS) * STRING_LENGTH_M;
      const yM = displacementAt(xM, t, p);
      const cx = xToCanvas(xM);
      const cy = yToCanvas(yM);
      parts.push(`${i === 0 ? 'M' : 'L'} ${cx.toFixed(1)} ${cy.toFixed(1)}`);
    }
    wavePathRef.current?.setAttribute('d', parts.join(' '));

    equilibriumLineRef.current?.setAttribute('x1', MARGIN_X.toFixed(1));
    equilibriumLineRef.current?.setAttribute('x2', (CANVAS_W - MARGIN_X).toFixed(1));
    equilibriumLineRef.current?.setAttribute('y1', EQUILIBRIUM_Y.toFixed(1));
    equilibriumLineRef.current?.setAttribute('y2', EQUILIBRIUM_Y.toFixed(1));

    sourceMarkerRef.current?.setAttribute('cx', xToCanvas(0).toFixed(1));
    sourceMarkerRef.current?.setAttribute('cy', yToCanvas(displacementAt(0, t, p)).toFixed(1));

    probeCircleRef.current?.setAttribute('cx', xToCanvas(probeX).toFixed(1));
    probeCircleRef.current?.setAttribute('cy', yToCanvas(probeY).toFixed(1));
    probeLineRef.current?.setAttribute('x1', xToCanvas(probeX).toFixed(1));
    probeLineRef.current?.setAttribute('y1', EQUILIBRIUM_Y.toFixed(1));
    probeLineRef.current?.setAttribute('x2', xToCanvas(probeX).toFixed(1));
    probeLineRef.current?.setAttribute('y2', yToCanvas(probeY).toFixed(1));

    updateMarkerGroup(crestGroupRef.current, markerPositions(p, t, 'crest'), t, p, '#fbbf24');
    updateMarkerGroup(troughGroupRef.current, markerPositions(p, t, 'trough'), t, p, '#38bdf8');

    const posYs: number[] = [];
    for (let i = 0; i <= 80; i++) {
      posYs.push(displacementAt((i / 80) * STRING_LENGTH_M, t, p));
    }
    const posRange = rangeFromValues(posYs, p.amplitude || 1);
    positionGraphPathRef.current?.setAttribute(
      'd',
      positionSeriesPathD(p, t, posRange.min, posRange.max),
    );
  }, [updateMarkerGroup]);

  const updateGraphVisuals = useCallback(() => {
    const c = controlsRef.current;
    const p = waveParamsFromControls(c);
    const t = simTimeRef.current;

    const windowSeries = timeHistoryRef.current.filter(
      (pt) => pt.t >= Math.max(0, t - HISTORY_WINDOW_S),
    );
    const timeYs = windowSeries.map((pt) => pt.y);
    const timeRange = rangeFromValues(
      timeYs.length > 0 ? timeYs : [-p.amplitude, p.amplitude],
      p.amplitude || 1,
    );
    timeGraphPathRef.current?.setAttribute(
      'd',
      timeSeriesPathD(timeHistoryRef.current, HISTORY_WINDOW_S, timeRange.min, timeRange.max),
    );
  }, []);

  const pushThrottledUpdates = useCallback(() => {
    const c = controlsRef.current;
    const p = waveParamsFromControls(c);
    const t = simTimeRef.current;
    const probeX = clamp(c.probeXM, 0, STRING_LENGTH_M);
    const probeY = displacementAt(probeX, t, p);

    setUi({
      ...p,
      simTime: t,
      probeDisplacement: probeY,
    });

    const hist = timeHistoryRef.current;
    hist.push({ t, y: probeY });
    const tCutoff = t - HISTORY_WINDOW_S;
    while (hist.length > MAX_HISTORY_POINTS || (hist.length > 1 && hist[0].t < tCutoff)) {
      hist.shift();
    }
    updateGraphVisuals();
  }, [updateGraphVisuals]);

  const resetSimulation = useCallback(() => {
    simTimeRef.current = 0;
    lastUiPushRef.current = 0;
    timeHistoryRef.current = [];

    const p = waveParamsFromControls(controlsRef.current);
    const probeY = displacementAt(controlsRef.current.probeXM, 0, p);
    setUi({ ...p, simTime: 0, probeDisplacement: probeY });

    requestAnimationFrame(() => {
      updateCanvasVisual();
      updateGraphVisuals();
    });
  }, [updateCanvasVisual, updateGraphVisuals]);

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
    updateGraphVisuals();
  }, [controls, updateCanvasVisual, updateGraphVisuals]);

  const handleControlChange = (patch: Partial<ControlsState>) => {
    const next = { ...controlsRef.current, ...patch };
    if (patch.probeXM !== undefined) {
      next.probeXM = clamp(patch.probeXM, 0, STRING_LENGTH_M);
    }
    setControls(next);
    controlsRef.current = next;
    updateCanvasVisual();
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

  const viewParams = waveParamsFromControls(controls);

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-8 text-slate-100">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-400">
            Oscillations &amp; waves
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
            Wave Generator
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-300">
            A traveling transverse wave on a string — tune amplitude, frequency, and speed to see how
            crests propagate and how <span className="font-mono text-rose-200">v = fλ</span> links the
            wave quantities.
          </p>
        </div>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-sky-500 hover:text-sky-100"
        >
          ← Dashboard
        </Link>
      </header>

      <main className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/40">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold tracking-wide text-rose-300">Wave canvas</h2>
              <p className="mt-1 text-xs text-slate-400">
                Source at left · wave travels right · yellow = crests · blue = troughs
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

          <div className="mt-4 overflow-hidden rounded-xl border border-slate-800 bg-slate-950/80 p-3">
            <svg viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`} className="mx-auto h-auto w-full max-h-[22rem]">
              <rect x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill="#020617" />
              <line
                ref={equilibriumLineRef}
                stroke="rgba(100,116,139,0.45)"
                strokeWidth={1.5}
                strokeDasharray="6 5"
              />
              <text x={MARGIN_X} y={EQUILIBRIUM_Y + 22} fill="#64748b" fontSize={10}>
                equilibrium
              </text>
              <text x={MARGIN_X - 4} y={28} fill="#94a3b8" fontSize={10}>
                source
              </text>
              <path
                ref={wavePathRef}
                fill="none"
                stroke="#fb7185"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <g ref={crestGroupRef} />
              <g ref={troughGroupRef} />
              <circle ref={sourceMarkerRef} r={7} fill="#f43f5e" stroke="#fecdd3" strokeWidth={2} />
              <line
                ref={probeLineRef}
                stroke="rgba(167,139,250,0.55)"
                strokeWidth={1.5}
                strokeDasharray="4 3"
              />
              <circle ref={probeCircleRef} r={8} fill="#a78bfa" stroke="#f8fafc" strokeWidth={2} />
              <text x={CANVAS_W - MARGIN_X - 8} y={CANVAS_H - 14} textAnchor="end" fill="#64748b" fontSize={10}>
                x → ({STRING_LENGTH_M} m)
              </text>
            </svg>
          </div>

          <div className="mt-3 rounded-lg border border-rose-900/50 bg-rose-950/30 px-4 py-3 text-center">
            <p className="text-xs font-medium uppercase tracking-wider text-rose-300/80">Wave relation</p>
            <p className="mt-1 font-mono text-lg text-rose-100">
              v = fλ = {roundTo2(viewParams.waveSpeedMps)} = {roundTo2(viewParams.frequencyHz)} ×{' '}
              {roundTo2(viewParams.wavelengthM)}
            </p>
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-950/80 p-5 shadow-lg shadow-slate-950/40">
          <h2 className="text-sm font-semibold tracking-wide text-rose-300">Controls</h2>

          <SliderWithInput
            label="Amplitude (A)"
            units="m"
            min={MIN_AMPLITUDE}
            max={MAX_AMPLITUDE}
            step={0.1}
            value={controls.amplitude}
            onChange={(v) => handleControlChange({ amplitude: v })}
            queryKey='amp'
          />
          <SliderWithInput
            label="Frequency (f)"
            units="Hz"
            min={MIN_FREQUENCY}
            max={MAX_FREQUENCY}
            step={0.1}
            value={controls.frequencyHz}
            onChange={(v) => handleControlChange({ frequencyHz: v })}
            syncToUrl={true}
            queryKey='freq'
          />
          <SliderWithInput
            label="Wave speed (v)"
            units="m/s"
            min={MIN_SPEED}
            max={MAX_SPEED}
            step={0.5}
            value={controls.waveSpeedMps}
            onChange={(v) => handleControlChange({ waveSpeedMps: v })}
            syncToUrl={true}
            queryKey='speed'
          />
          <SliderWithInput
            label="Probe position (time graph)"
            units="m"
            min={0}
            max={STRING_LENGTH_M}
            step={0.1}
            value={controls.probeXM}
            description="Highlighted bead — displacement vs time is recorded here"
            onChange={(v) => handleControlChange({ probeXM: v })}
            syncToUrl={true}
            queryKey='probe'
          />
        </section>
      </main>

      <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
        <h2 className="text-sm font-semibold tracking-wide text-rose-300">Real-time data</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
          <StatChip label="Amplitude A" value={`${roundTo2(ui.amplitude)} m`} />
          <StatChip label="Frequency f" value={`${roundTo2(ui.frequencyHz)} Hz`} />
          <StatChip label="Period T" value={`${roundTo2(ui.periodS)} s`} />
          <StatChip label="Wavelength λ" value={`${roundTo2(ui.wavelengthM)} m`} />
          <StatChip label="Wave speed v" value={`${roundTo2(ui.waveSpeedMps)} m/s`} />
          <StatChip
            label="Probe displacement"
            value={`${roundTo2(ui.probeDisplacement)} m`}
          />
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
        <h2 className="text-sm font-semibold tracking-wide text-rose-300">Graphs</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
            <p className="text-xs font-semibold text-slate-200">Displacement vs position</p>
            <p className="mt-0.5 text-[0.65rem] text-slate-400">y(x) snapshot at current time</p>
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
            <p className="text-xs font-semibold text-slate-200">Displacement vs time</p>
            <p className="mt-0.5 text-[0.65rem] text-slate-400">
              y(t) at probe · last {HISTORY_WINDOW_S} s
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
                ref={timeGraphPathRef}
                fill="none"
                stroke="#a78bfa"
                strokeWidth={1.7}
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
      </section>

      <ConceptBox
        heading="Key ideas"
        items={[
          {
            title: 'Transverse waves',
            description:
              'Each point on the string oscillates perpendicular to the direction of propagation. The disturbance travels right while individual particles move up and down about equilibrium.',
          },
          {
            title: 'Amplitude',
            description:
              'Amplitude A is the maximum displacement from equilibrium. Larger A means taller crests and deeper troughs without changing how fast the pattern moves along the string.',
          },
          {
            title: 'Frequency and period',
            description:
              'Frequency f counts oscillation cycles per second (Hz). Period T = 1/f is the time for one full cycle at a fixed point on the string.',
          },
          {
            title: 'Wavelength',
            description:
              'Wavelength λ is the spatial length of one full cycle — crest to crest along the string at a single instant.',
          },
          {
            title: 'Wave speed',
            description:
              'Wave speed v tells how fast the pattern travels. For sinusoidal waves on a string, v = fλ: speed equals frequency times wavelength.',
          },
          {
            title: 'Why higher f means shorter λ (fixed v)',
            description:
              'If v stays constant, raising f packs more cycles into each second of travel, so each cycle must fit in a shorter distance — λ must shrink. Doubling f halves λ when v is unchanged.',
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
