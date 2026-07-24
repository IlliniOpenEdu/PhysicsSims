// ─────────────────────────────────────────────
//  DofMap — maps (node id, DOF kind) → global equation index
//  Built from element declarations: elements decide how many DOF they
//  contribute per node, so nothing here assumes "2 per node".
// ─────────────────────────────────────────────

import type { DofKind } from './types';

export interface GlobalDof {
  node: number;
  dof: DofKind;
}

export class DofMap {
  private byNode = new Map<number, Map<DofKind, number>>();
  private order: GlobalDof[] = [];

  /** Register a DOF (idempotent) and return its global index. */
  request(node: number, dof: DofKind): number {
    let kinds = this.byNode.get(node);
    if (!kinds) {
      kinds = new Map();
      this.byNode.set(node, kinds);
    }
    let i = kinds.get(dof);
    if (i === undefined) {
      i = this.order.length;
      kinds.set(dof, i);
      this.order.push({ node, dof });
    }
    return i;
  }

  /** Global index of a DOF, or undefined if no element contributes it. */
  index(node: number, dof: DofKind): number | undefined {
    return this.byNode.get(node)?.get(dof);
  }

  has(node: number): boolean {
    return this.byNode.has(node);
  }

  /** Total number of global DOF. */
  get size(): number {
    return this.order.length;
  }

  /** (node, dof) for a global index, in assembly order. */
  at(i: number): GlobalDof {
    return this.order[i];
  }
}
