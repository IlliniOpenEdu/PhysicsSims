import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';

type Controls = {
	leftMassKg: number;
	rightMassKg: number;
	leftDistanceM: number;
	rightDistanceM: number;
};

const G = 9.81;

const DEFAULT_CONTROLS: Controls = {
	leftMassKg: 6,
	rightMassKg: 4,
	leftDistanceM: 1.2,
	rightDistanceM: 1.4,
};

function clamp(n: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, n));
}

function roundTo2(n: number): number {
	return Math.round(n * 100) / 100;
}

export function BeamBalance() {
	const [controls, setControls] = useState<Controls>(DEFAULT_CONTROLS);

	const leftForceN = controls.leftMassKg * G;
	const rightForceN = controls.rightMassKg * G;
	const leftTorque = leftForceN * controls.leftDistanceM;
	const rightTorque = rightForceN * controls.rightDistanceM;
	const netTorque = rightTorque - leftTorque;

	const balanceState = Math.abs(netTorque) < 0.15 ? 'Balanced' : netTorque > 0 ? 'Right side down' : 'Left side down';

	const beamAngleDeg = useMemo(() => {
		const normalized = clamp(netTorque / 80, -1, 1);
		return normalized * 14;
	}, [netTorque]);

	const centerOfMassOffsetM = useMemo(() => {
		const totalMass = controls.leftMassKg + controls.rightMassKg;
		if (totalMass <= 0) return 0;
		return (controls.rightMassKg * controls.rightDistanceM - controls.leftMassKg * controls.leftDistanceM) / totalMass;
	}, [controls.leftMassKg, controls.rightMassKg, controls.leftDistanceM, controls.rightDistanceM]);

	const handleControlChange = (field: keyof Controls, value: number) => {
		setControls((prev) => {
			if (field === 'leftMassKg' || field === 'rightMassKg') {
				return { ...prev, [field]: clamp(value, 0.2, 15) };
			}
			return { ...prev, [field]: clamp(value, 0.2, 2.5) };
		});
	};

	const handleSnapToEquilibrium = () => {
		setControls((prev) => {
			const rightForce = Math.max(0.001, prev.rightMassKg * G);
			const targetRightDistance = (prev.leftMassKg * G * prev.leftDistanceM) / rightForce;
			return { ...prev, rightDistanceM: clamp(targetRightDistance, 0.2, 2.5) };
		});
	};

	return (
		<div className="mx-auto flex min-h-[100dvh] max-w-6xl flex-col px-3 py-6 text-slate-100 sm:px-4 sm:py-8">
			<header className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-4 sm:mb-6 sm:items-center sm:gap-4">
				<div>
					<p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-400">Statics demo</p>
					<h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">Beam Balance Simulator</h1>
					<p className="mt-2 max-w-2xl text-sm text-slate-300">
						Move masses and lever-arm distances to explore rotational equilibrium where
						<span className="mx-1 rounded bg-slate-800 px-1 py-0.5 font-mono text-[0.72rem] text-rose-200">Στ = 0</span>.
					</p>
				</div>

				<Link
					to="/"
					className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-rose-500 hover:text-rose-100"
				>
					<span className="text-sm">←</span>
					Back to welcome
				</Link>
			</header>

			<main className="grid gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
				<section className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-lg shadow-slate-950/40 sm:p-5">
					<div className="pointer-events-none absolute inset-0 -z-10 opacity-70">
						<div className="absolute -left-32 top-0 h-64 w-64 rounded-full bg-rose-700/20 blur-3xl" />
						<div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-orange-500/20 blur-3xl" />
					</div>

					<h2 className="text-sm font-semibold tracking-wide text-rose-300">Visualizer</h2>
					<p className="mt-1 text-xs text-slate-300">Beam tilt reflects net torque around the pivot.</p>

					<div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/70 p-3 sm:p-4">
						<BeamSvg
							angleDeg={beamAngleDeg}
							leftMassKg={controls.leftMassKg}
							rightMassKg={controls.rightMassKg}
							leftDistanceM={controls.leftDistanceM}
							rightDistanceM={controls.rightDistanceM}
							leftForceN={leftForceN}
							rightForceN={rightForceN}
							leftTorque={leftTorque}
							rightTorque={rightTorque}
							centerOfMassOffsetM={centerOfMassOffsetM}
						/>
					</div>

					<div className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
						<Metric label="Left torque" value={`${roundTo2(leftTorque)} N·m`} />
						<Metric label="Right torque" value={`${roundTo2(rightTorque)} N·m`} />
						<Metric label="Net torque" value={`${roundTo2(netTorque)} N·m`} />
						<Metric label="State" value={balanceState} />
					</div>
				</section>

				<section className="flex min-h-0 flex-col space-y-4 rounded-2xl border border-slate-800 bg-slate-950/80 p-4 shadow-lg shadow-slate-950/40 sm:p-5">
					<h2 className="text-sm font-semibold tracking-wide text-rose-300">Controls</h2>

					<ControlRow
						label="Left mass"
						units="kg"
						min={0.2}
						max={15}
						step={0.1}
						value={controls.leftMassKg}
						onChange={(v) => handleControlChange('leftMassKg', v)}
					/>

					<ControlRow
						label="Left distance"
						units="m"
						min={0.2}
						max={2.5}
						step={0.05}
						value={controls.leftDistanceM}
						onChange={(v) => handleControlChange('leftDistanceM', v)}
					/>

					<ControlRow
						label="Right mass"
						units="kg"
						min={0.2}
						max={15}
						step={0.1}
						value={controls.rightMassKg}
						onChange={(v) => handleControlChange('rightMassKg', v)}
					/>

					<ControlRow
						label="Right distance"
						units="m"
						min={0.2}
						max={2.5}
						step={0.05}
						value={controls.rightDistanceM}
						onChange={(v) => handleControlChange('rightDistanceM', v)}
					/>

					<button
						type="button"
						onClick={handleSnapToEquilibrium}
						className="inline-flex items-center justify-center rounded-full border border-rose-600/60 bg-rose-500/20 px-4 py-2 text-xs font-semibold text-rose-100 transition hover:border-rose-400 hover:bg-rose-500/30"
					>
						Snap to equilibrium
					</button>

					<div className="rounded-lg border border-slate-800 bg-slate-900/80 p-3 text-[0.72rem] text-slate-300">
						Equilibrium condition:
						<span className="mx-1 rounded bg-slate-800 px-1 py-0.5 font-mono text-[0.68rem] text-rose-200">
							τ_left = τ_right
						</span>
						where τ = rF.
					</div>
				</section>
			</main>
		</div>
	);
}

