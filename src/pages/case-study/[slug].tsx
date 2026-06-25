import { Link, useParams } from 'react-router-dom';

type StudySection = { id: string; label: string; accent: string; body: string[] };
type StudyModule = { path: string; label: string };
type StudyTestimonial = { quote: string; author: string };

type Study = {
  title: string;
  subtitle: string;
  date: string;
  author: string;
  affiliation: string;
  pullQuote: string;
  pullQuoteMeta: string;
  modules: StudyModule[];
  sections: StudySection[];
  testimonials: StudyTestimonial[];
  sources: Record<string, string>;
};

const STUDIES: Record<string, Study> = {
  cstdy01: {
    title: 'Early Educator Feedback & Platform Differentiation',
    subtitle:
      'What a physics education researcher noticed, and what we found when we looked at the landscape',
    date: 'June 2026',
    author: 'Dev Team - PhysicsSims',
    affiliation: 'Illini Open Edu - University of Illinois Urbana-Champaign',
    pullQuote:
      '"The Large Hadron Collider simulation is a great example of something you have that PhET does not."',
    pullQuoteMeta: 'Summer 2026 - Feedback from UIUC Physics Graduate Researcher',
    modules: [
      { path: '/lhc', label: 'Large Hadron Collider' },
      { path: '/faradays-law', label: "Faraday's Law" },
      { path: '/mag-field-3d', label: "3D Magnetic Field Simulator" },
    ],
    sections: [
      {
        id: 'introduction',
        label: 'Introduction',
        accent: 'text-cyan-200',
        body: [
          'PhysicsSims is a free, open simulation platform built by UIUC students for UIUC students. The platform is designed around the PHYS 211/212/213 curriculum and aims to give students access to interactive, modern tools for building physics intuition without a paywall or institutional license.',
          'In Summer 2026, we shared an early version of the platform with a graduate researcher in physics education at UIUC. Their feedback helped clarify the platform’s strengths, its risks, and the questions we need to answer before pursuing broader department-level adoption.',
        ],
      },
      {
        id: 'methodology',
        label: 'Methodology',
        accent: 'text-amber-200',
        body: [
          'We shared the platform directly with a UIUC physics PhD student and research assistant with a background in physics education research and classroom innovation. They reviewed the platform independently and responded with written feedback covering interface design, content coverage, differentiation, and strategic considerations for department-level adoption.',
          'In parallel, we conducted a manual gap analysis comparing our module library against the PhET Interactive Simulations catalog to identify where we overlap, where PhysicsSims may offer distinct value, and where gaps remain.',
        ],
      },
      {
        id: 'findings',
        label: 'Findings',
        accent: 'text-emerald-200',
        body: [
          "The educator response was strongly positive. Key observations included the platform's modern interface as a meaningful differentiator, UIUC curriculum alignment as a practical advantage, and the Large Hadron Collider simulation as a concrete example of content not currently represented in PhET’s catalog.",
          "The PhET gap analysis suggested that PhysicsSims may be strongest where it is most curriculum-specific. While PhET has far greater breadth across science topics, PhysicsSims currently includes several advanced PHYS 212-aligned topics, including Gauss's Law, Ampere's Law, Maxwell's Equations, and a 3D magnetic field visualizer.",
          'Rather than replacing PhET, the clearer opportunity is to complement it: PhET provides a broad, proven library of simulations, while PhysicsSims can focus on UIUC-specific sequencing, modern interaction design, and simulations tailored to topics students encounter directly in the PHYS sequence.',
        ],
      },
      {
        id: 'conclusion',
        label: 'Conclusion',
        accent: 'text-violet-200',
        body: [
          'This early feedback supports the core thesis behind PhysicsSims: curriculum alignment and interface quality are not just aesthetic details; they can be practical differentiators for student learning tools.',
          'Before approaching department-level adoption, the project needs stronger evidence from physics education research, a clear position on AI-assisted learning, and real student usage data.',
          'Next steps include completing the thermodynamics track for PHYS 213, conducting a deeper review of the physics education research literature, and preparing a Fall 2026 follow-up case study based on student interaction data.',
        ],
      },
    ],
    testimonials: [{ quote: 'This is incredible. I\'ll be sure to pass this along to colleagues and students during future semesters.', author: 'Graduate Researcher, UIUC Department of Physics' },],
    sources: {},
  },
};

