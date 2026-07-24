import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SliderWithInput } from '../components/system/SliderWithInput';
import {
	MODULE_PARAMS,
	defaultParamValues,
	resolveParamKey,
	type ModuleParam,
} from '../config/moduleParams';

// Reuse the same Formspree endpoint as the footer contact form.
const FORMSPREE_ENDPOINT = import.meta.env.VITE_FORMSPREE_ENDPOINT as string | undefined;

type ComingSoonEntry = { label: string; track: string; eta?: string };
const COMING_SOON: ComingSoonEntry[] = [
	{ label: 'Charged particle in E/B fields', track: 'E&M', eta: 'Summer 2026' },
	{ label: 'PV Diagram Explorer', track: 'Thermodynamics', eta: 'Fall 2026' },
	{ label: 'Carnot cycle visuali1zer', track: 'Thermodynamics' },
];

// Courses mirror the PHYS nav dropdown (PHYS_LINKS in App.tsx), plus a free-text "Other".
const COURSE_OPTIONS = ['PHYS211', 'PHYS212', 'PHYS213', 'Other'] as const;

type EmbedPreset = {
	label: string;
	width: string;
	height: string;
};

const EMBED_PRESETS: EmbedPreset[] = [
	{ label: '800 × 600', width: '800', height: '600' },
	{ label: '960 × 540', width: '960', height: '540' },
	{ label: 'Full-width responsive', width: '100%', height: '600' },
];

type ModuleRoute = { path: string; label: string };
type ModuleGroup = { group: string; modules: ModuleRoute[] };

// Module routes pulled from ROUTE_CONFIG in App.tsx (system/index pages omitted).
const MODULE_GROUPS: ModuleGroup[] = [
	{
		group: 'Mechanics',
		modules: [
			{ path: '/kinematics', label: 'Kinematics (1D)' },
			{ path: '/kinematics-2d', label: 'Kinematics (2D)' },
			{ path: '/forces', label: 'Force Simulator' },
			{ path: '/gravity-friction', label: 'Gravity & Friction' },
			{ path: '/box-incline', label: 'Box on Incline' },
			{ path: '/spring-force', label: 'Spring Force' },
			{ path: '/pulley-system', label: 'Pulley System' },
			{ path: '/energy-hills', label: 'Energy Hills' },
			{ path: '/spring-energy', label: 'Spring Energy' },
			{ path: '/work-in-dynamics', label: 'Work in Dynamics' },
			{ path: '/center-of-mass', label: 'Center of Mass' },
			{ path: '/impulse-builder', label: 'Impulse Builder' },
			{ path: '/momentum-collision-1d', label: 'Momentum Collision (1D)' },
			{ path: '/momentum-collision-2d', label: 'Momentum Collision (2D)' },
			{ path: '/orbital-motion', label: 'Orbital Motion' },
			{ path: '/rotational-taut-string', label: 'Taut String Circular Motion' },
			{ path: '/rotational-angular-motion-builder', label: 'Angular Motion Builder' },
			{ path: '/rotational-dynamics-rotating-object-builder', label: 'Rotating Object Builder' },
			{ path: '/rotational-dynamics-bullet-disk-collision', label: 'Bullet-Disk Collision' },
			{ path: '/rotational-dynamics-torque-seesaw', label: 'Torque Seesaw' },
			{ path: '/rotational-dynamics-active-torque-disk', label: 'Active Torque Disk' },
			{ path: '/rolling-energy-split', label: 'Rolling Energy Split' },
			{ path: '/oscillations-vertical-spring', label: 'Vertical Spring Oscillator' },
			{ path: '/oscillations-pendulum', label: 'Pendulum Explorer' },
			{ path: '/oscillations-wave-generator', label: 'Wave Generator' },
			{ path: '/oscillations-standing-waves', label: 'Standing Waves' },
			{ path: '/frequency-generator', label: 'Frequency Generator' },
			{ path: '/free-body-diagram', label: 'Free Body Diagram' },
		],
	},
	{
		group: 'Pressure & Fluids',
		modules: [
			{ path: '/pressure-point-explorer', label: 'Pressure Point Explorer' },
			{ path: '/buoyancy-explorer', label: 'Buoyancy Explorer' },
			{ path: '/ideal-gas-law-explorer', label: 'Ideal Gas Law Explorer' },
			{ path: '/fluid-flow-explorer', label: 'Fluid Flow Explorer' },
			{ path: '/bernoulli-flow-explorer', label: 'Bernoulli Flow Explorer' },
		],
	},
	{
		group: 'Electricity & Magnetism',
		modules: [
			{ path: '/coulombs-law', label: "Coulomb's Law" },
			{ path: '/amperes-law', label: "Ampère's Law" },
			{ path: '/maxwell', label: "Maxwell's Equations" },
			{ path: '/faradays-law', label: "Faraday's Law" },
			{ path: '/capacitor', label: 'Capacitor' },
			{ path: '/rc-circuit', label: 'RC Circuit' },
			{ path: '/gauss-law', label: "Gauss's Law" },
			{ path: '/optics', label: 'Optics' },
		],
	},
	{
		group: 'Statics',
		modules: [
			{ path: '/beam-balance', label: 'Beam Balance' },
			{ path: '/centroid-finder', label: 'Centroid Finder' },
			{ path: '/truss-solver', label: 'Truss Solver' },
		],
	},
	{
		group: 'Thermodynamics',
		modules: [
			{ path: '/heat-transfer', label: 'Heat Transfer' },
			{ path: '/internal-energy', label: 'Internal Energy of an Ideal Gas' },
			{ path: '/entropy', label: 'Entropy / microstate' },
			{ path: '/carnot-cycle', label: 'Carnot Cycle' },
			{ path: '/kinetic-theory', label: 'Kinetic Theory of Gases' },
			{ path: '/heat-engine', label: 'Heat Engine Builder' },
			{ path: '/gibbs-phase', label: 'Gibbs Free Energy & Phase Stability (L8–L9)' }
		],
	},
];

