import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { SliderWithInput } from '../../components/SliderWithInput';
import { ConceptBox } from '../../components/ConceptBox';

type Mode = 'ideal' | 'lab';
type Phase = 'charge' | 'discharge';

type Settings = {
	resistanceOhm: number;
	capacitanceUf: number;
	sourceVoltage: number;
	initialChargeUc: number;
};

type Sample = {
	t: number;
	vc: number;
	vr: number;
	current: number;
	energy: number;
	probeA: number;
	probeB: number;
};

type Readouts = {
	vc: number;
	vr: number;
	current: number;
	energy: number;
	tau: number;
	probeA: number;
	probeB: number;
};

type ScopePoint = {
	t: number;
	value: number;
};

const DT = 0.04;
const TRACE_LIMIT = 240;
const GRAPH_WINDOW_SECONDS = 8;
const GRAPH_WIDTH = 560;
const GRAPH_HEIGHT = 220;
const GRAPH_PAD = 26;

const IDEAL_DEFAULTS: Settings = {
	resistanceOhm: 2200,
	capacitanceUf: 470,
	sourceVoltage: 9,
	initialChargeUc: 0,
};

const LAB_PRESET: Settings = {
	resistanceOhm: 4700,
	capacitanceUf: 680,
	sourceVoltage: 6,
	initialChargeUc: 1800,
};

const LAB_SENSOR_OFFSET = 0.018;
const LAB_SENSOR_NOISE = 0.028;

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

function randomNoise(amplitude: number) {
	return (Math.random() - 0.5) * amplitude * 2;
}

function computeActualSample(time: number, settings: Settings, phase: Phase) {
	const resistance = settings.resistanceOhm;
	const capacitance = settings.capacitanceUf * 1e-6;
	const sourceVoltage = settings.sourceVoltage;
	const initialVoltage = capacitance > 0 ? (settings.initialChargeUc * 1e-6) / capacitance : 0;
	const tau = Math.max(resistance * capacitance, 1e-6);

	if (phase === 'charge') {
		const vc = sourceVoltage + (initialVoltage - sourceVoltage) * Math.exp(-time / tau);
		const vr = sourceVoltage - vc;
		const current = vr / resistance;
		return {
			vc,
			vr,
			current,
			energy: 0.5 * capacitance * vc * vc,
			tau,
			probeA: sourceVoltage,
			probeB: vc,
		};
	}

	const vc = initialVoltage * Math.exp(-time / tau);
	const vr = -vc;
	const current = vr / resistance;
	return {
		vc,
		vr,
		current,
		energy: 0.5 * capacitance * vc * vc,
		tau,
		probeA: 0,
		probeB: vc,
	};
}

function applySensorModel(sample: ReturnType<typeof computeActualSample>) {
	return {
		...sample,
		vc: sample.vc + LAB_SENSOR_OFFSET + randomNoise(LAB_SENSOR_NOISE),
		vr: sample.vr - LAB_SENSOR_OFFSET * 0.45 + randomNoise(LAB_SENSOR_NOISE * 0.85),
		current: sample.current + randomNoise(0.00055),
		probeA: sample.probeA + randomNoise(0.02),
		probeB: sample.probeB + LAB_SENSOR_OFFSET + randomNoise(0.02),
	};
}

function buildSeries(points: Sample[], selector: (sample: Sample) => number): ScopePoint[] {
	return points.map((sample) => ({ t: sample.t, value: selector(sample) }));
}

type ScopeGraphProps = {
	title: string;
	unit: string;
	color: string;
	currentValue: number;
	currentTime: number;
	series: ScopePoint[];
	yMin: number;
	yMax: number;
};

