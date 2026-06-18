import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
	ADMIN_SESSION_KEY,
	KNOWN_SIM_PATHS,
	createDefaultAdminState,
	isInternalEnvironment,
	loadAdminState,
	loadAnalyticsEvents,
	pushAnalyticsEvent,
	saveAdminState,
	type AccessRole,
	type AdminControlState,
} from '../config/internalAdmin';

type AccessIdentity = {
	username: string;
	password: string;
	role: AccessRole;
};

type AdminTab =
	| 'analytics'
	| 'feature-flags'
	| 'publish'
	| 'content'
	| 'bug-test'
	| 'operations'
	| 'announcements';

const ACCESS_IDENTITIES: AccessIdentity[] = [
	{
		username: (import.meta.env.VITE_ADMIN_UN as string | undefined)?.trim() || '',
		password: (import.meta.env.VITE_ADMIN_PW as string | undefined)?.trim() || '',
		role: 'admin',
	},
];

const isAccessRole = (value: string): value is AccessRole => value === 'admin' || value === 'dev';

const TABS: Array<{ id: AdminTab; label: string }> = [
	{ id: 'analytics', label: 'Analytics' },
	{ id: 'feature-flags', label: 'Feature Flags' },
	{ id: 'publish', label: 'Publish Controls' },
	{ id: 'content', label: 'Content' },
	{ id: 'bug-test', label: 'Bug / Test' },
	{ id: 'operations', label: 'Operations' },
	{ id: 'announcements', label: 'Announcements' },
];

// ─── Shared primitives ────────────────────────────────────────────────────────

function Toggle({
	checked,
	onChange,
	label,
}: {
	checked: boolean;
	onChange: (v: boolean) => void;
	label?: string;
}) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			aria-label={label}
			onClick={() => onChange(!checked)}
			className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900 ${
				checked ? 'bg-cyan-500' : 'bg-slate-700'
			}`}
		>
			<span
				className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-150 ${
					checked ? 'translate-x-4' : 'translate-x-0'
				}`}
			/>
		</button>
	);
}

