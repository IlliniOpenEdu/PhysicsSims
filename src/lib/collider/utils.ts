export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function wrap01(value: number): number {
  const v = value % 1;
  return v < 0 ? v + 1 : v;
}

export function ringDistance(a: number, b: number): number {
  const d = Math.abs(a - b);
  return Math.min(d, 1 - d);
}

export function ringInSector(position: number, start: number, end: number): boolean {
  if (start <= end) return position >= start && position <= end;
  return position >= start || position <= end;
}

export function smooth(current: number, target: number, lambda: number, dt: number): number {
  const t = 1 - Math.exp(-lambda * dt);
  return lerp(current, target, t);
}

export function seededNoise(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}
