import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ConceptBox } from '../../components/system/ConceptBox';
import { SliderWithInput } from '../../components/system/SliderWithInput';

type DriveMode = 'voltage' | 'charge';

type DemoCue = {
	title: string;
	why: string;
	direction: 'up' | 'down' | 'steady';
	param: string;
	key: number;
};

const EPSILON_0 = 8.854187817e-12;

const AREA_MIN = 40;
const AREA_MAX = 500;
const DISTANCE_MIN = 1.5;
const DISTANCE_MAX = 15;
const DIELECTRIC_MIN = 1;
const DIELECTRIC_MAX = 12;
const VOLTAGE_MIN = 0;
const VOLTAGE_MAX = 80;
const CHARGE_MIN = 0;
const CHARGE_MAX = 30;

const DEFAULT_AREA = 180;
const DEFAULT_DISTANCE = 5;
const DEFAULT_DIELECTRIC = 2.4;
const DEFAULT_VOLTAGE = 24;
const DEFAULT_CHARGE = 0;

const conceptItems = [
	{
		title: 'Capacitance geometry',
		description: 'For parallel plates, C = εA/d. Larger plate area A and larger dielectric constant ε increase capacitance, while larger separation d reduces capacitance.',
	},
	{
		title: 'Charge-voltage coupling',
		description: 'Q = CV. In voltage-drive mode, changing V directly changes stored charge. In charge-drive mode, Q is held fixed and voltage responds to geometry.',
	},
	{
		title: 'Stored energy',
		description: 'U = (1/2)CV². Energy increases with both capacitance and voltage, which is why higher V and tighter spacing can rapidly fill the energy bar.',
	},
	{
		title: 'Field intuition',
		description: 'Between parallel plates, the electric field is approximately uniform and points from the positive plate to the negative plate.',
	},
];

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

function roundTo3(value: number) {
	return Math.round(value * 1000) / 1000;
}

function formatScalar(value: number, digits = 2) {
	return Number.isFinite(value) ? value.toFixed(digits) : '0.00';
}

function formatCapacitance(capacitanceF: number) {
	if (capacitanceF >= 1e-9) {
		return `${formatScalar(capacitanceF * 1e9, 2)} nF`;
	}

	if (capacitanceF >= 1e-12) {
		return `${formatScalar(capacitanceF * 1e12, 2)} pF`;
	}

	return `${capacitanceF.toExponential(2)} F`;
}

function formatCharge(chargeNc: number) {
	if (Math.abs(chargeNc) >= 1000) {
		return `${formatScalar(chargeNc / 1000, 2)} uC`;
	}

	return `${formatScalar(chargeNc, 2)} nC`;
}

function formatEnergy(energyJ: number) {
	if (energyJ >= 1e-6) {
		return `${formatScalar(energyJ * 1e6, 2)} uJ`;
	}

	if (energyJ >= 1e-9) {
		return `${formatScalar(energyJ * 1e9, 2)} nJ`;
	}

	return `${energyJ.toExponential(2)} J`;
}

function formatElectricField(fieldVm: number) {
	const abs = Math.abs(fieldVm);
	if (abs >= 1e6) {
		return `${formatScalar(fieldVm / 1e6, 2)} MV/m`;
	}
	if (abs >= 1e3) {
		return `${formatScalar(fieldVm / 1e3, 2)} kV/m`;
	}
	return `${formatScalar(fieldVm, 2)} V/m`;
}

function formatEnergyDensity(energyDensityJm3: number) {
	const abs = Math.abs(energyDensityJm3);
	if (abs >= 1e6) {
		return `${formatScalar(energyDensityJm3 / 1e6, 2)} MJ/m³`;
	}
	if (abs >= 1e3) {
		return `${formatScalar(energyDensityJm3 / 1e3, 2)} kJ/m³`;
	}
	if (abs >= 1) {
		return `${formatScalar(energyDensityJm3, 2)} J/m³`;
	}
	if (abs >= 1e-3) {
		return `${formatScalar(energyDensityJm3 * 1e3, 2)} mJ/m³`;
	}
	return `${energyDensityJm3.toExponential(2)} J/m³`;
}