function getOrigin(): string {
	return typeof window === 'undefined' ? '' : window.location.origin;
}

function getCleanBase(): string {
	const base = import.meta.env.BASE_URL ?? '/';
	return base.endsWith('/') ? base.slice(0, -1) : base;
}

// Build the absolute site URL for a module route (no state params).
function moduleToAbsoluteUrl(path: string): string {
	return `${getOrigin()}${getCleanBase()}${path}`;
}

type ParamValues = Record<string, number | string | boolean>;

// Build a module URL with the current inline-control values encoded as query params.
function buildModuleUrl(path: string, params: ModuleParam[], values: ParamValues): string {
	const url = new URL(moduleToAbsoluteUrl(path));
	for (const param of params) {
		const key = resolveParamKey(param);
		const value = values[key];
		if (value === undefined) continue;
		if (param.kind === 'boolean') {
			url.searchParams.set(key, value ? param.trueValue ?? '1' : param.falseValue ?? '0');
		} else {
			url.searchParams.set(key, String(value));
		}
	}
	return url.toString();
}

// Resolve whatever the instructor typed/selected into a URL object, or null if it's unusable.
// Accepts a full http(s) URL (with state params), or a site-relative path.
function resolveSourceUrl(input: string): URL | null {
	const trimmed = input.trim();
	if (!trimmed) return null;
	try {
		if (/^https?:\/\//i.test(trimmed)) {
			return new URL(trimmed);
		}
		const cleanBase = getCleanBase();
		let path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
		if (cleanBase && !path.startsWith(cleanBase)) {
			path = `${cleanBase}${path}`;
		}
		return new URL(`${getOrigin()}${path}`);
	} catch {
		return null;
	}
}

// Add the existing ?clean=1 chrome-hiding param so the embedded iframe shows no site nav/footer.
function buildEmbedUrl(input: string): string | null {
	const url = resolveSourceUrl(input);
	if (!url) return null;
	url.searchParams.set('clean', '1');
	return url.toString();
}

function buildIframeSnippet(src: string, width: string, height: string): string {
	const widthAttr = width === '100%' ? '100%' : width;
	return [
		'<iframe',
		`  src="${src}"`,
		`  width="${widthAttr}"`,
		`  height="${height}"`,
		'  style="border:0; border-radius:12px; max-width:100%;"',
		'  loading="lazy"',
		'  allow="fullscreen"',
		'  allowfullscreen',
		'  referrerpolicy="strict-origin-when-cross-origin"',
		'  name="physicssims-embed"',
		'  title="PhysicsSims simulation"',
		'></iframe>',
	].join('\n');
}

