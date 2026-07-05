// ─────────────────────────────────────────────
//  Truss solver validation — computed vs expected against textbook cases.
//  Run from CMD:  npx tsx src/solvers/truss/validate.ts
//  Exits non-zero if any check fails.
// ─────────────────────────────────────────────

import {
  E_STEEL,
  SIGMA_YIELD_STEEL,
} from '../../utils/constants';
import { solidRoundI, solveTruss } from './index';
import type { Load, Support, TrussElement, TrussNode, TrussSolution } from './index';

// Runs under Node (tsx); the app tsconfig only loads DOM + vite types, so
// declare the one Node global this script touches.
declare const process: { exitCode?: number };

// ── Tiny check harness ───────────────────────

interface Row {
  caseName: string;
  quantity: string;
  expected: string;
  computed: string;
  pass: boolean;
}
const rows: Row[] = [];

const REL_TOL = 1e-6;

function checkNum(caseName: string, quantity: string, expected: number, computed: number): void {
  // Relative tolerance with an absolute floor so expected-zero checks work
  const scale = Math.max(Math.abs(expected), 1);
  const pass = Math.abs(expected - computed) <= REL_TOL * scale;
  rows.push({
    caseName,
    quantity,
    expected: expected.toPrecision(8),
    computed: computed.toPrecision(8),
    pass,
  });
}

function checkTrue(caseName: string, quantity: string, computed: boolean): void {
  rows.push({ caseName, quantity, expected: 'true', computed: String(computed), pass: computed });
}

// ── Shared section properties ────────────────

const A = 1e-3; // m² — 10 cm² solid round bar
const steelBar = (id: number, i: number, j: number, area = A): TrussElement => ({
  id,
  nodes: [i, j],
  E: E_STEEL,
  A: area,
  I: solidRoundI(area),
  sigmaYield: SIGMA_YIELD_STEEL,
});

const axial = (sol: TrussSolution, el: number): number =>
  sol.memberForces.find((f) => f.element === el)!.axial;
const reaction = (sol: TrussSolution, node: number, dof: string): number =>
  sol.reactions.find((r) => r.node === node && r.dof === dof)!.value;

// ── Case 1: determinate 2D triangle ──────────
// Nodes A(0,0) pin, B(4,0) roller, apex C(2,3); P = 10 kN down at C.
// Method of joints (hand): diagonals N = −P√13/6, bottom chord N = +P/3,
// reactions 5 kN up at each support.
{
  const name = '1. 2D triangle (determinate)';
  const P = 10_000;
  const nodes: TrussNode[] = [
    { id: 0, pos: { x: 0, y: 0 } },
    { id: 1, pos: { x: 4, y: 0 } },
    { id: 2, pos: { x: 2, y: 3 } },
  ];
  const elements = [steelBar(0, 0, 1), steelBar(1, 0, 2), steelBar(2, 1, 2)];
  const supports: Support[] = [
    { node: 0, dofs: ['tx', 'ty'] },
    { node: 1, dofs: ['ty'] },
  ];
  const loads: Load[] = [{ node: 2, dof: 'ty', value: -P }];
  const sol = solveTruss(nodes, elements, supports, loads);

  const diag = (-P * Math.sqrt(13)) / 6;
  checkNum(name, 'N bottom chord (T) [N]', P / 3, axial(sol, 0));
  checkNum(name, 'N left diagonal (C) [N]', diag, axial(sol, 1));
  checkNum(name, 'N right diagonal (C) [N]', diag, axial(sol, 2));
  checkNum(name, 'R_Ax [N]', 0, reaction(sol, 0, 'tx'));
  checkNum(name, 'R_Ay [N]', P / 2, reaction(sol, 0, 'ty'));
  checkNum(name, 'R_By [N]', P / 2, reaction(sol, 1, 'ty'));
  checkNum(name, 'σ bottom chord [Pa]', P / 3 / A, sol.stresses[0].stress);

  // Failure-check plumbing: Euler SF on a compression diagonal (L² = 13)
  const pCr = (Math.PI ** 2 * E_STEEL * solidRoundI(A)) / 13;
  const fail = sol.failures.find((f) => f.element === 1)!;
  checkNum(name, 'buckling SF diagonal', pCr / Math.abs(diag), fail.bucklingSF);
  checkTrue(name, 'healthy members: no fails', sol.failures.every((f) => !f.fails));
}

