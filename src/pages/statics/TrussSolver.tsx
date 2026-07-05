import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ConceptBox } from '../../components/ConceptBox';
import { TrussCanvas2D } from '../../components/truss/TrussCanvas2D';
import { TrussDataPanel } from '../../components/truss/TrussDataPanel';
import { TrussInspector } from '../../components/truss/TrussInspector';
import { TrussOutputs } from '../../components/truss/TrussOutputs';
import { TrussScene3D } from '../../components/truss/TrussScene3D';
import type { Tool } from '../../components/truss/editorState';
import { TRUSS_PRESETS } from '../../components/truss/presets';
import { buildSolutionView } from '../../components/truss/renderModel';
import { useTrussEditor } from '../../hooks/truss/useTrussEditor';
import { toSigFigs } from '../../utils/formatters';

const TOOLS: { id: Tool; label: string }[] = [
  { id: 'select', label: 'Select' },
  { id: 'add-node', label: 'Add node' },
  { id: 'member', label: 'Member' },
  { id: 'delete', label: 'Delete' },
];

export function TrussSolver() {
  const editor = useTrussEditor();
  const { mode, tool, solve, span } = editor;

  const [deflectSlider, setDeflectSlider] = useState(50); // 0..100
  const [showGhost, setShowGhost] = useState(true);

  const solutionView = useMemo(
    () => (solve.kind === 'ok' ? buildSolutionView(solve.solution) : null),
    [solve],
  );

  // Ghost displacement multiplier: slider midpoint puts the peak ghost
  // offset at ~10% of the structure span; quadratic feel for fine control.
  const ghostScale = useMemo(() => {
    if (!solutionView || solutionView.maxDeflection <= 0) return 0;
    const auto = (0.1 * span) / solutionView.maxDeflection;
    return auto * (deflectSlider / 50) ** 2;
  }, [solutionView, span, deflectSlider]);

  const status =
    solve.kind === 'ok'
      ? solutionView && solutionView.failedCount > 0
        ? {
            tone: 'border-rose-500/40 bg-rose-500/10 text-rose-200',
            text: `Solved — ${solutionView.failedCount} member${solutionView.failedCount > 1 ? 's' : ''} failing`,
          }
        : {
            tone: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
            text: `Solved · ${editor.members.length} members`,
          }
      : solve.kind === 'empty'
        ? { tone: 'border-slate-700 bg-slate-900 text-slate-300', text: 'Draw a structure' }
        : solve.code === 'mechanism'
          ? { tone: 'border-rose-500/40 bg-rose-500/10 text-rose-200', text: 'Mechanism — unstable' }
          : { tone: 'border-amber-500/40 bg-amber-500/10 text-amber-200', text: solve.message };

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-7xl flex-col px-3 py-6 text-slate-100 sm:px-4 sm:py-8">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-4 sm:mb-6 sm:items-center sm:gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-400">
            Statics demo
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
            Truss Solver
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">
            Build a truss, load it, and solve it by the direct stiffness method: member forces,
            stresses, reactions, Euler buckling, and the (exaggerated) deflected shape.
          </p>
        </div>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-rose-500 hover:text-rose-100"
        >
          ← Dashboard
        </Link>
      </header>

      <main className="grid items-start gap-4 sm:gap-6 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)]">
        {/* Viewport — the hero — with outputs flowing beneath it */}
        <section className="space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-lg shadow-slate-950/40 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {/* 2D / 3D toggle */}
              <div className="flex overflow-hidden rounded-full border border-slate-700">
                {(['2d', '3d'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => editor.switchMode(m)}
                    className={`px-3 py-1.5 text-xs font-semibold uppercase transition ${
                      mode === m
                        ? 'bg-rose-500/20 text-rose-100'
                        : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>

              {/* Tools */}
              <div className="flex gap-1.5">
                {TOOLS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => editor.setTool(t.id)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      tool === t.id
                        ? 'border-sky-400 bg-sky-500/20 text-sky-100'
                        : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="ml-auto flex items-center gap-2">
                {solve.kind === 'ok' && solve.planarZRestrained && mode === '3d' && (
                  <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-[0.65rem] text-sky-200">
                    planar — z restrained
                  </span>
                )}
                <span className={`rounded-full border px-3 py-1 text-xs font-medium ${status.tone}`}>
                  {status.text}
                </span>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-800 bg-[#030507]">
              {mode === '2d' ? (
                <TrussCanvas2D
                  nodes={editor.nodes}
                  members={editor.members}
                  selection={editor.selection}
                  pendingNode={editor.pendingNode}
                  tool={tool}
                  solutionView={solutionView}
                  ghostScale={ghostScale}
                  showGhost={showGhost}
                  fitKey={editor.fitKey}
                  onNodeClick={editor.handleNodeClick}
                  onMemberClick={editor.handleMemberClick}
                  onMiss={editor.handleMiss}
                  onAddNode={(x, y) => editor.addNode(x, y, 0)}
                  onMoveNode={(id, x, y) => editor.moveNode(id, x, y)}
                />
              ) : (
                <div className="h-[37.5rem]">
                  <TrussScene3D
                    nodes={editor.nodes}
                    members={editor.members}
                    selection={editor.selection}
                    pendingNode={editor.pendingNode}
                    tool={tool}
                    solutionView={solutionView}
                    ghostScale={ghostScale}
                    showGhost={showGhost}
                    span={span}
                    onNodeClick={editor.handleNodeClick}
                    onMemberClick={editor.handleMemberClick}
                    onMiss={editor.handleMiss}
                    onAddNode={editor.addNode}
                  />
                </div>
              )}
            </div>

            {/* Deflection scale — the hook: drag it and watch the structure flex */}
            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.05] px-3 py-2.5">
              <label className="flex items-center gap-2 text-xs font-semibold text-amber-200">
                <input
                  type="checkbox"
                  checked={showGhost}
                  onChange={(e) => setShowGhost(e.target.checked)}
                  className="accent-amber-400"
                />
                Deflected shape
              </label>
              <input
                type="range"
                min={0}
                max={100}
                value={deflectSlider}
                onChange={(e) => setDeflectSlider(Number(e.target.value))}
                disabled={!showGhost || !solutionView}
                className="min-w-32 flex-1 accent-amber-400 disabled:opacity-40"
              />
              <span className="font-mono text-[0.68rem] text-amber-200/90">
                ×{ghostScale > 0 ? toSigFigs(ghostScale, 3) : '0'}
              </span>
              <span className="hidden text-[0.65rem] text-slate-500 sm:inline">
                displacements are exaggerated; real deflections are millimetres
              </span>
            </div>

            {/* Legend */}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.68rem] text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-1 w-5 rounded bg-sky-400" /> tension
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-1 w-5 rounded bg-orange-400" /> compression
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-1 w-5 rounded bg-rose-500" /> failing / near failure
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-1 w-5 rounded bg-rose-400/70" /> loads
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-1 w-5 rounded bg-emerald-400/80" /> reactions
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-1 w-5 rounded border border-dashed border-slate-400" />{' '}
                deflected ghost
              </span>
            </div>
          </div>

          <TrussOutputs
            solve={solve}
            view={solutionView}
            members={editor.members}
            mode={mode}
            selection={editor.selection}
            onSelectMember={(id) => editor.setSelection({ kind: 'member', id })}
            onSelectNode={(id) => editor.setSelection({ kind: 'node', id })}
          />
        </section>

        {/* Editor column */}
        <aside className="space-y-4">
          <TrussInspector editor={editor} view={solutionView} />

          {/* Preset library */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-300">
              Preset library
            </h3>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {TRUSS_PRESETS.map((p, i) => (
                <motion.button
                  key={p.id}
                  type="button"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.04 * i }}
                  onClick={() => editor.loadPreset(p)}
                  title={p.blurb}
                  className="rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-left transition hover:border-rose-400/60 hover:bg-rose-500/[0.06]"
                >
                  <span className="block text-xs font-semibold text-slate-100">
                    {p.label}
                    {p.mode === '3d' && <span className="ml-1 text-[0.6rem] text-sky-300">3D</span>}
                  </span>
                  <span className="mt-0.5 block text-[0.62rem] leading-tight text-slate-500">
                    {p.blurb}
                  </span>
                </motion.button>
              ))}
              <button
                type="button"
                onClick={editor.clearAll}
                className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-left text-xs font-semibold text-slate-400 transition hover:border-rose-500/50 hover:text-rose-200"
              >
                Clear all
                <span className="mt-0.5 block text-[0.62rem] font-normal text-slate-600">
                  Empty canvas, build from scratch.
                </span>
              </button>
            </div>
          </div>

          <TrussDataPanel
            mode={mode}
            nodes={editor.nodes}
            members={editor.members}
            onLoad={editor.loadModel}
          />
        </aside>
      </main>

      <ConceptBox
        className="mt-6"
        heading="What to notice"
        items={[
          {
            title: 'Tension and compression alternate',
            description:
              'Under a downward deck load the bottom chord stretches (tension, blue) while the top chord shortens (compression, orange). Flip a Pratt into a Howe and watch the diagonals swap roles.',
          },
          {
            title: 'Buckling punishes long compression members',
            description:
              'Euler capacity falls as 1/L². A member that is fine in tension can fail in compression at the same force — the table shows which check (yield vs buckling) governs each member.',
          },
          {
            title: 'The deflected shape is the stiffness matrix talking',
            description:
              'The ghost overlay is K⁻¹F, scaled up. Stiff load paths barely move; soft spots sag. Try deleting one diagonal and watch the deflection reorganize around the missing member.',
          },
          {
            title: 'Redundancy needs stiffness, not just statics',
            description:
              'The K-truss preset is statically indeterminate: the method of joints cannot resolve its member forces, but the stiffness solver distributes load according to relative member stiffness EA/L.',
          },
        ]}
      />
    </div>
  );
}
