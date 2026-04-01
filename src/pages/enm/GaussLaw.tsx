import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

type SurfaceShape = 'sphere' | 'cylinder' | 'cube';

const EPSILON_0 = 8.8541878128e-12;

function roundTo(value: number, digits: number): number {
	const factor = 10 ** digits;
	return Math.round(value * factor) / factor;
}

function scientific(value: number, digits = 3): string {
	if (!Number.isFinite(value)) return '0';
	return value.toExponential(digits);
}

export function GaussLaw() {
	const [shape, setShape] = useState<SurfaceShape>('sphere');
	const [chargeNc, setChargeNc] = useState(8);
	const [radiusM, setRadiusM] = useState(1.2);
	const [heightM, setHeightM] = useState(1.8);
	const [sideM, setSideM] = useState(1.6);

	const chargeC = chargeNc * 1e-9;

	const flux = chargeC / EPSILON_0;

	const surfaceArea = useMemo(() => {
		if (shape === 'sphere') return 4 * Math.PI * radiusM * radiusM;
		if (shape === 'cylinder') return 2 * Math.PI * radiusM * (heightM + radiusM);
		return 6 * sideM * sideM;
	}, [shape, radiusM, heightM, sideM]);

	const effectiveDistance = useMemo(() => {
		if (shape === 'sphere') return radiusM;
		if (shape === 'cylinder') return radiusM;
		return Math.max(0.01, sideM / 2);
	}, [shape, radiusM, sideM]);

	const fieldEstimate = useMemo(() => {
		return Math.abs(chargeC) / (4 * Math.PI * EPSILON_0 * effectiveDistance * effectiveDistance);
	}, [chargeC, effectiveDistance]);

	const fieldDirection = chargeC >= 0 ? 'outward' : 'inward';

	return (
		<div className="mx-auto flex min-h-[100dvh] max-w-6xl flex-col px-3 py-6 text-slate-100 sm:px-4 sm:py-8">
			<header className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-4 sm:mb-6 sm:items-center sm:gap-4">
				<div>
					<p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">
						E&M demo
					</p>
					<h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
						Gauss&apos;s Law Visualizer
					</h1>
					<p className="mt-2 max-w-2xl text-sm text-slate-300">
						Switch the Gaussian surface shape and observe that total electric flux depends on enclosed
						charge, not on the surface geometry.
					</p>
				</div>

				<Link
					to="/"
					className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-emerald-500 hover:text-emerald-100"
				>
					<span className="text-sm">←</span>
					Home
				</Link>
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-700/60 bg-emerald-900/50 px-3 py-1 text-[0.7rem] font-medium text-emerald-100">
                    Gaussian Surface · Electric Flux
                </span>
			</header>

			<main className="grid gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
				<section className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-lg shadow-slate-950/40 sm:p-5">
					<div className="pointer-events-none absolute inset-0 -z-10 opacity-70">
						<div className="absolute -left-32 top-0 h-64 w-64 rounded-full bg-emerald-700/30 blur-3xl" />
						<div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-cyan-500/20 blur-3xl" />
					</div>

					<div className="mb-4 flex flex-wrap gap-2">
						<ShapeButton active={shape === 'sphere'} onClick={() => setShape('sphere')} label="Sphere" />
						<ShapeButton
							active={shape === 'cylinder'}
							onClick={() => setShape('cylinder')}
							label="Cylinder"
						/>
						<ShapeButton active={shape === 'cube'} onClick={() => setShape('cube')} label="Cube" />
					</div>

					<div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3 sm:p-4">
						<Visualizer
							shape={shape}
							chargeSign={Math.sign(chargeC) || 1}
							radiusM={radiusM}
							heightM={heightM}
							lengthM={sideM}
						/>
					</div>

					<div className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
						<StatCard label="Charge (Q)" value={`${roundTo(chargeNc, 2)} nC`} />
						<StatCard label="Flux (Φ = Q/ε₀)" value={`${scientific(flux)} N·m²/C`} />
						<StatCard label="Surface area" value={`${roundTo(surfaceArea, 3)} m²`} />
						<StatCard label="Field direction" value={fieldDirection} />
						<StatCard label="|E| estimate" value={`${scientific(fieldEstimate)} N/C`} />
						<StatCard label="Shape" value={shape} />
					</div>
				</section>

				<section className="flex min-h-0 flex-col space-y-4 rounded-2xl border border-slate-800 bg-slate-950/80 p-4 shadow-lg shadow-slate-950/40 sm:p-5">
					<h2 className="text-sm font-semibold tracking-wide text-emerald-300">Controls for Gaussian Surface</h2>

					<ControlRow
						label="Enclosed charge"
						units="nC"
						min={-20}
						max={20}
						step={0.1}
						value={chargeNc}
						onChange={setChargeNc}
					/>

					<ControlRow
						label="Radius"
						units="m"
						min={0.2}
						max={3}
						step={0.05}
						value={radiusM}
						onChange={setRadiusM}
						disabled={shape === 'cube'}
					/>

					<ControlRow
						label="Cylinder height"
						units="m"
						min={0.4}
						max={4}
						step={0.05}
						value={heightM}
						onChange={setHeightM}
						disabled={shape !== 'cylinder'}
					/>

					<ControlRow
						label="Cube length"
						units="m"
						min={0.3}
						max={3}
						step={0.05}
						value={sideM}
						onChange={setSideM}
						disabled={shape !== 'cube'}
					/>

					<div className="rounded-lg border border-slate-800 bg-slate-900/80 p-3 text-[0.72rem] text-slate-300">
						<p>
							Gauss&apos;s Law: <span className="font-mono text-emerald-200">Φ = Q_enclosed / ε₀</span>
						</p>
						<p className="mt-2 text-slate-400">
							Changing the surface shape changes area and local field distribution, but the total
							flux stays fixed for the same enclosed charge.
						</p>
					</div>
				</section>
			</main>
		</div>
	);
}

