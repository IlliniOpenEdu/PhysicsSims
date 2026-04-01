import { Link } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';

type Vec2 = { x: number; y: number };

type Charge = {
	id: number;
	sign: 1 | -1;
	pos: Vec2;
};

type Magnet = {
	id: number;
	pos: Vec2;
	angleRad: number;
};

type DragTarget =
	| { kind: 'charge'; id: number }
	| { kind: 'magnet'; id: number };

function clamp(n: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, n));
}

function randomInRange(min: number, max: number): number {
	return min + Math.random() * (max - min);
}

function roundTo2(n: number): number {
	return Math.round(n * 100) / 100;
}

export function MagField() {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const nextIdRef = useRef(1);
	const drawSceneRef = useRef<(() => void) | null>(null);

	const [charges, setCharges] = useState<Charge[]>([]);
	const [magnets, setMagnets] = useState<Magnet[]>([]);
	const [fieldDensity, setFieldDensity] = useState(24);
	const [draggingTarget, setDraggingTarget] = useState<DragTarget | null>(null);
	const dragOffsetRef = useRef<Vec2>({ x: 0, y: 0 });

	drawSceneRef.current = () => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		const w = canvas.clientWidth;
		const h = canvas.clientHeight;

		ctx.clearRect(0, 0, w, h);

		const bg = ctx.createLinearGradient(0, 0, 0, h);
		bg.addColorStop(0, 'rgba(2,6,23,0.95)');
		bg.addColorStop(1, 'rgba(15,23,42,0.95)');
		ctx.fillStyle = bg;
		ctx.fillRect(0, 0, w, h);

		drawElectricField(ctx, w, h, charges, magnets, fieldDensity);
		drawMagnets(ctx, magnets);
		drawCharges(ctx, charges);
	};

	const totalNetCharge = useMemo(
		() => charges.reduce((acc, c) => acc + c.sign, 0),
		[charges]
	);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const resize = () => {
			const parent = canvas.parentElement;
			if (!parent) return;
			const rect = parent.getBoundingClientRect();
			const dpr = Math.max(1, window.devicePixelRatio || 1);
			const nextW = Math.max(320, Math.floor(rect.width));
			const nextH = Math.max(240, Math.floor(rect.height));
			canvas.width = Math.floor(nextW * dpr);
			canvas.height = Math.floor(nextH * dpr);
			canvas.style.width = `${nextW}px`;
			canvas.style.height = `${nextH}px`;
			const ctx = canvas.getContext('2d');
			if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			drawSceneRef.current?.();
		};

		resize();
		const ro = new ResizeObserver(resize);
		ro.observe(canvas.parentElement ?? canvas);
		return () => ro.disconnect();
	}, []);

	useEffect(() => {
		drawSceneRef.current?.();
	}, [charges, magnets, fieldDensity]);

	const getPointerPos = (event: React.PointerEvent<HTMLCanvasElement>): Vec2 | null => {
		const canvas = canvasRef.current;
		if (!canvas) return null;
		const rect = canvas.getBoundingClientRect();
		return {
			x: event.clientX - rect.left,
			y: event.clientY - rect.top,
		};
	};

	const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const point = getPointerPos(event);
		if (!point) return;

		let hit: Charge | null = null;
		for (let i = charges.length - 1; i >= 0; i--) {
			const c = charges[i];
			const dx = point.x - c.pos.x;
			const dy = point.y - c.pos.y;
			if (dx * dx + dy * dy <= 17 * 17) {
				hit = c;
				break;
			}
		}

		if (hit) {
			setDraggingTarget({ kind: 'charge', id: hit.id });
			dragOffsetRef.current = {
				x: hit.pos.x - point.x,
				y: hit.pos.y - point.y,
			};
			canvas.setPointerCapture(event.pointerId);
			return;
		}

		let hitMagnet: Magnet | null = null;
		for (let i = magnets.length - 1; i >= 0; i--) {
			const m = magnets[i];
			const dx = point.x - m.pos.x;
			const dy = point.y - m.pos.y;
			if (dx * dx + dy * dy <= 30 * 30) {
				hitMagnet = m;
				break;
			}
		}

		if (!hitMagnet) return;
		setDraggingTarget({ kind: 'magnet', id: hitMagnet.id });
		dragOffsetRef.current = {
			x: hitMagnet.pos.x - point.x,
			y: hitMagnet.pos.y - point.y,
		};
		canvas.setPointerCapture(event.pointerId);
	};

	const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
		if (!draggingTarget) return;
		const canvas = canvasRef.current;
		if (!canvas) return;
		const point = getPointerPos(event);
		if (!point) return;

		const nextX = point.x + dragOffsetRef.current.x;
		const nextY = point.y + dragOffsetRef.current.y;
		const margin = 14;
		const clampedX = clamp(nextX, margin, Math.max(margin, canvas.clientWidth - margin));
		const clampedY = clamp(nextY, margin, Math.max(margin, canvas.clientHeight - margin));

		if (draggingTarget.kind === 'charge') {
			setCharges((prev) =>
				prev.map((c) => (c.id === draggingTarget.id ? { ...c, pos: { x: clampedX, y: clampedY } } : c))
			);
			return;
		}

		setMagnets((prev) =>
			prev.map((m) => (m.id === draggingTarget.id ? { ...m, pos: { x: clampedX, y: clampedY } } : m))
		);
	};

	const endDrag = () => {
		setDraggingTarget(null);
	};

	const addCharge = (sign: 1 | -1) => {
		setCharges((prev) => [
			...prev,
			{
				id: nextIdRef.current++,
				sign,
				pos: {
					x: randomInRange(120, 520),
					y: randomInRange(90, 290),
				},
			},
		]);
	};

	const addMagnet = () => {
		setMagnets((prev) => [
			...prev,
			{
				id: nextIdRef.current++,
				pos: {
					x: randomInRange(140, 500),
					y: randomInRange(100, 280),
				},
				angleRad: randomInRange(-Math.PI / 2, Math.PI / 2),
			},
		]);
	};

	const clearAll = () => {
		setCharges([]);
		setMagnets([]);
	};

	return (
		<div className="mx-auto flex min-h-[100dvh] max-w-6xl flex-col px-3 py-6 text-slate-100 sm:px-4 sm:py-8">
			<header className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-4 sm:mb-6 sm:items-center sm:gap-4">
				<div>
					<p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300">E&M demo</p>
					<h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">Magnetic Field Simulator</h1>
					<p className="mt-2 max-w-2xl text-sm text-slate-300">
						Add positive and negative point charges plus bar magnets. The electric field background is
						rendered live from the placed charges.
					</p>
				</div>

				<Link
					to="/"
					className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-indigo-500 hover:text-indigo-100"
				>
					<span className="text-sm">←</span>
					Back to welcome
				</Link>
			</header>

			<main className="grid gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
				<section className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-lg shadow-slate-950/40 sm:p-5">
					<div className="pointer-events-none absolute inset-0 -z-10 opacity-70">
						<div className="absolute -left-32 top-0 h-64 w-64 rounded-full bg-indigo-700/25 blur-3xl" />
						<div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-cyan-500/20 blur-3xl" />
					</div>

					<h2 className="text-sm font-semibold tracking-wide text-indigo-300">Field View</h2>
					<p className="mt-1 text-xs text-slate-300">Arrows indicate electric field direction and local strength from all charges.</p>

					<div className="mt-4 h-[22rem] rounded-xl border border-slate-800 bg-slate-950/70 p-2 sm:h-[26rem] sm:p-3">
						<canvas
							ref={canvasRef}
							onPointerDown={handlePointerDown}
							onPointerMove={handlePointerMove}
							onPointerUp={endDrag}
							onPointerCancel={endDrag}
							onPointerLeave={endDrag}
							className={`h-full w-full rounded-lg bg-slate-950/60 ${draggingTarget != null ? 'cursor-grabbing' : 'cursor-grab'}`}
						/>
					</div>
				</section>

				<section className="flex min-h-0 flex-col space-y-4 rounded-2xl border border-slate-800 bg-slate-950/80 p-4 shadow-lg shadow-slate-950/40 sm:p-5">
					<h2 className="text-sm font-semibold tracking-wide text-indigo-300">Tools</h2>

					<div className="grid gap-2">
						<button
							type="button"
							onClick={() => addCharge(1)}
							className="rounded-lg border border-emerald-500/60 bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/25"
						>
							Add + point charge
						</button>
						<button
							type="button"
							onClick={() => addCharge(-1)}
							className="rounded-lg border border-rose-500/60 bg-rose-500/15 px-3 py-2 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/25"
						>
							Add - point charge
						</button>
						<button
							type="button"
							onClick={addMagnet}
							className="rounded-lg border border-indigo-500/60 bg-indigo-500/15 px-3 py-2 text-xs font-semibold text-indigo-100 transition hover:bg-indigo-500/25"
						>
							Add magnet
						</button>
						<button
							type="button"
							onClick={clearAll}
							className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-slate-500"
						>
							Clear all
						</button>
					</div>

					<div className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/80 p-3 text-xs text-slate-300">
						<p className="font-semibold text-slate-100">Field density</p>
						<input
							type="range"
							min={16}
							max={36}
							step={1}
							value={fieldDensity}
							onChange={(e) => setFieldDensity(clamp(Number(e.target.value), 16, 36))}
							className="h-1 w-full cursor-pointer appearance-none rounded-full bg-slate-800 accent-indigo-400"
						/>
						<p className="text-[0.7rem] text-slate-400">grid step: {fieldDensity}px</p>
						<p className="text-[0.7rem] text-slate-500">Tip: drag point charges and magnets directly on the field view.</p>
					</div>

					<div className="grid gap-2 text-xs">
						<Metric label="Point charges" value={String(charges.length)} />
						<Metric label="Magnets" value={String(magnets.length)} />
						<Metric label="Net charge" value={`${roundTo2(totalNetCharge)} q-units`} />
					</div>
				</section>
			</main>
		</div>
	);
}