// ── Case 1b: failure flags on undersized members ──
// Same triangle, A = 10 mm²: diagonal σ ≈ 601 MPa (also far past Euler load
// → buckling governs); bottom chord σ ≈ 333 MPa tension → yield governs.
{
  const name = '1b. Undersized members flagged';
  const tiny = 1e-5;
  const nodes: TrussNode[] = [
    { id: 0, pos: { x: 0, y: 0 } },
    { id: 1, pos: { x: 4, y: 0 } },
    { id: 2, pos: { x: 2, y: 3 } },
  ];
  const elements = [steelBar(0, 0, 1, tiny), steelBar(1, 0, 2, tiny), steelBar(2, 1, 2, tiny)];
  const sol = solveTruss(
    nodes,
    elements,
    [
      { node: 0, dofs: ['tx', 'ty'] },
      { node: 1, dofs: ['ty'] },
    ],
    [{ node: 2, dof: 'ty', value: -10_000 }],
  );
  const chord = sol.failures.find((f) => f.element === 0)!;
  const diag = sol.failures.find((f) => f.element === 1)!;
  checkTrue(name, 'tension chord fails by yield', chord.fails && chord.mode === 'yield');
  checkTrue(name, 'compression diag fails by buckling', diag.fails && diag.mode === 'buckling');
}

// ── Case 2: statically indeterminate 3-bar ───
// Timoshenko's classic: three bars from pinned supports meet at one loaded
// node; middle bar vertical, outer bars at α = 45°. One redundant bar —
// joint equilibrium gives 2 equations for 3 unknowns, so the method of
// joints cannot solve it. Published (Strength of Materials, Part I):
//   N_mid  = P / (1 + 2cos³α),  N_outer = P·cos²α / (1 + 2cos³α)
{
  const name = '2. 3-bar indeterminate (Timoshenko)';
  const P = 10_000;
  const nodes: TrussNode[] = [
    { id: 0, pos: { x: 0, y: 0 } }, // loaded joint
    { id: 1, pos: { x: -2, y: 2 } },
    { id: 2, pos: { x: 0, y: 2 } },
    { id: 3, pos: { x: 2, y: 2 } },
  ];
  const elements = [steelBar(0, 0, 1), steelBar(1, 0, 2), steelBar(2, 0, 3)];
  const supports: Support[] = [
    { node: 1, dofs: ['tx', 'ty'] },
    { node: 2, dofs: ['tx', 'ty'] },
    { node: 3, dofs: ['tx', 'ty'] },
  ];
  const sol = solveTruss(nodes, elements, supports, [{ node: 0, dof: 'ty', value: -P }]);

  const cos = Math.SQRT1_2; // α = 45°
  const denom = 1 + 2 * cos ** 3;
  checkNum(name, 'N middle bar (T) [N]', P / denom, axial(sol, 1));
  checkNum(name, 'N left bar (T) [N]', (P * cos ** 2) / denom, axial(sol, 0));
  checkNum(name, 'N right bar (T) [N]', (P * cos ** 2) / denom, axial(sol, 2));
  checkNum(name, 'ΣR_y = P [N]', P, [1, 2, 3].reduce((s, n) => s + reaction(sol, n, 'ty'), 0));
}

