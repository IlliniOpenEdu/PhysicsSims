import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

const principles = [
	{
		title: 'Visual First',
		detail:
			'Every simulation should make an idea obvious before you even read the equation. Motion, color, and structure come before text walls.',
	},
	{
		title: 'Free To Use, Easy To Share',
		detail:
			'All simulations are free to use and share, with no ads or paywalls. We want to make it as easy as possible for students to access and distribute our tools.',
	},
	{
		title: 'Built For Students',
		detail: (
			<>
				We go by our motto{' '}
				<span className="bg-[linear-gradient(90deg,#fdba74_0%,#fef08a_24%,#86efac_48%)] bg-clip-text font-semibold text-transparent">
					"For students, by students"
				</span>
				. We are committed to building the best physics sim library for students who lack the resources or
				time to build their own tools from scratch.
			</>
		),
	},
];

const upcomingPatches = [
	{ title: 'Finalize PHYS 212 page', eta: 'Patch v1.5.2' },
	{ title: 'Finalize all simulation pages', eta: 'Release v1.6' },
];

const team = [
	{ name: 'Evan Doubek', role: 'Module Developer', accent: 'from-cyan-300 via-sky-300 to-indigo-300', github: 'Edoubek1024' },
	{ name: 'Bryan Chen', role: 'UI/UX and Module Developer', accent: 'from-pink-300 via-amber-300 to-red-400', github: 'bbryanchenn' },
];

const tags = ['Easy2Use', 'Browser native', 'Classroom ready', 'Shareable Modules', 'Professor Endorsed'];

const PORTRAIT_CLIP = 'polygon(16% 0, 100% 0, 84% 100%, 0 100%)';
const principleOffset = ['', 'sm:ml-10', 'sm:ml-20'];

// Slanted P3R-style section banner with a trailing rule
function SectionBanner({ label, hint, delay = 0 }: { label: ReactNode; hint?: ReactNode; delay?: number }) {
	return (
		<div className="p3-rise relative mb-6 mt-14" style={{ animationDelay: `${delay}s` }}>
			<div className="-skew-y-[2deg]">
				<div className="flex items-center gap-3">
					<span className="h-6 w-2 -skew-x-[20deg] bg-gradient-to-b from-amber-400 to-emerald-400" />
					<h2 className="text-3xl font-black italic uppercase tracking-tight text-slate-100 sm:text-4xl">{label}</h2>
					<span className="h-px flex-1 bg-gradient-to-r from-slate-600 to-transparent" />
				</div>
			</div>
			{hint ? <p className="mt-2 pl-5 text-sm text-slate-400">{hint}</p> : null}
		</div>
	);
}