function mapRange(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
	const t = clamp((value - inMin) / (inMax - inMin), 0, 1);
	return outMin + (outMax - outMin) * t;
}

function Visualizer({
	shape,
	chargeSign,
	radiusM,
	heightM,
	lengthM,
}: {
	shape: SurfaceShape;
	chargeSign: number;
	radiusM: number;
	heightM: number;
	lengthM: number;
}) {
	const arrowColor = chargeSign >= 0 ? '#86efac' : '#fca5a5';
	const chargeColor = chargeSign >= 0 ? 'fill-emerald-400' : 'fill-rose-400';
	const chargeText = chargeSign >= 0 ? '+' : '-';

	const sphereRadius = mapRange(radiusM, 0.2, 3, 45, 110);
	const cylinderRadius = mapRange(radiusM, 0.2, 3, 38, 95);
	const cylinderBodyHeight = mapRange(heightM, 0.4, 4, 70, 170);
	const cylinderTopY = 145 - cylinderBodyHeight / 2;
	const cylinderBottomY = 145 + cylinderBodyHeight / 2;
	const cylinderRy = Math.max(14, Math.round(cylinderRadius * 0.33));

	const cubeSize = mapRange(lengthM, 0.3, 3, 80, 170);
	const cubeHalf = cubeSize / 2;
	const cubeDepth = Math.max(16, cubeSize * 0.22);
	const cubeFrontX = 260 - cubeHalf;
	const cubeFrontY = 145 - cubeHalf;
	const cubeBackX = cubeFrontX + cubeDepth;
	const cubeBackY = cubeFrontY - cubeDepth;

	return (
		<svg viewBox="0 0 520 290" className="h-auto w-full" preserveAspectRatio="xMidYMid meet">
			<defs>
				<marker
					id="arrowHead"
					markerWidth="10"
					markerHeight="10"
					refX="8"
					refY="5"
					orient="auto"
					markerUnits="strokeWidth"
				>
					<path d="M 0 0 L 10 5 L 0 10 z" fill={arrowColor} />
				</marker>
			</defs>

			<rect x="8" y="8" width="504" height="274" rx="12" fill="rgba(2,6,23,0.65)" stroke="rgba(51,65,85,0.8)" />

			{shape === 'sphere' && (
				<circle
					cx="260"
					cy="145"
					r={sphereRadius}
					fill="rgba(16,185,129,0.08)"
					stroke="rgba(16,185,129,0.9)"
					strokeWidth="3"
				/>
			)}

			{shape === 'cylinder' && (
				<g>
					<ellipse
						cx="260"
						cy={cylinderTopY}
						rx={cylinderRadius}
						ry={cylinderRy}
						fill="rgba(16,185,129,0.08)"
						stroke="rgba(16,185,129,0.9)"
						strokeWidth="3"
					/>
					<ellipse
						cx="260"
						cy={cylinderBottomY}
						rx={cylinderRadius}
						ry={cylinderRy}
						fill="rgba(16,185,129,0.08)"
						stroke="rgba(16,185,129,0.9)"
						strokeWidth="3"
					/>
					<line
						x1={260 - cylinderRadius}
						y1={cylinderTopY}
						x2={260 - cylinderRadius}
						y2={cylinderBottomY}
						stroke="rgba(16,185,129,0.9)"
						strokeWidth="3"
					/>
					<line
						x1={260 + cylinderRadius}
						y1={cylinderTopY}
						x2={260 + cylinderRadius}
						y2={cylinderBottomY}
						stroke="rgba(16,185,129,0.9)"
						strokeWidth="3"
					/>
				</g>
			)}

			{shape === 'cube' && (
				<g>
					<rect
						x={cubeFrontX}
						y={cubeFrontY}
						width={cubeSize}
						height={cubeSize}
						fill="rgba(16,185,129,0.08)"
						stroke="rgba(16,185,129,0.9)"
						strokeWidth="3"
					/>
					<rect
						x={cubeBackX}
						y={cubeBackY}
						width={cubeSize}
						height={cubeSize}
						fill="none"
						stroke="rgba(16,185,129,0.45)"
						strokeWidth="2"
					/>
					<line x1={cubeFrontX} y1={cubeFrontY} x2={cubeBackX} y2={cubeBackY} stroke="rgba(16,185,129,0.45)" strokeWidth="2" />
					<line x1={cubeFrontX + cubeSize} y1={cubeFrontY} x2={cubeBackX + cubeSize} y2={cubeBackY} stroke="rgba(16,185,129,0.45)" strokeWidth="2" />
					<line x1={cubeFrontX} y1={cubeFrontY + cubeSize} x2={cubeBackX} y2={cubeBackY + cubeSize} stroke="rgba(16,185,129,0.45)" strokeWidth="2" />
					<line x1={cubeFrontX + cubeSize} y1={cubeFrontY + cubeSize} x2={cubeBackX + cubeSize} y2={cubeBackY + cubeSize} stroke="rgba(16,185,129,0.45)" strokeWidth="2" />
				</g>
			)}

			<line x1="260" y1="145" x2="406" y2="145" stroke={arrowColor} strokeWidth="3" markerEnd="url(#arrowHead)" />
			<line x1="260" y1="145" x2="114" y2="145" stroke={arrowColor} strokeWidth="3" markerEnd="url(#arrowHead)" />
			<line x1="260" y1="145" x2="260" y2="40" stroke={arrowColor} strokeWidth="3" markerEnd="url(#arrowHead)" />
			<line x1="260" y1="145" x2="260" y2="250" stroke={arrowColor} strokeWidth="3" markerEnd="url(#arrowHead)" />

			<circle cx="260" cy="145" r="18" className={chargeColor} />
			<text
				x="260"
				y="145"
				textAnchor="middle"
				dominantBaseline="middle"
				className="fill-slate-950 text-sm font-bold"
			>
				{chargeText}
			</text>
		</svg>
	);
}