export function CaseStudyDetail() {
  const { slug } = useParams<{ slug: string }>();
  const study: Study | undefined = slug ? STUDIES[slug] : undefined;

  if (!study) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center text-slate-100 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-rose-400">Not Found</p>
        <h1 className="mt-3 text-2xl font-semibold text-slate-50">Study not found</h1>
        <p className="mt-2 text-sm text-slate-400">No case study matches this URL.</p>
        <div className="mt-6">
          <Link
            to="/case-study"
            className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400 transition hover:text-cyan-200"
          >
            Back to Case Studies
          </Link>
        </div>
      </div>
    );
  }

  const keys = Object.keys(STUDIES);
  const idx = slug ? keys.indexOf(slug) : -1;
  const prevSlug = idx > 0 ? keys[idx - 1] : null;
  const nextSlug = idx < keys.length - 1 ? keys[idx + 1] : null;
  const prevStudy = prevSlug ? STUDIES[prevSlug] : null;
  const nextStudy = nextSlug ? STUDIES[nextSlug] : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 text-slate-100 sm:px-6">
      <div className="mb-8">
        <Link
          to="/case-study"
          className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400 transition hover:text-cyan-200"
        >
          Back to Case Studies
        </Link>
      </div>

      <header className="mb-12 border-b border-white/[0.07] pb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">
          Research • Case Study
        </p>
        <p className="mt-1 font-mono text-xs text-slate-500">{slug!.toUpperCase()}</p>
        <h1 className="mt-2 text-4xl font-bold leading-tight tracking-tight text-slate-50 sm:text-5xl">
          {study.title}
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-slate-300">{study.subtitle}</p>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-500">
          <span>{study.date}</span>
          <span aria-hidden="true">-</span>
          <span>{study.author}</span>
          <span aria-hidden="true">-</span>
          <span>{study.affiliation}</span>
        </div>
      </header>

      <div className="space-y-12">
        {study.sections.map((section) => (
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

        <aside className="rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.04] px-7 py-8">
          <p className="mb-3 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-cyan-300">
            Key Insight
          </p>
          <blockquote className="text-2xl font-semibold leading-snug text-slate-100 sm:text-3xl">
            {study.pullQuote}
          </blockquote>
          <p className="mt-4 text-sm text-slate-400">{study.pullQuoteMeta}</p>
        </aside>

        <section id="modules-used">
          <h2 className="mb-1 text-xs font-semibold uppercase tracking-[0.22em] text-amber-200">
            Modules Used
          </h2>
          <p className="mb-5 text-sm text-slate-400">
            The following PhysicsSims modules were integrated into this study.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {study.modules.map((mod) => (
              <Link
                key={mod.path}
                to={mod.path}
                className="group rounded-xl border border-white/[0.07] bg-slate-900/70 p-4 text-center transition hover:border-amber-400/30"
              >
                <p className="text-sm font-medium text-slate-200 transition group-hover:text-amber-100">
                  {mod.label}
                </p>
                <p className="mt-1 text-xs text-slate-500 transition group-hover:text-amber-300/70">
                  View simulation
                </p>
              </Link>
            ))}
          </div>
        </section>

        <section id="student-feedback">
          <h2 className="mb-1 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200">
            Feedback
          </h2>
          <p className="mb-5 text-sm text-slate-400">
            Selected testimonials collected at the end of the study period.
          </p>
          <div className="space-y-4">
            {study.testimonials.map((t, i) => (
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

        <section id="sources">
          <h2 className="mb-1 text-xs font-semibold uppercase tracking-[0.22em] text-violet-200">
            Sources
          </h2>
          <p className="mb-5 text-sm text-slate-400">
            References and source material for this case study. None at this time.
          </p>
          <div className="space-y-3">
            {Object.entries(study.sources).map(([label, url], i) => (
              <p key={i} className="text-sm text-slate-300">
                <span className="font-semibold">{label}:</span>{' '}
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-300 transition hover:text-cyan-100"
                >
                  {url}
                </a>
              </p>
            ))}
          </div>
        </section>

        {(prevStudy || nextStudy) && (
          <nav className="grid grid-cols-2 gap-3">
            <div>
              {prevStudy && prevSlug && (
                <Link
                  to={`/case-study/${prevSlug}`}
                  className="group flex h-full flex-col rounded-xl border border-white/[0.07] bg-slate-900/70 px-4 py-3 transition hover:border-cyan-400/30"
                >
                  <span className="mb-2 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Previous
                  </span>
                  <span className="text-sm font-medium leading-snug text-slate-200 transition group-hover:text-cyan-100">
                    {slug!.toUpperCase()}
                  </span>
                  <span className="mt-1 text-xs text-slate-500">{prevStudy.date}</span>
                </Link>
              )}
            </div>
            <div>
              {nextStudy && nextSlug && (
                <Link
                  to={`/case-study/${nextSlug}`}
                  className="group flex h-full flex-col rounded-xl border border-white/[0.07] bg-slate-900/70 px-4 py-3 text-right transition hover:border-cyan-400/30"
                >
                  <span className="mb-2 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Next
                  </span>
                  <span className="text-sm font-medium leading-snug text-slate-200 transition group-hover:text-cyan-100">
                    {slug!.toUpperCase()}
                  </span>
                  <span className="mt-1 text-xs text-slate-500">{nextStudy.date}</span>
                </Link>
              )}
            </div>
          </nav>
        )}
      </div>
    </div>
  );
}
