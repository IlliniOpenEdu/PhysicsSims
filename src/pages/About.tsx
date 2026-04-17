import { Link } from 'react-router-dom';

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

const timeline = [
	{ phase: 'Development', text: 'Done' },
	{ phase: 'Initial Release', text: 'Done' },
	{ phase: 'More Modules', text: 'In Progress' },
	{ phase: 'Full Release', text: 'Very Soon' },
];

const upcomingPatches = [
	{ title: 'Finalize PHYS 211 page', eta: 'Patch v1.2' },
	{ title: 'Finalize E&M simulations', eta: 'Patch v1.4' },
	{ title: 'Finalize all simulation pages', eta: 'Release v1.5' },
];

const team = [
	{ name: 'Evan Doubek', role: 'Computer Science', accent: 'from-cyan-300 via-sky-300 to-indigo-300 ', github: 'Edoubek1024' },
	{ name: 'Bryan Chen', role: 'Systems Engineering and Design', accent: 'from-pink-300 via-amber-300 to-red-400', github: 'bbryanchenn' },
];

export function About() {
	return (
		<div className="relative mx-auto min-h-[100dvh] max-w-6xl overflow-hidden px-3 py-6 text-slate-100 sm:px-4 sm:py-8">
			<div className="pointer-events-none absolute inset-0 -z-10">
				<div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-amber-500/20 blur-3xl" />
				<div className="absolute right-0 top-32 h-80 w-80 rounded-full bg-cyan-500/20 blur-3xl" />
				<div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-emerald-500/15 blur-3xl" />
			</div>

			<header className="mb-6 rounded-3xl border border-slate-800/90 bg-slate-900/70 p-5 shadow-[0_20px_60px_rgba(2,6,23,0.55)] sm:p-8">
				<p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-300">About Us</p>
				<h1 className="mt-3 bg-[linear-gradient(90deg,#fdba74_0%,#fef08a_24%,#86efac_48%,#7dd3fc_74%,#c4b5fd_100%)] bg-clip-text text-3xl font-semibold tracking-tight text-transparent sm:text-5xl">
					For students, by students
				</h1>
				<p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-300 sm:text-base">
					PhysicsSims started at UIUC as a response to one simple problem: most learning tools felt either
					visually boring or cognitively overloaded. We wanted simulations with personality, clarity, and
					enough rigor to trust in real coursework. 
					This website will always be free to use, and we are committed to building the best physics sim library for students everywhere.
				</p>
				<p className='mt-5'>We would like to thank professor unknown for allowing us to do something.</p>

				<div className="mt-5 flex flex-wrap gap-3 text-xs">
					<span className="rounded-full border border-amber-300/40 bg-amber-300/10 px-3 py-1 text-amber-100">Easy2Use</span>
					<span className="rounded-full border border-emerald-300/40 bg-emerald-300/10 px-3 py-1 text-emerald-100">Browser native</span>
					<span className="rounded-full border border-cyan-300/40 bg-cyan-300/10 px-3 py-1 text-cyan-100">Classroom ready</span>
					<span className="rounded-full border border-pink-300/40 bg-pink-300/10 px-3 py-1 text-pink-100">Shareable Modules</span>
					<span className="rounded-full border border-slate-300/40 bg-slate-300/10 px-3 py-1 text-slate-100">Professor Endorsed</span>
				</div>

				<div className="mt-6">
					<Link
						to="/"
						className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/80 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:border-amber-400 hover:text-amber-100"
					>
						<span>←</span>
						Back to simulations
					</Link>
				</div>
			</header>

			<main className="grid gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">				
				<section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg shadow-slate-950/40 lg:col-span-2">
					<h2 className="text-lg font-semibold text-slate-100">Developers</h2>
					<p className="mt-1 text-sm text-slate-400">A small team building the kind of learning tool we wished we had.</p>

					<div className="mt-4 grid gap-4 md:grid-cols-2">
						{team.map((person) => (
							<article key={person.name} className="group rounded-2xl border border-slate-800 bg-slate-950/70 p-5 transition hover:-translate-y-1 hover:border-slate-600">
								<div className="flex items-start justify-between gap-4">
									<div className="min-w-0">
										<div className={`inline-flex rounded-full bg-gradient-to-r ${person.accent} px-3 py-1 text-[0.68rem] font-semibold text-slate-950`}>
											Team PhysicsSims
										</div>
										<h3 className="mt-3 text-xl font-semibold text-slate-100">{person.name}</h3>
										<p className="mt-1 text-sm text-slate-400">{person.role}</p>
										<a
											href={`https://github.com/${person.github}`}
											target="_blank"
											rel="noreferrer"
											className="mt-4 inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-sky-400 hover:text-sky-100"
										>
											<svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-current">
												<path d="M12 .5C5.73.5.75 5.58.75 11.92c0 5.07 3.29 9.37 7.86 10.89.58.11.79-.25.79-.56v-2.1c-3.2.71-3.88-1.57-3.88-1.57-.53-1.38-1.3-1.75-1.3-1.75-1.06-.74.08-.73.08-.73 1.17.09 1.8 1.22 1.8 1.22 1.04 1.83 2.72 1.3 3.38.99.11-.77.41-1.3.75-1.6-2.56-.3-5.25-1.3-5.25-5.79 0-1.28.44-2.33 1.16-3.15-.12-.3-.5-1.5.11-3.12 0 0 .94-.31 3.08 1.2.89-.25 1.84-.38 2.79-.39.95.01 1.9.14 2.79.39 2.14-1.51 3.08-1.2 3.08-1.2.61 1.62.23 2.82.11 3.12.72.82 1.16 1.87 1.16 3.15 0 4.5-2.69 5.48-5.26 5.78.42.36.79 1.07.79 2.16v3.2c0 .31.21.68.8.56 4.56-1.53 7.85-5.82 7.85-10.89C23.25 5.58 18.27.5 12 .5Z" />
											</svg>
										</a>
									</div>
									<img
										src={`https://github.com/${person.github}.png?size=200`}
										alt={`${person.name} profile photo`}
										loading="lazy"
										className="h-25 w-25 rounded-xl"
									/>
									
								</div>
							</article>
						))}
					</div>
				</section>
				<section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg shadow-slate-950/40">
					<h2 className="text-lg font-semibold text-slate-100">Core Principles</h2>
					<div className="mt-4 space-y-3">
						{principles.map((item) => (
							<article key={item.title} className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
								<h3 className="text-sm font-semibold text-amber-200">{item.title}</h3>
								<p className="mt-2 text-sm leading-relaxed text-slate-300">{item.detail}</p>
							</article>
						))}
					</div>
				</section>
				<div className="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
					<section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg shadow-slate-950/40">
						<h2 className="text-base font-semibold text-slate-100">Build Timeline</h2>
						<div className="mt-3 space-y-2.5">
							{timeline.map((step, idx) => (
								<div key={step.phase} className="flex gap-2.5">
									<div className="flex flex-col items-center">
										<span className="mt-1 h-2 w-2 rounded-full bg-cyan-300" />
										{idx < timeline.length - 1 ? <span className="mt-1 h-full w-px bg-slate-700" /> : null}
									</div>
									<div className="pb-3">
										<p className="text-xs font-semibold uppercase tracking-wide text-cyan-200">{step.phase}</p>
										<p className="mt-0.5 text-xs text-slate-300">{step.text}</p>
									</div>
								</div>
							))}
						</div>
					</section>

					<section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg shadow-slate-950/40">
						<h2 className="text-lg font-semibold text-slate-100">Future Plans</h2>
						<p className="mt-1 text-sm text-slate-400">What we are actively preparing next.</p>
						<div className="mt-4 space-y-3">
							{upcomingPatches.map((patch) => (
								<article key={patch.title} className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5">
									<p className="bg-[linear-gradient(90deg,#a7f3d0_25%,#34d399_70%)] bg-clip-text text-sm font-semibold text-transparent">{patch.title}</p>
									<p className="mt-1 text-xs uppercase tracking-wide text-slate-400">{patch.eta}</p>
								</article>
							))}
						</div>
					</section>
				</div>

				
			</main>
		</div>
	);
}
