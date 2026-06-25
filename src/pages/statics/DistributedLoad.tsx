import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';

type SupportType =
	| 'cable'
	| 'weightless-link'
	| 'roller'
	| 'rocker'
	| 'smooth-support'
	| 'roller-pin-slot'
	| 'journal-bearing'
	| 'external-pin'
	| 'internal-pin'
	| 'fixed-support'
	| 'thrust-bearing';

type EndSupport = {
	type: SupportType;
	angleDeg: number;
	slotAngleDeg: number;
};

type PointForce = {
	id: number;
	x: number;
	magnitude: number;
	angleDeg: number;
};

type PointMoment = {
	id: number;
	x: number;
	magnitude: number;
};

type Udl = {
	id: number;
	xStart: number;
	xEnd: number;
	w: number;
};

type Unknown = {
	label: string;
	x: number;
	coeffFx: number;
	coeffFy: number;
	coeffM: number;
};

type SolvedUnknown = {
	label: string;
	value: number;
};

type SolverResult = {
	status: 'solved' | 'indeterminate' | 'unstable';
	unknownCount: number;
	rank: number;
	reactions: SolvedUnknown[];
	sums: {
		sumFx: number;
		sumFy: number;
		sumM: number;
	};
	reactionForcesForDiagram: Array<{ x: number; fy: number }>;
	reactionMomentsForDiagram: Array<{ x: number; m: number }>;
};

const SUPPORT_OPTIONS: Array<{ value: SupportType; label: string }> = [
	{ value: 'cable', label: 'Cable' },
	{ value: 'weightless-link', label: 'Weightless link' },
	{ value: 'roller', label: 'Roller' },
	{ value: 'rocker', label: 'Rocker' },
	{ value: 'smooth-support', label: 'Smooth support' },
	{ value: 'roller-pin-slot', label: 'Roller pin in confined slot' },
	{ value: 'journal-bearing', label: 'Journal bearing' },
	{ value: 'external-pin', label: 'External pin' },
	{ value: 'internal-pin', label: 'Internal pin' },
	{ value: 'fixed-support', label: 'Fixed support' },
	{ value: 'thrust-bearing', label: 'Thrust bearing' },
];

function clamp(n: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, n));
}

function roundTo2(n: number): number {
	return Math.round(n * 100) / 100;
}

function toRad(deg: number): number {
	return (deg * Math.PI) / 180;
}

function solve3x3(a: number[][], b: number[]): { ok: boolean; rank: number; x: number[] } {
	const m = a.map((row, i) => [...row, b[i]]);
	let rank = 0;
	const n = 3;

	for (let col = 0; col < n; col++) {
		let pivot = rank;
		for (let r = rank + 1; r < n; r++) {
			if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r;
		}
		if (Math.abs(m[pivot][col]) < 1e-9) continue;
		[m[rank], m[pivot]] = [m[pivot], m[rank]];

		const pivotVal = m[rank][col];
		for (let c = col; c <= n; c++) m[rank][c] /= pivotVal;

		for (let r = 0; r < n; r++) {
			if (r === rank) continue;
			const f = m[r][col];
			for (let c = col; c <= n; c++) m[r][c] -= f * m[rank][c];
		}

		rank++;
	}

	if (rank < 3) return { ok: false, rank, x: [0, 0, 0] };
	return { ok: true, rank, x: [m[0][3], m[1][3], m[2][3]] };
}

function supportUnknowns(s: EndSupport, x: number): Unknown[] {
	switch (s.type) {
		case 'cable': {
			const a = toRad(s.angleDeg);
			return [{ label: x === 0 ? 'T_L' : 'T_R', x, coeffFx: Math.cos(a), coeffFy: Math.sin(a), coeffM: 0 }];
		}
		case 'weightless-link': {
			const a = toRad(s.angleDeg);
			return [{ label: x === 0 ? 'R_link_L' : 'R_link_R', x, coeffFx: Math.cos(a), coeffFy: Math.sin(a), coeffM: 0 }];
		}
		case 'roller':
			return [{ label: x === 0 ? 'R_Ly' : 'R_Ry', x, coeffFx: 0, coeffFy: 1, coeffM: 0 }];
		case 'rocker':
		case 'smooth-support': {
			const n = toRad(s.slotAngleDeg + 90);
			return [{ label: x === 0 ? 'R_Ln' : 'R_Rn', x, coeffFx: Math.cos(n), coeffFy: Math.sin(n), coeffM: 0 }];
		}
		case 'roller-pin-slot': {
			const n = toRad(s.slotAngleDeg + 90);
			return [{ label: x === 0 ? 'R_slot_L' : 'R_slot_R', x, coeffFx: Math.cos(n), coeffFy: Math.sin(n), coeffM: 0 }];
		}
		case 'journal-bearing':
			return [
				{ label: x === 0 ? 'R_Ly' : 'R_Ry', x, coeffFx: 0, coeffFy: 1, coeffM: 0 },
				{ label: x === 0 ? 'M_L' : 'M_R', x, coeffFx: 0, coeffFy: 0, coeffM: 1 },
			];
		case 'external-pin':
		case 'internal-pin':
		case 'thrust-bearing':
			return [
				{ label: x === 0 ? 'R_Lx' : 'R_Rx', x, coeffFx: 1, coeffFy: 0, coeffM: 0 },
				{ label: x === 0 ? 'R_Ly' : 'R_Ry', x, coeffFx: 0, coeffFy: 1, coeffM: 0 },
			];
		case 'fixed-support':
			return [
				{ label: x === 0 ? 'R_Lx' : 'R_Rx', x, coeffFx: 1, coeffFy: 0, coeffM: 0 },
				{ label: x === 0 ? 'R_Ly' : 'R_Ry', x, coeffFx: 0, coeffFy: 1, coeffM: 0 },
				{ label: x === 0 ? 'M_L' : 'M_R', x, coeffFx: 0, coeffFy: 0, coeffM: 1 },
			];
	}
}