// ── Case 3: 3D space truss (tripod) ──────────
// Apex at height h = 2 m, feet fully fixed on a circle of radius r = 1 m
// (120° apart), vertical load P = 9 kN down at the apex. Statics:
//   each leg N = −P·L/(3h)  (L = √(r²+h²)),
//   each foot R_vert = P/3, horizontal reaction P·r/(3h) toward the axis.
// Same solve path as 2D — nodes are Vec3, so elements declare 3 DOF/node.
{
  const name = '3. 3D tripod space truss';
  const P = 9_000;
  const r = 1;
  const h = 2;
  const L = Math.hypot(r, h);
  const nodes: TrussNode[] = [
    { id: 0, pos: { x: 0, y: h, z: 0 } }, // apex (y up)
    { id: 1, pos: { x: r, y: 0, z: 0 } },
    { id: 2, pos: { x: -r / 2, y: 0, z: (r * Math.sqrt(3)) / 2 } },
    { id: 3, pos: { x: -r / 2, y: 0, z: (-r * Math.sqrt(3)) / 2 } },
  ];
  const elements = [steelBar(0, 0, 1), steelBar(1, 0, 2), steelBar(2, 0, 3)];
  const supports: Support[] = [1, 2, 3].map((n) => ({ node: n, dofs: ['tx', 'ty', 'tz'] }));
  const sol = solveTruss(nodes, elements, supports, [{ node: 0, dof: 'ty', value: -P }]);

  const legN = (-P * L) / (3 * h);
  const horiz = (P * r) / (3 * h);
  checkNum(name, 'N each leg (C) [N] — leg 1', legN, axial(sol, 0));
  checkNum(name, 'N each leg (C) [N] — leg 2', legN, axial(sol, 1));
  checkNum(name, 'N each leg (C) [N] — leg 3', legN, axial(sol, 2));
  checkNum(name, 'R_y foot 1 [N]', P / 3, reaction(sol, 1, 'ty'));
  checkNum(name, 'R_x foot 1 (inward) [N]', -horiz, reaction(sol, 1, 'tx'));
  checkNum(name, 'R_z foot 1 [N]', 0, reaction(sol, 1, 'tz'));
  checkNum(name, 'R_x foot 2 [N]', horiz / 2, reaction(sol, 2, 'tx'));
  checkNum(name, 'R_z foot 2 [N]', (-horiz * Math.sqrt(3)) / 2, reaction(sol, 2, 'tz'));
  checkNum(name, 'ΣR_y = P [N]', P, [1, 2, 3].reduce((s, n) => s + reaction(sol, n, 'ty'), 0));
}

// ── Case 4: symmetry check ───────────────────
// Symmetric Warren-style truss, center load → mirror members must carry
// identical forces and the two supports split the load evenly.
//
//        3───────4          mirror pairs (about x = 2):
//       / \     / \           (0-1 ↔ 1-2), (0-3 ↔ 2-4), (1-3 ↔ 1-4)
//      0───1───2
//          │ 20 kN
{
  const name = '4. Symmetric truss, center load';
  const P = 20_000;
  const nodes: TrussNode[] = [
    { id: 0, pos: { x: 0, y: 0 } },
    { id: 1, pos: { x: 2, y: 0 } },
    { id: 2, pos: { x: 4, y: 0 } },
    { id: 3, pos: { x: 1, y: 1.5 } },
    { id: 4, pos: { x: 3, y: 1.5 } },
  ];
  const elements = [
    steelBar(0, 0, 1),
    steelBar(1, 1, 2),
    steelBar(2, 3, 4),
    steelBar(3, 0, 3),
    steelBar(4, 1, 3),
    steelBar(5, 1, 4),
    steelBar(6, 2, 4),
  ];
  const supports: Support[] = [
    { node: 0, dofs: ['tx', 'ty'] },
    { node: 2, dofs: ['ty'] },
  ];
  const sol = solveTruss(nodes, elements, supports, [{ node: 1, dof: 'ty', value: -P }]);

  checkNum(name, 'N(0-1) = N(1-2) [N]', axial(sol, 0), axial(sol, 1));
  checkNum(name, 'N(0-3) = N(2-4) [N]', axial(sol, 3), axial(sol, 6));
  checkNum(name, 'N(1-3) = N(1-4) [N]', axial(sol, 4), axial(sol, 5));
  checkNum(name, 'R_left = P/2 [N]', P / 2, reaction(sol, 0, 'ty'));
  checkNum(name, 'R_right = P/2 [N]', P / 2, reaction(sol, 2, 'ty'));
  checkNum(name, 'R_left,x = 0 [N]', 0, reaction(sol, 0, 'tx'));
}

// ── Report ───────────────────────────────────

const widths = [38, 34, 15, 15, 6];
const line = (cols: string[]): string => cols.map((c, i) => c.padEnd(widths[i])).join('  ');

console.log('');
console.log(line(['Case', 'Quantity', 'Expected', 'Computed', 'Status']));
console.log(line(widths.map((w) => '─'.repeat(w))));
let lastCase = '';
for (const r of rows) {
  console.log(
    line([
      r.caseName === lastCase ? '' : r.caseName,
      r.quantity,
      r.expected,
      r.computed,
      r.pass ? 'PASS' : 'FAIL',
    ]),
  );
  lastCase = r.caseName;
}
const failed = rows.filter((r) => !r.pass).length;
console.log('');
console.log(
  failed === 0
    ? `All ${rows.length} checks passed.`
    : `${failed} of ${rows.length} checks FAILED.`,
);
process.exitCode = failed === 0 ? 0 : 1;
