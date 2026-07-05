// ─────────────────────────────────────────────
//  useTrussEditor — editor state + solve-on-change for the truss page.
//  Every structural edit flows through here; the solver runs in a memo so
//  the render always has a solution consistent with the current structure.
// ─────────────────────────────────────────────

import { useCallback, useMemo, useState } from 'react';
import {
  solveEditorState,
  structureSpan,
  type EditorMember,
  type EditorNode,
  type Selection,
  type SupportKind,
  type Tool,
  type ViewMode,
} from '../../components/truss/editorState';
import type { TrussPreset } from '../../components/truss/presets';
import { TRUSS_PRESETS } from '../../components/truss/presets';
import { CUSTOM_SECTION_ID, findSection } from '../../components/truss/sections';

const nextId = (items: { id: number }[]): number =>
  items.reduce((m, it) => Math.max(m, it.id), -1) + 1;

const sameMember = (m: EditorMember, i: number, j: number): boolean =>
  (m.i === i && m.j === j) || (m.i === j && m.j === i);

export function useTrussEditor() {
  const initial = useMemo(() => TRUSS_PRESETS[0].build(), []);
  const [mode, setMode] = useState<ViewMode>('2d');
  const [tool, setTool] = useState<Tool>('select');
  const [nodes, setNodes] = useState<EditorNode[]>(initial.nodes);
  const [members, setMembers] = useState<EditorMember[]>(initial.members);
  const [selection, setSelection] = useState<Selection>(null);
  const [pendingNode, setPendingNode] = useState<number | null>(null);
  /** Bumped when the viewport should re-fit the structure (preset load). */
  const [fitKey, setFitKey] = useState(0);

  const solve = useMemo(() => solveEditorState(mode, nodes, members), [mode, nodes, members]);
  const span = useMemo(() => structureSpan(nodes, mode), [nodes, mode]);

  const addNode = useCallback((x: number, y: number, z = 0) => {
    setNodes((prev) => {
      const id = nextId(prev);
      setSelection({ kind: 'node', id });
      return [...prev, { id, x, y, z, support: 'none', load: { fx: 0, fy: 0, fz: 0 } }];
    });
  }, []);

  const moveNode = useCallback((id: number, x: number, y: number, z?: number) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, x, y, z: z === undefined ? n.z : z } : n)),
    );
  }, []);

  const deleteNode = useCallback((id: number) => {
    setNodes((prev) => prev.filter((n) => n.id !== id));
    setMembers((prev) => prev.filter((m) => m.i !== id && m.j !== id));
    setSelection((cur) => (cur?.kind === 'node' && cur.id === id ? null : cur));
    setPendingNode((cur) => (cur === id ? null : cur));
  }, []);

  const patchNode = useCallback((id: number, patch: Partial<Omit<EditorNode, 'id'>>) => {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  }, []);

  const setSupport = useCallback(
    (id: number, support: SupportKind) => patchNode(id, { support }),
    [patchNode],
  );

  const setLoad = useCallback(
    (id: number, load: { fx: number; fy: number; fz: number }) => patchNode(id, { load }),
    [patchNode],
  );

  /** Connect two nodes; ignores self-links and duplicate members. */
  const addMember = useCallback((i: number, j: number) => {
    if (i === j) return;
    setMembers((prev) => {
      if (prev.some((m) => sameMember(m, i, j))) return prev;
      const id = nextId(prev);
      const like = prev[prev.length - 1];
      const section = like
        ? {
            sectionId: like.sectionId,
            E: like.E,
            A: like.A,
            I: like.I,
            sigmaYield: like.sigmaYield,
          }
        : (() => {
            const s = findSection('steel-10')!;
            return { sectionId: s.id, E: s.E, A: s.A, I: s.I, sigmaYield: s.sigmaYield };
          })();
      setSelection({ kind: 'member', id });
      return [...prev, { id, i, j, ...section }];
    });
  }, []);

  const deleteMember = useCallback((id: number) => {
    setMembers((prev) => prev.filter((m) => m.id !== id));
    setSelection((cur) => (cur?.kind === 'member' && cur.id === id ? null : cur));
  }, []);

  /** Assign a section preset, or patch individual values (→ custom). */
  const patchMemberSection = useCallback(
    (id: number, patch: Partial<Pick<EditorMember, 'sectionId' | 'E' | 'A' | 'I' | 'sigmaYield'>>) => {
      setMembers((prev) =>
        prev.map((m) => {
          if (m.id !== id) return m;
          if (patch.sectionId && patch.sectionId !== CUSTOM_SECTION_ID) {
            const s = findSection(patch.sectionId);
            if (s) {
              return { ...m, sectionId: s.id, E: s.E, A: s.A, I: s.I, sigmaYield: s.sigmaYield };
            }
          }
          const { sectionId: _ignored, ...values } = patch;
          return { ...m, ...values, sectionId: CUSTOM_SECTION_ID };
        }),
      );
    },
    [],
  );

  const loadPreset = useCallback((preset: TrussPreset) => {
    const built = preset.build();
    setMode(preset.mode);
    setNodes(built.nodes);
    setMembers(built.members);
    setSelection(null);
    setPendingNode(null);
    setTool('select');
    setFitKey((k) => k + 1);
  }, []);

  /** Replace the whole model with imported data (same reset path as presets). */
  const loadModel = useCallback(
    (model: { mode: ViewMode; nodes: EditorNode[]; members: EditorMember[] }) => {
      setMode(model.mode);
      setNodes(model.nodes);
      setMembers(model.members);
      setSelection(null);
      setPendingNode(null);
      setTool('select');
      setFitKey((k) => k + 1);
    },
    [],
  );

  const clearAll = useCallback(() => {
    setNodes([]);
    setMembers([]);
    setSelection(null);
    setPendingNode(null);
    setTool('add-node');
  }, []);

  const switchMode = useCallback((next: ViewMode) => {
    setMode(next);
    setPendingNode(null);
    setFitKey((k) => k + 1);
  }, []);

  /** Tool-aware node click, shared by the 2D and 3D viewports. */
  const handleNodeClick = useCallback(
    (id: number) => {
      if (tool === 'delete') {
        deleteNode(id);
        return;
      }
      if (tool === 'member') {
        if (pendingNode === null) {
          setPendingNode(id);
        } else {
          addMember(pendingNode, id);
          setPendingNode(null);
        }
        return;
      }
      setSelection({ kind: 'node', id });
    },
    [tool, pendingNode, deleteNode, addMember],
  );

  /** Tool-aware member click, shared by the 2D and 3D viewports. */
  const handleMemberClick = useCallback(
    (id: number) => {
      if (tool === 'delete') {
        deleteMember(id);
        return;
      }
      if (tool === 'member') return; // connecting nodes — ignore member hits
      setSelection({ kind: 'member', id });
    },
    [tool, deleteMember],
  );

  const handleMiss = useCallback(() => {
    setPendingNode(null);
    setSelection(null);
  }, []);

  return {
    mode,
    tool,
    nodes,
    members,
    selection,
    pendingNode,
    fitKey,
    solve,
    span,
    setTool,
    setSelection,
    switchMode,
    addNode,
    moveNode,
    deleteNode,
    patchNode,
    setSupport,
    setLoad,
    addMember,
    deleteMember,
    patchMemberSection,
    loadPreset,
    loadModel,
    clearAll,
    handleNodeClick,
    handleMemberClick,
    handleMiss,
  };
}

export type TrussEditor = ReturnType<typeof useTrussEditor>;
