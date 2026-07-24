// ─────────────────────────────────────────────
//  Import/export panel. One shared text box holds the JSON — "Export" fills
//  it from the current structure, pasting or opening a file fills it for
//  import — and the preview box below always describes whatever is in it:
//  counts, supports, loads, sections, and whether it actually solves.
// ─────────────────────────────────────────────

import { useMemo, useRef, useState } from 'react';
import { solveEditorState, type EditorMember, type EditorNode, type ViewMode } from './editorState';
import { fmtForce } from './renderModel';
import { parseTrussFile, serializeTruss, summarizeTruss, type TrussModel } from './serialization';

interface Props {
  mode: ViewMode;
  nodes: EditorNode[];
  members: EditorMember[];
  onLoad: (model: TrussModel) => void;
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-slate-500">{label}</span>
      <span className="font-mono text-slate-200">{value}</span>
    </div>
  );
}

export function TrussDataPanel({ mode, nodes, members, onLoad }: Props) {
  const [text, setText] = useState('');
  const [copied, setCopied] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => {
    const t = text.trim();
    return t.length > 0 ? parseTrussFile(t) : null;
  }, [text]);

  // Preview facts + a dry-run solve so the box says whether it will stand up.
  const preview = useMemo(() => {
    if (!parsed?.ok) return null;
    const summary = summarizeTruss(parsed.model);
    const check = solveEditorState(parsed.model.mode, parsed.model.nodes, parsed.model.members);
    return { summary, check };
  }, [parsed]);

  const exportToBox = () => {
    setText(serializeTruss(mode, nodes, members));
    setFileName(null);
  };

  const copyJson = async () => {
    const json = text.trim().length > 0 ? text : serializeTruss(mode, nodes, members);
    if (text.trim().length === 0) setText(json);
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable (permissions / non-secure context) — the JSON
      // is in the text box, so the user can still select and copy manually
    }
  };

  const downloadJson = () => {
    const json = serializeTruss(mode, nodes, members);
    setText(json);
    setFileName(null);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `truss-${mode}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setText(typeof reader.result === 'string' ? reader.result : '');
      setFileName(file.name);
    };
    reader.readAsText(file);
  };

  const btn =
    'rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-slate-500 hover:text-slate-100';

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-300">
        Import / export
      </h3>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <button type="button" onClick={exportToBox} className={btn}>
          Export current
        </button>
        <button type="button" onClick={downloadJson} className={btn}>
          Download .json
        </button>
        <button type="button" onClick={copyJson} className={btn}>
          {copied ? 'Copied ✓' : 'Copy'}
        </button>
        <button type="button" onClick={() => fileRef.current?.click()} className={btn}>
          Open file…
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) openFile(f);
            e.target.value = '';
          }}
        />
      </div>

      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setFileName(null);
        }}
        spellCheck={false}
        placeholder="Paste truss JSON here, open a file, or export the current structure…"
        className="mt-3 h-28 w-full resize-y rounded-xl border border-slate-800 bg-slate-950/70 p-2.5 font-mono text-[0.65rem] leading-relaxed text-slate-300 outline-none placeholder:text-slate-600 focus:border-sky-600"
      />

      {/* Preview box: what the data in the text box actually is */}
      {parsed && (
        <div
          className={`mt-2 rounded-xl border p-3 text-[0.68rem] ${
            parsed.ok
              ? 'border-sky-500/25 bg-sky-500/[0.05]'
              : 'border-rose-500/30 bg-rose-500/[0.06]'
          }`}
        >
          {!parsed.ok ? (
            <p className="text-rose-300">
              <span className="font-semibold">Cannot import:</span> {parsed.error}
            </p>
          ) : (
            preview && (
              <>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-sky-200">
                    Truss structure · {preview.summary.mode.toUpperCase()}
                    {fileName && (
                      <span className="ml-1.5 font-normal text-slate-500">({fileName})</span>
                    )}
                  </p>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[0.6rem] font-medium ${
                      preview.check.kind === 'ok'
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                        : preview.check.kind === 'empty'
                          ? 'border-slate-700 bg-slate-900 text-slate-400'
                          : 'border-rose-500/40 bg-rose-500/10 text-rose-200'
                    }`}
                  >
                    {preview.check.kind === 'ok'
                      ? 'solves OK'
                      : preview.check.kind === 'empty'
                        ? 'no structure'
                        : preview.check.code === 'mechanism'
                          ? 'mechanism — unstable'
                          : 'will not solve'}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                  <Fact label="nodes" value={String(preview.summary.nodeCount)} />
                  <Fact label="members" value={String(preview.summary.memberCount)} />
                  <Fact
                    label="supports"
                    value={[
                      `${preview.summary.pins} pin`,
                      `${preview.summary.rollers} roller`,
                      ...(preview.summary.customs > 0
                        ? [`${preview.summary.customs} custom`]
                        : []),
                    ].join(' · ')}
                  />
                  <Fact
                    label="loads"
                    value={
                      preview.summary.loadedNodes > 0
                        ? `${preview.summary.loadedNodes} × Σ ${fmtForce(preview.summary.totalLoad)}`
                        : 'none'
                    }
                  />
                </div>
                <p className="mt-1.5 text-slate-500">
                  sections: <span className="text-slate-400">{preview.summary.sections.join(', ') || '—'}</span>
                </p>
                {preview.check.kind !== 'empty' && preview.check.restraintWarning && (
                  <p className="mt-1.5 text-amber-300/90">⚠ {preview.check.restraintWarning}</p>
                )}
                <button
                  type="button"
                  onClick={() => onLoad(parsed.model)}
                  className="mt-2.5 w-full rounded-lg border border-sky-500/40 bg-sky-500/15 px-3 py-1.5 text-xs font-semibold text-sky-100 transition hover:bg-sky-500/25"
                >
                  Load structure (replaces current)
                </button>
              </>
            )
          )}
        </div>
      )}
    </div>
  );
}