export function About() {
	return (
		<div className="relative mx-auto min-h-[100dvh] max-w-5xl overflow-hidden px-4 py-8 text-slate-100 sm:px-6 sm:py-12">
			<style>{`
				@keyframes p3Enter {
					0%   { opacity: 0; transform: translateX(-70px) scale(0.95); filter: blur(10px); }
					65%  { opacity: 1; transform: translateX(10px) scale(1.015); filter: blur(0); }
					100% { opacity: 1; transform: translateX(0) scale(1); }
				}
				@keyframes p3Rise {
					0%   { opacity: 0; transform: translateY(22px); }
					100% { opacity: 1; transform: translateY(0); }
				}
				@keyframes p3Slash {
					0%   { opacity: 0; transform: scaleX(0); transform-origin: left; }
					100% { opacity: 1; transform: scaleX(1); transform-origin: left; }
				}
				@keyframes p3Drift {
					0%   { transform: translateX(-6%) skewX(-18deg); }
					100% { transform: translateX(8%) skewX(-18deg); }
				}
				@keyframes p3Pulse {
					0%, 100% { opacity: 0.5; transform: scale(1); }
					50%      { opacity: 0.75; transform: scale(1.04); }
				}
				.p3-enter { opacity: 0; animation: p3Enter 0.7s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
				.p3-rise  { opacity: 0; animation: p3Rise 0.6s ease-out forwards; }
				.p3-slash { animation: p3Slash 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
				.p3-drift { animation: p3Drift 9s ease-in-out infinite alternate; }
				.p3-pulse { animation: p3Pulse 6s ease-in-out infinite; }
				@media (prefers-reduced-motion: reduce) {
					.p3-enter, .p3-rise, .p3-slash { animation: none; opacity: 1; transform: none; }
					.p3-drift, .p3-pulse { animation: none; }
				}
			`}</style>

			{/* ambient background: orbs, drifting bars, faint diagonal scanlines */}
			<div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
				<div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-amber-500/20 blur-3xl" />
				<div className="absolute right-0 top-1/3 h-80 w-80 rounded-full bg-cyan-500/20 blur-3xl" />
				<div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-emerald-500/15 blur-3xl" />
				<div className="p3-drift absolute -left-1/4 top-0 h-[200%] w-44 bg-gradient-to-b from-amber-400/[0.06] to-transparent" />
				<div className="p3-drift absolute left-1/2 -top-10 h-[200%] w-28 bg-gradient-to-b from-cyan-400/[0.06] to-transparent" style={{ animationDelay: '1.4s' }} />
				<div className="p3-drift absolute right-10 top-0 h-[200%] w-36 bg-gradient-to-b from-violet-400/[0.06] to-transparent" style={{ animationDelay: '2.8s' }} />
				<div
					className="absolute inset-0 opacity-[0.04]"
					style={{ backgroundImage: 'repeating-linear-gradient(115deg, #fff 0, #fff 1px, transparent 1px, transparent 9px)' }}
				/>
			</div>

			{/* ===== HERO ===== */}
			<header className="relative">
				{/* moon motif */}
				<div className="p3-pulse pointer-events-none absolute -right-6 -top-8 h-40 w-40 rounded-full bg-[radial-gradient(circle_at_35%_30%,#fef08a55,#fdba7433_45%,transparent_70%)] sm:-right-2 sm:h-52 sm:w-52" />
				<div className="pointer-events-none absolute right-10 top-2 h-24 w-24 rounded-full border border-amber-300/20 sm:right-16 sm:h-32 sm:w-32" />

				<p className="p3-enter inline-flex -skew-x-[10deg] bg-gradient-to-r from-amber-400 to-yellow-300 px-3 py-1 text-xs font-black uppercase tracking-[0.25em] text-slate-950" style={{ animationDelay: '0.05s' }}>
					<span className="skew-x-[10deg]">About Us</span>
				</p>

				<h1 className="p3-enter mt-4 max-w-3xl bg-[linear-gradient(90deg,#fdba74_0%,#fef08a_24%,#86efac_48%,#7dd3fc_74%,#c4b5fd_100%)] bg-clip-text text-4xl font-black italic uppercase leading-[0.95] tracking-tight text-transparent sm:text-6xl" style={{ animationDelay: '0.15s' }}>
					For students, by students
				</h1>

				<div className="p3-slash mt-5 h-1.5 w-64 -skew-x-[24deg] bg-gradient-to-r from-amber-400 via-emerald-400 to-cyan-400" style={{ animationDelay: '0.45s' }} />

				<p className="p3-rise mt-6 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base" style={{ animationDelay: '0.4s' }}>
					PhysicsSims started at UIUC as a response to one simple problem: most learning tools felt either
					visually boring or cognitively overloaded. We wanted simulations with personality, clarity, and
					enough rigor to trust in real coursework. This website will always be free to use, and we are
					committed to building the best physics sim library for students everywhere.
				</p>

				<p className="p3-rise mt-4 text-sm text-slate-400" style={{ animationDelay: '0.5s' }}>
					We would like to thank professor unknown for allowing us to do something.
				</p>

				<div className="p3-rise mt-6 flex flex-wrap gap-2.5 text-xs" style={{ animationDelay: '0.6s' }}>
					{tags.map((tag) => (
						<span key={tag} className="-skew-x-[12deg] border border-slate-600 bg-slate-900/70 px-3 py-1.5 font-semibold uppercase tracking-wide text-slate-200 transition hover:border-amber-400 hover:text-amber-100">
							<span className="block skew-x-[12deg]">{tag}</span>
						</span>
					))}
				</div>

				<div className="p3-rise mt-7" style={{ animationDelay: '0.7s' }}>
					<Link
						to="/"
						className="group inline-flex -skew-x-[10deg] items-center gap-2 border border-slate-700 bg-slate-950/80 px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-200 transition hover:border-amber-400 hover:text-amber-100"
					>
						<span className="flex skew-x-[10deg] items-center gap-2">
							<span className="transition-transform group-hover:-translate-x-1">←</span>
							Back to simulations
						</span>
					</Link>
				</div>
			</header>

			{/* ===== DEVELOPERS: party panels, stacked and offset ===== */}
			<SectionBanner label="Developers" hint="" delay={0.2} />

			<div className="space-y-6">
				{team.map((person, i) => (
					<div
						key={person.name}
						className={`p3-enter sm:max-w-[90%] ${i % 2 ? 'sm:ml-auto sm:mr-0' : ''}`}
						style={{ animationDelay: `${0.25 + i * 0.18}s` }}
					>
						<article className="group relative -skew-x-[7deg] overflow-hidden border border-slate-700/80 bg-slate-950/80 shadow-[0_18px_40px_rgba(2,6,23,0.6)] transition-all duration-300 hover:-translate-y-1.5 hover:border-slate-500 hover:shadow-[0_26px_60px_rgba(2,6,23,0.78)]">
							<div className={`absolute left-0 top-0 h-full w-2 bg-gradient-to-b ${person.accent}`} />
							<div className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-700 group-hover:translate-x-[130%]" />
							<span className="pointer-events-none absolute -right-2 -top-10 select-none text-[9rem] font-black italic leading-none text-slate-50/[0.05]">
								{String(i + 1).padStart(2, '0')}
							</span>

							<div className="relative skew-x-[7deg] p-6 sm:p-8">
								<div className="flex items-center justify-between gap-5">
									<div className="min-w-0">
										<div className={`inline-flex -skew-x-[10deg] bg-gradient-to-r ${person.accent} px-3 py-1 text-[0.62rem] font-bold uppercase tracking-[0.2em] text-slate-950`}>
											<span className="skew-x-[10deg]">Team PhysicsSims</span>
										</div>
										<h3 className="mt-3 text-2xl font-black italic uppercase tracking-tight text-slate-50 sm:text-3xl">{person.name}</h3>
										<p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{person.role}</p>
										<a
											href={`https://github.com/${person.github}`}
											target="_blank"
											rel="noreferrer"
											className="mt-4 inline-flex -skew-x-[8deg] items-center gap-2 border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-200 transition hover:border-sky-400 hover:text-sky-100"
										>
											<span className="flex skew-x-[8deg] items-center gap-2">
												<svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-current">
													<path d="M12 .5C5.73.5.75 5.58.75 11.92c0 5.07 3.29 9.37 7.86 10.89.58.11.79-.25.79-.56v-2.1c-3.2.71-3.88-1.57-3.88-1.57-.53-1.38-1.3-1.75-1.3-1.75-1.06-.74.08-.73.08-.73 1.17.09 1.8 1.22 1.8 1.22 1.04 1.83 2.72 1.3 3.38.99.11-.77.41-1.3.75-1.6-2.56-.3-5.25-1.3-5.25-5.79 0-1.28.44-2.33 1.16-3.15-.12-.3-.5-1.5.11-3.12 0 0 .94-.31 3.08 1.2.89-.25 1.84-.38 2.79-.39.95.01 1.9.14 2.79.39 2.14-1.51 3.08-1.2 3.08-1.2.61 1.62.23 2.82.11 3.12.72.82 1.16 1.87 1.16 3.15 0 4.5-2.69 5.48-5.26 5.78.42.36.79 1.07.79 2.16v3.2c0 .31.21.68.8.56 4.56-1.53 7.85-5.82 7.85-10.89C23.25 5.58 18.27.5 12 .5Z" />
												</svg>
												GitHub
											</span>
										</a>
									</div>

									<div className="relative shrink-0">
										<div
											className={`absolute -inset-1 bg-gradient-to-br ${person.accent} opacity-80 blur-[1px] transition-opacity duration-300 group-hover:opacity-100`}
											style={{ clipPath: PORTRAIT_CLIP }}
										/>
										<img
											src={`https://github.com/${person.github}.png?size=200`}
											alt={`${person.name} profile photo`}
											loading="lazy"
											className="relative h-28 w-28 object-cover transition-transform duration-300 group-hover:scale-105 sm:h-32 sm:w-32"
											style={{ clipPath: PORTRAIT_CLIP }}
										/>
									</div>
								</div>
							</div>
						</article>
					</div>
				))}
			</div>

			{/* ===== CORE PRINCIPLES: cascading slanted panels ===== */}
			<SectionBanner label="Core Principles" hint="" delay={0.2} />

			<div className="space-y-4">
				{principles.map((item, i) => (
					<article
						key={item.title}
						className={`p3-rise group relative -skew-x-[6deg] overflow-hidden border border-slate-800 bg-slate-950/70 ${principleOffset[i] ?? ''}`}
						style={{ animationDelay: `${0.25 + i * 0.12}s` }}
					>
						<div className="absolute left-0 top-0 h-full w-1.5 bg-gradient-to-b from-amber-400 to-emerald-400" />
						<div className="skew-x-[6deg] p-5">
							<div className="flex items-start gap-4">
								<span className="select-none text-3xl font-black italic leading-none text-amber-300/70">
									{String(i + 1).padStart(2, '0')}
								</span>
								<div>
									<h3 className="text-sm font-black uppercase tracking-wide text-amber-200">{item.title}</h3>
									<p className="mt-2 text-sm leading-relaxed text-slate-300">{item.detail}</p>
								</div>
							</div>
						</div>
					</article>
				))}
			</div>

			{/* ===== FUTURE PLANS: P3R schedule strip ===== */}
			<SectionBanner label="Roadmap" hint="" delay={0.2} />

			<div className="space-y-3 pb-6">
				{upcomingPatches.map((patch, i) => (
					<div
						key={patch.title}
						className="p3-rise group flex items-stretch"
						style={{ animationDelay: `${0.25 + i * 0.12}s` }}
					>
						<div className="-skew-x-[10deg] bg-gradient-to-br from-emerald-300 to-emerald-500 px-4 py-3">
							<span className="block skew-x-[10deg] text-xs font-black uppercase tracking-wide text-slate-950">{patch.eta}</span>
						</div>
						<div className="-ml-1 flex-1 -skew-x-[10deg] border border-slate-800 bg-slate-950/70 px-5 py-3 transition-colors group-hover:border-emerald-400/60">
							<span className="block skew-x-[10deg] text-sm font-semibold text-slate-100">{patch.title}</span>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}