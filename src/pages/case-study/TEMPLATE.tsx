/**
 * HOW TO ADD A NEW CASE STUDY
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * OPTION A — Same layout, just new content (recommended for most studies)
 * ─────────────────────────────────────────────────────────────────────────────
 * You don't need a new file. Two steps:
 *
 * 1. Add a card to the index listing in src/pages/caseStudy.tsx:
 *
 *   {
 *     slug: 'your-slug-here',            // must match the URL: /case-study/your-slug-here
 *     title: 'Your Study Title',
 *     subtitle: 'One-line framing',
 *     date: 'Month YYYY',
 *     author: 'Dr. Full Name',
 *     description: 'One or two sentences shown on the index card.',
 *   },
 *
 * 2. Add the full data to the STUDIES map in src/pages/case-study/[slug].tsx:
 *
 *   'your-slug-here': {
 *     title: 'Your Study Title',
 *     subtitle: 'One-line framing',
 *     date: 'Month YYYY',
 *     author: 'Dr. Full Name',
 *     affiliation: 'Department / Institution',
 *     pullQuote: '"Key finding in one sentence."',
 *     pullQuoteMeta: 'Season YYYY · Sample size: N students',
 *     modules: [
 *       { path: '/kinematics-2d', label: 'Kinematics (2D)' },
 *     ],
 *     sections: [
 *       { id: 'introduction', label: 'Introduction', accent: 'text-cyan-200', body: ['Paragraph 1.', 'Paragraph 2.'] },
 *       { id: 'methodology',  label: 'Methodology',  accent: 'text-amber-200',  body: ['...'] },
 *       { id: 'findings',     label: 'Findings',     accent: 'text-emerald-200', body: ['...'] },
 *       { id: 'conclusion',   label: 'Conclusion',   accent: 'text-violet-200', body: ['...'] },
 *     ],
 *     testimonials: [
 *       { quote: '...', author: 'Anonymous Student, PHYS 211' },
 *     ],
 *   },
 *
 * That's it — no new routes, no new files.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * OPTION B — Fully custom layout for one study
 * ─────────────────────────────────────────────────────────────────────────────
 * Copy this file, rename it (e.g. my-special-study.tsx), then:
 *
 * 1. Add a route in src/App.tsx ROUTE_CONFIG:
 *      { path: '/case-study/my-special-study', load: () => import('./pages/case-study/my-special-study').then((m) => ({ default: m.MySpecialStudy })) },
 *    Put it ABOVE the '/case-study/:slug' route so it matches first.
 *
 * 2. Add the card to caseStudy.tsx with slug: 'my-special-study'.
 *
 * 3. Edit the component below freely — full control over layout.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Link } from 'react-router-dom';

// ── Fill these in ──────────────────────────────────────────────────────────

const TITLE = 'Your Study Title Here';
const SUBTITLE = 'One-line framing or research question';
const DATE = 'Month YYYY';
const AUTHOR = 'Dr. Full Name';
const AFFILIATION = 'Department of Physics · University Name';

const PULL_QUOTE = '"Key finding as a short, striking sentence that stands alone."';
const PULL_QUOTE_META = 'Season YYYY · Sample size: N students';

const MODULES_USED = [
  { path: '/kinematics-2d', label: 'Kinematics (2D)' },
  { path: '/energy-hills', label: 'Energy Hills' },
  // Add or remove entries. path must match an existing route in App.tsx.
];

const SECTIONS = [
  {
    id: 'introduction',
    label: 'Introduction',
    accent: 'text-cyan-200',
    body: [
      'First paragraph of the introduction. Replace with real content.',
      'Second paragraph. Each string in this array becomes its own <p> tag.',
    ],
  },
  {
    id: 'methodology',
    label: 'Methodology',
    accent: 'text-amber-200',
    body: [
      'Describe the study design, participants, and data collection approach.',
      'Additional methodology detail.',
    ],
  },
  {
    id: 'findings',
    label: 'Findings',
    accent: 'text-emerald-200',
    body: [
      'Summarize quantitative and qualitative results.',
      'Additional findings paragraph.',
    ],
  },
  {
    id: 'conclusion',
    label: 'Conclusion',
    accent: 'text-violet-200',
    body: [
      'Interpret the findings and discuss implications.',
      'Future directions or limitations.',
    ],
  },
];

const TESTIMONIALS = [
  { quote: 'Student quote one.', author: 'Anonymous Student, PHYS 211' },
  { quote: 'Student quote two.', author: 'Anonymous Student, PHYS 212' },
  { quote: 'Student quote three.', author: 'Anonymous Student, PHYS 211' },
];

// ── Component (safe to leave as-is) ───────────────────────────────────────

export function StudyTemplate() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 text-slate-100 sm:px-6">
      <div className="mb-8">
        <Link
          to="/case-study"
          className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400 transition hover:text-cyan-200"
        >
          ← Case Studies
        </Link>
      </div>

      {/* Hero */}
      <header className="mb-12 border-b border-white/[0.07] pb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">
          Research · Case Study
        </p>
        <h1 className="mt-3 text-4xl font-bold leading-tight tracking-tight text-slate-50 sm:text-5xl">
          {TITLE}
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-slate-300">{SUBTITLE}</p>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-500">
          <span>{DATE}</span>
          <span aria-hidden="true">·</span>
          <span>{AUTHOR}</span>
          <span aria-hidden="true">·</span>
          <span>{AFFILIATION}</span>
        </div>
      </header>

      <div className="space-y-12">
        {/* Body sections */}
        {SECTIONS.map((section) => (
          <section key={section.id} id={section.id}>
            <h2
              className={`mb-4 text-xs font-semibold uppercase tracking-[0.22em] ${section.accent}`}
            >
              {section.label}
            </h2>
            <div className="space-y-5">
              {section.body.map((paragraph, i) => (
                <p key={i} className="text-base leading-[1.85] text-slate-300">
                  {paragraph}
                </p>
              ))}
            </div>
          </section>
        ))}

        {/* Pull quote */}
        <aside className="rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.04] px-7 py-8">
          <p className="mb-3 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-cyan-300">
            Key Insight
          </p>
          <blockquote className="text-2xl font-semibold leading-snug text-slate-100 sm:text-3xl">
            {PULL_QUOTE}
          </blockquote>
          <p className="mt-4 text-sm text-slate-400">{PULL_QUOTE_META}</p>
        </aside>

        {/* Modules Used */}
        <section id="modules-used">
          <h2 className="mb-1 text-xs font-semibold uppercase tracking-[0.22em] text-amber-200">
            Modules Used
          </h2>
          <p className="mb-5 text-sm text-slate-400">
            The following PhysicsSims modules were integrated into the study curriculum.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {MODULES_USED.map((mod) => (
              <Link
                key={mod.path}
                to={mod.path}
                className="group rounded-xl border border-white/[0.07] bg-slate-900/70 p-4 text-center transition hover:border-amber-400/30"
              >
                <p className="text-sm font-medium text-slate-200 transition group-hover:text-amber-100">
                  {mod.label}
                </p>
                <p className="mt-1 text-xs text-slate-500 transition group-hover:text-amber-300/70">
                  View simulation →
                </p>
              </Link>
            ))}
          </div>
        </section>

        {/* Student Feedback */}
        <section id="student-feedback">
          <h2 className="mb-1 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200">
            Student Feedback
          </h2>
          <p className="mb-5 text-sm text-slate-400">
            Selected testimonials collected at the end of the study period.
          </p>
          <div className="space-y-4">
            {TESTIMONIALS.map((t, i) => (
              <article
                key={i}
                className="rounded-xl border border-white/[0.07] bg-slate-900/70 p-5"
              >
                <p className="text-sm italic leading-relaxed text-slate-300">"{t.quote}"</p>
                <p className="mt-3 text-xs font-semibold text-slate-500">{t.author}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Footer CTA */}
        <section className="rounded-2xl border border-white/[0.07] bg-slate-900/70 p-7 text-center">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-violet-200">
            Join a Future Study
          </p>
          <h2 className="mb-3 text-xl font-semibold text-slate-50">
            Want to be part of our next study?
          </h2>
          <p className="mx-auto mb-6 max-w-md text-sm leading-relaxed text-slate-400">
            We collaborate with instructors and students at participating institutions. Reach out
            to discuss how your course can be involved in upcoming research.
          </p>
          <Link
            to="/instructor"
            className="inline-flex items-center gap-2 rounded-full border border-violet-300/50 bg-violet-400/15 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-violet-100 transition hover:bg-violet-300/25"
          >
            Contact us →
          </Link>
        </section>
      </div>
    </div>
  );
}