import type { ReactNode } from 'react';

type ConceptBoxItem = {
  title: ReactNode;
  description: ReactNode;
};

type ConceptBoxProps = {
  heading: ReactNode;
  items: ConceptBoxItem[];
  className?: string;
};

export function ConceptBox({ heading, items, className = '' }: ConceptBoxProps) {
  return (
    <section
      className={`rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/40 lg:col-span-2 ${className}`.trim()}
    >
      <h2 className="text-sm font-semibold tracking-wide text-sky-300">{heading}</h2>
      <div className="mt-3 grid gap-4 text-sm text-slate-300 md:grid-cols-2">
        {items.map((item) => (
          <div key={String(item.title)} className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
            <p className="font-semibold text-slate-50">{item.title}</p>
            <p className="mt-2 text-xs leading-relaxed">{item.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