function reactionSummary(result: SolverResult): string {
	if (result.status === 'unstable') return 'Unstable/underconstrained for static equilibrium.';
	if (result.status === 'indeterminate') return 'Statically indeterminate in this 2D solver (more than 3 reaction unknowns).';
	return 'Solved using ΣFx = 0, ΣFy = 0, ΣM = 0.';
}

export function DistributedLoad() {
	const [beamLength, setBeamLength] = useState(10);
	const [leftSupport, setLeftSupport] = useState<EndSupport>({ type: 'external-pin', angleDeg: 120, slotAngleDeg: 0 });
	const [rightSupport, setRightSupport] = useState<EndSupport>({ type: 'roller', angleDeg: 60, slotAngleDeg: 0 });

	const [pointForces, setPointForces] = useState<PointForce[]>([
		{ id: 1, x: 3, magnitude: 12, angleDeg: -90 },
		{ id: 2, x: 7.4, magnitude: 8, angleDeg: -90 },
	]);
	const [pointMoments, setPointMoments] = useState<PointMoment[]>([{ id: 1, x: 5, magnitude: -10 }]);
	const [udls, setUdls] = useState<Udl[]>([{ id: 1, xStart: 1.5, xEnd: 8.5, w: 2.2 }]);

	const nextForceId = useMemo(() => pointForces.reduce((m, p) => Math.max(m, p.id), 0) + 1, [pointForces]);
	const nextMomentId = useMemo(() => pointMoments.reduce((m, p) => Math.max(m, p.id), 0) + 1, [pointMoments]);
	const nextUdlId = useMemo(() => udls.reduce((m, p) => Math.max(m, p.id), 0) + 1, [udls]);

	const solver = useMemo<SolverResult>(() => {
		const left = supportUnknowns(leftSupport, 0);
		const right = supportUnknowns(rightSupport, beamLength);
		const unknowns = [...left, ...right];

		let extFx = 0;
		let extFy = 0;
		let extM = 0;

		for (const f of pointForces) {
			const a = toRad(f.angleDeg);
			const fx = f.magnitude * Math.cos(a);
			const fy = f.magnitude * Math.sin(a);
			extFx += fx;
			extFy += fy;
			extM += f.x * fy;
		}

		for (const m of pointMoments) extM += m.magnitude;

		for (const d of udls) {
			const a = clamp(Math.min(d.xStart, d.xEnd), 0, beamLength);
			const b = clamp(Math.max(d.xStart, d.xEnd), 0, beamLength);
			if (b <= a) continue;
			const w = d.w;
			const r = w * (b - a);
			const fy = -r;
			extFy += fy;
			extM += ((a + b) / 2) * fy;
		}

		const A = [
			unknowns.map((u) => u.coeffFx),
			unknowns.map((u) => u.coeffFy),
			unknowns.map((u) => u.coeffM + u.x * u.coeffFy),
		];
		const b = [-extFx, -extFy, -extM];

		if (unknowns.length < 3) {
			return {
				status: 'unstable',
				unknownCount: unknowns.length,
				rank: 0,
				reactions: [],
				sums: { sumFx: extFx, sumFy: extFy, sumM: extM },
				reactionForcesForDiagram: [],
				reactionMomentsForDiagram: [],
			};
		}

		if (unknowns.length > 3) {
			return {
				status: 'indeterminate',
				unknownCount: unknowns.length,
				rank: 3,
				reactions: [],
				sums: { sumFx: extFx, sumFy: extFy, sumM: extM },
				reactionForcesForDiagram: [],
				reactionMomentsForDiagram: [],
			};
		}

		const solved = solve3x3(
			[
				[A[0][0], A[0][1], A[0][2]],
				[A[1][0], A[1][1], A[1][2]],
				[A[2][0], A[2][1], A[2][2]],
			],
			b
		);

		if (!solved.ok) {
			return {
				status: 'unstable',
				unknownCount: unknowns.length,
				rank: solved.rank,
				reactions: [],
				sums: { sumFx: extFx, sumFy: extFy, sumM: extM },
				reactionForcesForDiagram: [],
				reactionMomentsForDiagram: [],
			};
		}

		const reactions: SolvedUnknown[] = unknowns.map((u, i) => ({ label: u.label, value: solved.x[i] }));

		let sumFx = extFx;
		let sumFy = extFy;
		let sumM = extM;
		const reactionForcesForDiagram: Array<{ x: number; fy: number }> = [];
		const reactionMomentsForDiagram: Array<{ x: number; m: number }> = [];

		for (let i = 0; i < unknowns.length; i++) {
			const u = unknowns[i];
			const v = solved.x[i];
			sumFx += u.coeffFx * v;
			sumFy += u.coeffFy * v;
			sumM += (u.coeffM + u.x * u.coeffFy) * v;
			if (Math.abs(u.coeffFy) > 1e-9) reactionForcesForDiagram.push({ x: u.x, fy: u.coeffFy * v });
			if (Math.abs(u.coeffM) > 1e-9) reactionMomentsForDiagram.push({ x: u.x, m: u.coeffM * v });
		}

		return {
			status: 'solved',
			unknownCount: unknowns.length,
			rank: 3,
			reactions,
			sums: { sumFx, sumFy, sumM },
			reactionForcesForDiagram,
			reactionMomentsForDiagram,
		};
	}, [leftSupport, rightSupport, beamLength, pointForces, pointMoments, udls]);

	const shearMoment = useMemo(() => {
		if (solver.status !== 'solved') return { shear: [] as Array<{ x: number; v: number }>, moment: [] as Array<{ x: number; m: number }>, maxShear: 1, maxMoment: 1 };

		const samples = 140;
		const shear: Array<{ x: number; v: number }> = [];
		const moment: Array<{ x: number; m: number }> = [];

		const verticalPointForces: Array<{ x: number; fy: number }> = [];
		for (const f of pointForces) {
			const fy = f.magnitude * Math.sin(toRad(f.angleDeg));
			verticalPointForces.push({ x: clamp(f.x, 0, beamLength), fy });
		}
		for (const r of solver.reactionForcesForDiagram) verticalPointForces.push(r);

		const allPointMoments: Array<{ x: number; m: number }> = [];
		for (const m of pointMoments) allPointMoments.push({ x: clamp(m.x, 0, beamLength), m: m.magnitude });
		for (const rm of solver.reactionMomentsForDiagram) allPointMoments.push(rm);

		for (let i = 0; i <= samples; i++) {
			const x = (beamLength * i) / samples;
			let v = 0;
			let m = 0;

			for (const pf of verticalPointForces) {
				if (pf.x <= x + 1e-9) {
					v += pf.fy;
					m += pf.fy * (x - pf.x);
				}
			}

			for (const pm of allPointMoments) {
				if (pm.x <= x + 1e-9) m += pm.m;
			}

			for (const d of udls) {
				const a = clamp(Math.min(d.xStart, d.xEnd), 0, beamLength);
				const b = clamp(Math.max(d.xStart, d.xEnd), 0, beamLength);
				if (b <= a || x <= a) continue;
				const xp = Math.min(x, b);
				const span = xp - a;
				v += -d.w * span;
				const r = d.w * span;
				const centroid = a + span / 2;
				m += -r * (x - centroid);
			}

			shear.push({ x, v });
			moment.push({ x, m });
		}

		const maxShear = Math.max(1, ...shear.map((p) => Math.abs(p.v)));
		const maxMoment = Math.max(1, ...moment.map((p) => Math.abs(p.m)));
		return { shear, moment, maxShear, maxMoment };
	}, [solver, pointForces, pointMoments, udls, beamLength]);

	const addPointForce = () => {
		setPointForces((prev) => [...prev, { id: nextForceId, x: beamLength * 0.5, magnitude: 6, angleDeg: -90 }]);
	};

	const addPointMoment = () => {
		setPointMoments((prev) => [...prev, { id: nextMomentId, x: beamLength * 0.5, magnitude: 8 }]);
	};

	const addUdl = () => {
		setUdls((prev) => [...prev, { id: nextUdlId, xStart: beamLength * 0.2, xEnd: beamLength * 0.8, w: 1.5 }]);
	};

	const netOK =
		Math.abs(solver.sums.sumFx) < 1e-6 &&
		Math.abs(solver.sums.sumFy) < 1e-6 &&
		Math.abs(solver.sums.sumM) < 1e-6 &&
		solver.status === 'solved';

	return (
		<div className="mx-auto flex min-h-[100dvh] max-w-7xl flex-col px-3 py-6 text-slate-100 sm:px-4 sm:py-8">
			<header className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-4 sm:mb-6 sm:items-center sm:gap-4">
				<div>
					<p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-300">Statics demo</p>
					<h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">Beam Support and Load Analyzer</h1>
					<p className="mt-2 max-w-3xl text-sm text-slate-300">
						Choose end supports, add point forces, moments, and distributed loads, then inspect reactions, shear, and bending moment.
					</p>
				</div>

				<Link
					to="/dashboard"
					className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-red-500 hover:text-red-100"
				>
					← Dashboard
				</Link>
			</header>

			<main className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
				<section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-lg shadow-slate-950/40 sm:p-5">
					<h2 className="text-sm font-semibold tracking-wide text-red-300">Beam and Diagrams</h2>
					<p className="mt-1 text-xs text-slate-300">Sign convention: +Fy up, +M counterclockwise.</p>

					<div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/70 p-3 sm:p-4">
						<BeamView
							beamLength={beamLength}
							leftSupport={leftSupport}
							rightSupport={rightSupport}
							pointForces={pointForces}
							pointMoments={pointMoments}
							udls={udls}
						/>
					</div>

					<div className="mt-4 grid gap-3 md:grid-cols-2">
						<Diagram title="Shear Force V(x)" color="rgba(96,165,250,0.95)" points={shearMoment.shear.map((p) => ({ x: p.x, y: p.v }))} maxAbs={shearMoment.maxShear} xMax={beamLength} units="N" />
						<Diagram title="Bending Moment M(x)" color="rgba(248,113,113,0.95)" points={shearMoment.moment.map((p) => ({ x: p.x, y: p.m }))} maxAbs={shearMoment.maxMoment} xMax={beamLength} units="N·m" />
					
                        <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-3 text-xs text-slate-300">
						<p className="font-semibold text-slate-100">Reaction Forces</p>
						<p className="mt-1 text-[0.72rem] text-slate-400">{reactionSummary(solver)}</p>
						{solver.reactions.length === 0 ? (
							<p className="mt-2 text-[0.72rem] text-slate-500">No unique reaction set available for this support combination.</p>
						) : (
							<div className="mt-2 grid gap-1">
								{solver.reactions.map((r) => (
									<p key={r.label} className="text-[0.72rem] text-slate-200">{r.label}: {roundTo2(r.value)}</p>
								))}
							</div>
						)}
					</div>

					<div className="rounded-lg border border-slate-800 bg-slate-900/80 p-3 text-xs text-slate-300">
						<p className="font-semibold text-slate-100">Net Equilibrium Check</p>
						<p className="mt-1 text-[0.72rem] text-slate-200">ΣFx = {roundTo2(solver.sums.sumFx)} N</p>
						<p className="text-[0.72rem] text-slate-200">ΣFy = {roundTo2(solver.sums.sumFy)} N</p>
						<p className="text-[0.72rem] text-slate-200">ΣM = {roundTo2(solver.sums.sumM)} N·m</p>
						<p className={`mt-2 text-[0.72rem] font-semibold ${netOK ? 'text-emerald-300' : 'text-amber-300'}`}>
							{netOK ? 'Equilibrium satisfied (within tolerance).' : 'Equilibrium not satisfied or support set is not solvable.'}
						</p>
					</div>
                    </div>
				</section>

				<section className="flex min-h-0 flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-950/80 p-4 shadow-lg shadow-slate-950/40 sm:p-5">
					<h2 className="text-sm font-semibold tracking-wide text-red-300">Inputs and Results</h2>

					<div className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/80 p-3 text-xs">
						<label className="block text-slate-300">Beam length L (m)</label>
						<input
							type="number"
							min={2}
							max={40}
							step={0.5}
							value={roundTo2(beamLength)}
							onChange={(e) => setBeamLength(clamp(Number(e.target.value), 2, 40))}
							className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-100 outline-none"
						/>
					</div>

					<SupportEditor title="Left end (x=0)" support={leftSupport} onChange={setLeftSupport} />
					<SupportEditor title="Right end (x=L)" support={rightSupport} onChange={setRightSupport} />

					<LoadEditor
						beamLength={beamLength}
						pointForces={pointForces}
						pointMoments={pointMoments}
						udls={udls}
						onPointForcesChange={setPointForces}
						onPointMomentsChange={setPointMoments}
						onUdlsChange={setUdls}
						onAddPointForce={addPointForce}
						onAddPointMoment={addPointMoment}
						onAddUdl={addUdl}
					/>

					
				</section>
			</main>
		</div>
	);
}

