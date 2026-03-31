import { Link } from 'react-router-dom';

export function Home() {
  return (
    <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-70">
        <div className="absolute -left-40 top-0 h-72 w-72 rounded-full bg-sky-700/30 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-blue-500/25 blur-3xl" />
      </div>

      <header className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">
            Welcome to
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl md:text-5xl">
            Physics Labs
          </h1>
          <p className="mt-4 max-w-xl text-sm text-slate-300 sm:text-base">
            An interactive space for exploring mechanics, waves, electricity, and more — right in
            your browser. Built for students, educators, and anyone curious about how the world
            works.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              to="/kinematics"
              className="inline-flex items-center gap-2 rounded-full bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 shadow-md shadow-sky-900/50 transition hover:bg-sky-400"
            >
              1-D Kinematics demo
              <span className="text-xs">→</span>
            </Link>
            <Link
              to="/kinematics-2d"
              className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-sky-500 hover:text-sky-100"
            >
              2-D Kinematics demo
              <span className="text-xs">→</span>
            </Link>
            <Link
              to="/forces"
              className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-emerald-500 hover:text-emerald-100"
            >
              Force simulator
              <span className="text-xs">→</span>
            </Link>
            <Link
              to="/gravity-friction"
              className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-sky-500 hover:text-sky-100"
            >
              Simple friction (rope pull)
              <span className="text-xs">→</span>
            </Link>
            <Link
              to="/box-incline"
              className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-emerald-500 hover:text-emerald-100"
            >
              Box on an incline
              <span className="text-xs">→</span>
            </Link>
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1 text-[0.7rem] font-medium text-slate-300">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
              Frontend-only · Static site
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-xs text-slate-300">
          <p className="font-semibold text-sky-200">What&apos;s here now?</p>
          <p className="mt-2">
            This is the welcome page. It introduces the project and links to individual experiment
            pages — starting with a simple kinematics demo about throwing a ball.
          </p>
          <p className="mt-2">
            As you add more simulations, you can create new routes (for example
            <span className="mx-1 rounded bg-slate-900 px-1 py-0.5 font-mono text-[0.6rem] text-sky-200">
              /waves
            </span>
            ,
            <span className="mx-1 rounded bg-slate-900 px-1 py-0.5 font-mono text-[0.6rem] text-sky-200">
              /circuits
            </span>
            ) and link to them from here.
          </p>
        </div>
      </header>

      <main className="grid flex-1 gap-8 lg:grid-cols-[minmax(0,2.1fr)_minmax(0,1.2fr)]">
        <section className="relative overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/80 p-6 shadow-lg shadow-slate-950/40">
          <div className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-32 bg-gradient-to-t from-slate-950/90 to-transparent" />
          <h2 className="text-sm font-semibold tracking-wide text-sky-300">
            Learn physics by experimenting
          </h2>
          <p className="mt-2 text-lg font-semibold text-slate-50 sm:text-xl">
            Each simulation is a small, focused &quot;lab&quot; designed to answer a question.
          </p>
          <p className="mt-3 max-w-2xl text-sm text-slate-300">
            The demos you add here are meant to help you see how equations turn into motion,
            forces, fields, and waves — not just numbers on a page.
          </p>

          <ul className="mt-4 grid gap-3 text-sm text-slate-200 sm:grid-cols-2">
            <li className="flex gap-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3">
              <span className="mt-0.5 h-6 w-6 flex-none rounded-full bg-sky-700/50 text-center text-xs font-semibold text-sky-100">
                1
              </span>
              <div>
                <p className="font-medium text-slate-50">Pose a question</p>
                <p className="mt-1 text-xs text-slate-400">
                  For example: &quot;What happens if I throw a ball harder or from higher up?&quot;
                </p>
              </div>
            </li>
            <li className="flex gap-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3">
              <span className="mt-0.5 h-6 w-6 flex-none rounded-full bg-sky-700/50 text-center text-xs font-semibold text-sky-100">
                2
              </span>
              <div>
                <p className="font-medium text-slate-50">Adjust the parameters</p>
                <p className="mt-1 text-xs text-slate-400">
                  Use sliders and inputs to change acceleration, velocity, and initial conditions.
                </p>
              </div>
            </li>
            <li className="flex gap-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3">
              <span className="mt-0.5 h-6 w-6 flex-none rounded-full bg-sky-700/50 text-center text-xs font-semibold text-sky-100">
                3
              </span>
              <div>
                <p className="font-medium text-slate-50">Watch the outcome</p>
                <p className="mt-1 text-xs text-slate-400">
                  See the motion respond immediately while the equations stay behind the scenes.
                </p>
              </div>
            </li>
            <li className="flex gap-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3">
              <span className="mt-0.5 h-6 w-6 flex-none rounded-full bg-sky-700/50 text-center text-xs font-semibold text-sky-100">
                4
              </span>
              <div>
                <p className="font-medium text-slate-50">Connect ideas</p>
                <p className="mt-1 text-xs text-slate-400">
                  Relate graphs, formulas, and intuition by exploring many versions of the same
                  setup.
                </p>
              </div>
            </li>
          </ul>
        </section>

        <aside className="space-y-5 rounded-2xl border border-slate-800/80 bg-slate-950/80 p-6 shadow-lg shadow-slate-950/40">
          <h2 className="text-sm font-semibold tracking-wide text-sky-300">
            Where the simulations will live
          </h2>
          <p className="text-sm text-slate-300">
            Each simulation will eventually get its own page. The first example is the kinematics
            demo, reachable from the button above.
          </p>

          <ul className="space-y-3 text-sm text-slate-200">
            <li className="flex items-start gap-3">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-sky-400" />
              <div>
                <span className="font-mono text-[0.7rem] text-sky-300">src/pages</span>
                <p className="text-xs text-slate-400">
                  Holds top-level routes such as
                  <span className="mx-1 rounded bg-slate-900/80 px-1 py-0.5 font-mono text-[0.65rem] text-sky-200">
                    /kinematics
                  </span>
                  and future topics.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-sky-400" />
              <div>
                <span className="font-mono text-[0.7rem] text-sky-300">src/simulations</span>
                <p className="text-xs text-slate-400">
                  Stores the underlying simulation logic and state for each experiment.
                </p>
              </div>
            </li>
          </ul>

          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/80 p-4 text-xs text-slate-300">
            When you&apos;re ready to grow this project, you can keep adding new pages and link
            them from this welcome screen to create a full interactive physics lab.
          </div>
        </aside>
      </main>
    </div>
  );
}