function StatusBadge({ value }: { value: boolean }) {
	return (
		<span
			className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
				value ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-700/50 text-slate-400'
			}`}
		>
			<span className={`h-1.5 w-1.5 rounded-full ${value ? 'bg-emerald-400' : 'bg-slate-500'}`} />
			{value ? 'On' : 'Off'}
		</span>
	);
}

function SectionHeader({ title, description }: { title: string; description?: string }) {
	return (
		<div className="mb-5 border-b border-slate-800 pb-4">
			<h2 className="text-sm font-semibold text-slate-100">{title}</h2>
			{description ? <p className="mt-0.5 text-xs text-slate-400">{description}</p> : null}
		</div>
	);
}

function FieldLabel({ children }: { children: ReactNode }) {
	return <span className="text-xs font-medium text-slate-400">{children}</span>;
}

function TextInput({
	value,
	onChange,
	type = 'text',
	autoComplete,
	required,
	placeholder,
}: {
	value: string;
	onChange: (e: ChangeEvent<HTMLInputElement>) => void;
	type?: string;
	autoComplete?: string;
	required?: boolean;
	placeholder?: string;
}) {
	return (
		<input
			type={type}
			value={value}
			onChange={onChange}
			autoComplete={autoComplete}
			required={required}
			placeholder={placeholder}
			className="mt-1.5 w-full rounded-md border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 transition focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600/40"
		/>
	);
}

function TextArea({
	value,
	onChange,
	rows = 3,
}: {
	value: string;
	onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
	rows?: number;
}) {
	return (
		<textarea
			rows={rows}
			value={value}
			onChange={onChange}
			className="mt-1.5 w-full rounded-md border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 transition focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600/40"
		/>
	);
}

function SelectInput({
	value,
	onChange,
	children,
}: {
	value: string;
	onChange: (e: ChangeEvent<HTMLSelectElement>) => void;
	children: ReactNode;
}) {
	return (
		<select
			value={value}
			onChange={onChange}
			className="mt-1.5 w-full rounded-md border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600/40"
		>
			{children}
		</select>
	);
}

// ─── Main component ───────────────────────────────────────────────────────────

export function Admin() {
	const [username, setUsername] = useState('');
	const [password, setPassword] = useState('');
	const [errorMessage, setErrorMessage] = useState('');
	const [activeRole, setActiveRole] = useState<AccessRole | null>(null);
	const [activeTab, setActiveTab] = useState<AdminTab>('analytics');
	const [controls, setControls] = useState<AdminControlState>(createDefaultAdminState);
	const [analyticsEvents, setAnalyticsEvents] = useState(loadAnalyticsEvents);
	const [announcementPreviewOpen, setAnnouncementPreviewOpen] = useState(false);
	const [opsMessage, setOpsMessage] = useState('');
	const [simFilter, setSimFilter] = useState('');
	const opsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const canAccessInternal = isInternalEnvironment();

	useEffect(() => {
		const storedRole = window.sessionStorage.getItem(ADMIN_SESSION_KEY);
		if (storedRole && isAccessRole(storedRole)) {
			setActiveRole(storedRole);
		}
		setControls(loadAdminState());
		setAnalyticsEvents(loadAnalyticsEvents());
	}, []);

	const publishedCount = useMemo(
		() => Object.values(controls.simulationVisibility).filter(Boolean).length,
		[controls.simulationVisibility],
	);
	const unpublishedCount = KNOWN_SIM_PATHS.length - publishedCount;

	const analyticsSummary = useMemo(() => {
		const pageViews = analyticsEvents.filter((e) => e.type === 'page_view').length;
		const adminActions = analyticsEvents.filter((e) => e.type === 'admin_action').length;
		const loginSuccess = analyticsEvents.filter((e) => e.type === 'login_success').length;
		const loginFailure = analyticsEvents.filter((e) => e.type === 'login_failure').length;
		return { pageViews, adminActions, loginSuccess, loginFailure };
	}, [analyticsEvents]);

	const persistControls = (nextState: AdminControlState, actionLabel: string) => {
		setControls(nextState);
		saveAdminState(nextState);
		pushAnalyticsEvent('admin_action', actionLabel);
		setAnalyticsEvents(loadAnalyticsEvents());
	};

	const showOpsMessage = (msg: string) => {
		setOpsMessage(msg);
		if (opsTimerRef.current) clearTimeout(opsTimerRef.current);
		opsTimerRef.current = setTimeout(() => setOpsMessage(''), 4000);
	};

	const handleLogin = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const matched = ACCESS_IDENTITIES.find(
			(id) =>
				id.username && id.password && id.username === username.trim() && id.password === password,
		);
		if (!matched) {
			setErrorMessage('Invalid credentials.');
			pushAnalyticsEvent('login_failure', 'Admin login failed', { username: username.trim() });
			setAnalyticsEvents(loadAnalyticsEvents());
			return;
		}
		window.sessionStorage.setItem(ADMIN_SESSION_KEY, matched.role);
		setActiveRole(matched.role);
		setErrorMessage('');
		setPassword('');
		pushAnalyticsEvent('login_success', 'Admin login succeeded', { role: matched.role });
		setAnalyticsEvents(loadAnalyticsEvents());
	};

	const handleLogout = () => {
		window.sessionStorage.removeItem(ADMIN_SESSION_KEY);
		setActiveRole(null);
		setUsername('');
		setPassword('');
		setErrorMessage('');
	};

	// ── Access blocked ──────────────────────────────────────────────────────────

	if (!canAccessInternal) {
		return (
			<div className="mx-auto max-w-lg px-4 py-16 text-center">
				<div className="rounded-lg border border-slate-800 bg-slate-900 p-8">
					<p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
						Restricted
					</p>
					<h1 className="mt-3 text-xl font-semibold text-slate-100">Access blocked</h1>
					<p className="mt-2 text-sm text-slate-400">
						Admin console is only available on localhost, *.local, *.internal, or when{' '}
						<code className="rounded bg-slate-800 px-1 py-0.5 text-xs text-slate-300">
							VITE_INTERNAL_ADMIN_ENABLED=true
						</code>
						.
					</p>
				</div>
			</div>
		);
	}

	// ── Login ───────────────────────────────────────────────────────────────────

	if (!activeRole) {
		return (
			<div className="flex min-h-[80vh] items-center justify-center px-4">
				<div className="w-full max-w-sm">
					<div className="mb-6">
						<p className="text-xs font-semibold uppercase tracking-widest text-cyan-600">
							PhysicsSims Admin
						</p>
						<h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-100">Sign in</h1>
						<p className="mt-1 text-sm text-slate-400">Internal access only.</p>
					</div>
					<form className="space-y-4" onSubmit={handleLogin}>
						<div>
							<FieldLabel>Username</FieldLabel>
							<TextInput
								value={username}
								onChange={(e) => setUsername(e.target.value)}
								autoComplete="username"
								required
							/>
						</div>
						<div>
							<FieldLabel>Password</FieldLabel>
							<TextInput
								type="password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								autoComplete="current-password"
								required
							/>
						</div>
						{errorMessage ? (
							<p className="rounded-md border border-rose-800/60 bg-rose-950/40 px-3 py-2 text-sm text-rose-300">
								{errorMessage}
							</p>
						) : null}
						<button
							type="submit"
							className="w-full rounded-md bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-500"
						>
							Sign in
						</button>
					</form>
				</div>
			</div>
		);
	}

	// ── Main panel ──────────────────────────────────────────────────────────────

	return (
		<div className="mx-auto max-w-6xl px-4 py-8">
			<div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
				{/* Top bar */}
				<div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
					<div className="flex items-center gap-3">
						<span className="text-sm font-semibold text-slate-100">Admin Console</span>
						<span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-cyan-400">
							{activeRole}
						</span>
					</div>
					<div className="flex items-center gap-1">
						<button
							type="button"
							onClick={() => {
								persistControls(createDefaultAdminState(), 'Reset admin controls');
							}}
							className="rounded px-2.5 py-1.5 text-xs font-medium text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
						>
							Reset defaults
						</button>
						<button
							type="button"
							onClick={handleLogout}
							className="rounded px-2.5 py-1.5 text-xs font-medium text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
						>
							Sign out
						</button>
					</div>
				</div>

				<div className="flex" style={{ minHeight: 'calc(100vh - 14rem)' }}>
					{/* Sidebar */}
					<nav className="w-44 flex-shrink-0 border-r border-slate-800 py-2">
						{TABS.map((tab) => (
							<button
								key={tab.id}
								type="button"
								onClick={() => setActiveTab(tab.id)}
								className={`flex w-full items-center px-4 py-2 text-left text-sm transition ${
									activeTab === tab.id
										? 'bg-slate-800 font-medium text-slate-100'
										: 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-300'
								}`}
							>
								{tab.label}
							</button>
						))}
					</nav>

					{/* Content */}
					<div className="min-w-0 flex-1 overflow-auto p-6">
						{/* ── Analytics ─────────────────────────────────────────────── */}
						{activeTab === 'analytics' ? (
							<div className="space-y-5">
								<SectionHeader
									title="Analytics"
									description="Local event log stored in localStorage — not sent to any server."
								/>

								<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
									{[
										{ label: 'Page views', value: analyticsSummary.pageViews, cls: 'text-slate-100' },
										{
											label: 'Admin actions',
											value: analyticsSummary.adminActions,
											cls: 'text-slate-100',
										},
										{
											label: 'Login success',
											value: analyticsSummary.loginSuccess,
											cls: 'text-emerald-300',
										},
										{
											label: 'Login failures',
											value: analyticsSummary.loginFailure,
											cls: 'text-rose-300',
										},
									].map((stat) => (
										<div
											key={stat.label}
											className="rounded-lg border border-slate-800 bg-slate-800/40 p-4"
										>
											<p className="text-xs text-slate-500">{stat.label}</p>
											<p className={`mt-1 text-2xl font-semibold tabular-nums ${stat.cls}`}>
												{stat.value}
											</p>
										</div>
									))}
								</div>

								<div>
									<div className="mb-2 flex items-center justify-between">
										<span className="text-xs font-medium text-slate-400">
											Event log (last 100)
										</span>
										<button
											type="button"
											onClick={() => {
												window.localStorage.removeItem('physicssims-analytics-events');
												setAnalyticsEvents([]);
											}}
											className="rounded px-2 py-1 text-xs text-slate-500 transition hover:bg-slate-800 hover:text-slate-300"
										>
											Clear
										</button>
									</div>
									<div className="overflow-auto rounded-lg border border-slate-800">
										<table className="w-full text-left text-xs">
											<thead className="border-b border-slate-800 bg-slate-800/60">
												<tr>
													<th className="px-3 py-2 font-medium text-slate-400">Time</th>
													<th className="px-3 py-2 font-medium text-slate-400">Type</th>
													<th className="px-3 py-2 font-medium text-slate-400">Detail</th>
												</tr>
											</thead>
											<tbody className="divide-y divide-slate-800/60">
												{[...analyticsEvents]
													.reverse()
													.slice(0, 100)
													.map((event) => (
														<tr key={event.id} className="hover:bg-slate-800/30">
															<td className="px-3 py-2 tabular-nums text-slate-500">
																{new Date(event.ts).toLocaleString()}
															</td>
															<td className="px-3 py-2">
																<span
																	className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
																		event.type === 'login_success'
																			? 'bg-emerald-500/15 text-emerald-300'
																			: event.type === 'login_failure'
																				? 'bg-rose-500/15 text-rose-300'
																				: event.type === 'admin_action'
																					? 'bg-cyan-500/15 text-cyan-300'
																					: 'bg-slate-700/60 text-slate-400'
																	}`}
																>
																	{event.type.replace(/_/g, ' ')}
																</span>
															</td>
															<td className="px-3 py-2 text-slate-300">{event.detail}</td>
														</tr>
													))}
												{analyticsEvents.length === 0 ? (
													<tr>
														<td
															className="px-3 py-6 text-center text-slate-500"
															colSpan={3}
														>
															No events recorded yet.
														</td>
													</tr>
												) : null}
											</tbody>
										</table>
									</div>
								</div>
							</div>
						) : null}

						{/* ── Feature Flags ─────────────────────────────────────────── */}
						{activeTab === 'feature-flags' ? (
							<div className="space-y-5">
								<SectionHeader
									title="Feature Flags"
									description="Toggle runtime behaviors. Changes persist to localStorage immediately."
								/>
								<div className="divide-y divide-slate-800 rounded-lg border border-slate-800">
									{[
										{
											key: 'maintenanceMode' as const,
											label: 'Maintenance mode',
											help: 'Shows a maintenance banner and locks site browsing on the home page.',
										},
										{
											key: 'experimentalMechanics' as const,
											label: 'Experimental mechanics',
											help: 'Displays experimental badges on content cards in the home page.',
										},
										{
											key: 'analyticsCollection' as const,
											label: 'Analytics collection',
											help: 'Records internal page view and admin action events to localStorage.',
										},
										{
											key: 'showDebugPanel' as const,
											label: 'Show debug panel',
											help: 'Renders internal debug metadata on the home page.',
										},
									].map((flag) => {
										const enabled = controls.featureFlags[flag.key];
										return (
											<div
												key={flag.key}
												className="flex items-center justify-between px-4 py-3.5"
											>
												<div className="min-w-0 flex-1 pr-4">
													<div className="flex items-center gap-2">
														<span className="text-sm font-medium text-slate-200">
															{flag.label}
														</span>
														<StatusBadge value={enabled} />
													</div>
													<p className="mt-0.5 text-xs text-slate-500">{flag.help}</p>
												</div>
												<Toggle
													checked={enabled}
													label={flag.label}
													onChange={(value) => {
														persistControls(
															{
																...controls,
																featureFlags: {
																	...controls.featureFlags,
																	[flag.key]: value,
																},
															},
															`Toggled flag: ${flag.key}`,
														);
													}}
												/>
											</div>
										);
									})}
								</div>
							</div>
						) : null}

						{/* ── Publish Controls ──────────────────────────────────────── */}
						{activeTab === 'publish' ? (
							<div className="space-y-4">
								<SectionHeader
									title="Publish Controls"
									description={`${publishedCount} of ${KNOWN_SIM_PATHS.length} simulations published.`}
								/>
								<div className="flex flex-wrap items-center gap-2">
									<input
										type="search"
										placeholder="Filter simulations..."
										value={simFilter}
										onChange={(e) => setSimFilter(e.target.value)}
										className="h-8 w-52 rounded-md border border-slate-700 bg-slate-800/60 px-3 text-xs text-slate-100 outline-none placeholder:text-slate-500 transition focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600/40"
									/>
									<div className="ml-auto flex gap-2">
										<button
											type="button"
											onClick={() => {
												const next: Record<string, boolean> = {};
												for (const path of KNOWN_SIM_PATHS) next[path] = true;
												persistControls(
													{ ...controls, simulationVisibility: next },
													'Published all simulations',
												);
											}}
											className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-emerald-700 hover:bg-emerald-900/20 hover:text-emerald-300"
										>
											Publish all
										</button>
										<button
											type="button"
											onClick={() => {
												const next: Record<string, boolean> = {};
												for (const path of KNOWN_SIM_PATHS) next[path] = false;
												persistControls(
													{ ...controls, simulationVisibility: next },
													'Unpublished all simulations',
												);
											}}
											className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-rose-700 hover:bg-rose-900/20 hover:text-rose-300"
										>
											Unpublish all
										</button>
									</div>
								</div>
								<div className="divide-y divide-slate-800 rounded-lg border border-slate-800">
									{KNOWN_SIM_PATHS.filter((p) =>
										p.includes(simFilter.toLowerCase()),
									).map((path) => {
										const isPublished = controls.simulationVisibility[path] !== false;
										return (
											<div
												key={path}
												className="flex items-center justify-between px-4 py-2.5"
											>
												<div className="flex items-center gap-2.5">
													<StatusBadge value={isPublished} />
													<span className="font-mono text-xs text-slate-300">{path}</span>
												</div>
												<div className="flex items-center gap-3">
													<Link
														to={path}
														target="_blank"
														rel="noopener noreferrer"
														className="text-[10px] text-slate-500 transition hover:text-cyan-400"
													>
														open ↗
													</Link>
													<Toggle
														checked={isPublished}
														label={`Publish ${path}`}
														onChange={() => {
															persistControls(
																{
																	...controls,
																	simulationVisibility: {
																		...controls.simulationVisibility,
																		[path]: !isPublished,
																	},
																},
																`${isPublished ? 'Unpublished' : 'Published'} ${path}`,
															);
														}}
													/>
												</div>
											</div>
										);
									})}
									{KNOWN_SIM_PATHS.filter((p) => p.includes(simFilter.toLowerCase()))
										.length === 0 ? (
										<p className="px-4 py-4 text-center text-xs text-slate-500">
											No simulations match &ldquo;{simFilter}&rdquo;.
										</p>
									) : null}
								</div>
							</div>
						) : null}

						{/* ── Content ───────────────────────────────────────────────── */}
						{activeTab === 'content' ? (
							<div className="space-y-5">
								<SectionHeader
									title="Content Overrides"
									description="Controls text rendered in the HalideLanding hero on the home page. Changes appear immediately — the home page listens to localStorage via the storage event."
								/>
								<div className="grid gap-5 lg:grid-cols-2">
									<div>
										<FieldLabel>Home hero title</FieldLabel>
										<TextInput
											value={controls.contentOverrides.homeHeroTitle}
											onChange={(e) => {
												persistControls(
													{
														...controls,
														contentOverrides: {
															...controls.contentOverrides,
															homeHeroTitle: e.target.value,
														},
													},
													'Updated home hero title',
												);
											}}
										/>
									</div>
									<div>
										<FieldLabel>Featured simulation</FieldLabel>
										<SelectInput
											value={controls.contentOverrides.featuredSimPath}
											onChange={(e) => {
												persistControls(
													{
														...controls,
														contentOverrides: {
															...controls.contentOverrides,
															featuredSimPath: e.target.value,
														},
													},
													'Changed featured simulation',
												);
											}}
										>
											{KNOWN_SIM_PATHS.map((path) => (
												<option key={path} value={path}>
													{path}
												</option>
											))}
										</SelectInput>
									</div>
									<div className="lg:col-span-2">
										<FieldLabel>Home hero subtitle</FieldLabel>
										<TextArea
											rows={3}
											value={controls.contentOverrides.homeHeroSubtitle}
											onChange={(e) => {
												persistControls(
													{
														...controls,
														contentOverrides: {
															...controls.contentOverrides,
															homeHeroSubtitle: e.target.value,
														},
													},
													'Updated home hero subtitle',
												);
											}}
										/>
									</div>
									<div className="lg:col-span-2">
										<FieldLabel>Home hero tagline</FieldLabel>
										<TextInput
											value={controls.contentOverrides.homeHeroTagline}
											onChange={(e) => {
												persistControls(
													{
														...controls,
														contentOverrides: {
															...controls.contentOverrides,
															homeHeroTagline: e.target.value,
														},
													},
													'Updated home hero tagline',
												);
											}}
										/>
									</div>
								</div>
							</div>
						) : null}

						{/* ── Bug / Test ────────────────────────────────────────────── */}
						{activeTab === 'bug-test' ? (
							<div className="space-y-5">
								<SectionHeader
									title="Bug / Test Controls"
									description="Force error states and mock conditions for testing."
								/>
								<div className="rounded-lg border border-slate-800">
									<div className="flex items-center justify-between px-4 py-3.5">
										<div>
											<div className="flex items-center gap-2">
												<span className="text-sm font-medium text-slate-200">
													Home error trigger
												</span>
												<StatusBadge value={controls.bugTestControls.forceHomeError} />
											</div>
											<p className="mt-0.5 text-xs text-slate-500">
												Throws a controlled error in the home page for error-boundary
												verification.
											</p>
										</div>
										<Toggle
											checked={controls.bugTestControls.forceHomeError}
											label="Force home error"
											onChange={(value) => {
												persistControls(
													{
														...controls,
														bugTestControls: {
															...controls.bugTestControls,
															forceHomeError: value,
														},
													},
													'Toggled forceHomeError',
												);
											}}
										/>
									</div>
								</div>

								<div className="grid gap-5 lg:grid-cols-2">
									<div>
										<FieldLabel>Simulated network delay (ms)</FieldLabel>
										<input
											type="number"
											min={0}
											max={10000}
											value={controls.bugTestControls.simulateSlowNetworkMs}
											onChange={(e) => {
												const value = Number(e.target.value);
												persistControls(
													{
														...controls,
														bugTestControls: {
															...controls.bugTestControls,
															simulateSlowNetworkMs: Number.isFinite(value)
																? Math.max(0, value)
																: 0,
														},
													},
													'Updated simulated network delay',
												);
											}}
											className="mt-1.5 w-full rounded-md border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-100 tabular-nums outline-none transition focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600/40"
										/>
									</div>
									<div>
										<FieldLabel>Mock deploy status</FieldLabel>
										<SelectInput
											value={controls.bugTestControls.mockDeployStatus}
											onChange={(e) => {
												persistControls(
													{
														...controls,
														bugTestControls: {
															...controls.bugTestControls,
															mockDeployStatus: e.target
																.value as AdminControlState['bugTestControls']['mockDeployStatus'],
														},
													},
													'Updated mock deploy status',
												);
											}}
										>
											<option value="auto">Auto (live status)</option>
											<option value="online">Force online</option>
											<option value="issues">Force issues</option>
											<option value="deploying">Force deploying</option>
											<option value="paused">Force paused</option>
											<option value="queued">Force queued</option>
										</SelectInput>
									</div>
								</div>
							</div>
						) : null}

						{/* ── Operations ────────────────────────────────────────────── */}
						{activeTab === 'operations' ? (
							<div className="space-y-5">
								<SectionHeader
									title="Operations"
									description="System state, bulk actions, and diagnostics."
								/>
								<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
									{[
										{
											label: 'Managed sims',
											value: KNOWN_SIM_PATHS.length,
											cls: 'text-slate-100',
										},
										{ label: 'Published', value: publishedCount, cls: 'text-emerald-300' },
										{ label: 'Unpublished', value: unpublishedCount, cls: 'text-rose-300' },
										{
											label: 'Last updated',
											value: new Date(controls.updatedAt).toLocaleTimeString(),
											cls: 'text-slate-300',
										},
									].map((stat) => (
										<div
											key={stat.label}
											className="rounded-lg border border-slate-800 bg-slate-800/40 p-4"
										>
											<p className="text-xs text-slate-500">{stat.label}</p>
											<p className={`mt-1 text-lg font-semibold tabular-nums ${stat.cls}`}>
												{stat.value}
											</p>
										</div>
									))}
								</div>

								<div className="space-y-2">
									<p className="text-xs font-medium text-slate-400">Actions</p>
									<div className="flex flex-wrap gap-2">
										<button
											type="button"
											onClick={async () => {
												try {
													await navigator.clipboard.writeText(
														JSON.stringify(controls, null, 2),
													);
													showOpsMessage('Admin state copied to clipboard.');
												} catch {
													showOpsMessage('Clipboard access denied.');
												}
											}}
											className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-slate-600 hover:bg-slate-800 hover:text-slate-100"
										>
											Export state JSON
										</button>
										<button
											type="button"
											onClick={() => {
												const toRemove: string[] = [];
												for (let i = 0; i < window.localStorage.length; i += 1) {
													const key = window.localStorage.key(i);
													if (key?.startsWith('home-announcement-dismissed:'))
														toRemove.push(key);
												}
												for (const key of toRemove) window.localStorage.removeItem(key);
												showOpsMessage(
													`Cleared ${toRemove.length} dismissed announcement marker${toRemove.length !== 1 ? 's' : ''}.`,
												);
												pushAnalyticsEvent(
													'admin_action',
													'Cleared dismissed announcement markers',
												);
											}}
											className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-slate-600 hover:bg-slate-800 hover:text-slate-100"
										>
											Reset announcement dismissals
										</button>
										<button
											type="button"
											onClick={() => {
												window.localStorage.removeItem('physicssims-analytics-events');
												setAnalyticsEvents([]);
												showOpsMessage('Analytics log cleared.');
											}}
											className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-rose-400 transition hover:border-rose-700 hover:bg-rose-900/20 hover:text-rose-300"
										>
											Clear analytics log
										</button>
									</div>
								</div>

								{opsMessage ? (
									<p className="rounded-md border border-slate-800 bg-slate-800/40 px-3 py-2 text-xs text-slate-300">
										{opsMessage}
									</p>
								) : null}

								<div className="space-y-2">
									<p className="text-xs font-medium text-slate-400">Quick nav</p>
									<div className="flex flex-wrap gap-2">
										{[
											{ label: 'Home', to: '/' },
											{ label: 'Dashboard', to: '/dashboard' },
											{ label: 'LHC', to: '/lhc' },
											{ label: 'Wave 3D', to: '/wave-3d' },
											{ label: 'System status', to: '/system' },
											{ label: 'Changelog', to: '/changelog' },
										].map((link) => (
											<Link
												key={link.to}
												to={link.to}
												target="_blank"
												rel="noopener noreferrer"
												className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-400 transition hover:border-slate-600 hover:bg-slate-800 hover:text-slate-100"
											>
												{link.label} ↗
											</Link>
										))}
									</div>
								</div>

								<div className="space-y-2">
									<p className="text-xs font-medium text-slate-400">localStorage — physicssims keys</p>
									<div className="overflow-auto rounded-lg border border-slate-800">
										<table className="w-full text-left text-xs">
											<thead className="border-b border-slate-800 bg-slate-800/60">
												<tr>
													<th className="px-3 py-2 font-medium text-slate-400">Key</th>
													<th className="px-3 py-2 font-medium text-slate-400">Size</th>
													<th className="px-3 py-2 font-medium text-slate-400" />
												</tr>
											</thead>
											<tbody className="divide-y divide-slate-800/60">
												{(() => {
													const entries: Array<{ key: string; bytes: number }> = [];
													for (let i = 0; i < window.localStorage.length; i++) {
														const key = window.localStorage.key(i);
														if (key?.startsWith('physicssims')) {
															const v = window.localStorage.getItem(key) ?? '';
															entries.push({ key, bytes: new Blob([v]).size });
														}
													}
													entries.sort((a, b) => b.bytes - a.bytes);
													if (entries.length === 0) {
														return (
															<tr>
																<td className="px-3 py-4 text-center text-slate-500" colSpan={3}>
																	No physicssims-* keys found.
																</td>
															</tr>
														);
													}
													return entries.map(({ key, bytes }) => (
														<tr key={key} className="hover:bg-slate-800/30">
															<td className="px-3 py-2 font-mono text-slate-300">{key}</td>
															<td className="px-3 py-2 tabular-nums text-slate-400">
																{bytes >= 1024
																	? `${(bytes / 1024).toFixed(1)} KB`
																	: `${bytes} B`}
															</td>
															<td className="px-3 py-2 text-right">
																<button
																	type="button"
																	onClick={() => {
																		window.localStorage.removeItem(key);
																		showOpsMessage(`Removed key: ${key}`);
																		setAnalyticsEvents(loadAnalyticsEvents());
																	}}
																	className="rounded px-1.5 py-0.5 text-[10px] text-rose-400 transition hover:bg-rose-900/20"
																>
																	delete
																</button>
															</td>
														</tr>
													));
												})()}
											</tbody>
										</table>
									</div>
								</div>
							</div>
						) : null}

						{/* ── Announcements ─────────────────────────────────────────── */}
						{activeTab === 'announcements' ? (
							<div className="space-y-5">
								<SectionHeader
									title="Announcements"
									description="Managed announcement shown on the home page. Overrides the default launch popup when enabled."
								/>

								<div className="rounded-lg border border-slate-800">
									<div className="flex items-center justify-between px-4 py-3.5">
										<div>
											<div className="flex items-center gap-2">
												<span className="text-sm font-medium text-slate-200">
													Announcement enabled
												</span>
												<StatusBadge value={controls.announcement.enabled} />
											</div>
											<p className="mt-0.5 text-xs text-slate-500">
												When on, this replaces the default home announcement popup.
											</p>
										</div>
										<Toggle
											checked={controls.announcement.enabled}
											label="Announcement enabled"
											onChange={(value) => {
												persistControls(
													{
														...controls,
														announcement: {
															...controls.announcement,
															enabled: value,
														},
													},
													'Toggled announcement',
												);
											}}
										/>
									</div>
								</div>

								<div className="grid gap-5 lg:grid-cols-2">
									<div>
										<FieldLabel>Announcement ID</FieldLabel>
										<TextInput
											value={controls.announcement.id}
											onChange={(e) => {
												persistControls(
													{
														...controls,
														announcement: {
															...controls.announcement,
															id: e.target.value,
														},
													},
													'Updated announcement id',
												);
											}}
										/>
									</div>
									<div>
										<FieldLabel>Title</FieldLabel>
										<TextInput
											value={controls.announcement.title}
											onChange={(e) => {
												persistControls(
													{
														...controls,
														announcement: {
															...controls.announcement,
															title: e.target.value,
														},
													},
													'Updated announcement title',
												);
											}}
										/>
									</div>
									<div className="lg:col-span-2">
										<FieldLabel>Description</FieldLabel>
										<TextArea
											rows={3}
											value={controls.announcement.description}
											onChange={(e) => {
												persistControls(
													{
														...controls,
														announcement: {
															...controls.announcement,
															description: e.target.value,
														},
													},
													'Updated announcement description',
												);
											}}
										/>
									</div>
									<div>
										<FieldLabel>Button text</FieldLabel>
										<TextInput
											value={controls.announcement.primaryButtonText}
											onChange={(e) => {
												persistControls(
													{
														...controls,
														announcement: {
															...controls.announcement,
															primaryButtonText: e.target.value,
														},
													},
													'Updated announcement button text',
												);
											}}
										/>
									</div>
									<div>
										<FieldLabel>Button URL</FieldLabel>
										<TextInput
											value={controls.announcement.primaryButtonUrl}
											onChange={(e) => {
												persistControls(
													{
														...controls,
														announcement: {
															...controls.announcement,
															primaryButtonUrl: e.target.value,
														},
													},
													'Updated announcement button URL',
												);
											}}
										/>
									</div>
									<div className="lg:col-span-2">
										<div className="flex items-center justify-between rounded-lg border border-slate-800 px-4 py-3">
											<span className="text-sm font-medium text-slate-200">
												Open button in new tab
											</span>
											<Toggle
												checked={controls.announcement.openPrimaryInNewTab}
												label="Open button in new tab"
												onChange={(value) => {
													persistControls(
														{
															...controls,
															announcement: {
																...controls.announcement,
																openPrimaryInNewTab: value,
															},
														},
														'Updated announcement open-in-new-tab',
													);
												}}
											/>
										</div>
									</div>
								</div>

								<div>
									<button
										type="button"
										onClick={() => setAnnouncementPreviewOpen((v) => !v)}
										className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-400 transition hover:border-slate-600 hover:bg-slate-800 hover:text-slate-200"
									>
										{announcementPreviewOpen ? 'Hide preview' : 'Show preview'}
									</button>
								</div>

								{announcementPreviewOpen ? (
									<div className="rounded-lg border border-slate-700 bg-slate-800/40 p-5">
										<p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
											Preview
										</p>
										<p className="mt-3 text-base font-semibold text-slate-100">
											{controls.announcement.title}
										</p>
										<p className="mt-1.5 text-sm text-slate-400">
											{controls.announcement.description}
										</p>
										<div className="mt-4 flex items-center gap-3">
											<span className="inline-flex rounded-md bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white">
												{controls.announcement.primaryButtonText}
											</span>
											{controls.announcement.openPrimaryInNewTab ? (
												<span className="text-xs text-slate-500">opens in new tab</span>
											) : null}
										</div>
									</div>
								) : null}
							</div>
						) : null}
					</div>
				</div>
			</div>
		</div>
	);
}