function SupportEditor({
	title,
	support,
	onChange,
}: {
	title: string;
	support: EndSupport;
	onChange: (next: EndSupport) => void;
}) {
	const needsAngle = support.type === 'cable' || support.type === 'weightless-link';
	const needsSlot = support.type === 'roller-pin-slot' || support.type === 'rocker' || support.type === 'smooth-support';

	return (
		<div className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/80 p-3 text-xs">
			<p className="font-semibold text-slate-100">{title}</p>
			<select
				value={support.type}
				onChange={(e) => onChange({ ...support, type: e.target.value as SupportType })}
				className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-100 outline-none"
			>
				{SUPPORT_OPTIONS.map((o) => (
					<option key={o.value} value={o.value}>{o.label}</option>
				))}
			</select>

			{needsAngle && (
				<div>
					<label className="block text-slate-300">Reaction axis angle (deg from +x)</label>
					<input
						type="number"
						step={1}
						value={roundTo2(support.angleDeg)}
						onChange={(e) => onChange({ ...support, angleDeg: Number(e.target.value) })}
						className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-100 outline-none"
					/>
				</div>
			)}

			{needsSlot && (
				<div>
					<label className="block text-slate-300">
						{support.type === 'roller-pin-slot' ? 'Slot axis angle (deg from +x)' : 'Surface angle (deg from +x)'}
					</label>
					<input
						type="number"
						step={1}
						value={roundTo2(support.slotAngleDeg)}
						onChange={(e) => onChange({ ...support, slotAngleDeg: Number(e.target.value) })}
						className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-100 outline-none"
					/>
				</div>
			)}
		</div>
	);
}

