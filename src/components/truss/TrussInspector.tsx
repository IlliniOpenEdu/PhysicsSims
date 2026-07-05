// ─────────────────────────────────────────────
//  Context-sensitive inspector: node position/support/load editing,
//  member section assignment (presets + custom E/A/I/σ_y).
//  Pure form UI — all numbers it shows come from editor state or the
//  solver output, never computed here.
// ─────────────────────────────────────────────

import { useEffect, useState } from 'react';
import { formatAuto, formatDeg } from '../../utils/formatters';
import type { EditorMember, EditorNode, SupportKind, ViewMode } from './editorState';
import { fmtForce, fmtLength, fmtSF, fmtStress, type SolutionView } from './renderModel';
import { CUSTOM_SECTION_ID, SECTION_PRESETS } from './sections';
import type { TrussEditor } from '../../hooks/truss/useTrussEditor';

// ── Small controlled number field that tolerates in-progress typing ────────

function NumberField({
  label,
  value,
  onCommit,
  step = 0.5,
  unit,
}: {
  label: string;
  value: number;
  onCommit: (v: number) => void;
  step?: number;
  unit?: string;
}) {
  const [text, setText] = useState(String(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(String(value));
  }, [value, focused]);

  return (
    <label className="flex items-center justify-between gap-2 text-xs text-slate-300">
      <span className="whitespace-nowrap">{label}</span>
      <span className="flex items-center gap-1">
        <input
          type="number"
          step={step}
          value={text}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => {
            setText(e.target.value);
            const v = Number(e.target.value);
            if (Number.isFinite(v)) onCommit(v);
          }}
          className="w-20 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-right font-mono text-xs text-slate-100 outline-none focus:border-sky-500"
        />
        {unit && <span className="w-8 text-[0.65rem] text-slate-500">{unit}</span>}
      </span>
    </label>
  );
}

/** cos/sin at right angles return ~1e-16, not 0 — snap so axis-aligned loads
 *  get exact zero components instead of floating-point residue. */
const trig = (v: number): number => (Math.abs(v) < 1e-12 ? 0 : v);

const SUPPORT_OPTIONS: { value: SupportKind; label2d: string; label3d: string }[] = [
  { value: 'none', label2d: 'free', label3d: 'free' },
  { value: 'pin', label2d: 'pin (x + y fixed)', label3d: 'pin (x, y, z fixed)' },
  { value: 'roller', label2d: 'roller (y fixed)', label3d: 'roller (y fixed)' },
];

