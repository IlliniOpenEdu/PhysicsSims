import type { CircuitComponent, Point, Rotation } from './types';
import { DEFAULT_LENGTH } from './types';

const DIRS: Record<Rotation, Point> = {
  0: { x: 1, y: 0 },
  90: { x: 0, y: 1 },
  180: { x: -1, y: 0 },
  270: { x: 0, y: -1 },
};

export function pinKey(x: number, y: number): string {
  return `${Math.round(x)},${Math.round(y)}`;
}

/** Terminal A is the component origin; terminal B is offset by length along rotation. */
export function componentTerminals(c: CircuitComponent): Point[] {
  if (c.kind === 'ground') return [{ x: c.x, y: c.y }];
  const len = c.length ?? DEFAULT_LENGTH;
  const dir = DIRS[c.rotation];
  return [
    { x: c.x, y: c.y },
    { x: c.x + dir.x * len, y: c.y + dir.y * len },
  ];
}

/** Midpoint of a component in grid units (for symbol placement). */
export function componentCenter(c: CircuitComponent): Point {
  const terminals = componentTerminals(c);
  if (terminals.length === 1) return terminals[0];
  return {
    x: (terminals[0].x + terminals[1].x) / 2,
    y: (terminals[0].y + terminals[1].y) / 2,
  };
}

export function rotate(rotation: Rotation, delta: number): Rotation {
  const next = (((rotation + delta) % 360) + 360) % 360;
  return next as Rotation;
}