function LoadEditor({
	beamLength,
	pointForces,
	pointMoments,
	udls,
	onPointForcesChange,
	onPointMomentsChange,
	onUdlsChange,
	onAddPointForce,
	onAddPointMoment,
	onAddUdl,
}: {
	beamLength: number;
	pointForces: PointForce[];
	pointMoments: PointMoment[];
	udls: Udl[];
	onPointForcesChange: (next: PointForce[]) => void;
	onPointMomentsChange: (next: PointMoment[]) => void;
	onUdlsChange: (next: Udl[]) => void;
	onAddPointForce: () => void;
	onAddPointMoment: () => void;
	onAddUdl: () => void;
}) {
	return (
		<div className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/80 p-3 text-xs">
			<div className="flex items-center justify-between">
				<p className="font-semibold text-slate-100">Loads</p>
				<div className="flex gap-2">
					<button type="button" onClick={onAddPointForce} className="rounded border border-sky-600/60 bg-sky-600/20 px-2 py-1 text-[0.68rem] text-sky-100">+ Force</button>
					<button type="button" onClick={onAddPointMoment} className="rounded border border-amber-600/60 bg-amber-600/20 px-2 py-1 text-[0.68rem] text-amber-100">+ Moment</button>
					<button type="button" onClick={onAddUdl} className="rounded border border-purple-600/60 bg-purple-600/20 px-2 py-1 text-[0.68rem] text-purple-100">+ UDL</button>
				</div>
			</div>

			{pointForces.map((f) => (
				<div key={`pf-${f.id}`} className="grid grid-cols-4 gap-2 rounded border border-slate-800 bg-sky-950/70 p-2">
					<input type="number" value={roundTo2(f.x)} onChange={(e) => onPointForcesChange(pointForces.map((it) => it.id === f.id ? { ...it, x: clamp(Number(e.target.value), 0, beamLength) } : it))} className="rounded border border-slate-700 bg-slate-950 px-2 py-1" title="x (m)" />
					<input type="number" value={roundTo2(f.magnitude)} onChange={(e) => onPointForcesChange(pointForces.map((it) => it.id === f.id ? { ...it, magnitude: Number(e.target.value) } : it))} className="rounded border border-slate-700 bg-slate-950 px-2 py-1" title="F (N)" />
					<input type="number" value={roundTo2(f.angleDeg)} onChange={(e) => onPointForcesChange(pointForces.map((it) => it.id === f.id ? { ...it, angleDeg: Number(e.target.value) } : it))} className="rounded border border-slate-700 bg-slate-950 px-2 py-1" title="deg" />
					<button type="button" onClick={() => onPointForcesChange(pointForces.filter((it) => it.id !== f.id))} className="rounded border border-slate-700 px-2 py-1 text-red-300">remove</button>
				</div>
			))}

			{pointMoments.map((m) => (
				<div key={`pm-${m.id}`} className="grid grid-cols-3 gap-2 rounded border border-slate-800 bg-amber-950/70 p-2">
					<input type="number" value={roundTo2(m.x)} onChange={(e) => onPointMomentsChange(pointMoments.map((it) => it.id === m.id ? { ...it, x: clamp(Number(e.target.value), 0, beamLength) } : it))} className="rounded border border-slate-700 bg-slate-950 px-2 py-1" title="x (m)" />
					<input type="number" value={roundTo2(m.magnitude)} onChange={(e) => onPointMomentsChange(pointMoments.map((it) => it.id === m.id ? { ...it, magnitude: Number(e.target.value) } : it))} className="rounded border border-slate-700 bg-slate-950 px-2 py-1" title="M (N.m)" />
					<button type="button" onClick={() => onPointMomentsChange(pointMoments.filter((it) => it.id !== m.id))} className="rounded border border-slate-700 px-2 py-1 text-red-300">remove</button>
				</div>
			))}

			{udls.map((d) => (
				<div key={`udl-${d.id}`} className="grid grid-cols-4 gap-2 rounded border border-slate-800 bg-purple-600/20 p-2">
					<input type="number" value={roundTo2(d.xStart)} onChange={(e) => onUdlsChange(udls.map((it) => it.id === d.id ? { ...it, xStart: clamp(Number(e.target.value), 0, beamLength) } : it))} className="rounded border border-slate-700 bg-slate-950 px-2 py-1" title="start (m)" />
					<input type="number" value={roundTo2(d.xEnd)} onChange={(e) => onUdlsChange(udls.map((it) => it.id === d.id ? { ...it, xEnd: clamp(Number(e.target.value), 0, beamLength) } : it))} className="rounded border border-slate-700 bg-slate-950 px-2 py-1" title="end (m)" />
					<input type="number" value={roundTo2(d.w)} onChange={(e) => onUdlsChange(udls.map((it) => it.id === d.id ? { ...it, w: Math.max(0, Number(e.target.value)) } : it))} className="rounded border border-slate-700 bg-slate-950 px-2 py-1" title="w (N/m down)" />
					<button type="button" onClick={() => onUdlsChange(udls.filter((it) => it.id !== d.id))} className="rounded border border-slate-700 px-2 py-1 text-red-300">remove</button>
				</div>
			))}

			<div className="text-[0.68rem] text-slate-400">
				Point force fields: x, magnitude, angle(deg). Point moment: x, M. UDL: start, end, w (downward N/m).
			</div>
		</div>
	);
}

