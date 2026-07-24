import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SliderWithInput } from '../../components/system/SliderWithInput';
import { ConceptBox } from '../../components/system/ConceptBox';

const MU_0 = 4 * Math.PI * 1e-7;

function scientific(value: number, digits = 3) {
	if (!Number.isFinite(value)) return '0';
	return value.toExponential(digits);
}

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

export function AmperesLaw() {
	const [currentA, setCurrentA] = useState(8);
	const [loopRadiusM, setLoopRadiusM] = useState(0.45);
	const [wireOffsetM, setWireOffsetM] = useState(0.12);
	const [muRelative, setMuRelative] = useState(1);

	const enclosedCurrent = Math.abs(wireOffsetM) < loopRadiusM ? currentA : 0;
	const circulation = MU_0 * muRelative * enclosedCurrent;
	const meanBAlongLoop = circulation / (2 * Math.PI * loopRadiusM);
	const centeredWireB = (MU_0 * muRelative * Math.abs(currentA)) / (2 * Math.PI * loopRadiusM);

	const viz = useMemo(() => {
		const loopPx = clamp((loopRadiusM / 0.9) * 110, 36, 112);
		const wireOffsetPx = clamp((wireOffsetM / 0.9) * 120, -120, 120);
		const wireInside = Math.abs(wireOffsetM) < loopRadiusM;

		return { loopPx, wireOffsetPx, wireInside };
	}, [loopRadiusM, wireOffsetM]);

	return (
		<div className="mx-auto flex min-h-[100dvh] max-w-6xl flex-col px-3 py-6 text-slate-100 sm:px-4 sm:py-8">
			<header className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-4 sm:mb-6 sm:items-center sm:gap-4">
				<div>
					<p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">E&M demo</p>
					<h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
						Ampere&apos;s Law Simulator
					</h1>
					<p className="mt-2 max-w-2xl text-sm text-slate-300">
						Move the wire and resize the Amperian loop to see when enclosed current is nonzero and how
						that sets the circulation of the magnetic field.
					</p>
				</div>

				<div className="flex flex-wrap items-center gap-3">
					<Link
						to="/dashboard"
						className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-cyan-500 hover:text-cyan-100"
					>
						← Dashboard
					</Link>
					<span className="inline-flex items-center gap-2 rounded-full border border-cyan-700/60 bg-cyan-900/50 px-3 py-1 text-[0.7rem] font-medium text-cyan-100">
						Integral B·dl = μI_enclosed
					</span>
				</div>
			</header>

			<main className="grid gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
				<section className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-lg shadow-slate-950/40 sm:p-5">
					<div className="pointer-events-none absolute inset-0 -z-10 opacity-70">
						<div className="absolute -left-32 top-0 h-64 w-64 rounded-full bg-cyan-700/25 blur-3xl" />
						<div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />
					</div>

					<h2 className="text-sm font-semibold tracking-wide text-cyan-300">Cross-Section View</h2>
					<p className="mt-1 text-xs text-slate-300">
						The dashed loop is the Amperian path. The wire marker is out of page (dot) for +I and into
						page (cross) for -I.
					</p>

					<div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/70 p-3">
						<svg viewBox="0 0 520 320" className="h-auto w-full" preserveAspectRatio="xMidYMid meet">
							<rect x="8" y="8" width="504" height="304" rx="12" fill="rgba(2,6,23,0.65)" stroke="rgba(51,65,85,0.8)" />

							<circle
								cx="260"
								cy="160"
								r={viz.loopPx}
								fill="rgba(6,182,212,0.10)"
								stroke="rgba(34,211,238,0.95)"
								strokeDasharray="7 6"
								strokeWidth="3"
							/>

							<circle
								cx={260 + viz.wireOffsetPx}
								cy="160"
								r="22"
								fill={viz.wireInside ? 'rgba(16,185,129,0.22)' : 'rgba(244,63,94,0.18)'}
								stroke={viz.wireInside ? 'rgba(52,211,153,0.95)' : 'rgba(251,113,133,0.95)'}
								strokeWidth="2.5"
							/>

							{currentA >= 0 ? (
								<>
									<circle cx={260 + viz.wireOffsetPx} cy="160" r="5" fill="rgb(186 230 253)" />
									<circle cx={260 + viz.wireOffsetPx} cy="160" r="12" fill="none" stroke="rgb(186 230 253)" strokeWidth="2" />
								</>
							) : (
								<>
									<line
										x1={260 + viz.wireOffsetPx - 8}
										y1="152"
										x2={260 + viz.wireOffsetPx + 8}
										y2="168"
										stroke="rgb(254 202 202)"
										strokeWidth="2.5"
									/>
									<line
										x1={260 + viz.wireOffsetPx + 8}
										y1="152"
										x2={260 + viz.wireOffsetPx - 8}
										y2="168"
										stroke="rgb(254 202 202)"
										strokeWidth="2.5"
									/>
								</>
							)}

							<text x="26" y="34" fill="rgb(148 163 184)" fontSize="13">
								Inside loop: {viz.wireInside ? 'yes' : 'no'}
							</text>
							<text x="26" y="54" fill="rgb(148 163 184)" fontSize="13">
								I_enclosed = {enclosedCurrent.toFixed(2)} A
							</text>
							<text x="26" y="74" fill="rgb(148 163 184)" fontSize="13">
								∮ B · dl = {scientific(circulation)} T·m
							</text>
						</svg>
					</div>

					<div className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
						<StatCard label="Current (I)" value={`${currentA.toFixed(2)} A`} />
						<StatCard label="Loop radius (r)" value={`${loopRadiusM.toFixed(2)} m`} />
						<StatCard label="Relative permeability (μr)" value={muRelative.toFixed(1)} />
						<StatCard label="Enclosed current" value={`${enclosedCurrent.toFixed(2)} A`} />
						<StatCard label="Circulation ∮B·dl" value={`${scientific(circulation)} T·m`} />
						<StatCard label="Average B on loop" value={`${scientific(meanBAlongLoop)} T`} />
						<StatCard label="B for centered wire" value={`${scientific(centeredWireB)} T`} />
					</div>
				</section>

				<section className="flex min-h-0 flex-col space-y-4 rounded-2xl border border-slate-800 bg-slate-950/80 p-4 shadow-lg shadow-slate-950/40 sm:p-5">
					<h2 className="text-sm font-semibold tracking-wide text-cyan-300">Controls</h2>

					<SliderWithInput
						label="Wire current"
						min={-20}
						max={20}
						step={0.1}
						value={currentA}
						onChange={setCurrentA}
						units="A"
						accentClass="accent-cyan-400"
					/>

					<SliderWithInput
						label="Amperian loop radius"
						min={0.1}
						max={0.9}
						step={0.01}
						value={loopRadiusM}
						onChange={setLoopRadiusM}
						units="m"
						accentClass="accent-cyan-400"
					/>

					<SliderWithInput
						label="Wire offset from center"
						min={-0.9}
						max={0.9}
						step={0.01}
						value={wireOffsetM}
						onChange={setWireOffsetM}
						units="m"
						accentClass="accent-cyan-400"
					/>

					<SliderWithInput
						label="Relative permeability (μr)"
						min={0.5}
						max={300}
						step={0.5}
						value={muRelative}
						onChange={setMuRelative}
						units=""
						accentClass="accent-cyan-400"
					/>

					<div className="rounded-lg border border-slate-800 bg-slate-900/80 p-3 text-[0.72rem] text-slate-300">
						<p>
							Ampere&apos;s Law: <span className="font-mono text-cyan-200">∮ B · dl = μ₀ μr I_enclosed</span>
						</p>
						<p className="mt-2 text-slate-400">
							When the wire sits outside the loop, the enclosed current is zero and total circulation drops to
							zero even though magnetic field exists locally.
						</p>
					</div>
				</section>

				<ConceptBox
					heading="How To Read This"
					items={[
						{
							title: 'Inside vs outside',
							description:
								'Only current enclosed by your chosen loop contributes to the circulation value. Sliding the wire across the boundary flips that condition.',
						},
						{
							title: 'Why average B?',
							description:
								'For an off-center wire, magnetic field strength around the loop is not uniform. The simulator reports circulation and the equivalent mean B.',
						},
						{
							title: 'Sign convention',
							description:
								'Positive current (dot) points out of the page. Negative current (cross) points into the page, reversing the sign of enclosed current and circulation.',
						},
						{
							title: 'Material effect',
							description:
								'Increasing μr scales circulation and magnetic field proportionally, representing higher permeability media around the loop.',
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