function drawElectricField(
	ctx: CanvasRenderingContext2D,
	w: number,
	h: number,
	charges: Charge[],
	magnets: Magnet[],
	step: number
) {
	if (charges.length === 0 && magnets.length === 0) return;

	const chargeScale = 1600;
	const dipoleScale = 58000;
	const softening = 120;

	for (let y = step; y < h - step; y += step) {
		for (let x = step; x < w - step; x += step) {
			let ex = 0;
			let ey = 0;

			for (const c of charges) {
				const dx = x - c.pos.x;
				const dy = y - c.pos.y;
				const r2 = dx * dx + dy * dy + softening;
				const invR = 1 / Math.sqrt(r2);
				const contrib = (chargeScale * c.sign) / r2;
				ex += contrib * dx * invR;
				ey += contrib * dy * invR;
			}

			for (const m of magnets) {
				const rx = x - m.pos.x;
				const ry = y - m.pos.y;
				const r2 = rx * rx + ry * ry + softening;
				const r = Math.sqrt(r2);
				const invR = 1 / r;
				const rhatX = rx * invR;
				const rhatY = ry * invR;
				const mx = Math.cos(m.angleRad);
				const my = Math.sin(m.angleRad);
				const mdotr = mx * rhatX + my * rhatY;
				const factor = dipoleScale / (r2 * r);

				ex += factor * (3 * mdotr * rhatX - mx);
				ey += factor * (3 * mdotr * rhatY - my);
			}

			const mag = Math.sqrt(ex * ex + ey * ey);
			if (mag < 0.001) continue;

			const dirX = ex / mag;
			const dirY = ey / mag;
			const len = clamp(mag * 26, 5, 13);

			const x2 = x + dirX * len;
			const y2 = y + dirY * len;
			const alpha = clamp(mag * 0.18, 0.18, 0.75);

			ctx.save();
			ctx.strokeStyle = `rgba(147,197,253,${alpha})`;
			ctx.lineWidth = 1.1;
			ctx.beginPath();
			ctx.moveTo(x, y);
			ctx.lineTo(x2, y2);
			ctx.stroke();

			const angle = Math.atan2(dirY, dirX);
			const arrow = 3.5;
			ctx.beginPath();
			ctx.moveTo(x2, y2);
			ctx.lineTo(x2 - arrow * Math.cos(angle - 0.55), y2 - arrow * Math.sin(angle - 0.55));
			ctx.lineTo(x2 - arrow * Math.cos(angle + 0.55), y2 - arrow * Math.sin(angle + 0.55));
			ctx.closePath();
			ctx.fillStyle = `rgba(191,219,254,${alpha})`;
			ctx.fill();
			ctx.restore();
		}
	}
}

