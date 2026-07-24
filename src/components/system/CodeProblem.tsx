import { useEffect, useId, useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

export type CodeProblem = {
  title: string;
  description: string;
  imageUrl?: string;
  code: string;
};

type CodeProblemProps = {
  problem: CodeProblem;
  answerCode: string;
  answerTitle?: string;
  explanation?: string;
  lightMode?: boolean;
  className?: string;
};

type CopyTarget = 'problem' | 'answer' | null;

function PythonCodeBlock({ code }: { code: string }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-700/60 bg-slate-950/90 p-4 text-xs sm:text-sm">
      <SyntaxHighlighter
        language="python"
        style={oneDark}
        customStyle={{
          margin: 0,
          padding: 0,
          background: 'transparent',
        }}
        codeTagProps={{
          style: {
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          },
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

export function CodeProblem({
  problem,
  answerCode,
  answerTitle = 'Code Answer',
  explanation,
  lightMode = false,
  className,
}: CodeProblemProps) {
  const [showAnswer, setShowAnswer] = useState(false);
  const [copiedTarget, setCopiedTarget] = useState<CopyTarget>(null);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const contentId = useId();

  useEffect(() => {
    if (isCollapsed) {
      setShowAnswer(false);
    }
  }, [isCollapsed]);

  const handleCopyCode = async (target: Exclude<CopyTarget, null>, code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedTarget(target);
      window.setTimeout(() => setCopiedTarget(null), 1500);
    } catch {
      setCopiedTarget(null);
    }
  };

  const isProblemCopied = copiedTarget === 'problem';
  const isAnswerCopied = copiedTarget === 'answer';

  return (
    <section
      className={`overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-900/70 shadow-lg shadow-slate-950/30 ${className ?? ''}`}
    >
      <header className="flex items-center justify-between gap-3 border-b border-slate-700/60 px-4 py-3 sm:px-6">
        <h3 className="truncate text-base font-semibold text-slate-100 sm:text-lg">
          {problem.title}
        </h3>
        <button
          type="button"
          onClick={() => setIsCollapsed((prev) => !prev)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-600 text-slate-200 transition hover:border-sky-400 hover:text-sky-300"
          aria-expanded={!isCollapsed}
          aria-controls={contentId}
          aria-label={isCollapsed ? 'Expand card' : 'Collapse card'}
        >
          <svg
            viewBox="0 0 24 24"
            className={`h-4 w-4 transition-transform ${isCollapsed ? 'rotate-180' : 'rotate-0'}`}
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </header>

      <p className="sr-only" aria-live="polite">
        {isProblemCopied ? 'Starter code copied' : isAnswerCopied ? 'Answer code copied' : ''}
      </p>

      <div
        id={contentId}
        className={`grid w-[200%] grid-cols-2 overflow-hidden transition-[transform,max-height,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          showAnswer ? '-translate-x-1/2' : 'translate-x-0'
        } ${isCollapsed ? 'pointer-events-none max-h-0 opacity-0' : 'max-h-[5000px] opacity-100'}`}
      >
        <article className="w-full p-4 sm:p-6">
          <header className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">
                Problem
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleCopyCode('problem', problem.code)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-sky-500/50 bg-sky-500/10 text-sky-100 transition hover:bg-sky-500/20"
                aria-label={isProblemCopied ? 'Starter code copied' : 'Copy starter code'}
                title={isProblemCopied ? 'Copied' : 'Copy starter'}
              >
                {isProblemCopied ? (
                  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="10" height="10" rx="2" />
                    <rect x="5" y="5" width="10" height="10" rx="2" />
                  </svg>
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowAnswer(true)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-600 text-slate-300 transition hover:border-sky-400 hover:text-sky-300"
                aria-label="Open answer card"
                title="Open answer"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  aria-hidden="true"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-3-6 3V4.5Z" />
                </svg>
              </button>
            </div>
          </header>

          <p className="whitespace-pre-line text-sm leading-relaxed text-slate-300">
            {problem.description}
          </p>

          {problem.imageUrl ? (
            <div
              className={`mx-auto mt-4 w-full max-w-3xl overflow-hidden rounded-xl border ${
                lightMode
                  ? 'border-sky-200 bg-sky-50'
                  : 'border-slate-700/70 bg-slate-950/50'
              }`}
            >
              <div className="h-56 sm:h-64 lg:h-72">
                <img
                  src={problem.imageUrl}
                  alt={`${problem.title} diagram`}
                  className="h-full w-full object-contain p-2"
                />
              </div>
            </div>
          ) : null}

          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Given Code
            </p>
            <PythonCodeBlock code={problem.code} />
          </div>
        </article>

        <article className="w-full p-4 sm:p-6">
          <header className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
                Answer
              </p>
              <h3 className="mt-1 text-lg font-semibold text-slate-100 sm:text-xl">
                {answerTitle}
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleCopyCode('answer', answerCode)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-emerald-500/60 bg-emerald-500/10 text-emerald-200 transition hover:bg-emerald-500/20"
                aria-label={isAnswerCopied ? 'Answer code copied' : 'Copy answer code'}
                title={isAnswerCopied ? 'Copied' : 'Copy code'}
              >
                {isAnswerCopied ? (
                  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="10" height="10" rx="2" />
                    <rect x="5" y="5" width="10" height="10" rx="2" />
                  </svg>
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowAnswer(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-600 text-slate-300 transition hover:border-sky-400 hover:text-sky-300"
                aria-label="Back to problem card"
                title="Back to problem"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" fill="currentColor">
                  <path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-3-6 3V4.5Z" />
                </svg>
              </button>
            </div>
          </header>

          {explanation ? (
            <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/8 p-4 text-sm leading-relaxed text-slate-200">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-200/90">
                How This Works
              </p>
              {explanation}
            </div>
          ) : null}

          <PythonCodeBlock code={answerCode} />
        </article>
      </div>
    </section>
  );
}
