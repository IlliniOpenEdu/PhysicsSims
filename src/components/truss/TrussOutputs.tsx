// ─────────────────────────────────────────────
//  Outputs panel: global stat tiles, per-member force/stress/SF table,
//  reactions at supports. Rows cross-link to viewport selection.
// ─────────────────────────────────────────────

import { motion } from 'framer-motion';
import type { EditorMember, Selection, SolveState, ViewMode } from './editorState';
import {
  fmtDeflection,
  fmtForce,
  fmtLength,
  fmtSF,
  fmtStress,
  type SolutionView,
} from './renderModel';

interface Props {
  solve: SolveState;
  view: SolutionView | null;
  members: EditorMember[];
  mode: ViewMode;
  selection: Selection;
  onSelectMember: (id: number) => void;
  onSelectNode: (id: number) => void;
}

function StatTile({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-slate-950/55 p-3 text-center">
      <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className={`mt-1 truncate text-sm font-semibold ${tone ?? 'text-slate-100'}`}>{value}</p>
    </div>
  );
}

export function TrussOutputs({
  solve,
  view,
  members,
  mode,
  selection,
  onSelectMember,
  onSelectNode,
}: Props) {
  if (solve.kind !== 'ok' || !view) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 text-sm text-slate-400">
        <h2 className="text-sm font-semibold tracking-wide text-rose-300">Results</h2>
        <p className="mt-2">
          {solve.kind === 'error'
            ? solve.code === 'mechanism'
              ? 'The structure is a mechanism: its stiffness matrix is singular. Add members or supports until it can carry load.'
              : `Cannot solve: ${solve.message}.`
            : 'Nothing to solve yet — connect at least two nodes with a member.'}
        </p>
      </div>
    );
  }

  const failedTone = view.failedCount > 0 ? 'text-rose-400' : 'text-emerald-300';
  const governing = members.find((m) => m.id === view.governingMember);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-4"
    >
      {/* Global summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="Status"
          value={view.failedCount > 0 ? `${view.failedCount} failing` : 'All members OK'}
          tone={failedTone}
        />
        <StatTile label="Max deflection" value={fmtDeflection(view.maxDeflection)} tone="text-amber-300" />
        <StatTile
          label="Overall SF"
          value={fmtSF(view.minSF)}
          tone={view.minSF < 1 ? 'text-rose-400' : view.minSF < 1.6 ? 'text-orange-300' : 'text-emerald-300'}
        />
        <StatTile
          label="Governing"
          value={
            governing && view.governingMode
              ? `M${governing.id} · ${view.governingMode}`
              : '—'
          }
        />
      </div>

      {/* Per-member table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
        <h2 className="text-sm font-semibold tracking-wide text-rose-300">Member forces</h2>
        <div className="mt-3 max-h-72 overflow-auto">
          <table className="w-full font-mono text-[0.68rem] text-slate-300">
            <thead className="sticky top-0 bg-slate-900">
              <tr className="text-slate-500">
                <th className="pb-1 pr-2 text-left font-normal">#</th>
                <th className="pb-1 pr-2 text-left font-normal">nodes</th>
                <th className="pb-1 pr-2 text-right font-normal">L</th>
                <th className="pb-1 pr-2 text-right font-normal">N</th>
                <th className="pb-1 pr-2 text-left font-normal">T/C</th>
                <th className="pb-1 pr-2 text-right font-normal">σ</th>
                <th className="pb-1 pr-2 text-right font-normal">SF</th>
                <th className="pb-1 text-left font-normal">check</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const f = view.forceByMember.get(m.id);
                const stress = view.stressByMember.get(m.id);
                const fail = view.failureByMember.get(m.id);
                if (!f) return null;
                const isSelected = selection?.kind === 'member' && selection.id === m.id;
                return (
                  <tr
                    key={m.id}
                    onClick={() => onSelectMember(m.id)}
                    className={`cursor-pointer border-t border-slate-800/70 ${
                      isSelected
                        ? 'bg-slate-800/60 text-white'
                        : fail?.fails
                          ? 'bg-rose-500/[0.07] hover:bg-rose-500/[0.14]'
                          : 'hover:bg-slate-800/30'
                    }`}
                  >
                    <td className="py-1 pr-2">{m.id}</td>
                    <td className="py-1 pr-2 text-slate-400">
                      {m.i}–{m.j}
                    </td>
                    <td className="py-1 pr-2 text-right">{fmtLength(f.length)}</td>
                    <td className="py-1 pr-2 text-right">{fmtForce(Math.abs(f.axial))}</td>
                    <td
                      className={`py-1 pr-2 ${
                        f.state === 'tension'
                          ? 'text-sky-300'
                          : f.state === 'compression'
                            ? 'text-orange-300'
                            : 'text-slate-500'
                      }`}
                    >
                      {f.state === 'tension' ? 'T' : f.state === 'compression' ? 'C' : '0'}
                    </td>
                    <td className="py-1 pr-2 text-right">
                      {stress !== undefined ? fmtStress(Math.abs(stress)) : '—'}
                    </td>
                    <td className="py-1 pr-2 text-right">{fail ? fmtSF(fail.safetyFactor) : '—'}</td>
                    <td className={`py-1 ${fail?.fails ? 'font-semibold text-rose-400' : 'text-emerald-300/80'}`}>
                      {fail?.fails ? `FAIL · ${fail.mode}` : 'ok'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reactions */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
        <h2 className="text-sm font-semibold tracking-wide text-emerald-300">Support reactions</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full font-mono text-[0.68rem] text-slate-300">
            <thead>
              <tr className="text-slate-500">
                <th className="pb-1 pr-2 text-left font-normal">node</th>
                <th className="pb-1 pr-2 text-right font-normal">Rx</th>
                <th className="pb-1 pr-2 text-right font-normal">Ry</th>
                {mode === '3d' && <th className="pb-1 pr-2 text-right font-normal">Rz</th>}
              </tr>
            </thead>
            <tbody>
              {[...view.reactionByNode.entries()].map(([nodeId, r]) => (
                <tr
                  key={nodeId}
                  onClick={() => onSelectNode(nodeId)}
                  className={`cursor-pointer border-t border-slate-800/70 ${
                    selection?.kind === 'node' && selection.id === nodeId
                      ? 'bg-slate-800/60 text-white'
                      : 'hover:bg-slate-800/30'
                  }`}
                >
                  <td className="py-1 pr-2">{nodeId}</td>
                  <td className="py-1 pr-2 text-right">{fmtForce(r.x)}</td>
                  <td className="py-1 pr-2 text-right">{fmtForce(r.y)}</td>
                  {mode === '3d' && <td className="py-1 pr-2 text-right">{fmtForce(r.z)}</td>}
                </tr>
              ))}
              {view.reactionByNode.size === 0 && (
                <tr className="border-t border-slate-800/70 text-slate-600">
                  <td colSpan={mode === '3d' ? 4 : 3} className="py-2 text-center">
                    no supports
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