function getChargeDotCount(chargeNc: number) {
	return clamp(Math.round(chargeNc / 1.5), 0, 18);
}

function makeDotPositions(count: number, left: number, right: number, y: number) {
	if (count <= 0) return [] as Array<{ x: number; y: number }>;

	const positions: Array<{ x: number; y: number }> = [];
	for (let index = 0; index < count; index += 1) {
		const ratio = count === 1 ? 0.5 : index / (count - 1);
		positions.push({
			x: left + ratio * (right - left),
			y,
		});
	}

	return positions;
}

function easeOutCubic(t: number) {
	return 1 - Math.pow(1 - t, 3);
}

function useTweenedNumber(target: number, durationMs = 300) {
	const [value, setValue] = useState(target);
	const rafRef = useRef<number | null>(null);
	const valueRef = useRef(target);

	useEffect(() => {
		valueRef.current = value;
	}, [value]);

	useEffect(() => {
		if (Math.abs(target - valueRef.current) < 1e-6) {
			setValue(target);
			return;
		}

		if (rafRef.current !== null) {
			window.cancelAnimationFrame(rafRef.current);
		}

		const from = valueRef.current;
		const start = performance.now();

		const tick = (now: number) => {
			const t = Math.min(1, (now - start) / durationMs);
			const eased = easeOutCubic(t);
			const next = from + (target - from) * eased;
			setValue(next);

			if (t < 1) {
				rafRef.current = window.requestAnimationFrame(tick);
			} else {
				rafRef.current = null;
			}
		};

		rafRef.current = window.requestAnimationFrame(tick);

		return () => {
			if (rafRef.current !== null) {
				window.cancelAnimationFrame(rafRef.current);
				rafRef.current = null;
			}
		};
	}, [durationMs, target]);

	return value;
}