function NodePanel({
  node,
  mode,
  editor,
  view,
}: {
  node: EditorNode;
  mode: ViewMode;
  editor: TrussEditor;
  view: SolutionView | null;
}) {
  const magXY = Math.hypot(node.load.fx, node.load.fy);
  const angle = magXY > 0 ? Math.atan2(node.load.fy, node.load.fx) : -Math.PI / 2;
  const reaction = view?.reactionByNode.get(node.id);
  const disp = view?.dispByNode.get(node.id);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-amber-300">
          Node {node.id}
        </h3>
        <button
          type="button"
          onClick={() => editor.deleteNode(node.id)}
          className="rounded-full border border-slate-700 px-2.5 py-1 text-[0.65rem] font-semibold text-slate-300 transition hover:border-rose-500 hover:text-rose-200"
        >
          Delete node
        </button>
      </div>

      <div className="space-y-1.5">
        <NumberField label="x" value={node.x} unit="m" step={0.25}
          onCommit={(v) => editor.patchNode(node.id, { x: v })} />
        <NumberField label="y" value={node.y} unit="m" step={0.25}
          onCommit={(v) => editor.patchNode(node.id, { y: v })} />
        {mode === '3d' && (
          <NumberField label="z" value={node.z} unit="m" step={0.25}
            onCommit={(v) => editor.patchNode(node.id, { z: v })} />
        )}
      </div>

      <label className="flex items-center justify-between gap-2 text-xs text-slate-300">
        <span>Support</span>
        <select
          value={node.support}
          onChange={(e) => editor.setSupport(node.id, e.target.value as SupportKind)}
          className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100 outline-none focus:border-sky-500"
        >
          {SUPPORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {mode === '3d' ? o.label3d : o.label2d}
            </option>
          ))}
        </select>
      </label>

      <div className="rounded-lg border border-rose-400/20 bg-rose-400/[0.05] p-2.5">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-rose-200/80">
          Point load
        </p>
        <div className="mt-2 space-y-1.5">
          {mode === '2d' ? (
            <>
              <NumberField
                label="Magnitude"
                value={magXY / 1e3}
                unit="kN"
                step={1}
                onCommit={(kN) => {
                  const m = Math.max(kN, 0) * 1e3;
                  editor.setLoad(node.id, {
                    fx: m * trig(Math.cos(angle)),
                    fy: m * trig(Math.sin(angle)),
                    fz: 0,
                  });
                }}
              />
              <NumberField
                label="Direction"
                value={Math.round((angle * 180) / Math.PI)}
                unit="deg"
                step={15}
                onCommit={(deg) => {
                  const a = (deg * Math.PI) / 180;
                  editor.setLoad(node.id, {
                    fx: magXY * trig(Math.cos(a)),
                    fy: magXY * trig(Math.sin(a)),
                    fz: 0,
                  });
                }}
              />
              <p className="text-[0.65rem] text-slate-500">
                {formatDeg(angle)} from +x · −90° is straight down
              </p>
            </>
          ) : (
            <>
              <NumberField label="Fx" value={node.load.fx / 1e3} unit="kN" step={1}
                onCommit={(v) => editor.setLoad(node.id, { ...node.load, fx: v * 1e3 })} />
              <NumberField label="Fy" value={node.load.fy / 1e3} unit="kN" step={1}
                onCommit={(v) => editor.setLoad(node.id, { ...node.load, fy: v * 1e3 })} />
              <NumberField label="Fz" value={node.load.fz / 1e3} unit="kN" step={1}
                onCommit={(v) => editor.setLoad(node.id, { ...node.load, fz: v * 1e3 })} />
            </>
          )}
        </div>
      </div>

      {(reaction || disp) && (
        <div className="space-y-1 rounded-lg border border-white/[0.06] bg-slate-950/60 p-2.5 font-mono text-[0.68rem] text-slate-300">
          {reaction && (
            <p>
              R = ({fmtForce(reaction.x)}, {fmtForce(reaction.y)}
              {mode === '3d' ? `, ${fmtForce(reaction.z)}` : ''})
            </p>
          )}
          {disp && (
            <p className="text-slate-400">
              u = ({formatAuto(disp.x * 1e3, 'mm', 3)}, {formatAuto(disp.y * 1e3, 'mm', 3)}
              {mode === '3d' ? `, ${formatAuto(disp.z * 1e3, 'mm', 3)}` : ''})
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function MemberPanel({
  member,
  editor,
  view,
}: {
  member: EditorMember;
  editor: TrussEditor;
  view: SolutionView | null;
}) {
  const force = view?.forceByMember.get(member.id);
  const stress = view?.stressByMember.get(member.id);
  const failure = view?.failureByMember.get(member.id);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-amber-300">
          Member {member.id}{' '}
          <span className="text-slate-500">
            ({member.i}–{member.j})
          </span>
        </h3>
        <button
          type="button"
          onClick={() => editor.deleteMember(member.id)}
          className="rounded-full border border-slate-700 px-2.5 py-1 text-[0.65rem] font-semibold text-slate-300 transition hover:border-rose-500 hover:text-rose-200"
        >
          Delete
        </button>
      </div>

      <label className="flex items-center justify-between gap-2 text-xs text-slate-300">
        <span>Section</span>
        <select
          value={member.sectionId}
          onChange={(e) => editor.patchMemberSection(member.id, { sectionId: e.target.value })}
          className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100 outline-none focus:border-sky-500"
        >
          {SECTION_PRESETS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
          <option value={CUSTOM_SECTION_ID}>Custom…</option>
        </select>
      </label>

      <div className="space-y-1.5">
        <NumberField label="E" value={member.E / 1e9} unit="GPa" step={5}
          onCommit={(v) => editor.patchMemberSection(member.id, { E: v * 1e9 })} />
        <NumberField label="A" value={member.A * 1e4} unit="cm²" step={2}
          onCommit={(v) => editor.patchMemberSection(member.id, { A: v / 1e4 })} />
        <NumberField label="I" value={member.I * 1e8} unit="cm⁴" step={2}
          onCommit={(v) => editor.patchMemberSection(member.id, { I: v / 1e8 })} />
        <NumberField label="σ_yield" value={member.sigmaYield / 1e6} unit="MPa" step={10}
          onCommit={(v) => editor.patchMemberSection(member.id, { sigmaYield: v * 1e6 })} />
        <p className="text-[0.65rem] text-slate-500">Editing a value switches to Custom.</p>
      </div>

      {force && (
        <div className="space-y-1 rounded-lg border border-white/[0.06] bg-slate-950/60 p-2.5 font-mono text-[0.68rem] text-slate-300">
          <p>
            N = {fmtForce(force.axial)}{' '}
            <span
              className={
                force.state === 'tension'
                  ? 'text-sky-300'
                  : force.state === 'compression'
                    ? 'text-orange-300'
                    : 'text-slate-500'
              }
            >
              {force.state === 'tension' ? '(T)' : force.state === 'compression' ? '(C)' : '(0)'}
            </span>
          </p>
          <p>L = {fmtLength(force.length)}</p>
          {stress !== undefined && <p>σ = {fmtStress(stress)}</p>}
          {failure && (
            <p className={failure.fails ? 'font-semibold text-rose-400' : 'text-slate-400'}>
              SF = {fmtSF(failure.safetyFactor)}
              {failure.fails ? ` — FAILS (${failure.mode})` : ''}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function TrussInspector({
  editor,
  view,
}: {
  editor: TrussEditor;
  view: SolutionView | null;
}) {
  const { selection, nodes, members, mode } = editor;
  const node =
    selection?.kind === 'node' ? nodes.find((n) => n.id === selection.id) : undefined;
  const member =
    selection?.kind === 'member' ? members.find((m) => m.id === selection.id) : undefined;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
      {node ? (
        <NodePanel node={node} mode={mode} editor={editor} view={view} />
      ) : member ? (
        <MemberPanel member={member} editor={editor} view={view} />
      ) : (
        <div className="space-y-2 text-xs text-slate-400">
          <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-300">
            Inspector
          </h3>
          <p>Select a node to set supports and loads, or a member to assign its section.</p>
          <ul className="list-inside list-disc space-y-1 text-[0.7rem] text-slate-500">
            <li>Select — click/drag nodes{mode === '2d' ? ', drag empty space to pan' : ''}</li>
            <li>Add node — click {mode === '3d' ? 'the ground plane' : 'the grid'} to place</li>
            <li>Member — click two nodes to connect them</li>
            <li>Delete — click a node or member to remove it</li>
            {mode === '3d' && <li>In 3D, set node elevation via the y field.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