function ShapeButton({
	active,
	onClick,
	label,
}: {
	active: boolean;
	onClick: () => void;
	label: string;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
				active
					? 'border-emerald-500 bg-emerald-500/20 text-emerald-100'
					: 'border-slate-700 bg-slate-900 text-slate-300 hover:border-emerald-600 hover:text-emerald-200'
			}`}
		>
			{label}
		</button>
	);
}

function StatCard({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-md border border-slate-800 bg-slate-900/80 px-3 py-2">
			<p className="text-[0.65rem] uppercase tracking-[0.08em] text-slate-500">{label}</p>
			<p className="mt-1 text-[0.78rem] font-medium text-emerald-200">{value}</p>
		</div>
	);
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function ControlRow({
	label,
	units,
	min,
	max,
	step,
	value,
	onChange,
	disabled = false,
}: {
	label: string;
	units: string;
	min: number;
	max: number;
	step: number;
	value: number;
	onChange: (value: number) => void;
	disabled?: boolean;
}) {
	const handleSliderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		if (disabled) return;
		onChange(Number(event.target.value));
	};

	const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		if (disabled) return;
		const parsed = Number(event.target.value);
		if (Number.isNaN(parsed)) return;
		onChange(clamp(parsed, min, max));
	};

	return (
		<div className={`space-y-1.5 ${disabled ? 'pointer-events-none opacity-50' : ''}`}>
			<div className="flex items-baseline justify-between gap-2">
				<p className="text-xs text-slate-200">{label}</p>
				<span className="text-[0.65rem] text-slate-400">
					{roundTo(value, 2).toFixed(2)} {units}
				</span>
			</div>
			<div className="flex items-center gap-3">
				<input
					type="range"
					min={min}
					max={max}
					step={step}
					value={value}
					onChange={handleSliderChange}
					disabled={disabled}
					className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-slate-800 accent-emerald-400 disabled:cursor-not-allowed"
				/>
				<div className="flex items-center gap-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1">
					<input
						type="number"
						min={min}
						max={max}
						step={step}
						value={roundTo(value, 2)}
						onChange={handleInputChange}
						disabled={disabled}
						className="w-20 bg-transparent text-right text-[0.7rem] text-slate-100 outline-none disabled:cursor-not-allowed"
					/>
					<span className="text-[0.65rem] text-slate-400">{units}</span>
				</div>
			</div>
		</div>
	);
}
