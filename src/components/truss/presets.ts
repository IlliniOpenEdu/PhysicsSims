// ─────────────────────────────────────────────
//  Canonical truss presets for the editor.
//  Each build() returns fresh editor state (fully editable after load).
//  Geometry only — forces come from the solver. Loads are tuned so the
//  default section sits near (but under) capacity: the near-failure
//  coloring shows without the whole preset reading as broken.
// ─────────────────────────────────────────────

import type { EditorMember, EditorNode, ViewMode } from './editorState';
import { DEFAULT_SECTION } from './sections';

export interface TrussPreset {
  id: string;
  label: string;
  blurb: string;
  mode: ViewMode;
  build: () => { nodes: EditorNode[]; members: EditorMember[] };
}

const node = (
  id: number,
  x: number,
  y: number,
  z = 0,
  support: EditorNode['support'] = 'none',
  fy = 0,
  fx = 0,
  fz = 0,
): EditorNode => ({ id, x, y, z, support, load: { fx, fy, fz } });

const member = (id: number, i: number, j: number): EditorMember => ({
  id,
  i,
  j,
  sectionId: DEFAULT_SECTION.id,
  E: DEFAULT_SECTION.E,
  A: DEFAULT_SECTION.A,
  I: DEFAULT_SECTION.I,
  sigmaYield: DEFAULT_SECTION.sigmaYield,
});

const members = (pairs: [number, number][]): EditorMember[] =>
  pairs.map(([i, j], k) => member(k, i, j));

// Node id conventions below: bottom chord 0..4 (left→right), top chord 10+,
// mid-height 20+ — keeps preset geometry easy to audit.

const pratt = () => ({
  nodes: [
    node(0, 0, 0, 0, 'pin'),
    node(1, 2, 0, 0, 'none', -8e3),
    node(2, 4, 0, 0, 'none', -8e3),
    node(3, 6, 0, 0, 'none', -8e3),
    node(4, 8, 0, 0, 'roller'),
    node(11, 2, 2),
    node(12, 4, 2),
    node(13, 6, 2),
  ],
  members: members([
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4], // bottom chord
    [11, 12],
    [12, 13], // top chord
    [0, 11],
    [4, 13], // end diagonals
    [11, 1],
    [12, 2],
    [13, 3], // verticals
    [11, 2],
    [13, 2], // Pratt diagonals — slope down toward midspan
  ]),
});

const howe = () => ({
  nodes: [
    node(0, 0, 0, 0, 'pin'),
    node(1, 2, 0, 0, 'none', -8e3),
    node(2, 4, 0, 0, 'none', -8e3),
    node(3, 6, 0, 0, 'none', -8e3),
    node(4, 8, 0, 0, 'roller'),
    node(11, 2, 2),
    node(12, 4, 2),
    node(13, 6, 2),
  ],
  members: members([
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [11, 12],
    [12, 13],
    [0, 11],
    [4, 13],
    [11, 1],
    [12, 2],
    [13, 3],
    [1, 12],
    [3, 12], // Howe diagonals — slope up toward midspan
  ]),
});

const warren = () => ({
  nodes: [
    node(0, 0, 0, 0, 'pin'),
    node(1, 2, 0, 0, 'none', -15e3),
    node(2, 4, 0, 0, 'none', -15e3),
    node(3, 6, 0, 0, 'none', -15e3),
    node(4, 8, 0, 0, 'roller'),
    node(10, 1, 1.8),
    node(11, 3, 1.8),
    node(12, 5, 1.8),
    node(13, 7, 1.8),
  ],
  members: members([
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [10, 11],
    [11, 12],
    [12, 13],
    [0, 10],
    [10, 1],
    [1, 11],
    [11, 2],
    [2, 12],
    [12, 3],
    [3, 13],
    [13, 4],
  ]),
});

const kTruss = () => ({
  nodes: [
    node(0, 0, 0, 0, 'pin'),
    node(1, 2, 0, 0, 'none', -8e3),
    node(2, 4, 0, 0, 'none', -8e3),
    node(3, 6, 0, 0, 'none', -8e3),
    node(4, 8, 0, 0, 'roller'),
    node(10, 0, 2),
    node(11, 2, 2),
    node(12, 4, 2),
    node(13, 6, 2),
    node(14, 8, 2),
    node(21, 2, 1),
    node(22, 4, 1),
    node(23, 6, 1),
  ],
  members: members([
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4], // bottom chord
    [10, 11],
    [11, 12],
    [12, 13],
    [13, 14], // top chord
    [0, 10],
    [4, 14], // end posts
    [11, 21],
    [21, 1],
    [12, 22],
    [22, 2],
    [13, 23],
    [23, 3], // split verticals
    [21, 10],
    [21, 0], // K panel 1
    [22, 11],
    [22, 1], // K panel 2
    [22, 13],
    [22, 3], // K panel 3 (mirrored)
    [23, 14],
    [23, 4], // K panel 4
  ]),
});

const spaceFrame = () => ({
  nodes: [
    node(0, -1.5, 0, -1.5, 'pin'),
    node(1, 1.5, 0, -1.5, 'pin'),
    node(2, 1.5, 0, 1.5, 'pin'),
    node(3, -1.5, 0, 1.5, 'pin'),
    node(10, 0, 3, 0, 'none', -18e3, 6e3),
  ],
  members: members([
    [0, 10],
    [1, 10],
    [2, 10],
    [3, 10], // legs
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0], // base ring
  ]),
});

export const TRUSS_PRESETS: TrussPreset[] = [
  {
    id: 'warren',
    label: 'Warren',
    blurb: 'Alternating diagonals, no verticals — determinate.',
    mode: '2d',
    build: warren,
  },
  {
    id: 'pratt',
    label: 'Pratt',
    blurb: 'Diagonals in tension under gravity load.',
    mode: '2d',
    build: pratt,
  },
  {
    id: 'howe',
    label: 'Howe',
    blurb: 'Mirrored Pratt — diagonals go into compression.',
    mode: '2d',
    build: howe,
  },
  {
    id: 'k-truss',
    label: 'K-truss',
    blurb: 'Split verticals with K bracing — statically indeterminate.',
    mode: '2d',
    build: kTruss,
  },
  {
    id: 'space-frame',
    label: 'Space frame',
    blurb: '3D quadpod with a side load — reactions in all three axes.',
    mode: '3d',
    build: spaceFrame,
  },
];