function BeamSvg({
	angleDeg,
	leftMassKg,
	rightMassKg,
	leftDistanceM,
	rightDistanceM,
	leftForceN,
	rightForceN,
	leftTorque,
	rightTorque,
	centerOfMassOffsetM,
}: {
	angleDeg: number;
	leftMassKg: number;
	rightMassKg: number;
	leftDistanceM: number;
	rightDistanceM: number;
	leftForceN: number;
	rightForceN: number;
	leftTorque: number;
	rightTorque: number;
	centerOfMassOffsetM: number;
}) {
	const leftX = 260 - (leftDistanceM / 2.5) * 170;
	const rightX = 260 + (rightDistanceM / 2.5) * 170;
	const leftSize = 16 + (leftMassKg / 15) * 26;
	const rightSize = 16 + (rightMassKg / 15) * 26;
	const forceScale = 0.35;
	const leftArrowLen = clamp(leftForceN * forceScale, 16, 46);
	const rightArrowLen = clamp(rightForceN * forceScale, 16, 46);
	const comX = 260 + clamp(centerOfMassOffsetM, -2.5, 2.5) * (170 / 2.5);

	return (
		<svg viewBox="0 0 520 250" className="h-auto w-full" preserveAspectRatio="xMidYMid meet">
			<defs>
				<marker id="forceArrow" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
					<path d="M0,0 L8,4 L0,8 z" fill="rgba(248,250,252,0.85)" />
				</marker>
			</defs>
			<rect x="8" y="8" width="504" height="234" rx="12" fill="rgba(2,6,23,0.65)" stroke="rgba(51,65,85,0.8)" />

			<polygon points="245,188 275,188 260,158" fill="rgba(148,163,184,0.85)" />

			<g transform={`rotate(${angleDeg} 260 145)`}>
				<rect x="90" y="138" width="340" height="14" rx="7" fill="rgba(244,114,182,0.45)" stroke="rgba(251,113,133,0.8)" />
				<line x1="260" y1="145" x2={leftX} y2="145" stroke="rgba(251,113,133,0.6)" strokeDasharray="4 3" strokeWidth="1.5" />
				<line x1="260" y1="145" x2={rightX} y2="145" stroke="rgba(251,113,133,0.6)" strokeDasharray="4 3" strokeWidth="1.5" />
				<text x={(260 + leftX) / 2} y="133" textAnchor="middle" className="fill-rose-200 text-[9px]">rL={roundTo2(leftDistanceM)}m</text>
				<text x={(260 + rightX) / 2} y="133" textAnchor="middle" className="fill-rose-200 text-[9px]">rR={roundTo2(rightDistanceM)}m</text>
				<line x1={leftX} y1="145" x2={leftX} y2="174" stroke="rgba(248,250,252,0.8)" strokeWidth="2" />
				<line x1={rightX} y1="145" x2={rightX} y2="174" stroke="rgba(248,250,252,0.8)" strokeWidth="2" />
				<line
					x1={leftX}
					y1={174 - leftArrowLen}
					x2={leftX}
					y2="174"
					stroke="rgba(248,250,252,0.85)"
					strokeWidth="2"
					markerEnd="url(#forceArrow)"
				/>
				<line
					x1={rightX}
					y1={174 - rightArrowLen}
					x2={rightX}
					y2="174"
					stroke="rgba(248,250,252,0.85)"
					strokeWidth="2"
					markerEnd="url(#forceArrow)"
				/>
				<text x={leftX - 8} y={174 - leftArrowLen - 4} textAnchor="end" className="fill-slate-200 text-[9px]">F={roundTo2(leftForceN)}N</text>
				<text x={rightX + 8} y={174 - rightArrowLen - 4} className="fill-slate-200 text-[9px]">F={roundTo2(rightForceN)}N</text>

				<circle cx={comX} cy="145" r="4" fill="rgba(52,211,153,0.95)" stroke="rgba(16,185,129,1)" />
				<text x={comX} y="125" textAnchor="middle" className="fill-emerald-200 text-[9px]">CoM</text>

				<rect
					x={leftX - leftSize / 2}
					y={174}
					width={leftSize}
					height={leftSize}
					rx="6"
					fill="rgba(56,189,248,0.85)"
					stroke="rgba(14,165,233,1)"
				/>
				<rect
					x={rightX - rightSize / 2}
					y={174}
					width={rightSize}
					height={rightSize}
					rx="6"
					fill="rgba(251,113,133,0.85)"
					stroke="rgba(244,63,94,1)"
				/>

				<text x={112} y="118" className="fill-sky-200 text-[11px]">↺ τL {roundTo2(leftTorque)} N·m</text>
				<text x={328} y="118" className="fill-rose-200 text-[11px]">↻ τR {roundTo2(rightTorque)} N·m</text>
			</g>

			<text x="18" y="24" className="fill-slate-300 text-[10px]">left mass: {roundTo2(leftMassKg)} kg</text>
			<text x="18" y="38" className="fill-slate-300 text-[10px]">right mass: {roundTo2(rightMassKg)} kg</text>
			<text x="18" y="52" className="fill-slate-300 text-[10px]">tilt: {roundTo2(angleDeg)}°</text>
		</svg>
	);
}