function drawCharges(ctx: CanvasRenderingContext2D, charges: Charge[]) {
	for (const charge of charges) {
		const positive = charge.sign > 0;
		ctx.save();
		ctx.beginPath();
		ctx.arc(charge.pos.x, charge.pos.y, 13, 0, Math.PI * 2);
		ctx.fillStyle = positive ? 'rgba(16,185,129,0.95)' : 'rgba(244,63,94,0.95)';
		ctx.fill();
		ctx.strokeStyle = positive ? 'rgba(5,150,105,1)' : 'rgba(225,29,72,1)';
		ctx.lineWidth = 2;
		ctx.stroke();

		ctx.fillStyle = 'rgba(2,6,23,0.95)';
		ctx.font = 'bold 13px ui-sans-serif, system-ui, sans-serif';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(positive ? '+' : '-', charge.pos.x, charge.pos.y + 0.5);
		ctx.restore();
	}
}

function drawMagnets(ctx: CanvasRenderingContext2D, magnets: Magnet[]) {
	for (const magnet of magnets) {
		ctx.save();
		ctx.translate(magnet.pos.x, magnet.pos.y);
		ctx.rotate(magnet.angleRad);

		ctx.fillStyle = 'rgba(99,102,241,0.9)';
		ctx.strokeStyle = 'rgba(129,140,248,1)';
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.roundRect(-26, -10, 52, 20, 8);
		ctx.fill();
		ctx.stroke();

		ctx.fillStyle = 'rgba(251,113,133,0.95)';
		ctx.beginPath();
		ctx.roundRect(-26, -10, 26, 20, 8);
		ctx.fill();

		ctx.fillStyle = 'rgba(96,165,250,0.95)';
		ctx.beginPath();
		ctx.roundRect(0, -10, 26, 20, 8);
		ctx.fill();

		ctx.fillStyle = 'rgba(2,6,23,0.95)';
		ctx.font = 'bold 10px ui-sans-serif, system-ui, sans-serif';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText('N', -13, 0);
		ctx.fillText('S', 13, 0);
		ctx.restore();
	}
}

function Metric({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-md border border-slate-800 bg-slate-900/80 px-3 py-2">
			<p className="text-[0.65rem] uppercase tracking-[0.08em] text-slate-500">{label}</p>
			<p className="mt-1 text-[0.78rem] font-medium text-indigo-200">{value}</p>
		</div>
	);
}