export function Capacitor() {
	const { search } = useLocation();
	const [driveMode, setDriveMode] = useState<DriveMode>('voltage');
	const [areaCm2, setAreaCm2] = useState(DEFAULT_AREA);
	const [distanceMm, setDistanceMm] = useState(DEFAULT_DISTANCE);
	const [dielectric, setDielectric] = useState(DEFAULT_DIELECTRIC);
	const [voltage, setVoltage] = useState(DEFAULT_VOLTAGE);
	const [chargeNc, setChargeNc] = useState(DEFAULT_CHARGE);
	const [isVoltagePulsing, setIsVoltagePulsing] = useState(false);
	const [demoCue, setDemoCue] = useState<DemoCue | null>(null);
	const [isSimFlashVisible, setIsSimFlashVisible] = useState(false);
	const prevVoltageRef = useRef(DEFAULT_VOLTAGE);
	const pulseTimeoutRef = useRef<number | null>(null);
	const cueTimerRef = useRef<number | null>(null);
	const flashTimerRef = useRef<number | null>(null);
	const prevValuesRef = useRef({
		areaCm2: DEFAULT_AREA,
		distanceMm: DEFAULT_DISTANCE,
		dielectric: DEFAULT_DIELECTRIC,
		voltage: DEFAULT_VOLTAGE,
	});
	const lastDemoTsRef = useRef<string | null>(null);

	const animatedAreaCm2 = useTweenedNumber(areaCm2, 300);
	const animatedDistanceMm = useTweenedNumber(distanceMm, 300);
	const animatedDielectric = useTweenedNumber(dielectric, 300);

	const areaM2 = areaCm2 / 10000;
	const distanceM = distanceMm / 1000;
	const capacitanceF = EPSILON_0 * dielectric * (areaM2 / distanceM);
	const derivedChargeNc = capacitanceF * voltage * 1e9;
	const derivedVoltage = chargeNc <= 0 ? 0 : (chargeNc * 1e-9) / capacitanceF;
	const displayVoltage = driveMode === 'voltage' ? voltage : derivedVoltage;
	const displayChargeNc = driveMode === 'charge' ? chargeNc : derivedChargeNc;
	const deferredChargeNc = useDeferredValue(displayChargeNc);
	const energyJ = 0.5 * capacitanceF * displayVoltage * displayVoltage;
	const electricFieldVm = distanceM > 0 ? displayVoltage / distanceM : 0;
	const permittivity = EPSILON_0 * dielectric;
	const energyDensityJm3 = 0.5 * permittivity * electricFieldVm * electricFieldVm;

	useEffect(() => {
		const query = new URLSearchParams(search);
		const demoTs = query.get('__demoTs');
		if (!demoTs || demoTs === lastDemoTsRef.current) {
			prevValuesRef.current = { areaCm2, distanceMm, dielectric, voltage };
			return;
		}

		lastDemoTsRef.current = demoTs;
		const changedParam = query.get('__demoChanged')?.split(',')[0] ?? '';
		const prev = prevValuesRef.current;

		let title = 'Parameter updated';
		let why = 'The simulation state changed for the next lesson step.';
		let direction: DemoCue['direction'] = 'steady';
		let param = changedParam || 'unknown';

		if (changedParam === 'plate-spacing') {
			const delta = distanceMm - prev.distanceMm;
			direction = delta > 0 ? 'up' : delta < 0 ? 'down' : 'steady';
			title = delta > 0 ? 'Spacing increased' : delta < 0 ? 'Spacing decreased' : 'Spacing updated';
			why = 'Because C = epsilon*A/d, larger spacing lowers capacitance and smaller spacing raises it.';
			param = 'plate-spacing';
		} else if (changedParam === 'dielectric-constant') {
			const delta = dielectric - prev.dielectric;
			direction = delta > 0 ? 'up' : delta < 0 ? 'down' : 'steady';
			title = delta > 0 ? 'Dielectric increased' : delta < 0 ? 'Dielectric decreased' : 'Dielectric updated';
			why = 'Higher dielectric means higher permittivity, which increases capacitance and stored charge at fixed voltage.';
			param = 'dielectric-constant';
		} else if (changedParam === 'plate-area') {
			const delta = areaCm2 - prev.areaCm2;
			direction = delta > 0 ? 'up' : delta < 0 ? 'down' : 'steady';
			title = delta > 0 ? 'Plate area increased' : delta < 0 ? 'Plate area decreased' : 'Plate area updated';
			why = 'Because C = epsilon*A/d, larger plate area increases capacitance.';
			param = 'plate-area';
		} else if (changedParam === 'voltage') {
			const delta = displayVoltage - prev.voltage;
			direction = delta > 0 ? 'up' : delta < 0 ? 'down' : 'steady';
			title = delta > 0 ? 'Voltage increased' : delta < 0 ? 'Voltage decreased' : 'Voltage updated';
			why = 'Electric field strength scales with V/d, so voltage changes field strength and stored energy.';
			param = 'voltage';
		}

		setDemoCue({
			title,
			why,
			direction,
			param,
			key: Date.now(),
		});
		setIsSimFlashVisible(true);

		if (cueTimerRef.current !== null) window.clearTimeout(cueTimerRef.current);
		if (flashTimerRef.current !== null) window.clearTimeout(flashTimerRef.current);

		cueTimerRef.current = window.setTimeout(() => {
			setDemoCue(null);
			cueTimerRef.current = null;
		}, 1600);

		flashTimerRef.current = window.setTimeout(() => {
			setIsSimFlashVisible(false);
			flashTimerRef.current = null;
		}, 420);

		prevValuesRef.current = { areaCm2, distanceMm, dielectric, voltage };
	}, [areaCm2, dielectric, distanceMm, displayVoltage, search, voltage]);

	useEffect(() => {
		const delta = displayVoltage - prevVoltageRef.current;
		if (delta > 0.2) {
			setIsVoltagePulsing(true);
			if (pulseTimeoutRef.current !== null) {
				window.clearTimeout(pulseTimeoutRef.current);
			}
			pulseTimeoutRef.current = window.setTimeout(() => {
				setIsVoltagePulsing(false);
				pulseTimeoutRef.current = null;
			}, 180);
		}
		prevVoltageRef.current = displayVoltage;
	}, [displayVoltage]);

	useEffect(() => {
		return () => {
			if (pulseTimeoutRef.current !== null) {
				window.clearTimeout(pulseTimeoutRef.current);
			}
			if (cueTimerRef.current !== null) {
				window.clearTimeout(cueTimerRef.current);
			}
			if (flashTimerRef.current !== null) {
				window.clearTimeout(flashTimerRef.current);
			}
		};
	}, []);

	const energyMaxJ = driveMode === 'voltage'
		? 0.5 * capacitanceF * VOLTAGE_MAX * VOLTAGE_MAX
		: 0.5 * ((CHARGE_MAX * 1e-9) * (CHARGE_MAX * 1e-9)) / capacitanceF;

	const energyFill = energyMaxJ > 0 ? clamp(energyJ / energyMaxJ, 0, 1) : 0;
	const plateScale = Math.sqrt(animatedAreaCm2 / AREA_MAX);
	const plateWidth = 28 + plateScale * 22;
	const plateHeight = 5 + plateScale * 4;
	const gap = 10 + ((animatedDistanceMm - DISTANCE_MIN) / (DISTANCE_MAX - DISTANCE_MIN)) * 24;
	const topPlateY = 17;
	const bottomPlateY = topPlateY + plateHeight + gap;
	const chargeDots = getChargeDotCount(Math.max(deferredChargeNc, 0));
	const topDotPositions = useMemo(() => makeDotPositions(chargeDots, 50 - plateWidth / 2 + 2.4, 50 + plateWidth / 2 - 2.4, topPlateY + plateHeight / 2), [chargeDots, plateHeight, plateWidth, topPlateY]);
	const bottomDotPositions = useMemo(() => makeDotPositions(chargeDots, 50 - plateWidth / 2 + 2.4, 50 + plateWidth / 2 - 2.4, bottomPlateY + plateHeight / 2), [chargeDots, plateHeight, plateWidth, bottomPlateY]);
	const fieldLineCount = clamp(Math.round(displayVoltage / 7) + 4, 4, 14);
	const fieldLineOffsets = useMemo(() => Array.from({ length: fieldLineCount }, (_, index) => {
		const ratio = fieldLineCount === 1 ? 0.5 : index / (fieldLineCount - 1);
		return 50 - plateWidth / 2 + 2 + ratio * (plateWidth - 4);
	}), [fieldLineCount, plateWidth]);

	const toggleDriveMode = (nextMode: DriveMode) => {
		if (nextMode === driveMode) return;

		if (nextMode === 'voltage') {
			setVoltage(clamp(roundTo3(derivedVoltage), VOLTAGE_MIN, VOLTAGE_MAX));
		} else {
			setChargeNc(clamp(roundTo3(derivedChargeNc), CHARGE_MIN, CHARGE_MAX));
		}

		setDriveMode(nextMode);
	};

	const chargeLevel = clamp(displayChargeNc / CHARGE_MAX, 0, 1);
	const pulseBoost = isVoltagePulsing ? 0.28 : 0;
	const positiveGlow = 0.3 + chargeLevel * 0.65 + pulseBoost;
	const negativeGlow = 0.28 + chargeLevel * 0.6 + pulseBoost * 0.9;
	const linePulseScale = isVoltagePulsing ? 1.32 : 1;
	const dielectricOpacity = clamp((animatedDielectric - 1) / 7, 0, 0.55);

	return (
		<div className="mx-auto min-h-screen max-w-7xl px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
			<header className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-4">
				<div>
					<p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">E&M demo</p>
					<h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">
						Capacitor Lab
					</h1>
					<p className="mt-2 max-w-2xl text-sm text-slate-300 sm:text-base">
						Explore a parallel-plate capacitor with adjustable plate area, plate spacing, and dielectric constant.
						Switch between voltage-driven and charge-driven behavior to see how the stored energy and plate charge respond.
					</p>
				</div>

				<Link
					to="/dashboard"
					className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-900/80 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:border-cyan-300/60 hover:text-cyan-100"
				>
					<span aria-hidden="true">←</span>
					← Dashboard
				</Link>
			</header>

			<main className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,0.85fr)]">
				<section className="overflow-hidden rounded-3xl border border-white/10 bg-[#0f141d] shadow-[0_24px_70px_rgba(2,6,23,0.5)]">
					<div className="border-b border-white/10 px-5 py-4 sm:px-6">
						<div className="flex flex-wrap items-center justify-between gap-3">
							<div>
								<p className="text-[0.7rem] uppercase tracking-[0.22em] text-cyan-200/80">Parallel plate view</p>
								<p className="mt-1 text-sm text-slate-300">
									Plate size changes the area, plate spacing changes the field gap, and the dielectric boosts capacitance.
								</p>
							</div>

							<div className="inline-flex rounded-full border border-white/10 bg-slate-950/90 p-1 text-xs font-semibold">
								<button
									type="button"
									onClick={() => toggleDriveMode('voltage')}
									className={`rounded-full px-3 py-1.5 transition ${driveMode === 'voltage' ? 'bg-cyan-400/20 text-cyan-100' : 'text-slate-300 hover:text-slate-100'}`}
								>
									Control by V
								</button>
								<button
									type="button"
									onClick={() => toggleDriveMode('charge')}
									className={`rounded-full px-3 py-1.5 transition ${driveMode === 'charge' ? 'bg-cyan-400/20 text-cyan-100' : 'text-slate-300 hover:text-slate-100'}`}
								>
									Control by Q
								</button>
							</div>
						</div>
						{demoCue ? (
							<div key={demoCue.key} className="mt-3 rounded-xl border border-cyan-300/45 bg-cyan-300/10 px-3 py-2 text-xs text-cyan-100 shadow-[0_0_14px_rgba(34,211,238,0.25)]">
								<p className="font-semibold uppercase tracking-[0.12em]">
									{demoCue.direction === 'up' ? '▲ ' : demoCue.direction === 'down' ? '▼ ' : '• '}
									{demoCue.title}
								</p>
								<p className="mt-1 text-[0.72rem] text-cyan-100/90">{demoCue.why}</p>
							</div>
						) : null}
					</div>

					<div className="px-4 py-5 sm:px-6">
						<div className={`relative rounded-[1.5rem] border border-cyan-300/10 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.18),transparent_42%),linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.98))] p-4 sm:p-5 transition-all ${isSimFlashVisible ? 'ring-2 ring-cyan-300/45 shadow-[0_0_22px_rgba(34,211,238,0.28)]' : ''}`}>
							{isSimFlashVisible ? <div className="pointer-events-none absolute inset-0 rounded-[1.25rem] bg-cyan-300/6" /> : null}
							<svg viewBox="0 0 100 74" className="h-[24rem] w-full" role="img" aria-label="Parallel plate capacitor visualization">
								<defs>
									<marker id="field-arrow" markerWidth="4" markerHeight="4" refX="3.2" refY="2" orient="auto" markerUnits="strokeWidth">
										<path d="M 0 0 L 4 2 L 0 4 z" fill="#7dd3fc" />
									</marker>
									<linearGradient id="plateFill" x1="0" y1="0" x2="0" y2="1">
										<stop offset="0%" stopColor="rgba(125,211,252,0.95)" />
										<stop offset="100%" stopColor="rgba(56,189,248,0.35)" />
									</linearGradient>
									<linearGradient id="negativeFill" x1="0" y1="0" x2="0" y2="1">
										<stop offset="0%" stopColor="rgba(251,113,133,0.92)" />
										<stop offset="100%" stopColor="rgba(244,63,94,0.35)" />
									</linearGradient>
									<linearGradient id="energyFill" x1="0" y1="0" x2="0" y2="1">
										<stop offset="0%" stopColor="rgba(250,204,21,0.95)" />
										<stop offset="100%" stopColor="rgba(251,191,36,0.3)" />
									</linearGradient>
									<filter id="plateGlowBlue" x="-40%" y="-300%" width="180%" height="600%">
										<feGaussianBlur stdDeviation="1.5" result="blur" />
										<feMerge>
											<feMergeNode in="blur" />
											<feMergeNode in="SourceGraphic" />
										</feMerge>
									</filter>
									<filter id="plateGlowRed" x="-40%" y="-300%" width="180%" height="600%">
										<feGaussianBlur stdDeviation="1.5" result="blur" />
										<feMerge>
											<feMergeNode in="blur" />
											<feMergeNode in="SourceGraphic" />
										</feMerge>
									</filter>
								</defs>

								<rect x="1.5" y="1.5" width="97" height="71" rx="3" fill="rgba(2,6,23,0.18)" stroke="rgba(148,163,184,0.16)" />

								<line x1="50" y1="8" x2="50" y2="66" stroke="rgba(148,163,184,0.14)" strokeDasharray="1.5 2.4" />

								{fieldLineOffsets.map((x, index) => {
									const y1 = topPlateY + plateHeight + 0.5;
									const y2 = bottomPlateY - 0.5;
									const isMajorLine = index % 3 === 0;

									return (
										<line
											key={`field-${index}`}
											x1={x}
											y1={y1}
											x2={x}
											y2={y2}
											stroke={`rgba(125,211,252,${isMajorLine ? 0.82 : 0.58})`}
											strokeWidth={isMajorLine ? 0.95 * linePulseScale : 0.68 * linePulseScale}
											strokeDasharray="2.1 1.2"
											markerEnd="url(#field-arrow)"
										/>
									);
								})}

								<rect x={50 - plateWidth / 2} y={topPlateY} width={plateWidth} height={plateHeight} rx="1.2" fill="url(#plateFill)" stroke="rgba(125,211,252,0.9)" strokeWidth="0.5" />
								<rect x={50 - plateWidth / 2} y={bottomPlateY} width={plateWidth} height={plateHeight} rx="1.2" fill="url(#negativeFill)" stroke="rgba(251,113,133,0.92)" strokeWidth="0.5" />
								<rect
									x={50 - plateWidth / 2 + 1.1}
									y={topPlateY + plateHeight + 0.5}
									width={plateWidth - 2.2}
									height={Math.max(0.4, bottomPlateY - (topPlateY + plateHeight + 1))}
									rx="0.8"
									fill="rgba(16,185,129,0.45)"
									opacity={dielectricOpacity}
									style={{ transition: 'opacity 300ms ease' }}
								/>
								<line
									x1={50 - plateWidth / 2}
									y1={topPlateY}
									x2={50 + plateWidth / 2}
									y2={topPlateY}
									stroke={`rgba(56,189,248,${positiveGlow})`}
									strokeWidth={isVoltagePulsing ? 1.8 : 1.2}
									filter="url(#plateGlowBlue)"
								/>
								<line
									x1={50 - plateWidth / 2}
									y1={bottomPlateY + plateHeight}
									x2={50 + plateWidth / 2}
									y2={bottomPlateY + plateHeight}
									stroke={`rgba(251,113,133,${negativeGlow})`}
									strokeWidth={isVoltagePulsing ? 1.72 : 1.15}
									filter="url(#plateGlowRed)"
								/>

								<text x={50 - plateWidth / 2 - 4.2} y={topPlateY + plateHeight / 2 + 1.4} textAnchor="middle" fontSize="3.2" fill="rgba(191,219,254,0.96)" className="font-bold">+</text>
								<text x={50 + plateWidth / 2 + 4.2} y={bottomPlateY + plateHeight / 2 + 1.4} textAnchor="middle" fontSize="3.3" fill="rgba(254,205,211,0.96)" className="font-bold">−</text>

								{topDotPositions.map((dot, index) => (
									<g key={`top-dot-${index}`}>
										<circle cx={dot.x} cy={dot.y} r="0.8" fill="#eff6ff" opacity="0.98" />
										<text x={dot.x} y={dot.y + 0.45} textAnchor="middle" fontSize="1.5" fill="#0f172a">+</text>
									</g>
								))}

								{bottomDotPositions.map((dot, index) => (
									<g key={`bottom-dot-${index}`}>
										<circle cx={dot.x} cy={dot.y} r="0.8" fill="#fff1f2" opacity="0.98" />
										<text x={dot.x} y={dot.y + 0.45} textAnchor="middle" fontSize="1.5" fill="#0f172a">−</text>
									</g>
								))}

								<text x="50" y="7.2" textAnchor="middle" fontSize="2.3" fill="rgb(165 243 252)" className="font-semibold">
									Electric field lines
								</text>

								<line x1={50 - plateWidth / 2} y1={topPlateY - 2} x2={50 + plateWidth / 2} y2={topPlateY - 2} stroke="rgba(226,232,240,0.4)" strokeWidth="0.5" />
								<line x1={50 - plateWidth / 2} y1={bottomPlateY + plateHeight + 2} x2={50 + plateWidth / 2} y2={bottomPlateY + plateHeight + 2} stroke="rgba(226,232,240,0.4)" strokeWidth="0.5" />

								<line x1={50 - plateWidth / 2} y1={topPlateY - 4.4} x2={50 + plateWidth / 2} y2={topPlateY - 4.4} stroke="rgba(226,232,240,0.24)" strokeWidth="0.7" markerStart="url(#field-arrow)" markerEnd="url(#field-arrow)" />
								<text x="50" y={topPlateY - 5.2} textAnchor="middle" fontSize="1.8" fill="rgb(226 232 240)">A = {formatScalar(areaCm2, 0)} cm²</text>

								<line x1={82} y1={topPlateY + plateHeight} x2={82} y2={bottomPlateY} stroke="rgba(226,232,240,0.28)" strokeWidth="0.7" markerStart="url(#field-arrow)" markerEnd="url(#field-arrow)" />
								<text x="84" y={(topPlateY + plateHeight + bottomPlateY) / 2} textAnchor="start" fontSize="1.8" fill="rgb(226 232 240)">
									d = {formatScalar(distanceMm, 1)} mm
								</text>

								<rect x="8" y="15" width="4" height="44" rx="1.2" fill="rgba(15,23,42,0.8)" stroke="rgba(148,163,184,0.16)" />
								<rect x="8" y={15 + (1 - energyFill) * 44} width="4" height={44 * energyFill} rx="1.2" fill="url(#energyFill)" />
								<text x="10" y="13" textAnchor="middle" fontSize="1.8" fill="rgb(226 232 240)">U</text>
								<text x="12.8" y="38" fontSize="1.7" fill="rgb(226 232 240)">{Math.round(energyFill * 100)}%</text>

								<text x="50" y="69" textAnchor="middle" fontSize="2.2" fill="rgb(148 163 184)">
									{driveMode === 'voltage' ? 'Voltage drives charge buildup' : 'Charge drives the electric field'}
								</text>
							</svg>
						</div>

						<div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
							<div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
								<p className="text-[0.65rem] uppercase tracking-[0.16em] text-slate-400">Capacitance</p>
								<p className="mt-1 text-xl font-semibold text-cyan-200">{formatCapacitance(capacitanceF)}</p>
							</div>
							<div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
								<p className="text-[0.65rem] uppercase tracking-[0.16em] text-slate-400">Charge</p>
								<p className="mt-1 text-xl font-semibold text-rose-200">{formatCharge(displayChargeNc)}</p>
							</div>
							<div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
								<p className="text-[0.65rem] uppercase tracking-[0.16em] text-slate-400">Voltage</p>
								<p className="mt-1 text-xl font-semibold text-sky-200">{formatScalar(displayVoltage, 2)} V</p>
							</div>
							<div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
								<p className="text-[0.65rem] uppercase tracking-[0.16em] text-slate-400">Stored energy</p>
								<p className="mt-1 text-xl font-semibold text-amber-200">{formatEnergy(energyJ)}</p>
							</div>
							<div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
								<p className="text-[0.65rem] uppercase tracking-[0.16em] text-slate-400">Electric Field</p>
								<p className="mt-1 text-xl font-semibold text-pink-200">{formatElectricField(electricFieldVm)}</p>
							</div>
							<div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
								<p className="text-[0.65rem] uppercase tracking-[0.16em] text-slate-400">Energy Density</p>
								<p className="mt-1 text-xl font-semibold text-emerald-200">{formatEnergyDensity(energyDensityJm3)}</p>
							</div>
						</div>
					</div>
				</section>

				<aside className="space-y-5">
					<section className="rounded-3xl border border-white/10 bg-slate-950/80 p-5 shadow-lg shadow-slate-950/35">
						<h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200">Controls</h2>
						<div className="mt-4 space-y-4">
							<SliderWithInput
								label="Plate area"
								min={AREA_MIN}
								max={AREA_MAX}
								step={1}
								value={areaCm2}
								onChange={setAreaCm2}
								units="cm²"
								description="Bigger plates store more charge and increase capacitance."
							/>

							<SliderWithInput
								label="Plate spacing"
								min={DISTANCE_MIN}
								max={DISTANCE_MAX}
								step={0.1}
								value={distanceMm}
								onChange={setDistanceMm}
								units="mm"
								description="Closer plates increase capacitance; wider gaps reduce it."
							/>

							<SliderWithInput
								label="Dielectric constant"
								min={DIELECTRIC_MIN}
								max={DIELECTRIC_MAX}
								step={0.1}
								value={dielectric}
								onChange={setDielectric}
								units="k"
								description="Higher dielectric boosts capacitance by increasing permittivity."
							/>

							{driveMode === 'voltage' ? (
								<SliderWithInput
									label="Voltage"
									min={VOLTAGE_MIN}
									max={VOLTAGE_MAX}
									step={0.1}
									value={voltage}
									onChange={setVoltage}
									units="V"
									description="Voltage directly sets the electric field strength between the plates."
								/>
							) : (
								<SliderWithInput
									label="Charge"
									min={CHARGE_MIN}
									max={CHARGE_MAX}
									step={0.1}
									value={chargeNc}
									onChange={setChargeNc}
									units="nC"
									description="Charge mode keeps Q fixed and lets voltage respond to the plate geometry."
								/>
							)}
						</div>

						<div className="mt-5 grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:grid-cols-3">
							<div>
								<p className="text-[0.65rem] uppercase tracking-[0.16em] text-slate-400">Area</p>
								<p className="mt-1 text-sm font-semibold text-slate-100">{formatScalar(areaCm2, 0)} cm²</p>
							</div>
							<div>
								<p className="text-[0.65rem] uppercase tracking-[0.16em] text-slate-400">Gap</p>
								<p className="mt-1 text-sm font-semibold text-slate-100">{formatScalar(distanceMm, 1)} mm</p>
							</div>
							<div>
								<p className="text-[0.65rem] uppercase tracking-[0.16em] text-slate-400">Dielectric</p>
								<p className="mt-1 text-sm font-semibold text-slate-100">k = {formatScalar(dielectric, 1)}</p>
							</div>
						</div>
					</section>

					<ConceptBox heading="Concept explanation" items={conceptItems} className="rounded-3xl" />
				</aside>
			</main>
		</div>
	);
}