type SubmitStatus = 'idle' | 'submitting' | 'success' | 'error';
type RequestType = 'new' | 'fix' | 'feedback';

export function Instructor() {
	// ---- Embed generator state ----
	const [sourceUrl, setSourceUrl] = useState('');
	const [width, setWidth] = useState('800');
	const [height, setHeight] = useState('600');
	const [embedCopied, setEmbedCopied] = useState(false);

	// Inline parameter controls (driven by the "Or pick a module" dropdown).
	const [selectedModule, setSelectedModule] = useState('');
	const [paramValues, setParamValues] = useState<ParamValues>({});
	const moduleParams = selectedModule ? MODULE_PARAMS[selectedModule] ?? [] : [];

	// Pick a module: reset its controls to defaults and populate the URL field.
	const handleModuleSelect = (path: string) => {
		if (!path) return;
		setSelectedModule(path);
		const params = MODULE_PARAMS[path] ?? [];
		const defaults = defaultParamValues(params);
		setParamValues(defaults);
		setSourceUrl(
			params.length > 0 ? buildModuleUrl(path, params, defaults) : moduleToAbsoluteUrl(path)
		);
	};

	// Adjust one control: rebuild the URL field live.
	const handleParamChange = (key: string, value: number | string | boolean) => {
		const nextValues = { ...paramValues, [key]: value };
		setParamValues(nextValues);
		if (selectedModule) {
			setSourceUrl(buildModuleUrl(selectedModule, moduleParams, nextValues));
		}
	};

	// Typing in the manual field wins — drop any active module/param selection.
	const handleManualUrlChange = (value: string) => {
		if (selectedModule) {
			setSelectedModule('');
			setParamValues({});
		}
		setSourceUrl(value);
	};

	const embedUrl = useMemo(() => buildEmbedUrl(sourceUrl), [sourceUrl]);
	const iframeSnippet = useMemo(
		() => (embedUrl ? buildIframeSnippet(embedUrl, width, height) : ''),
		[embedUrl, width, height]
	);

	const applyPreset = (preset: EmbedPreset) => {
		setWidth(preset.width);
		setHeight(preset.height);
	};

	const copySnippet = async () => {
		if (!iframeSnippet) return;
		try {
			await navigator.clipboard.writeText(iframeSnippet);
			setEmbedCopied(true);
			window.setTimeout(() => setEmbedCopied(false), 1400);
		} catch {
			setEmbedCopied(false);
		}
	};

	// ---- Notify me state ----
	const [notifyEmail, setNotifyEmail] = useState('');
	const [notifyStatus, setNotifyStatus] = useState<SubmitStatus>('idle');

	// ---- Feedback form state ----
	const [name, setName] = useState('');
	const [email, setEmail] = useState('');
	const [course, setCourse] = useState<string>('');
	const [otherCourse, setOtherCourse] = useState('');
	const [requestType, setRequestType] = useState<RequestType>('feedback');
	const [message, setMessage] = useState('');
	const [status, setStatus] = useState<SubmitStatus>('idle');

	const requestTypeLabel: Record<RequestType, string> = {
		new: 'New module',
		fix: 'Fix existing module',
		feedback: 'General feedback',
	};

	const handleNotifySubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const trimmed = notifyEmail.trim();
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) || !FORMSPREE_ENDPOINT) return;
		setNotifyStatus('submitting');
		try {
			const response = await fetch(FORMSPREE_ENDPOINT, {
				method: 'POST',
				headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
				body: JSON.stringify({ 
					title: 'New module notification', 
					email: trimmed, 
					_subject: 'PhysicsSims new module notification' 
				}),
			});
			setNotifyStatus(response.ok ? 'success' : 'error');
		} catch {
			setNotifyStatus('error');
		}
	};

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!message.trim() || !FORMSPREE_ENDPOINT) return;
		setStatus('submitting');

		const resolvedCourse = course === 'Other' ? otherCourse.trim() : course;
		try {
			const response = await fetch(FORMSPREE_ENDPOINT, {
				method: 'POST',
				headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: name.trim(),
					email: email.trim(),
					course: resolvedCourse,
					requestType: requestTypeLabel[requestType],
					message: message.trim(),
					_subject: 'PhysicsSims instructor request',
				}),
			});
			setStatus(response.ok ? 'success' : 'error');
		} catch {
			setStatus('error');
		}
	};

	const inputClass =
		'mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400/70';
	const labelClass = 'block text-xs font-medium uppercase tracking-[0.14em] text-slate-300';

	return (
		<div className="mx-auto min-h-screen max-w-4xl px-4 py-10 text-slate-100 sm:px-6 lg:px-8">
			<header className="mb-8">
				<p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">For instructors</p>
				<h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">
					Instructor Tools
				</h1>
				<p className="mt-3 text-sm text-slate-300 sm:text-base">
					Every module already supports fullscreen mode and URL-encoded state — adjust a simulation,
					then bookmark or share the link to reopen it in exactly that state.
				</p>
			</header>

			{/* Embed Generator */}
			<section className="mb-8 rounded-3xl border border-white/10 bg-slate-950/70 p-5 sm:p-6">
				<h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-200">
					Embed generator
				</h2>
				<p className="mt-2 text-sm text-slate-300">
					Paste a module link (state params included) or pick one below, choose a size, then copy the{' '}
					<code className="rounded bg-white/[0.06] px-1 py-0.5 text-xs text-amber-100">&lt;iframe&gt;</code>{' '}
					into Canvas or smartPhysics. The embed hides this site&rsquo;s navigation automatically.
				</p>

				<div className="mt-5 grid gap-4 sm:grid-cols-2">
					<label className={labelClass}>
						Module URL
						<input
							type="text"
							value={sourceUrl}
							onChange={(event) => handleManualUrlChange(event.target.value)}
							placeholder="https://… or /energy-hills?m=4.5&Vo=4.5"
							className={inputClass}
						/>
					</label>

					<label className={labelClass}>
						Or pick a module
						<select
							value={selectedModule}
							onChange={(event) => handleModuleSelect(event.target.value)}
							className={inputClass}
						>
							<option value="">Select a simulation…</option>
							{MODULE_GROUPS.map((group) => (
								<optgroup key={group.group} label={group.group}>
									{group.modules.map((module) => (
										<option key={module.path} value={module.path}>
											{module.label}
										</option>
									))}
								</optgroup>
							))}
						</select>
					</label>
				</div>

				{/* Inline parameter controls for the selected module */}
				{selectedModule && moduleParams.length > 0 ? (
					<div className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.04] p-4">
						<p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">
							Simulation parameters
						</p>
						<p className="mt-1 text-xs text-slate-400">
							Adjust these to bake a starting state into the embed link above.
						</p>
						<div className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
							{moduleParams.map((param) => {
								const key = resolveParamKey(param);
								if (param.kind === 'number') {
									return (
										<SliderWithInput
											key={key}
											label={param.label}
											min={param.min}
											max={param.max}
											step={param.step}
											value={Number(paramValues[key] ?? param.default)}
											units={param.units}
											syncToUrl={false}
											onChange={(value) => handleParamChange(key, value)}
										/>
									);
								}
								if (param.kind === 'boolean') {
									const on = Boolean(paramValues[key]);
									return (
										<label key={key} className={labelClass}>
											{param.label}
											<button
												type="button"
												onClick={() => handleParamChange(key, !on)}
												className={`mt-1 w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
													on
														? 'border-emerald-300/60 bg-emerald-400/15 text-emerald-100'
														: 'border-white/10 bg-slate-950 text-slate-300 hover:border-cyan-300/40'
												}`}
											>
												{on ? 'On' : 'Off'}
											</button>
										</label>
									);
								}
								return (
									<label key={key} className={labelClass}>
										{param.label}
										<select
											value={String(paramValues[key] ?? param.default)}
											onChange={(event) => handleParamChange(key, event.target.value)}
											className={inputClass}
										>
											{param.options.map((option) => (
												<option key={option.value} value={option.value}>
													{option.label}
												</option>
											))}
										</select>
									</label>
								);
							})}
						</div>
					</div>
				) : selectedModule ? (
					<p className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-xs text-slate-400">
						Inline controls aren&rsquo;t set up for this module yet. Either paste the URLs with settings set as you like, or pick a supported module to customize. Force Simulator, Pendulum Explorer, Energy Hills, Impulse Builder, and Momentum Collision (1D) are good ones to start with!
					</p>
				) : null}

				<div className="mt-4 grid gap-4 sm:grid-cols-2">
					<label className={labelClass}>
						Width
						<input
							type="text"
							value={width}
							onChange={(event) => setWidth(event.target.value)}
							className={inputClass}
						/>
					</label>
					<label className={labelClass}>
						Height
						<input
							type="text"
							value={height}
							onChange={(event) => setHeight(event.target.value)}
							className={inputClass}
						/>
					</label>
				</div>

				<div className="mt-3 flex flex-wrap gap-2">
					{EMBED_PRESETS.map((preset) => {
						const active = preset.width === width && preset.height === height;
						return (
							<button
								key={preset.label}
								type="button"
								onClick={() => applyPreset(preset)}
								className={`rounded-full border px-3 py-1.5 text-xs font-semibold tracking-[0.04em] transition ${
									active
										? 'border-cyan-300/70 bg-cyan-400/15 text-cyan-100'
										: 'border-white/15 bg-white/[0.03] text-slate-200 hover:border-cyan-300/50 hover:text-cyan-100'
								}`}
							>
								{preset.label}
							</button>
						);
					})}
				</div>

				<div className="mt-5">
					<div className="mb-2 flex items-center justify-between gap-3">
						<p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
							Embed code
						</p>
						<button
							type="button"
							onClick={copySnippet}
							disabled={!iframeSnippet}
							className="rounded-full border border-emerald-300/50 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-100 transition hover:bg-emerald-300/20 disabled:cursor-not-allowed disabled:opacity-40"
						>
							{embedCopied ? 'Copied' : 'Copy'}
						</button>
					</div>
					<pre className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-950 p-4 text-xs leading-relaxed text-slate-200">
						<code>
							{iframeSnippet || 'Enter or select a module URL above to generate the embed code.'}
						</code>
					</pre>
				</div>
			</section>

			{/* Coming Soon */}
			<section className="mb-8 rounded-3xl border border-white/10 bg-slate-950/70 p-5 sm:p-6">
				<h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-200">
					Coming soon
				</h2>
				<p className="mt-2 text-sm text-slate-400">Modules currently in progress.</p>
				<div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
					{COMING_SOON.map((item) => (
						<div
							key={item.label}
							className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3"
						>
							<p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
								{item.track}
							</p>
							<p className="mt-1 text-sm font-medium text-slate-200">{item.label}</p>
							{item.eta && (
								<span className="mt-2 inline-block rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-amber-300">
									{item.eta}
								</span>
							)}
						</div>
					))}
				</div>
			</section>

			{/* Feedback / Request a Module */}
			<section className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 sm:p-6">
				<h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-200">
					Feedback &amp; module requests
				</h2>

				{/* Notify me signup */}
				<div className="mt-4">
					<p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">
						New module notifications
					</p>
					{notifyStatus === 'success' ? (
						<p className="mt-3 text-sm text-emerald-300">You're on the list. Prepare for frequent updates!</p>
					) : (
						<form onSubmit={handleNotifySubmit} className="mt-2">
							<div className="flex gap-2">
								<input
									type="email"
									required
									value={notifyEmail}
									onChange={(e) => setNotifyEmail(e.target.value)}
									placeholder="your@email.edu"
									className="flex-1 rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400/70"
								/>
								<button
									type="submit"
									disabled={notifyStatus === 'submitting' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(notifyEmail.trim())}
									className="whitespace-nowrap rounded-full border border-emerald-300/50 bg-emerald-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-emerald-100 transition hover:bg-emerald-300/20 disabled:cursor-not-allowed disabled:opacity-40"
								>
									{notifyStatus === 'submitting' ? 'Sending…' : 'Notify me'}
								</button>
							</div>
							{notifyStatus === 'error' && (
								<p className="mt-2 text-xs text-rose-300">
									Something went wrong. Please try again.
								</p>
							)}
						</form>
					)}
				</div>

				<div className="my-6 border-t border-white/[0.08]" />

				{status === 'success' ? (
					<div className="mt-4 rounded-2xl border border-emerald-300/40 bg-emerald-400/10 p-5 text-sm text-emerald-100">
						<p className="font-semibold">Thanks you, your message is on its way.</p>
						<p className="mt-1 text-emerald-100/80">
							We read every request. This will send an email, we&rsquo;ll follow up there.
						</p>
					</div>
				) : (
					<form onSubmit={handleSubmit} className="mt-4 space-y-4">
						<p className="text-sm text-slate-300">
							Request a new simulation, flag an issue with an existing one, or share general feedback.
						</p>

						<div className="grid gap-4 sm:grid-cols-2">
							<label className={labelClass}>
								Name <span className="text-slate-500">(optional)</span>
								<input
									type="text"
									value={name}
									onChange={(event) => setName(event.target.value)}
									className={inputClass}
								/>
							</label>
							<label className={labelClass}>
								Email <span className="text-slate-500">(optional)</span>
								<input
									type="email"
									value={email}
									onChange={(event) => setEmail(event.target.value)}
									className={inputClass}
								/>
							</label>
						</div>

						<div className="grid gap-4 sm:grid-cols-2">
							<label className={labelClass}>
								Course
								<select
									value={course}
									onChange={(event) => setCourse(event.target.value)}
									className={inputClass}
								>
									<option value="">Select a course…</option>
									{COURSE_OPTIONS.map((option) => (
										<option key={option} value={option}>
											{option}
										</option>
									))}
								</select>
							</label>
							{course === 'Other' ? (
								<label className={labelClass}>
									Course name
									<input
										type="text"
										value={otherCourse}
										onChange={(event) => setOtherCourse(event.target.value)}
										placeholder="e.g. PHYS 325"
										className={inputClass}
									/>
								</label>
							) : null}
						</div>

						<fieldset>
							<legend className={labelClass}>Request type</legend>
							<div className="mt-2 flex flex-wrap gap-2">
								{(Object.keys(requestTypeLabel) as RequestType[]).map((type) => {
									const active = requestType === type;
									return (
										<label
											key={type}
											className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
												active
													? 'border-violet-300/70 bg-violet-400/15 text-violet-100'
													: 'border-white/15 bg-white/[0.03] text-slate-200 hover:border-violet-300/50 hover:text-violet-100'
											}`}
										>
											<input
												type="radio"
												name="requestType"
												value={type}
												checked={active}
												onChange={() => setRequestType(type)}
												className="sr-only"
											/>
											{requestTypeLabel[type]}
										</label>
									);
								})}
							</div>
						</fieldset>

						<label className={labelClass}>
							Message
							<textarea
								value={message}
								onChange={(event) => setMessage(event.target.value)}
								rows={5}
								required
								className={inputClass}
							/>
						</label>

						{status === 'error' ? (
							<p className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
								Something went wrong sending your message. Please try again in a moment.
							</p>
						) : null}

						<div className="flex items-center justify-end gap-3">
							<button
								type="submit"
								disabled={status === 'submitting' || !message.trim() || !FORMSPREE_ENDPOINT}
								className="rounded-full border border-cyan-300/50 bg-cyan-400/15 px-5 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-cyan-100 transition hover:bg-cyan-300/25 disabled:cursor-not-allowed disabled:opacity-40"
							>
								{status === 'submitting' ? 'Sending…' : 'Send'}
							</button>
						</div>
					</form>
				)}
			</section>
			<footer>
					<p className="mt-12 text-center text-xs text-slate-500">
						Questions? Reach the lead devs at <a href="mailto:bchen74@illinois.edu" className="text-cyan-400 hover:underline">bchen74@illinois.edu</a> or <a href="mailto:edoub@illinois.edu" className="text-cyan-400 hover:underline">edoub@illinois.edu</a>
					</p>
			</footer>
			<div className="mt-8">
				<Link
					to="/"
					className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400 transition hover:text-cyan-200"
				>
					← Back to home
				</Link>
			</div>
		</div>
	);
}
