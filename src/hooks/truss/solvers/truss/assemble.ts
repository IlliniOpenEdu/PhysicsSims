// ─────────────────────────────────────────────
//  Global stiffness assembly
//  Generic over element type: consumes { dofs, k } contributions and
//  scatters them into K via the DofMap. Knows nothing about dimensions
//  or DOF-per-node counts.
// ─────────────────────────────────────────────

import type { DofMap } from './dofMap';
import type { ElementContribution } from './element';

/**
 * Registers every DOF the contributions declare, then assembles the dense
 * global stiffness matrix (size = dofMap.size after registration).
 */
export function assembleGlobalK(
  contributions: ElementContribution[],
  dofMap: DofMap,
): number[][] {
  for (const c of contributions) {
    for (const d of c.dofs) dofMap.request(d.node, d.dof);
  }

  const n = dofMap.size;
  const K: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));

  for (const c of contributions) {
    const g = c.dofs.map((d) => dofMap.index(d.node, d.dof)!);
    for (let a = 0; a < g.length; a++) {
      for (let b = 0; b < g.length; b++) {
        K[g[a]][g[b]] += c.k[a][b];
      }
    }
  }
  return K;
}
