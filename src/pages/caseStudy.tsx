import { Link } from 'react-router-dom';

const CASE_STUDIES = [
  {
    slug: 'cstdy01',
    title: 'Early Educator Feedback & Platform Differentiation',
    subtitle: 'What a physics education researcher noticed and what we found when we looked at the landscape',
    date: 'June 2026',
    author: 'Dev Team - PhysicsSims',
    description:
      'In Summer 2026, a UIUC physics education graduate researcher reviewed the platform and provided written feedback on UI, content coverage, and differentiation — alongside our own gap analysis against the PhET simulation catalog.',
  },
];

export function CaseStudyIndex() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 text-slate-100 sm:px-6">
      <header className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">Research</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">
          Case Studies
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
          These studies examine how interactive physics simulations affect student engagement,
          learning outcomes, and long-term retention across undergraduate physics courses.
        </p>
        <div className="mt-5">
          <Link
            to="/"
            className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400 transition hover:text-cyan-200"
          >
            ← Back to home
          </Link>
        </div>
      </header>

      <div className="space-y-5">
        {CASE_STUDIES.map((study) => (
          <article
            key={study.slug}
            className="group rounded-2xl border border-white/[0.07] bg-slate-900/70 p-6 shadow-lg shadow-slate-950/40 transition hover:border-cyan-400/30"
          >
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span>{study.date}</span>
                  <span aria-hidden="true">·</span>
                  <span>{study.author}</span>
                </div>
                <h2 className="mt-2 text-lg font-semibold leading-snug text-slate-50 sm:text-xl">
                  {study.title}
                </h2>
                <p className="mt-0.5 text-sm font-medium text-cyan-300/80">{study.subtitle}</p>
                <p className="mt-3 text-sm leading-relaxed text-slate-400">{study.description}</p>
              </div>
              <div className="shrink-0 pt-1">
                <Link
                  to={`/case-study/${study.slug}`}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-cyan-300/40 bg-cyan-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-cyan-100 transition hover:bg-cyan-300/20"
                >
                  Read More →
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