function ScopeGraph({ title, unit, color, currentValue, currentTime, series, yMin, yMax }: ScopeGraphProps) {
	const graph = useMemo(() => {
		const gradientId = `${title.replace(/[^a-zA-Z0-9_-]/g, '')}-grid`;
		const startTime = Math.max(0, currentTime - GRAPH_WINDOW_SECONDS);
		const endTime = startTime + GRAPH_WINDOW_SECONDS;
		const safeSpan = Math.max(endTime - startTime, 0.001);
		const safeYSpan = Math.max(yMax - yMin, 0.001);

		const mapX = (t: number) => GRAPH_PAD + ((t - startTime) / safeSpan) * (GRAPH_WIDTH - GRAPH_PAD * 2);
		const mapY = (value: number) => GRAPH_HEIGHT - GRAPH_PAD - ((value - yMin) / safeYSpan) * (GRAPH_HEIGHT - GRAPH_PAD * 2);

		const filtered = series.filter((point) => point.t >= startTime - 0.001);
		const points = filtered.map((point) => `${mapX(point.t).toFixed(2)},${mapY(point.value).toFixed(2)}`).join(' ');
		const zeroY = yMin <= 0 && yMax >= 0 ? mapY(0) : null;

		return {
			points,
			zeroY,
			currentX: mapX(currentTime),
			currentY: mapY(currentValue),
			gradientId,
			startTime,
			endTime,
		};
	}, [currentTime, currentValue, series, yMax, yMin]);

	return (
		<div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3 shadow-md shadow-slate-950/25">
			<div className="flex items-baseline justify-between gap-3 px-1 pb-2">
				<div>
					<p className="text-sm font-semibold text-slate-50">{title}</p>
					<p className="text-[0.7rem] text-slate-400">oscilloscope view</p>
				</div>
				<p className="text-right text-xs text-slate-300">
					<span className="font-semibold text-slate-100">{currentValue.toFixed(2)}</span> {unit}
				</p>
			</div>

			<svg viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`} className="h-56 w-full rounded-lg border border-slate-800/80 bg-slate-950/90" role="img" aria-label={`${title} graph`}>
				<defs>
					<linearGradient id={graph.gradientId} x1="0" y1="0" x2="1" y2="1">
						<stop offset="0%" stopColor="rgba(15,23,42,0.9)" />
						<stop offset="100%" stopColor="rgba(2,6,23,0.98)" />
					</linearGradient>
				</defs>

				<rect x="0" y="0" width={GRAPH_WIDTH} height={GRAPH_HEIGHT} fill={`url(#${graph.gradientId})`} />

				{Array.from({ length: 10 }, (_, i) => {
					const x = GRAPH_PAD + (i * (GRAPH_WIDTH - GRAPH_PAD * 2)) / 9;
					return <line key={`gx-${i}`} x1={x} y1={GRAPH_PAD} x2={x} y2={GRAPH_HEIGHT - GRAPH_PAD} stroke="rgba(148,163,184,0.12)" strokeWidth="1" />;
				})}
				{Array.from({ length: 6 }, (_, i) => {
					const y = GRAPH_PAD + (i * (GRAPH_HEIGHT - GRAPH_PAD * 2)) / 5;
					return <line key={`gy-${i}`} x1={GRAPH_PAD} y1={y} x2={GRAPH_WIDTH - GRAPH_PAD} y2={y} stroke="rgba(148,163,184,0.12)" strokeWidth="1" />;
				})}

				{graph.zeroY !== null && (
					<line x1={GRAPH_PAD} y1={graph.zeroY} x2={GRAPH_WIDTH - GRAPH_PAD} y2={graph.zeroY} stroke="rgba(148,163,184,0.38)" strokeWidth="1.2" />
				)}

				<line x1={GRAPH_PAD} y1={GRAPH_PAD} x2={GRAPH_PAD} y2={GRAPH_HEIGHT - GRAPH_PAD} stroke="rgba(148,163,184,0.45)" strokeWidth="1.2" />
				<line x1={GRAPH_PAD} y1={GRAPH_HEIGHT - GRAPH_PAD} x2={GRAPH_WIDTH - GRAPH_PAD} y2={GRAPH_HEIGHT - GRAPH_PAD} stroke="rgba(148,163,184,0.45)" strokeWidth="1.2" />

				{graph.points.length > 0 && (
					<polyline points={graph.points} fill="none" stroke={color} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
				)}

				<circle cx={graph.currentX} cy={graph.currentY} r="4.5" fill={color} stroke="rgba(15,23,42,0.8)" strokeWidth="1.2" />
				<text x={32} y={28} fill="rgb(148 163 184)" fontSize="12">{unit}</text>
				<text x={GRAPH_WIDTH - 94} y={GRAPH_HEIGHT - 12} fill="rgb(148 163 184)" fontSize="11">time (s)</text>
			</svg>
		</div>
	);
}

export function RCCircuit() {
	const [mode, setMode] = useState<Mode>('ideal');
	const [phase, setPhase] = useState<Phase>('charge');
	const [running, setRunning] = useState(false);
	const [sensorNoiseEnabled, setSensorNoiseEnabled] = useState(true);

	const [resistanceOhm, setResistanceOhm] = useState(IDEAL_DEFAULTS.resistanceOhm);
	const [capacitanceUf, setCapacitanceUf] = useState(IDEAL_DEFAULTS.capacitanceUf);
	const [sourceVoltage, setSourceVoltage] = useState(IDEAL_DEFAULTS.sourceVoltage);
	const [initialChargeUc, setInitialChargeUc] = useState(IDEAL_DEFAULTS.initialChargeUc);

	const [time, setTime] = useState(0);
	const [trace, setTrace] = useState<Sample[]>([]);
	const [readouts, setReadouts] = useState<Readouts>(() => {
		const actual = computeActualSample(0, IDEAL_DEFAULTS, 'charge');
		return {
			vc: actual.vc,
			vr: actual.vr,
			current: actual.current,
			energy: actual.energy,
			tau: actual.tau,
			probeA: actual.probeA,
			probeB: actual.probeB,
		};
	});

	const timeRef = useRef(0);
	const modeRef = useRef<Mode>('ideal');
	const phaseRef = useRef<Phase>('charge');
	const sensorNoiseRef = useRef(true);
	const activeSettingsRef = useRef<Settings>(IDEAL_DEFAULTS);
	const stepRef = useRef<() => void>(() => undefined);
	const intervalRef = useRef<number | null>(null);

	const activeSettings = useMemo<Settings>(() => {
		if (mode === 'lab') return LAB_PRESET;
		return {
			resistanceOhm,
			capacitanceUf,
			sourceVoltage,
			initialChargeUc,
		};
	}, [mode, resistanceOhm, capacitanceUf, sourceVoltage, initialChargeUc]);

	const resetSimulation = () => {
		const nextActual = computeActualSample(0, activeSettingsRef.current, phaseRef.current);
		const nextSample = modeRef.current === 'lab' && sensorNoiseRef.current ? applySensorModel(nextActual) : nextActual;

		timeRef.current = 0;
		setTime(0);
		setTrace([]);
		setReadouts({
			vc: nextSample.vc,
			vr: nextSample.vr,
			current: nextSample.current,
			energy: nextActual.energy,
			tau: nextActual.tau,
			probeA: nextSample.probeA,
			probeB: nextSample.probeB,
		});
	};

	useEffect(() => {
		activeSettingsRef.current = activeSettings;
	}, [activeSettings]);

	useEffect(() => {
		modeRef.current = mode;
	}, [mode]);

	useEffect(() => {
		phaseRef.current = phase;
	}, [phase]);

	useEffect(() => {
		sensorNoiseRef.current = sensorNoiseEnabled;
	}, [sensorNoiseEnabled]);

	useEffect(() => {
		resetSimulation();
		// Keep the current play/pause state, but restart the waveform whenever the setup changes.
	}, [mode, phase, resistanceOhm, capacitanceUf, sourceVoltage, initialChargeUc, sensorNoiseEnabled]);

	stepRef.current = () => {
		const nextTime = timeRef.current + DT;
		const actual = computeActualSample(nextTime, activeSettingsRef.current, phaseRef.current);
		const measured = modeRef.current === 'lab' && sensorNoiseRef.current ? applySensorModel(actual) : actual;

		const nextSample: Sample = {
			t: nextTime,
			vc: measured.vc,
			vr: measured.vr,
			current: measured.current,
			energy: actual.energy,
			probeA: measured.probeA,
			probeB: measured.probeB,
		};

		timeRef.current = nextTime;
		setTime(nextTime);
		setReadouts({
			vc: nextSample.vc,
			vr: nextSample.vr,
			current: nextSample.current,
			energy: nextSample.energy,
			tau: actual.tau,
			probeA: nextSample.probeA,
			probeB: nextSample.probeB,
		});
		setTrace((prev) => {
			const updated = [...prev, nextSample];
			return updated.length > TRACE_LIMIT ? updated.slice(updated.length - TRACE_LIMIT) : updated;
		});
	};

	useEffect(() => {
		if (intervalRef.current !== null) {
			window.clearInterval(intervalRef.current);
			intervalRef.current = null;
		}

		if (!running) return;

		intervalRef.current = window.setInterval(() => {
			stepRef.current();
		}, DT * 1000);

		return () => {
			if (intervalRef.current !== null) {
				window.clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
		};
	}, [running]);

	useEffect(() => {
		return () => {
			if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
		};
	}, []);

	const currentValues = useMemo(() => {
		const settings = activeSettingsRef.current;
		const capacitanceF = settings.capacitanceUf * 1e-6;
		const initialVoltage = capacitanceF > 0 ? (settings.initialChargeUc * 1e-6) / capacitanceF : 0;
		const maxVoltage = Math.max(settings.sourceVoltage, initialVoltage, 0.5) * 1.15;
		const maxCurrent = Math.max(settings.sourceVoltage / Math.max(settings.resistanceOhm, 1), Math.abs(initialVoltage / Math.max(settings.resistanceOhm, 1)), 0.0005) * 1.25;

		return {
			capacitanceF,
			initialVoltage,
			maxVoltage,
			maxCurrent,
		};
	}, [activeSettings]);

	const measuredCurrentMa = readouts.current * 1000;
	const tauLabel = readouts.tau >= 1 ? `${readouts.tau.toFixed(2)} s` : `${(readouts.tau * 1000).toFixed(0)} ms`;
	const vcSeries = buildSeries(trace, (sample) => sample.vc);
	const vrSeries = buildSeries(trace, (sample) => sample.vr);
	const iSeries = buildSeries(trace, (sample) => sample.current * 1000);

	const boardMaxCharge = Math.max(Math.abs(readouts.vc), Math.abs(activeSettings.sourceVoltage), 0.5);
	const chargeFraction = clamp(Math.abs(readouts.vc) / boardMaxCharge, 0, 1);
	const currentDirection = readouts.current >= 0 ? 1 : -1;
	const activeWireColor = phase === 'charge' ? '#38bdf8' : '#f59e0b';
	const currentArrowColor = phase === 'charge' ? '#60a5fa' : '#fbbf24';
	const currentArrowStartX = currentDirection >= 0 ? 240 : 610;
	const currentArrowEndX = currentDirection >= 0 ? 610 : 240;

	const displaySettings = mode === 'lab' ? LAB_PRESET : {
		resistanceOhm,
		capacitanceUf,
		sourceVoltage,
		initialChargeUc,
	};

	const labNote = mode === 'lab'
		? 'Practical lab mode uses fixed bench values and noisy sensor readouts.'
		: 'Ideal mode lets you tune R, C, source voltage, and starting charge.';

	return (
		<div className="mx-auto flex min-h-screen max-w-[94rem] flex-col px-4 py-8 text-slate-100">
			<header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
				<div>
					<p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">ENM demo</p>
					<h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
						RC Circuit Lab
					</h1>
					<p className="mt-2 max-w-2xl text-sm text-slate-300">
						Breadboard-style RC charge/discharge simulator with voltage, current, probe, and oscilloscope-style traces.
					</p>
				</div>

				<div className="flex flex-wrap items-center gap-3">
					<Link
						to="/"
						className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-emerald-500 hover:text-emerald-100"
					>
						<span className="text-sm">←</span>
						Back to welcome
					</Link>
					<span className="inline-flex items-center gap-2 rounded-full border border-emerald-700/60 bg-emerald-900/50 px-3 py-1 text-[0.7rem] font-medium text-emerald-100">
						Time constant · probes · live scope
					</span>
				</div>
			</header>

			<main className="grid gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
				<section className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/40">
					<div className="pointer-events-none absolute inset-0 -z-10 opacity-70">
						<div className="absolute -left-32 top-0 h-64 w-64 rounded-full bg-sky-700/28 blur-3xl" />
						<div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-cyan-500/20 blur-3xl" />
					</div>

					<div className="mb-4 flex flex-wrap items-center gap-2">
						<button
							type="button"
							onClick={() => setMode('ideal')}
							className={`rounded-full px-3 py-1 text-xs font-medium transition ${mode === 'ideal' ? 'border border-emerald-400 bg-emerald-500/20 text-emerald-100' : 'border border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'}`}
						>
							Ideal mode
						</button>
						<button
							type="button"
							onClick={() => setMode('lab')}
							className={`rounded-full px-3 py-1 text-xs font-medium transition ${mode === 'lab' ? 'border border-sky-400 bg-sky-500/20 text-sky-100' : 'border border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'}`}
						>
							Practical lab mode
						</button>
					</div>

					<h2 className="text-sm font-semibold tracking-wide text-emerald-300">RC circuit</h2>
					<p className="mt-1 text-xs text-slate-300">
						Battery, switch, resistor, capacitor, and probe points A/B are all visible in the main circuit path.
					</p>

					<div className="mt-4 overflow-hidden rounded-xl border border-slate-800 bg-slate-950/70 p-4">
						<svg viewBox="0 0 940 360" className="h-[24rem] w-full rounded-lg border border-slate-800/70 bg-slate-950/80" role="img" aria-label="RC circuit visual">
							<defs>
								<pattern id="board-dots" width="20" height="20" patternUnits="userSpaceOnUse">
									<circle cx="10" cy="10" r="1.2" fill="rgba(148,163,184,0.12)" />
								</pattern>
								<marker id="rc-arrowhead" markerWidth="5" markerHeight="5" refX="4.1" refY="2.5" orient="auto" markerUnits="strokeWidth">
									<path d="M 0 0 L 5 2.5 L 0 5 z" fill={currentArrowColor} />
								</marker>
							</defs>

							<rect x="0" y="0" width="940" height="360" fill="rgba(2,6,23,0.98)" />
							<rect x="0" y="0" width="940" height="360" fill="url(#board-dots)" opacity="0.95" />

							<rect x="26" y="26" width="888" height="308" rx="20" fill="rgba(15,23,42,0.65)" stroke="rgba(51,65,85,0.8)" />

							<path d="M 100 102 H 198" stroke={activeWireColor} strokeWidth="5" strokeLinecap="round" opacity={phase === 'charge' ? 1 : 0.45} />
							<path d="M 240 102 H 338" stroke={activeWireColor} strokeWidth="5" strokeLinecap="round" opacity={1} />
							<path d="M 338 102 H 410" stroke={activeWireColor} strokeWidth="5" strokeLinecap="round" opacity={1} />
							<path d="M 518 102 H 702" stroke={activeWireColor} strokeWidth="5" strokeLinecap="round" opacity={1} />
							<path d="M 726 102 H 840" stroke={activeWireColor} strokeWidth="5" strokeLinecap="round" opacity={1} />
							<path d="M 840 102 V 252 H 100 V 102" stroke="rgba(148,163,184,0.7)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />

							<g>
								<rect x="84" y="128" width="32" height="128" rx="8" fill="rgba(30,41,59,0.92)" stroke="rgba(148,163,184,0.5)" />
								<line x1="100" y1="144" x2="100" y2="176" stroke="#f59e0b" strokeWidth="7" strokeLinecap="round" />
								<line x1="100" y1="180" x2="100" y2="222" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" />
								<text x="92" y="138" fontSize="16" fill="#fca5a5">+</text>
								<text x="92" y="272" fontSize="16" fill="#93c5fd">-</text>
								<text x="44" y="106" fontSize="12" fill="rgb(191 219 254)">Battery</text>
								<text x="40" y="120" fontSize="10" fill="rgb(148 163 184)">{displaySettings.sourceVoltage.toFixed(1)} V source</text>
							</g>

							<g>
								<circle cx="240" cy="102" r="8" fill="rgba(15,23,42,0.98)" stroke="rgba(96,165,250,0.9)" strokeWidth="2" />
								<circle cx="240" cy="102" r="3" fill="#60a5fa" />
								<line x1="240" y1="102" x2="276" y2="76" stroke={phase === 'charge' ? '#60a5fa' : '#fbbf24'} strokeWidth="4" strokeLinecap="round" />
								<circle cx="212" cy="102" r="5" fill="#e2e8f0" />
								<circle cx="268" cy="102" r="5" fill="#e2e8f0" />
								<text x="188" y="66" fontSize="13" fill="rgb(191 219 254)">Switch</text>
								<text x="166" y="82" fontSize="11" fill="rgb(148 163 184)">{phase === 'charge' ? 'closed / charging' : 'open / discharging'}</text>
							</g>

							<g>
								<path d="M 410 82 L 428 122 L 446 82 L 464 122 L 482 82 L 500 122 L 518 82" stroke="#f97316" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
								<text x="420" y="66" fontSize="13" fill="rgb(254 215 170)">Resistor</text>
								<text x="422" y="138" fontSize="11" fill="rgb(148 163 184)">{displaySettings.resistanceOhm.toFixed(0)} Ω</text>
							</g>

							<g>
								<line x1="702" y1="76" x2="702" y2="128" stroke="#22d3ee" strokeWidth="5" strokeLinecap="round" />
								<line x1="726" y1="76" x2="726" y2="128" stroke="#22d3ee" strokeWidth="5" strokeLinecap="round" />
								<rect x="684" y="74" width="60" height="58" rx="10" fill="rgba(15,118,110,0.15)" stroke="rgba(45,212,191,0.45)" />
								<rect x="692" y={76 + (1 - chargeFraction) * 50} width="44" height={8 + chargeFraction * 42} rx="8" fill="rgba(34,211,238,0.5)" />
								<text x="682" y="66" fontSize="13" fill="rgb(165 243 252)">Capacitor</text>
								<text x="678" y="146" fontSize="11" fill="rgb(148 163 184)">{displaySettings.capacitanceUf.toFixed(0)} μF</text>
							</g>

							<circle cx="240" cy="102" r="5" fill="#60a5fa" />
							<circle cx="750" cy="102" r="5" fill="#f8fafc" />
							<circle cx="516" cy="102" r="5" fill="#f8fafc" />

							<circle cx="516" cy="102" r="7" fill="rgba(14,165,233,0.12)" stroke="rgba(14,165,233,0.65)" strokeWidth="2" />
							<text x="508" y="96" fontSize="12" fill="#7dd3fc">A</text>
							<circle cx="750" cy="102" r="7" fill="rgba(34,211,238,0.12)" stroke="rgba(34,211,238,0.75)" strokeWidth="2" />
							<text x="742" y="96" fontSize="12" fill="#a5f3fc">B</text>

							<path
								d={`M ${currentArrowStartX} 58 H ${currentArrowEndX}`}
								stroke={currentArrowColor}
								strokeWidth="4"
								strokeLinecap="round"
								markerEnd="url(#rc-arrowhead)"
							/>
							<text x="388" y="50" fontSize="13" fill={currentArrowColor}>I</text>

							<g>
								<line x1="516" y1="110" x2="516" y2="258" stroke="rgba(125,211,252,0.24)" strokeWidth="1.2" strokeDasharray="3 3" />
								<line x1="750" y1="110" x2="750" y2="258" stroke="rgba(165,243,252,0.24)" strokeWidth="1.2" strokeDasharray="3 3" />
								<line x1="240" y1="110" x2="240" y2="258" stroke="rgba(148,163,184,0.2)" strokeWidth="1" strokeDasharray="3 3" />

								<text x="194" y="276" fontSize="11" fill="rgb(148 163 184)">Switch node</text>
								<text x="490" y="276" fontSize="11" fill="rgb(125 211 252)">Probe A</text>
								<text x="722" y="276" fontSize="11" fill="rgb(165 243 252)">Probe B</text>
							</g>

							<g>
								<rect x="640" y="290" width="270" height="52" rx="10" fill="rgba(15,23,42,0.8)" stroke="rgba(100,116,139,0.55)" />
								<text x="654" y="309" fontSize="11" fill="rgb(226 232 240)">Phase</text>
								<text x="654" y="326" fontSize="14" fill={phase === 'charge' ? '#7dd3fc' : '#fbbf24'}>{phase === 'charge' ? 'Charging' : 'Discharging'}</text>
								<text x="770" y="326" fontSize="10" fill="rgb(148 163 184)">{mode === 'lab' ? 'Lab mode: sensor active' : 'Ideal mode: clean model'}</text>
							</g>
						</svg>
					</div>

					<div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
						<div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
							<p className="text-[0.65rem] uppercase tracking-[0.14em] text-slate-400">VC</p>
							<p className="mt-1 text-lg font-semibold text-cyan-300">{readouts.vc.toFixed(2)} V</p>
						</div>
						<div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
							<p className="text-[0.65rem] uppercase tracking-[0.14em] text-slate-400">VR</p>
							<p className="mt-1 text-lg font-semibold text-amber-300">{readouts.vr.toFixed(2)} V</p>
						</div>
						<div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
							<p className="text-[0.65rem] uppercase tracking-[0.14em] text-slate-400">Current</p>
							<p className="mt-1 text-lg font-semibold text-emerald-300">{measuredCurrentMa.toFixed(2)} mA</p>
						</div>
						<div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
							<p className="text-[0.65rem] uppercase tracking-[0.14em] text-slate-400">Stored energy</p>
							<p className="mt-1 text-lg font-semibold text-violet-300">{readouts.energy.toExponential(2)} J</p>
						</div>
					</div>
				</section>

				<section className="flex min-h-[30rem] flex-col space-y-4 rounded-2xl border border-slate-800 bg-slate-950/80 p-5 shadow-lg shadow-slate-950/40">
					<div className="flex items-center justify-between gap-2">
						<h2 className="text-sm font-semibold tracking-wide text-sky-300">Controls</h2>
						<div className="flex items-center gap-2">
							<button
								type="button"
								onClick={() => setPhase('charge')}
								className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${phase === 'charge' ? 'border border-cyan-400 bg-cyan-500/20 text-cyan-100' : 'border border-slate-700 bg-slate-900 text-slate-300'}`}
							>
								Charge
							</button>
							<button
								type="button"
								onClick={() => setPhase('discharge')}
								className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${phase === 'discharge' ? 'border border-amber-400 bg-amber-500/20 text-amber-100' : 'border border-slate-700 bg-slate-900 text-slate-300'}`}
							>
								Discharge
							</button>
						</div>
					</div>

					<p className="text-xs text-slate-300">{labNote}</p>

					<div className="flex flex-wrap gap-2">
						<button
							type="button"
							onClick={() => setRunning((prev) => !prev)}
							className="rounded-lg border border-emerald-700/70 bg-emerald-900/40 px-3 py-2 text-xs font-medium text-emerald-100 transition hover:border-emerald-500"
						>
							{running ? 'Pause' : 'Run'}
						</button>
						<button
							type="button"
							onClick={() => {
								setRunning(false);
								resetSimulation();
							}}
							className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-200 transition hover:border-slate-500"
						>
							Reset
						</button>
					</div>

					{mode === 'lab' ? (
						<div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/90 p-3 text-sm text-slate-300">
							<p className="font-medium text-sky-200">Fixed lab values</p>
							<div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
								<div className="rounded-lg border border-slate-800 bg-slate-950/70 p-2">R = {LAB_PRESET.resistanceOhm.toFixed(0)} Ω</div>
								<div className="rounded-lg border border-slate-800 bg-slate-950/70 p-2">C = {LAB_PRESET.capacitanceUf.toFixed(0)} μF</div>
								<div className="rounded-lg border border-slate-800 bg-slate-950/70 p-2">Vs = {LAB_PRESET.sourceVoltage.toFixed(1)} V</div>
								<div className="rounded-lg border border-slate-800 bg-slate-950/70 p-2">Q0 = {LAB_PRESET.initialChargeUc.toFixed(0)} μC</div>
							</div>
							<button
								type="button"
								onClick={() => setSensorNoiseEnabled((prev) => !prev)}
								className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${sensorNoiseEnabled ? 'border border-sky-400 bg-sky-500/20 text-sky-100' : 'border border-slate-700 bg-slate-900 text-slate-300'}`}
							>
								{sensorNoiseEnabled ? 'Sensor mode' : 'Clean mode'}
							</button>
							<p className="text-[0.7rem] text-slate-400">
								Sensor bias: +{LAB_SENSOR_OFFSET.toFixed(3)} V, noise: ±{LAB_SENSOR_NOISE.toFixed(3)} V
							</p>
						</div>
					) : (
						<>
							<SliderWithInput
								label="Resistance R"
								min={100}
								max={10000}
								step={50}
								value={resistanceOhm}
								units="Ω"
								onChange={setResistanceOhm}
							/>
							<SliderWithInput
								label="Capacitance C"
								min={50}
								max={2200}
								step={10}
								value={capacitanceUf}
								units="μF"
								onChange={setCapacitanceUf}
							/>
							<SliderWithInput
								label="Source voltage"
								min={1}
								max={12}
								step={0.1}
								value={sourceVoltage}
								units="V"
								onChange={setSourceVoltage}
							/>
							<SliderWithInput
								label="Initial capacitor charge"
								min={0}
								max={5000}
								step={25}
								value={initialChargeUc}
								units="μC"
								onChange={setInitialChargeUc}
							/>
						</>
					)}

					<div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3 text-sm">
						<p className="text-slate-300">Time constant</p>
						<p className="mt-1 font-medium text-amber-200">τ = RC = {tauLabel}</p>
						<p className="mt-1 text-xs text-slate-400">
							Here R = {displaySettings.resistanceOhm.toFixed(0)} Ω and C = {displaySettings.capacitanceUf.toFixed(0)} μF.
						</p>
					</div>

					<div className="grid gap-3 sm:grid-cols-2">
						<div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3 text-sm">
							<p className="text-slate-300">Probe A</p>
							<p className="mt-1 font-medium text-sky-200">{readouts.probeA.toFixed(2)} V</p>
						</div>
						<div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3 text-sm">
							<p className="text-slate-300">Probe B</p>
							<p className="mt-1 font-medium text-cyan-200">{readouts.probeB.toFixed(2)} V</p>
						</div>
						<div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3 text-sm">
							<p className="text-slate-300">Capacitor voltage</p>
							<p className="mt-1 font-medium text-cyan-200">VC = {readouts.vc.toFixed(2)} V</p>
						</div>
						<div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3 text-sm">
							<p className="text-slate-300">Resistor voltage</p>
							<p className="mt-1 font-medium text-amber-200">VR = {readouts.vr.toFixed(2)} V</p>
						</div>
						<div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3 text-sm sm:col-span-2">
							<p className="text-slate-300">Current</p>
							<p className="mt-1 font-medium text-emerald-200">I = {measuredCurrentMa.toFixed(2)} mA</p>
							<p className="mt-1 text-xs text-slate-400">Time = {time.toFixed(2)} s</p>
						</div>
					</div>
				</section>

				<section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/40 lg:col-span-2">
					<div className="flex flex-wrap items-end justify-between gap-3">
						<div>
							<h2 className="text-sm font-semibold tracking-wide text-sky-300">Live graphs</h2>
							<p className="mt-1 text-xs text-slate-300">Oscilloscope-style traces for capacitor voltage, resistor voltage, and current.</p>
						</div>
						<p className="text-xs text-slate-400">Clean in ideal mode, sensor-biased in lab mode when enabled.</p>
					</div>

					<div className="mt-4 grid gap-4 lg:grid-cols-3">
						<ScopeGraph
							title="VC(t)"
							unit="V"
							color="rgb(34 211 238)"
							currentValue={readouts.vc}
							currentTime={time}
							series={vcSeries}
							yMin={-currentValues.maxVoltage * 0.15}
							yMax={currentValues.maxVoltage}
						/>
						<ScopeGraph
							title="VR(t)"
							unit="V"
							color="rgb(251 191 36)"
							currentValue={readouts.vr}
							currentTime={time}
							series={vrSeries}
							yMin={-currentValues.maxVoltage}
							yMax={currentValues.maxVoltage}
						/>
						<ScopeGraph
							title="I(t)"
							unit="mA"
							color="rgb(52 211 153)"
							currentValue={measuredCurrentMa}
							currentTime={time}
							series={iSeries}
							yMin={-currentValues.maxCurrent * 1000}
							yMax={currentValues.maxCurrent * 1000}
						/>
					</div>
				</section>
                <ConceptBox heading="Concept explained" items={[
                  {
                    title: "Time constant",
                    description: "In an RC circuit, the time constant (τ = RC) determines how quickly the capacitor charges or discharges."
                  },
                  {
                    title: "Capacitor voltage",
                    description: "The voltage across the capacitor follows an exponential curve during charging and discharging."
                  },
                  {
                    title: "Circuit current",
                    description: "The current in the circuit also follows an exponential curve, decreasing as the capacitor charges."
                  }
                ]}></ConceptBox>
			</main>	
		</div>
	);
}
