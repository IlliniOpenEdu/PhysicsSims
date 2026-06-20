// ─────────────────────────────────────────────
//  mathUtils.ts
//  Shared math helpers for PhysicsSims
// ─────────────────────────────────────────────

// ── General ──────────────────────────────────

export const clamp = (val: number, min: number, max: number): number =>
  Math.min(Math.max(val, min), max);

export const lerp = (a: number, b: number, t: number): number =>
  a + (b - a) * t;

export const mapRange = (
  val: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
): number => outMin + ((val - inMin) / (inMax - inMin)) * (outMax - outMin);

export const approxEqual = (a: number, b: number, eps = 1e-9): boolean =>
  Math.abs(a - b) < eps;

// ── Numerical Integration ─────────────────────

type State = number[];
type Derivative = (t: number, y: State) => State

/**
 * 4th-order Runge-Kutta integrator
 * Use for any sim animating physics over time
 *
 * @param f  derivative function f(t, y) → dy/dt
 * @param y  current state vector
 * @param t  current time
 * @param dt timestep
 *
 * Example — simple harmonic oscillator:
 *   const f = (t, [x, v]) => [v, -(k/m) * x]
 *   [x, v] = rk4(f, [x, v], t, dt)
 */
export function rk4(f: Derivative, y: State, t: number, dt: number): State {
  const k1 = f(t, y);
  const k2 = f(t + dt / 2, y.map((yi, i) => yi + (dt / 2) * k1[i]));
  const k3 = f(t + dt / 2, y.map((yi, i) => yi + (dt / 2) * k2[i]));
  const k4 = f(t + dt, y.map((yi, i) => yi + dt * k3[i]));
  return y.map((yi, i) => yi + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
}

/**
 * Euler integrator — fast, less accurate
 * Fine for low-stakes animations, not for energy-conserving sims
 */
export function euler(f: Derivative, y: State, t: number, dt: number): State {
  const dy = f(t, y);
  return y.map((yi, i) => yi + dt * dy[i]);
}

// ── 2D Vector ─────────────────────────────────

export interface Vec2 { x: number; y: number }

export const vec2 = {
  add:    (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y }),
  sub:    (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y }),
  scale:  (a: Vec2, s: number): Vec2 => ({ x: a.x * s, y: a.y * s }),
  dot:    (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y,
  cross:  (a: Vec2, b: Vec2): number => a.x * b.y - a.y * b.x,
  mag:    (a: Vec2): number => Math.sqrt(a.x * a.x + a.y * a.y),
  norm:   (a: Vec2): Vec2 => {
    const m = vec2.mag(a);
    return m === 0 ? { x: 0, y: 0 } : { x: a.x / m, y: a.y / m };
  },
  perp:   (a: Vec2): Vec2 => ({ x: -a.y, y: a.x }),
  angle:  (a: Vec2): number => Math.atan2(a.y, a.x),
  fromAngle: (theta: number, mag = 1): Vec2 => ({
    x: Math.cos(theta) * mag,
    y: Math.sin(theta) * mag,
  }),
  dist: (a: Vec2, b: Vec2): number => vec2.mag(vec2.sub(a, b)),
  lerp: (a: Vec2, b: Vec2, t: number): Vec2 => ({
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
  }),
};

// ── 3D Vector ─────────────────────────────────

export interface Vec3 { x: number; y: number; z: number }

export const vec3 = {
  add:   (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }),
  sub:   (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }),
  scale: (a: Vec3, s: number): Vec3 => ({ x: a.x * s, y: a.y * s, z: a.z * s }),
  dot:   (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z,
  cross: (a: Vec3, b: Vec3): Vec3 => ({
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  }),
  mag:  (a: Vec3): number => Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z),
  norm: (a: Vec3): Vec3 => {
    const m = vec3.mag(a);
    return m === 0 ? { x: 0, y: 0, z: 0 } : { x: a.x / m, y: a.y / m, z: a.z / m };
  },
  dist: (a: Vec3, b: Vec3): number => vec3.mag(vec3.sub(a, b)),
};

// ── Statistics (useful for kinetic theory) ────

/** Arithmetic mean */
export const mean = (arr: number[]): number =>
  arr.reduce((s, v) => s + v, 0) / arr.length;

/** Sample standard deviation */
export const stdDev = (arr: number[]): number => {
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1));
};

/** Gaussian (Box-Muller) — for Maxwell-Boltzmann particle speeds */
export function randGaussian(mu = 0, sigma = 1): number {
  const u = 1 - Math.random();
  const v = Math.random();
  return mu + sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Random float in [min, max] */
export const randRange = (min: number, max: number): number =>
  min + Math.random() * (max - min);

/** Bin data into a histogram, returns [binCenter, count][] */
export function histogram(
  data: number[],
  bins: number,
  min: number,
  max: number
): [number, number][] {
  const width = (max - min) / bins;
  const counts = new Array(bins).fill(0);
  for (const v of data) {
    const i = clamp(Math.floor((v - min) / width), 0, bins - 1);
    counts[i]++;
  }
  return counts.map((c, i) => [min + (i + 0.5) * width, c]);
}