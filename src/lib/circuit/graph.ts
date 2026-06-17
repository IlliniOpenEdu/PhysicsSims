import type { Schematic } from './types';
import { componentTerminals, pinKey } from './geometry';

class UnionFind {
  private parent = new Map<string, string>();

  find(key: string): string {
    let root = this.parent.get(key);
    if (root === undefined) {
      this.parent.set(key, key);
      return key;
    }
    if (root === key) return key;
    root = this.find(root);
    this.parent.set(key, root);
    return root;
  }

  add(key: string): void {
    if (!this.parent.has(key)) this.parent.set(key, key);
  }

  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

export interface Topology {
  /** Map "x,y" pin key → node index. */
  nodeOfKey: Map<string, number>;
  nodeCount: number;
  groundNode: number;
  /** True if the user placed an explicit ground component. */
  hasExplicitGround: boolean;
}

/**
 * Derive electrical nodes from schematic geometry.
 *
 * Pins sharing a grid coordinate are the same node. Ideal wires and closed
 * switches merge their endpoints. When wire resistance is enabled, wires are
 * NOT merged (they become resistor elements during stamping).
 */
export function buildTopology(schematic: Schematic): Topology {
  const uf = new UnionFind();
  const groundKeys: string[] = [];

  for (const c of schematic.components) {
    const terminals = componentTerminals(c);
    for (const t of terminals) uf.add(pinKey(t.x, t.y));
    if (c.kind === 'ground') groundKeys.push(pinKey(c.x, c.y));
    if (c.kind === 'switch' && c.closed && terminals.length === 2) {
      uf.union(pinKey(terminals[0].x, terminals[0].y), pinKey(terminals[1].x, terminals[1].y));
    }
  }

  for (const w of schematic.wires) {
    const ka = pinKey(w.a.x, w.a.y);
    const kb = pinKey(w.b.x, w.b.y);
    uf.add(ka);
    uf.add(kb);
    if (!schematic.settings.wireResistance) uf.union(ka, kb);
  }

  // Collect all keys and assign node indices to roots.
  const allKeys = new Set<string>();
  for (const c of schematic.components) {
    for (const t of componentTerminals(c)) allKeys.add(pinKey(t.x, t.y));
  }
  for (const w of schematic.wires) {
    allKeys.add(pinKey(w.a.x, w.a.y));
    allKeys.add(pinKey(w.b.x, w.b.y));
  }

  const rootToNode = new Map<string, number>();
  const nodeOfKey = new Map<string, number>();
  let nextNode = 0;
  for (const key of allKeys) {
    const root = uf.find(key);
    let node = rootToNode.get(root);
    if (node === undefined) {
      node = nextNode;
      nextNode += 1;
      rootToNode.set(root, node);
    }
    nodeOfKey.set(key, node);
  }

  // Determine the ground/reference node.
  let groundNode = 0;
  let hasExplicitGround = false;
  if (groundKeys.length > 0) {
    hasExplicitGround = true;
    groundNode = uf.find(groundKeys[0]) === undefined ? 0 : (rootToNode.get(uf.find(groundKeys[0])) ?? 0);
  }

  return {
    nodeOfKey,
    nodeCount: nextNode,
    groundNode,
    hasExplicitGround,
  };
}