function Metric({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-md border border-slate-800 bg-slate-900/80 px-3 py-2">
			<p className="text-[0.65rem] uppercase tracking-[0.08em] text-slate-500">{label}</p>
			<p className="mt-1 text-[0.78rem] font-medium text-rose-200">{value}</p>
		</div>
	);
}

function ControlRow({
	label,
	units,
	min,
	max,
	step,
	value,
	onChange,
}: {
	label: string;
	units: string;
	min: number;
	max: number;
	step: number;
	value: number;
	onChange: (value: number) => void;
}) {
	const handleSliderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		onChange(Number(event.target.value));
	};

	const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		const parsed = Number(event.target.value);
		if (Number.isNaN(parsed)) return;
		onChange(clamp(parsed, min, max));
	};

	return (
		<div className="space-y-1.5">
			<div className="flex items-baseline justify-between gap-2">
				<p className="text-xs text-slate-200">{label}</p>
				<span className="text-[0.65rem] text-slate-400">{roundTo2(value)} {units}</span>
			</div>
			<div className="flex items-center gap-3">
				<input
					type="range"
					min={min}
					max={max}
					step={step}
					value={value}
					onChange={handleSliderChange}
					className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-slate-800 accent-rose-400"
				/>
				<div className="flex items-center gap-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1">
					<input
						type="number"
						min={min}
						max={max}
						step={step}
						value={roundTo2(value)}
						onChange={handleInputChange}
						className="w-20 bg-transparent text-right text-[0.7rem] text-slate-100 outline-none"
					/>
					<span className="text-[0.65rem] text-slate-400">{units}</span>
				</div>
			</div>
		</div>
	);
}
