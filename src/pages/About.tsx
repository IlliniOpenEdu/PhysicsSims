import { Link } from 'react-router-dom';

const principles = [
	{
		title: 'Visual First',
		detail:
			'Every simulation should make an idea obvious before you even read the equation. Motion, color, and structure come before text walls.',
	},
	{
		title: 'Physics Honest',
		detail:
			'We simplify interfaces, not the core model. If we approximate, we say so. If an assumption matters, we surface it in plain language.',
	},
	{
		title: 'Built For Students',
		detail:
			'The controls and feedback are designed around how students actually explore: tweak, test, break it, and ask why.',
	},
];

const timeline = [
	{ phase: 'Spark', text: 'Frustration with dated classroom applets and rigid tools.' },
	{ phase: 'Prototype', text: 'Early mechanics demos proved that cleaner UX drives better intuition.' },
	{ phase: 'Expansion', text: 'E&M and statics modules added with reusable visual + controls patterns.' },
	{ phase: 'Now', text: 'Turning PhysicsSims into a dependable learning lab for classrooms and self-study.' },
];

const team = [
	{ name: 'Evan Doubek', role: 'Computer Science', accent: 'from-amber-300 via-orange-300 to-rose-300' },
	{ name: 'Bryan Chen', role: 'Systems Engineering and Design', accent: 'from-cyan-300 via-sky-300 to-indigo-300' },
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

				<div className="mt-5 flex flex-wrap gap-3 text-xs">
					<span className="rounded-full border border-amber-300/40 bg-amber-300/10 px-3 py-1 text-amber-100">Easy2Use</span>
					<span className="rounded-full border border-emerald-300/40 bg-emerald-300/10 px-3 py-1 text-emerald-100">Browser native</span>
					<span className="rounded-full border border-cyan-300/40 bg-cyan-300/10 px-3 py-1 text-cyan-100">Classroom ready</span>
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

				<section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg shadow-slate-950/40">
					<h2 className="text-lg font-semibold text-slate-100">Build Timeline</h2>
					<div className="mt-4 space-y-3">
						{timeline.map((step, idx) => (
							<div key={step.phase} className="flex gap-3">
								<div className="flex flex-col items-center">
									<span className="mt-1 h-2.5 w-2.5 rounded-full bg-cyan-300" />
									{idx < timeline.length - 1 ? <span className="mt-1 h-full w-px bg-slate-700" /> : null}
								</div>
								<div className="pb-4">
									<p className="text-sm font-semibold text-cyan-200">{step.phase}</p>
									<p className="mt-1 text-sm text-slate-300">{step.text}</p>
								</div>
							</div>
						))}
					</div>
				</section>

				<section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg shadow-slate-950/40 lg:col-span-2">
					<h2 className="text-lg font-semibold text-slate-100">Developers</h2>
					<p className="mt-1 text-sm text-slate-400">A small team building the kind of learning tool we wished we had.</p>

					<div className="mt-4 grid gap-4 md:grid-cols-2">
						{team.map((person) => (
							<article key={person.name} className="group rounded-2xl border border-slate-800 bg-slate-950/70 p-5 transition hover:-translate-y-1 hover:border-slate-600">
								<div className={`inline-flex rounded-full bg-gradient-to-r ${person.accent} px-3 py-1 text-[0.68rem] font-semibold text-slate-950`}>
									Team PhysicsSims
								</div>
								<h3 className="mt-3 text-xl font-semibold text-slate-100">{person.name}</h3>
								<p className="mt-1 text-sm text-slate-400">{person.role}</p>
							</article>
						))}
					</div>
				</section>
			</main>
		</div>
	);
}