function BeamView({
	beamLength,
	leftSupport,
	rightSupport,
	pointForces,
	pointMoments,
	udls,
}: {
	beamLength: number;
	leftSupport: EndSupport;
	rightSupport: EndSupport;
	pointForces: PointForce[];
	pointMoments: PointMoment[];
	udls: Udl[];
}) {
	const mapX = (x: number) => 40 + (clamp(x, 0, beamLength) / beamLength) * 520;
	const drawAxisForce = (x: number, y: number, angleDeg: number, label: string, color: string, showTheta: boolean) => {
		const a = toRad(angleDeg);
		const len = 38;
		const x2 = x + Math.cos(a) * len;
		const y2 = y - Math.sin(a) * len;
		const thetaX = x + Math.cos(a) * 18 + 5;
		const thetaY = y - Math.sin(a) * 18 + 10;
		return (
			<g>
				<line x1={x} y1={y} x2={x2} y2={y2} stroke={color} strokeWidth="2" markerEnd="url(#arrSupport)" />
				<text x={x2 + 4} y={y2 - 2} className="fill-red-200 text-[9px]">{label}</text>
				{showTheta && <text x={thetaX} y={thetaY} className="fill-slate-300 text-[9px]">θ</text>}
			</g>
		);
	};

	const drawComponentForces = (x: number, y: number, includeFx: boolean, includeFy: boolean, includeM: boolean) => (
		<g>
			{includeFx && (
				<>
					<line x1={x} y1={y} x2={x + 34} y2={y} stroke="rgba(248,113,113,0.95)" strokeWidth="2" markerEnd="url(#arrSupport)" />
					<text x={x + 38} y={y + 4} className="fill-red-200 text-[9px]">Fx</text>
				</>
			)}
			{includeFy && (
				<>
					<line x1={x} y1={y} x2={x} y2={y - 34} stroke="rgba(248,113,113,0.95)" strokeWidth="2" markerEnd="url(#arrSupport)" />
					<text x={x + 4} y={y - 36} className="fill-red-200 text-[9px]">Fy</text>
				</>
			)}
			{includeM && (
				<>
					<path d={`M ${x - 12} ${y + 10} A 12 12 0 1 0 ${x + 12} ${y + 10}`} fill="none" stroke="rgba(216,180,254,0.95)" strokeWidth="2" />
					<text x={x - 20} y={y + 26} className="fill-fuchsia-200 text-[9px]">M</text>
				</>
			)}
		</g>
	);

	const drawSupportSymbol = (x: number, support: EndSupport, side: 'left' | 'right') => {
		const dir = side === 'left' ? -1 : 1;
		switch (support.type) {
			case 'fixed-support':
				return <rect x={x + dir * 2 - (dir < 0 ? 8 : 0)} y="102" width="8" height="56" fill="rgba(148,163,184,0.75)" />;
			case 'external-pin':
				return <polygon points={`${x - 14},148 ${x + 14},148 ${x},130`} fill="rgba(148,163,184,0.85)" />;
			case 'internal-pin':
				return (
					<g>
						<line x1={x} y1="130" x2={x + dir * 20} y2="158" stroke="rgba(190,242,100,0.9)" strokeWidth="6" strokeLinecap="round" />
						<circle cx={x} cy="130" r="4" fill="rgba(226,232,240,0.95)" />
					</g>
				);
			case 'roller':
				return (
					<g>
						<circle cx={x} cy="142" r="7" fill="rgba(203,213,225,0.9)" />
						<line x1={x - 20} y1="151" x2={x + 20} y2="151" stroke="rgba(148,163,184,0.85)" strokeWidth="2" />
					</g>
				);
			case 'rocker':
				return (
					<g>
						<line x1={x - 18} y1="156" x2={x + 18} y2="138" stroke="rgba(148,163,184,0.85)" strokeWidth="3" />
						<circle cx={x} cy="139" r="6" fill="rgba(203,213,225,0.95)" />
					</g>
				);
			case 'smooth-support':
				return <line x1={x - 18} y1="156" x2={x + 18} y2="138" stroke="rgba(148,163,184,0.9)" strokeWidth="4" />;
			case 'roller-pin-slot':
				return (
					<g>
						<line x1={x - 20} y1="156" x2={x + 20} y2="134" stroke="rgba(148,163,184,0.85)" strokeWidth="3" />
						<line x1={x - 14} y1="162" x2={x + 26} y2="140" stroke="rgba(100,116,139,0.85)" strokeWidth="2" />
						<circle cx={x} cy="140" r="6" fill="rgba(203,213,225,0.95)" />
					</g>
				);
			case 'journal-bearing':
				return (
					<g>
						<rect x={x - 5} y="118" width="10" height="24" fill="rgba(148,163,184,0.9)" />
						<rect x={x - 14} y="112" width="6" height="36" fill="rgba(100,116,139,0.95)" />
					</g>
				);
			case 'thrust-bearing':
				return (
					<g>
						<rect x={x - 6} y="116" width="12" height="28" fill="rgba(148,163,184,0.9)" />
						<rect x={x + dir * 8 - 3} y="112" width="6" height="36" fill="rgba(100,116,139,0.95)" />
					</g>
				);
			case 'cable':
				return <line x1={x} y1="130" x2={x + dir * -28} y2="92" stroke="rgba(192,132,252,0.95)" strokeWidth="4" strokeLinecap="round" />;
			case 'weightless-link':
				return (
					<g>
						<line x1={x} y1="130" x2={x + dir * -28} y2="100" stroke="rgba(226,232,240,0.95)" strokeWidth="4" strokeLinecap="round" />
						<circle cx={x} cy="130" r="3" fill="rgba(15,23,42,1)" stroke="rgba(226,232,240,0.95)" />
					</g>
				);
		}
	};

	const drawSupportForces = (x: number, support: EndSupport) => {
		switch (support.type) {
			case 'fixed-support':
				return drawComponentForces(x + 2, 116, true, true, true);
			case 'thrust-bearing':
				return drawComponentForces(x + 2, 116, true, true, true);
			case 'external-pin':
			case 'internal-pin':
				return drawComponentForces(x + 2, 116, true, true, false);
			case 'journal-bearing':
				return drawComponentForces(x + 2, 116, false, true, true);
			case 'roller':
				return drawAxisForce(x + 2, 116, 90, 'F', 'rgba(248,113,113,0.95)', false);
			case 'rocker':
			case 'smooth-support':
				return drawAxisForce(x + 2, 116, support.slotAngleDeg + 90, 'F', 'rgba(248,113,113,0.95)', true);
			case 'roller-pin-slot':
				return drawAxisForce(x + 2, 116, support.slotAngleDeg + 90, 'F', 'rgba(248,113,113,0.95)', true);
			case 'cable':
			case 'weightless-link':
				return drawAxisForce(x + 2, 116, support.angleDeg, 'F', 'rgba(248,113,113,0.95)', true);
		}
	};

	return (
		<svg viewBox="0 0 600 220" className="h-auto w-full" preserveAspectRatio="xMidYMid meet">
			<defs>
				<marker id="arrDown" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
					<path d="M0,0 L8,4 L0,8 z" fill="rgba(248,250,252,0.9)" />
				</marker>
				<marker id="arrUp" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
					<path d="M0,0 L8,4 L0,8 z" fill="rgba(74,222,128,0.95)" />
				</marker>
				<marker id="arrSupport" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
					<path d="M0,0 L8,4 L0,8 z" fill="rgba(248,113,113,0.95)" />
				</marker>
			</defs>

			<rect x="8" y="8" width="584" height="204" rx="12" fill="rgba(2,6,23,0.65)" stroke="rgba(51,65,85,0.8)" />
			<line x1="40" y1="130" x2="560" y2="130" stroke="rgba(148,163,184,0.95)" strokeWidth="8" strokeLinecap="round" />

			<text x="34" y="154" className="fill-slate-400 text-[10px]">0</text>
			<text x="548" y="154" className="fill-slate-400 text-[10px]">L</text>

			<text x="30" y="24" className="fill-slate-300 text-[10px]">Left: {leftSupport.type}</text>
			<text x="360" y="24" className="fill-slate-300 text-[10px]">Right: {rightSupport.type}</text>

			{drawSupportSymbol(mapX(0), leftSupport, 'left')}
			{drawSupportSymbol(mapX(beamLength), rightSupport, 'right')}
			{drawSupportForces(mapX(0), leftSupport)}
			{drawSupportForces(mapX(beamLength), rightSupport)}

			{pointForces.map((f) => {
				const x = mapX(f.x);
				return (
					<g key={`f-${f.id}`}>
						<line x1={x} y1="70" x2={x} y2="124" stroke="rgba(241,245,249,0.95)" strokeWidth="2" markerEnd="url(#arrDown)" />
						<text x={x + 4} y="66" className="fill-slate-200 text-[9px]">F {roundTo2(f.magnitude)}N</text>
					</g>
				);
			})}

			{udls.map((d) => {
				const a = mapX(Math.min(d.xStart, d.xEnd));
				const b = mapX(Math.max(d.xStart, d.xEnd));
				const arrows = 8;
				const step = (b - a) / arrows;
				return (
					<g key={`u-${d.id}`}>
						<line x1={a} y1="52" x2={b} y2="52" stroke="rgba(167,139,250,0.95)" strokeWidth="2" />
						{Array.from({ length: arrows + 1 }).map((_, i) => {
							const x = a + i * step;
							return <line key={`${d.id}-${i}`} x1={x} y1="52" x2={x} y2="124" stroke="rgba(196,181,253,0.9)" strokeWidth="1.4" markerEnd="url(#arrDown)" />;
						})}
						<text x={a} y="46" className="fill-purple-200 text-[9px]">w={roundTo2(d.w)}N/m</text>
					</g>
				);
			})}

			{pointMoments.map((m) => {
				const x = mapX(m.x);
				const cw = m.magnitude < 0;
				return (
					<g key={`m-${m.id}`}>
						<path d={cw ? `M ${x - 15} 152 A 15 15 0 1 0 ${x + 15} 152` : `M ${x + 15} 152 A 15 15 0 1 0 ${x - 15} 152`} fill="none" stroke="rgba(251,191,36,0.95)" strokeWidth="2" />
						<text x={x - 12} y="170" className="fill-amber-200 text-[9px]">M={roundTo2(m.magnitude)}</text>
					</g>
				);
			})}

			
		</svg>
	);
}

