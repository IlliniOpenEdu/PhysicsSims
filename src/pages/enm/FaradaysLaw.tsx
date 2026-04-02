import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { SliderWithInput } from '../../components/SliderWithInput';
import { ConceptBox } from '../../components/ConceptBox';

type Mode = 'law' | 'iolab';

type FluxSample = {
	t: number;
	v: number;
};

type EventMarks = {
	enter: number | null;
	center: number | null;
	exit: number | null;
};

type SignalMode = 'clean' | 'sensor';

const DT = 0.04;
const GRAPH_W = 560;
const GRAPH_H = 220;
const GRAPH_PAD = 26;
const MAX_POINTS = 200;
const COIL_HALF_WIDTH = 0.18;

function gaussianField(x: number, sigma: number) {
	return Math.exp(-(x * x) / (2 * sigma * sigma));
}

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

function crossed(a: number, b: number, x: number) {
	return (a <= x && b >= x) || (a >= x && b <= x);
}

export function FaradaysLaw() {
	const [mode, setMode] = useState<Mode>('law');
	const [running, setRunning] = useState(true);

	const [turns, setTurns] = useState(150);
	const [area, setArea] = useState(0.0055);
	const [bPeak, setBPeak] = useState(0.32);
	const [sigma, setSigma] = useState(0.28);
	const [speed, setSpeed] = useState(0.9);

	const [magnetX, setMagnetX] = useState(-1.1);
	const [direction, setDirection] = useState(1);
	const [flux, setFlux] = useState(0);
	const [emf, setEmf] = useState(0);
	const [trace, setTrace] = useState<FluxSample[]>([]);
	const [marks, setMarks] = useState<EventMarks>({ enter: null, center: null, exit: null });
	const [signalMode, setSignalMode] = useState<SignalMode>('sensor');
	const [sensorOffset, setSensorOffset] = useState(0.012);
	const [sensorNoise, setSensorNoise] = useState(0.02);

	const timeRef = useRef(0);
	const magnetXRef = useRef(-1.1);
	const directionRef = useRef(1);
	const phiPrevRef = useRef(0);
	const marksRef = useRef<EventMarks>({ enter: null, center: null, exit: null });

	const iolabPreset = {
		turns: 200,
		area: 0.0048,
		bPeak: 0.22,
		sigma: 0.24,
		speed: 1.35,
	};

	const active = mode === 'iolab'
		? iolabPreset
		: { turns, area, bPeak, sigma, speed };

	const fluxAt = (x: number) => {
		const b = active.bPeak * gaussianField(x, active.sigma);
		return active.turns * active.area * b;
	};

	const resetPass = () => {
		const startPhi = fluxAt(-1.1);
		timeRef.current = 0;
		magnetXRef.current = -1.1;
		directionRef.current = 1;
		phiPrevRef.current = startPhi;
		marksRef.current = { enter: null, center: null, exit: null };

		setMagnetX(-1.1);
		setDirection(1);
		setFlux(startPhi);
		setEmf(0);
		setTrace([]);
		setMarks({ enter: null, center: null, exit: null });
		setRunning(mode === 'law');
	};

	const advanceStep = () => {
		const prevX = magnetXRef.current;
		let nextDirection = directionRef.current;
		let nextX = prevX + nextDirection * active.speed * DT;

		if (mode === 'law') {
			if (nextX > 1.25) {
				nextX = 1.25;
				nextDirection = -1;
			}
			if (nextX < -1.25) {
				nextX = -1.25;
				nextDirection = 1;
			}
		} else if (nextX > 1.3) {
			nextX = 1.3;
			setRunning(false);
		}

		const phiNow = fluxAt(nextX);
		const baseEmf = -((phiNow - phiPrevRef.current) / DT);
		const noisyEmf = baseEmf + sensorOffset + (Math.random() - 0.5) * sensorNoise;
		const signal = mode === 'iolab' && signalMode === 'sensor' ? noisyEmf : baseEmf;
		const clipped = clamp(signal, -2.5, 2.5);

		const nextTime = timeRef.current + DT;

		if (mode === 'iolab') {
			const nextMarks = { ...marksRef.current };
			if (nextMarks.enter === null && crossed(prevX, nextX, -COIL_HALF_WIDTH)) {
				nextMarks.enter = nextTime;
			}
			if (nextMarks.center === null && crossed(prevX, nextX, 0)) {
				nextMarks.center = nextTime;
			}
			if (nextMarks.exit === null && crossed(prevX, nextX, COIL_HALF_WIDTH)) {
				nextMarks.exit = nextTime;
			}
			marksRef.current = nextMarks;
			setMarks(nextMarks);
		}

		timeRef.current = nextTime;
		magnetXRef.current = nextX;
		directionRef.current = nextDirection;
		phiPrevRef.current = phiNow;

		setMagnetX(nextX);
		setDirection(nextDirection);
		setFlux(phiNow);
		setEmf(clipped);
		setTrace((prevTrace) => {
			const updated = [...prevTrace, { t: nextTime, v: clipped }];
			return updated.length > MAX_POINTS ? updated.slice(updated.length - MAX_POINTS) : updated;
		});
	};

	useEffect(() => {
		resetPass();
	}, [mode, turns, area, bPeak, sigma, speed]);

	useEffect(() => {
		if (!running) return;

		const timer = window.setInterval(() => {
			advanceStep();
		}, DT * 1000);

		return () => window.clearInterval(timer);
	}, [running, mode, active.speed, signalMode, sensorOffset, sensorNoise]);

	const graph = useMemo(() => {
		const maxV = Math.max(0.08, ...trace.map((p) => Math.abs(p.v)));
		const minT = trace.length > 0 ? trace[0].t : 0;
		const maxT = trace.length > 0 ? trace[trace.length - 1].t : 1;
		const tSpan = Math.max(maxT - minT, 1);

		const mapX = (t: number) => GRAPH_PAD + ((t - minT) / tSpan) * (GRAPH_W - GRAPH_PAD * 2);
		const mapY = (v: number) => GRAPH_H / 2 - (v / maxV) * (GRAPH_H / 2 - GRAPH_PAD);

		const line = trace
			.map((p) => `${mapX(p.t).toFixed(2)},${mapY(p.v).toFixed(2)}`)
			.join(' ');

		return {
			maxV,
			line,
			mapX,
			yZero: mapY(0),
			xMin: GRAPH_PAD,
			xMax: GRAPH_W - GRAPH_PAD,
			yTop: GRAPH_PAD,
			yBottom: GRAPH_H - GRAPH_PAD,
		};
	}, [trace]);

	const markerItems = [
		{ key: 'enter', label: 'enter', time: marks.enter, color: 'rgb(56 189 248)' },
		{ key: 'center', label: 'center', time: marks.center, color: 'rgb(16 185 129)' },
		{ key: 'exit', label: 'exit', time: marks.exit, color: 'rgb(251 191 36)' },
	].filter((item) => item.time !== null);

	const magnetPx = 26 + ((magnetX + 1.25) / 2.5) * 68;

	return (
		<div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-8 text-slate-100">
			<header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
				<div>
					<p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">ENM demo</p>
					<h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
						Faraday&apos;s Law
					</h1>
					<p className="mt-2 max-w-2xl text-sm text-slate-300">
						Compare a theory-focused mode with an IOLab-style practical pass to see how changing magnetic flux induces voltage.
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
						Induced EMF · PHYS 212 target
					</span>
				</div>
			</header>

			<main className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
				<section className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/40">
					<div className="pointer-events-none absolute inset-0 -z-10 opacity-70">
						<div className="absolute -left-24 top-0 h-56 w-56 rounded-full bg-emerald-600/20 blur-3xl" />
						<div className="absolute bottom-0 right-0 h-56 w-56 rounded-full bg-sky-500/20 blur-3xl" />
					</div>

					<div className="mb-4 flex flex-wrap items-center gap-2">
						<button
							type="button"
							onClick={() => setMode('law')}
							className={`rounded-full px-3 py-1 text-xs font-medium transition ${
								mode === 'law'
									? 'border border-emerald-400 bg-emerald-500/20 text-emerald-100'
									: 'border border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'
							}`}
						>
							Normal law mode
						</button>
						<button
							type="button"
							onClick={() => setMode('iolab')}
							className={`rounded-full px-3 py-1 text-xs font-medium transition ${
								mode === 'iolab'
									? 'border border-sky-400 bg-sky-500/20 text-sky-100'
									: 'border border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'
							}`}
						>
							Practical lab mode (IOLab)
						</button>
					</div>

					<h2 className="text-sm font-semibold tracking-wide text-emerald-300">Magnet through coil</h2>
					<div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/70 p-4">
						<svg viewBox="0 0 120 52" className="h-44 w-full rounded-lg border border-slate-800/70 bg-slate-900/70" role="img" aria-label="Magnet moving through coil">
							<rect x="12" y="20" width="96" height="12" rx="6" fill="rgba(100,116,139,0.2)" stroke="rgba(148,163,184,0.35)" />
							<rect x="48" y="18.2" width="24" height="15.6" rx="3" fill="rgba(16,185,129,0.08)" stroke="rgba(16,185,129,0.55)" strokeDasharray="1.2 1.2" />

							{Array.from({ length: 8 }, (_, i) => (
								<ellipse
									key={i}
									cx={52 + i * 2}
									cy={26}
									rx={1.8}
									ry={7}
									fill="none"
									stroke="rgba(56,189,248,0.8)"
									strokeWidth="0.7"
								/>
							))}

							<rect x={magnetPx} y={15} width="14" height="22" rx="2" fill="#ef4444" stroke="#fca5a5" />
							<line x1={magnetPx + 7} y1={15} x2={magnetPx + 7} y2={37} stroke="#fee2e2" strokeWidth="0.8" />
							<text x={magnetPx + 3.4} y={13.5} fontSize="2.6" fill="#fca5a5">N</text>
							<text x={magnetPx + 9.5} y={13.5} fontSize="2.6" fill="#fca5a5">S</text>
							<text x="50" y="17" fontSize="2.5" fill="rgb(16 185 129)">coil sensing region</text>

							<text x="13" y="47" fontSize="2.8" fill="rgb(148 163 184)">magnet position x = {magnetX.toFixed(2)} m</text>
							<text x="59" y="47" fontSize="2.8" fill="rgb(148 163 184)">EMF = {emf.toFixed(3)} V</text>
							<text x="13" y="50.4" fontSize="2.4" fill="rgb(94 234 212)">flux Φ = {flux.toExponential(2)} Wb-turn</text>
							<text x="59" y="50.4" fontSize="2.4" fill="rgb(148 163 184)">v = {(direction * active.speed).toFixed(2)} m/s ({direction > 0 ? 'right' : 'left'})</text>
						</svg>
					</div>

					<h2 className="mt-5 text-sm font-semibold tracking-wide text-sky-300">Voltage vs time</h2>
					<div className="mt-3 overflow-hidden rounded-xl border border-slate-800 bg-slate-950/70 p-3">
						<svg viewBox={`0 0 ${GRAPH_W} ${GRAPH_H}`} className="h-56 w-full" role="img" aria-label="Induced voltage versus time graph">
							<line x1={graph.xMin} y1={graph.yZero} x2={graph.xMax} y2={graph.yZero} stroke="rgba(148,163,184,0.45)" strokeWidth="1" />
							<line x1={graph.xMin} y1={graph.yTop} x2={graph.xMin} y2={graph.yBottom} stroke="rgba(148,163,184,0.45)" strokeWidth="1" />

							<polyline
								points={graph.line}
								fill="none"
								stroke={mode === 'iolab' ? 'rgb(56 189 248)' : 'rgb(16 185 129)'}
								strokeWidth="2.5"
								strokeLinecap="round"
							/>

							{mode === 'iolab' && markerItems.map((mark) => (
								<g key={mark.key}>
									<line
										x1={graph.mapX(mark.time as number)}
										y1={graph.yTop}
										x2={graph.mapX(mark.time as number)}
										y2={graph.yBottom}
										stroke={mark.color}
										strokeWidth="1.4"
										strokeDasharray="4 3"
									/>
									<text
										x={graph.mapX(mark.time as number) + 3}
										y={graph.yTop + 12}
										fontSize="10"
										fill={mark.color}
									>
										{mark.label}
									</text>
								</g>
							))}

							<text x={36} y={24} fill="rgb(148 163 184)" fontSize="12">V (volts)</text>
							<text x={GRAPH_W - 82} y={GRAPH_H - 12} fill="rgb(148 163 184)" fontSize="12">time (s)</text>
							<text x={36} y={GRAPH_H - 14} fill="rgb(148 163 184)" fontSize="11">peak |V| ~ {graph.maxV.toFixed(2)} V</text>
						</svg>
					</div>
				</section>

				<section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/80 p-5 shadow-lg shadow-slate-950/40">
					<h2 className="text-sm font-semibold tracking-wide text-emerald-300">Controls</h2>

					<div className="flex gap-2">
						<button
							type="button"
							onClick={() => setRunning((prev) => !prev)}
							className="rounded-lg border border-emerald-700/70 bg-emerald-900/40 px-3 py-2 text-xs font-medium text-emerald-100 transition hover:border-emerald-500"
						>
							{running ? 'Pause' : 'Run'}
						</button>
						<button
							type="button"
							onClick={advanceStep}
							disabled={running}
							className="rounded-lg border border-sky-700/70 bg-sky-900/30 px-3 py-2 text-xs font-medium text-sky-100 transition enabled:hover:border-sky-500 disabled:cursor-not-allowed disabled:opacity-40"
						>
							Step +Δt
						</button>
						<button
							type="button"
							onClick={resetPass}
							className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-200 transition hover:border-slate-500"
						>
							Reset
						</button>
					</div>

					{mode === 'law' ? (
						<>
							<SliderWithInput
								label="Magnet speed"
								min={0.2}
								max={2.2}
								step={0.05}
								value={speed}
								units="m/s"
								onChange={setSpeed}
							/>
							<SliderWithInput
								label="Peak magnetic field"
								min={0.08}
								max={0.7}
								step={0.01}
								value={bPeak}
								units="T"
								onChange={setBPeak}
							/>
							<SliderWithInput
								label="Coil area"
								min={0.001}
								max={0.012}
								step={0.0005}
								value={area}
								units="m^2"
								onChange={setArea}
							/>
							<SliderWithInput
								label="Number of turns"
								min={20}
								max={400}
								step={5}
								value={turns}
								units="turns"
								onChange={setTurns}
							/>
							<SliderWithInput
								label="Flux spread (sigma)"
								min={0.12}
								max={0.55}
								step={0.01}
								value={sigma}
								units="m"
								onChange={setSigma}
							/>
						</>
					) : (
						<div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3 text-sm text-slate-300">
							<p className="font-medium text-sky-200">IOLab practical profile</p>
							<p className="mt-1 text-xs leading-relaxed">
								Fixed parameters emulate a quick PHYS 212 induction lab pass: move the magnet through
								the pickup coil once and observe the bipolar voltage pulse.
							</p>
							<div className="mt-2 flex flex-wrap items-center gap-2">
								<button
									type="button"
									onClick={() => setSignalMode('sensor')}
									className={`rounded-full px-3 py-1 text-xs transition ${
										signalMode === 'sensor'
											? 'border border-sky-400 bg-sky-500/20 text-sky-100'
											: 'border border-slate-700 bg-slate-900 text-slate-300'
									}`}
								>
									Sensor mode
								</button>
								<button
									type="button"
									onClick={() => setSignalMode('clean')}
									className={`rounded-full px-3 py-1 text-xs transition ${
										signalMode === 'clean'
											? 'border border-emerald-400 bg-emerald-500/20 text-emerald-100'
											: 'border border-slate-700 bg-slate-900 text-slate-300'
									}`}
								>
									Clean mode
								</button>
							</div>
							<SliderWithInput
								label="Sensor offset"
								min={-0.08}
								max={0.08}
								step={0.002}
								value={sensorOffset}
								units="V"
								onChange={setSensorOffset}
							/>
							<SliderWithInput
								label="Sensor noise"
								min={0}
								max={0.08}
								step={0.002}
								value={sensorNoise}
								units="V"
								onChange={setSensorNoise}
							/>
							<ul className="mt-2 space-y-1 text-xs text-slate-400">
								<li>N = {iolabPreset.turns} turns</li>
								<li>A = {iolabPreset.area.toFixed(4)} m^2</li>
								<li>B_peak = {iolabPreset.bPeak.toFixed(2)} T</li>
								<li>speed = {iolabPreset.speed.toFixed(2)} m/s</li>
								<li>signal = {signalMode === 'sensor' ? 'realistic (noise + offset)' : 'ideal clean'}</li>
							</ul>
						</div>
					)}

					<div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3 text-sm">
						<p className="text-slate-300">Core law</p>
						<p className="mt-1 font-medium text-amber-200">ε = - dΦ/dt</p>
						<p className="mt-1 text-xs text-slate-400">
							The minus sign is Lenz&apos;s law: induced EMF opposes the change in magnetic flux.
						</p>
					</div>
                    <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3 text-sm">
                        <p className="text-slate-300">Current</p>
                        <p className="mt-1 text-xs text-teal-300">Φ {flux.toExponential(2)} Wb-turn</p>
                    </div>
				</section>
                <ConceptBox
                  heading="Key Concepts"
                  items={[
                    {
                      title: "Faraday's Law",
                      description: "The induced EMF in a circuit is proportional to the rate of change of magnetic flux through the circuit.",
                    },
                    {
                      title: "Lenz's Law",
                      description: "The direction of the induced EMF is such that it opposes the change in magnetic flux that produced it. Where it is defined as the negative sign in Faraday's Law.",
                    },
                  ]}
                />
			</main>
		</div>
	);
}
