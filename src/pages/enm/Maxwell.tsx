import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SliderWithInput } from '../../components/system/SliderWithInput';
import { ConceptBox } from '../../components/system/ConceptBox';

const C0 = 299792458;
const EPSILON_0 = 8.8541878128e-12;
const MU_0 = 4 * Math.PI * 1e-7;

function scientific(value: number, digits = 3) {
	if (!Number.isFinite(value)) return '0';
	return value.toExponential(digits);
}

export function Maxwell() {
	const [running, setRunning] = useState(true);
	const [timeS, setTimeS] = useState(0);
	const [ePeak, setEPeak] = useState(380);
	const [frequencyMHz, setFrequencyMHz] = useState(95);
	const [phaseDeg, setPhaseDeg] = useState(0);
	const [epsilonR, setEpsilonR] = useState(1);
	const [muR, setMuR] = useState(1);

	useEffect(() => {
		if (!running) return;
		const timer = window.setInterval(() => {
			setTimeS((prev) => prev + 0.0000000035);
		}, 30);
		return () => window.clearInterval(timer);
	}, [running]);

	const derived = useMemo(() => {
		const fHz = frequencyMHz * 1e6;
		const omega = 2 * Math.PI * fHz;
		const speed = C0 / Math.sqrt(epsilonR * muR);
		const wavelength = speed / fHz;
		const k = (2 * Math.PI) / wavelength;
		const phase = (phaseDeg * Math.PI) / 180;
		const bPeak = ePeak / speed;
		const epsilon = epsilonR * EPSILON_0;
		const mu = muR * MU_0;
		const impedance = Math.sqrt(mu / epsilon);
		const pAvg = (ePeak * ePeak) / (2 * impedance);

		return {
			fHz,
			omega,
			speed,
			wavelength,
			k,
			phase,
			bPeak,
			impedance,
			pAvg,
		};
	}, [ePeak, frequencyMHz, phaseDeg, epsilonR, muR]);

	const wave = useMemo(() => {
		const width = 560;
		const height = 260;
		const centerY = 130;
		const padX = 24;
		const drawableW = width - padX * 2;
		const samples = 90;
		const ampScale = 0.12;
		const bVisualScale = (derived.speed / C0) * 0.9;

		const ePts: string[] = [];
		const bPts: string[] = [];

		for (let i = 0; i <= samples; i++) {
			const xNorm = i / samples;
			const x = xNorm * (3.2 * derived.wavelength);
			const theta = derived.k * x - derived.omega * timeS + derived.phase;
			const eValue = ePeak * Math.sin(theta);
			const bValue = derived.bPeak * Math.sin(theta);

			const px = padX + xNorm * drawableW;
			const ePy = centerY - eValue * ampScale;
			const bPy = centerY - (bValue * ampScale * 1e8) * bVisualScale;

			ePts.push(`${px.toFixed(2)},${ePy.toFixed(2)}`);
			bPts.push(`${px.toFixed(2)},${bPy.toFixed(2)}`);
		}

		return {
			width,
			height,
			centerY,
			eLine: ePts.join(' '),
			bLine: bPts.join(' '),
		};
	}, [derived, ePeak, timeS]);

	return (
		<div className="mx-auto flex min-h-[100dvh] max-w-6xl flex-col px-3 py-6 text-slate-100 sm:px-4 sm:py-8">
			<header className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-4 sm:mb-6 sm:items-center sm:gap-4">
				<div>
					<p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">E&M demo</p>
					<h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
						Maxwell&apos;s Equations Explorer
					</h1>
					<p className="mt-2 max-w-2xl text-sm text-slate-300">
						Visualize a propagating electromagnetic wave and see how medium properties change wave speed,
						impedance, and average power flow.
					</p>
				</div>

				<div className="flex flex-wrap items-center gap-3">
					<Link
						to="/dashboard"
						className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-violet-500 hover:text-violet-100"
					>
						← Dashboard
					</Link>
					<button
						type="button"
						onClick={() => setRunning((prev) => !prev)}
						className="inline-flex items-center gap-2 rounded-full border border-violet-700/60 bg-violet-900/50 px-3 py-1 text-[0.7rem] font-medium text-violet-100 transition hover:border-violet-500"
					>
						{running ? 'Pause wave' : 'Play wave'}
					</button>
				</div>
			</header>

			<main className="grid gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
				<section className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-lg shadow-slate-950/40 sm:p-5">
					<div className="pointer-events-none absolute inset-0 -z-10 opacity-70">
						<div className="absolute -left-32 top-0 h-64 w-64 rounded-full bg-violet-700/25 blur-3xl" />
						<div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-cyan-500/20 blur-3xl" />
					</div>

					<h2 className="text-sm font-semibold tracking-wide text-violet-300">Transverse Wave Snapshot</h2>
					<p className="mt-1 text-xs text-slate-300">
						Electric field (cyan) and magnetic field (amber) stay in phase and perpendicular to the direction
						of propagation.
					</p>

					<div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/70 p-3">
						<svg viewBox={`0 0 ${wave.width} ${wave.height}`} className="h-auto w-full" preserveAspectRatio="xMidYMid meet">
							<rect
								x="8"
								y="8"
								width={wave.width - 16}
								height={wave.height - 16}
								rx="12"
								fill="rgba(2,6,23,0.65)"
								stroke="rgba(51,65,85,0.8)"
							/>

							<line x1="24" y1={wave.centerY} x2={wave.width - 24} y2={wave.centerY} stroke="rgba(100,116,139,0.7)" strokeWidth="1.2" />
							<text x="26" y="28" fill="rgb(148 163 184)" fontSize="12">x direction (propagation)</text>
							<text x="26" y="46" fill="rgb(125 211 252)" fontSize="12">E field</text>
							<text x="90" y="46" fill="rgb(252 211 77)" fontSize="12">B field</text>

							<polyline fill="none" stroke="rgb(125 211 252)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" points={wave.eLine} />
							<polyline fill="none" stroke="rgb(252 211 77)" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" points={wave.bLine} />
						</svg>
					</div>

					<div className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
						<StatCard label="Wave speed" value={`${scientific(derived.speed)} m/s`} />
						<StatCard label="Wavelength" value={`${derived.wavelength.toFixed(3)} m`} />
						<StatCard label="Angular frequency" value={`${scientific(derived.omega)} rad/s`} />
						<StatCard label="Magnetic peak (B₀)" value={`${scientific(derived.bPeak)} T`} />
						<StatCard label="Wave impedance" value={`${derived.impedance.toFixed(2)} Ω`} />
						<StatCard label="Avg Poynting magnitude" value={`${scientific(derived.pAvg)} W/m²`} />
					</div>
				</section>

				<section className="flex min-h-0 flex-col space-y-4 rounded-2xl border border-slate-800 bg-slate-950/80 p-4 shadow-lg shadow-slate-950/40 sm:p-5">
					<h2 className="text-sm font-semibold tracking-wide text-violet-300">Wave Controls</h2>

					<SliderWithInput
						label="Electric field peak"
						min={20}
						max={1200}
						step={1}
						value={ePeak}
						onChange={setEPeak}
						units="V/m"
						accentClass="accent-violet-400"
						queryKey="ePeak"
					/>

					<SliderWithInput
						label="Frequency"
						min={1}
						max={1200}
						step={1}
						value={frequencyMHz}
						onChange={setFrequencyMHz}
						units="MHz"
						accentClass="accent-violet-400"
						queryKey="freq"
					/>

					<SliderWithInput
						label="Phase offset"
						min={-180}
						max={180}
						step={1}
						value={phaseDeg}
						onChange={setPhaseDeg}
						units="deg"
						accentClass="accent-violet-400"
						queryKey="phase"
					/>

					<SliderWithInput
						label="Relative permittivity (epsilon_r)"
						min={1}
						max={20}
						step={0.1}
						value={epsilonR}
						onChange={setEpsilonR}
						units=""
						accentClass="accent-violet-400"
						queryKey="epsR"
					/>

					<SliderWithInput
						label="Relative permeability (mu_r)"
						min={1}
						max={20}
						step={0.1}
						value={muR}
						onChange={setMuR}
						units=""
						accentClass="accent-violet-400"
						queryKey="muR"
					/>

					<div className="rounded-lg border border-slate-800 bg-slate-900/80 p-3 text-[0.72rem] text-slate-300">
						<p>
							In-medium speed: <span className="font-mono text-violet-200">v = c / sqrt(epsilon_r mu_r)</span>
						</p>
						<p className="mt-2 text-slate-400">
							As epsilon_r or mu_r increase, the wave slows down and wavelength shrinks at fixed frequency.
						</p>
					</div>
                    <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-3 text-[0.72rem] text-slate-300">
						<p>
							Field Relationship <span className="font-mono text-violet-200">B₀ = E₀ / c</span>
						</p>
						<p className="mt-2 text-slate-400">
							The magnetic field amplitude is proportional to the electric field. In free space, they are linked by the speed of light.
						</p>
					</div>
				</section>

				<ConceptBox
					heading="Maxwell In One View"
					items={[
						{
							title: 'Gauss for E',
							description:
								'Divergence of electric field follows charge density. More charge gives stronger electric flux out of a closed surface.',
						},
						{
							title: 'Gauss for B',
							description:
								'Magnetic monopoles are not observed, so net magnetic flux through any closed surface remains zero.',
						},
						{
							title: 'Faraday induction',
							description:
								'A changing magnetic field curls the electric field. This coupling is what allows self-sustaining waves.',
						},
						{
							title: 'Ampere-Maxwell law',
							description:
								'Current and changing electric flux curl the magnetic field, completing the E-B feedback loop in wave propagation.',
						},
					]}
					className="lg:col-span-2"
				/>
			</main>
		</div>
	);
}

function StatCard({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2.5">
			<p className="text-[0.68rem] uppercase tracking-wide text-slate-400">{label}</p>
			<p className="mt-1 text-sm font-semibold text-slate-100">{value}</p>
		</div>
	);
}