function Diagram({
	title,
	points,
	maxAbs,
	xMax,
	color,
	units,
}: {
	title: string;
	points: Array<{ x: number; y: number }>;
	maxAbs: number;
	xMax: number;
	color: string;
	units: string;
}) {
	const toSvgX = (x: number) => 40 + (x / Math.max(1e-9, xMax)) * 440;
	const toSvgY = (y: number) => 100 - (y / Math.max(1e-9, maxAbs)) * 70;
	const d = points
		.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toSvgX(p.x)} ${toSvgY(p.y)}`)
		.join(' ');

	return (
		<div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
			<p className="text-xs font-semibold text-slate-100">{title}</p>
			<svg viewBox="0 0 520 200" className="mt-2 h-auto w-full" preserveAspectRatio="xMidYMid meet">
				<rect x="8" y="8" width="504" height="184" rx="10" fill="rgba(2,6,23,0.5)" stroke="rgba(51,65,85,0.8)" />
				<line x1="40" y1="100" x2="480" y2="100" stroke="rgba(100,116,139,0.9)" strokeWidth="1" />
				<line x1="40" y1="30" x2="40" y2="170" stroke="rgba(100,116,139,0.9)" strokeWidth="1" />
				<path d={d} fill="none" stroke={color} strokeWidth="2.2" />
				<text x="44" y="24" className="fill-slate-300 text-[9px]">+{roundTo2(maxAbs)} {units}</text>
				<text x="44" y="182" className="fill-slate-300 text-[9px]">-{roundTo2(maxAbs)} {units}</text>
				<text x="466" y="114" className="fill-slate-400 text-[9px]">x</text>
			</svg>
		</div>
	);
}
