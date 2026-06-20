// ─────────────────────────────────────────────
//  magField3d/field.ts
//  Analytic (closed-form) magnetic-field math + field-line generation.
//
//  No three.js, no React — pure functions only. Field lines are returned as
//  polylines in *scene units*; physical readouts (Tesla, N/m) are computed
//  separately from the slider values using real SI constants.
// ─────────────────────────────────────────────

import { MU_0, TWO_PI, PI } from '../../../utils/constants';
import { vec3, type Vec3 } from '../../../utils/mathUtils';
import type { CurrentArrow, FieldDensity, FieldLine, MagFieldParams } from './types';

// ── Scene geometry constants (scene units, not metres) ──
export const WIRE_HALF_LENGTH = 4.2;
export const LOOP_RADIUS = 1.6;
export const CM_TO_SCENE = 0.06; // scene units per centimetre, for solenoid sizing

// ── Physical reference distances for the numeric readouts ──
export const WIRE_READOUT_RADIUS_M = 0.01; // report B at 1 cm from the wire
export const LOOP_RADIUS_M = 0.05; // physical loop radius used for B at centre

const DENSITY_RINGS: Record<FieldDensity, number> = { low: 3, medium: 5, high: 7 };
const DENSITY_AZIMUTHS: Record<FieldDensity, number> = { low: 4, medium: 6, high: 8 };

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

// ─────────────────────────────────────────────
//  Brightness normalization
// ─────────────────────────────────────────────

interface RawLine {
  points: Vec3[];
  raw: number[];
}

/** Normalize raw magnitudes across an entire mode so the brightest point maps to 1. */
function finalize(lines: RawLine[]): FieldLine[] {
  let max = 0;
  for (const line of lines) {
    for (const m of line.raw) {
      if (m > max) max = m;
    }
  }
  const inv = max > 0 ? 1 / max : 0;
  return lines.map((line) => ({
    points: line.points,
    strength: line.raw.map((m) => Math.min(1, m * inv)),
  }));
}

// ─────────────────────────────────────────────
//  1. Straight wire (along z)  —  B = μ₀I / (2πr), circulating
// ─────────────────────────────────────────────

/** Field direction (unit) at p for a wire on the z-axis carrying current in +z·dir. */
export function wireFieldDir(p: Vec3, dir: number): Vec3 {
  const rho = Math.hypot(p.x, p.y);
  if (rho < 1e-6) return v(0, 0, 0);
  // φ̂ = ẑ × r̂ = (-y, x, 0)/ρ
  return v((-p.y / rho) * dir, (p.x / rho) * dir, 0);
}

function straightWireLines(dir: number, density: FieldDensity): RawLine[] {
  const radii = [0.7, 1.3, 2.0, 2.8, 3.7];
  const planes = DENSITY_RINGS[density];
  const segments = 72;
  const lines: RawLine[] = [];

  for (let pi = 0; pi < planes; pi += 1) {
    const z = planes === 1 ? 0 : -WIRE_HALF_LENGTH * 0.78 + (pi / (planes - 1)) * WIRE_HALF_LENGTH * 1.56;
    for (const r of radii) {
      const points: Vec3[] = [];
      const raw: number[] = [];
      const mag = 1 / r; // ∝ |B|
      for (let i = 0; i <= segments; i += 1) {
        // dir flips traversal sense so flowing particles follow the field
        const a = (dir >= 0 ? 1 : -1) * (i / segments) * TWO_PI;
        points.push(v(r * Math.cos(a), r * Math.sin(a), z));
        raw.push(mag);
      }
      lines.push({ points, raw });
    }
  }
  return lines;
}

// ─────────────────────────────────────────────
//  2. Current loop (radius LOOP_RADIUS in xy-plane)  —  dipole field lines
//     Closed-form dipole streamline: r = L·sin²θ  (in a meridional plane)
// ─────────────────────────────────────────────

/** Dipole field direction (unit) at p for a moment along +z·dir. */
export function dipoleFieldDir(p: Vec3, dir: number): Vec3 {
  const r = vec3.mag(p);
  if (r < 1e-4) return v(0, 0, dir);
  const rhat = vec3.scale(p, 1 / r);
  const m = v(0, 0, dir);
  // B ∝ 3(m·r̂)r̂ − m
  const mdot = vec3.dot(m, rhat);
  const b = vec3.sub(vec3.scale(rhat, 3 * mdot), m);
  return vec3.norm(b);
}

function dipoleLines(dir: number, density: FieldDensity, shells: number[]): RawLine[] {
  const azimuths = DENSITY_AZIMUTHS[density];
  const steps = 90;
  const eps = 0.12;
  const lines: RawLine[] = [];

  for (let ai = 0; ai < azimuths; ai += 1) {
    const phi = (ai / azimuths) * PI; // half turn — each line is mirrored by ±ρ traversal
    const cphi = Math.cos(phi);
    const sphi = Math.sin(phi);
    for (const L of shells) {
      const points: Vec3[] = [];
      const raw: number[] = [];
      for (let i = 0; i <= steps; i += 1) {
        const theta = eps + (i / steps) * (PI - 2 * eps);
        const st = Math.sin(theta);
        const ct = Math.cos(theta);
        const r = L * st * st;
        const rho = r * st;
        const z = r * ct;
        // brightness ∝ |B_dipole| = √(1+3cos²θ)/r³
        const mag = Math.sqrt(1 + 3 * ct * ct) / Math.max(r * r * r, 1e-3);
        const x = rho * cphi;
        const y = rho * sphi;
        // dir<0 reverses flow direction along the line
        if (dir >= 0) {
          points.push(v(x, y, z));
          raw.push(mag);
        } else {
          points.unshift(v(x, y, z));
          raw.unshift(mag);
        }
      }
      lines.push({ points, raw });
    }
  }
  return lines;
}

function currentLoopLines(dir: number, density: FieldDensity): RawLine[] {
  const a = LOOP_RADIUS;
  // shells straddling the loop radius so some lines thread inside, others wrap outside
  const shells =
    density === 'low'
      ? [a * 0.5, a, a * 1.8]
      : density === 'medium'
        ? [a * 0.35, a * 0.7, a, a * 1.5, a * 2.3]
        : [a * 0.3, a * 0.55, a * 0.85, a, a * 1.4, a * 2.0, a * 2.8];
  return dipoleLines(dir, density, shells);
}

// ─────────────────────────────────────────────
//  3. Solenoid (axis = z)  —  geometric closed loops:
//     straight & bunched inside, bulging back outside like a bar magnet.
// ─────────────────────────────────────────────

function solenoidLines(params: MagFieldParams): RawLine[] {
  const dir = params.direction;
  const halfLen = Math.max(0.6, (params.coilLengthCm * CM_TO_SCENE) / 2);
  const R = Math.max(0.4, params.coilRadiusCm * CM_TO_SCENE);
  const density = params.density;
  const radialCount = density === 'low' ? 2 : density === 'medium' ? 3 : 4;
  const azimuths = DENSITY_AZIMUTHS[density];

  const lines: RawLine[] = [];
  const inSteps = 26;
  const outSteps = 40;

  for (let ai = 0; ai < azimuths; ai += 1) {
    const phi = (ai / azimuths) * TWO_PI;
    const cphi = Math.cos(phi);
    const sphi = Math.sin(phi);

    for (let ri = 0; ri < radialCount; ri += 1) {
      const rho = R * (0.25 + (ri / radialCount) * 0.6); // interior offset radius
      const rOut = R + 0.6 + rho * 1.4; // exterior bulge radius
      const points: Vec3[] = [];
      const raw: number[] = [];

      // interior: straight, uniform, brightest — runs from bottom to top (current sense via dir)
      for (let i = 0; i <= inSteps; i += 1) {
        const t = i / inSteps;
        const z = dir >= 0 ? -halfLen + t * 2 * halfLen : halfLen - t * 2 * halfLen;
        points.push(v(rho * cphi, rho * sphi, z));
        raw.push(1.0);
      }
      // exterior return: bulges out and curves back — fades with distance from axis
      for (let i = 1; i <= outSteps; i += 1) {
        const s = i / outSteps;
        const z = (dir >= 0 ? 1 : -1) * halfLen * Math.cos(PI * s);
        const radius = rho + (rOut - rho) * Math.sin(PI * s);
        points.push(v(radius * cphi, radius * sphi, z));
        const dist = Math.hypot(radius, z);
        raw.push(0.45 / Math.max(0.4, dist - R * 0.5));
      }
      lines.push({ points, raw });
    }
  }
  return lines;
}

/** Field direction (unit) at p inside/around the solenoid. */
export function solenoidFieldDir(p: Vec3, params: MagFieldParams): Vec3 {
  const halfLen = Math.max(0.6, (params.coilLengthCm * CM_TO_SCENE) / 2);
  const R = Math.max(0.4, params.coilRadiusCm * CM_TO_SCENE);
  const rho = Math.hypot(p.x, p.y);
  if (rho < R * 0.95 && Math.abs(p.z) < halfLen * 0.95) {
    return v(0, 0, params.direction); // near-uniform interior field along the axis
  }
  return dipoleFieldDir(p, params.direction); // exterior behaves like a bar magnet
}

// ─────────────────────────────────────────────
//  4. Two parallel wires (both along z, separated along x)
//     Field lines traced numerically in the z = 0 cross-section.
// ─────────────────────────────────────────────

interface LineWire {
  x: number;
  sign: number;
}

function twoWires(params: MagFieldParams): LineWire[] {
  const d = Math.max(0.8, params.separationCm * CM_TO_SCENE * 4);
  const s1 = params.direction;
  const s2 = params.oppositeCurrent ? -params.direction : params.direction;
  return [
    { x: -d / 2, sign: s1 },
    { x: d / 2, sign: s2 },
  ];
}

function twoWireFieldXY(x: number, y: number, wires: LineWire[]): { bx: number; by: number } {
  let bx = 0;
  let by = 0;
  for (const w of wires) {
    const dx = x - w.x;
    const dy = y - 0;
    const r2 = dx * dx + dy * dy;
    if (r2 < 1e-4) continue;
    // φ̂/r contribution: (-dy, dx)/r²
    bx += (w.sign * -dy) / r2;
    by += (w.sign * dx) / r2;
  }
  return { bx, by };
}

function twoWireLines(params: MagFieldParams): RawLine[] {
  const wires = twoWires(params);
  const density = params.density;
  const seedsPerWire = density === 'low' ? 3 : density === 'medium' ? 5 : 7;
  const bound = 6.5;
  const maxSteps = 1400;
  const ds = 0.05;
  const lines: RawLine[] = [];

  const trace = (sx: number, sy: number): RawLine | null => {
    const points: Vec3[] = [];
    const raw: number[] = [];
    let x = sx;
    let y = sy;
    for (let i = 0; i < maxSteps; i += 1) {
      const { bx, by } = twoWireFieldXY(x, y, wires);
      const mag = Math.hypot(bx, by);
      if (mag < 1e-4) break;
      points.push(v(x, y, 0));
      raw.push(mag);
      // RK2 midpoint step along the normalized field
      const ux = bx / mag;
      const uy = by / mag;
      const mxp = x + ux * ds * 0.5;
      const myp = y + uy * ds * 0.5;
      const mid = twoWireFieldXY(mxp, myp, wires);
      const mm = Math.hypot(mid.bx, mid.by) || 1;
      x += (mid.bx / mm) * ds;
      y += (mid.by / mm) * ds;
      if (Math.abs(x) > bound || Math.abs(y) > bound) break;
      if (i > 20 && Math.hypot(x - sx, y - sy) < ds) {
        points.push(v(x, y, 0)); // closed the loop
        raw.push(mag);
        break;
      }
    }
    return points.length > 8 ? { points, raw } : null;
  };

  for (const w of wires) {
    for (let i = 0; i < seedsPerWire; i += 1) {
      const r = 0.35 + i * 0.55;
      const line = trace(w.x + r, 0.0001);
      if (line) lines.push(line);
    }
  }
  return lines;
}

export function twoWireFieldDir(p: Vec3, params: MagFieldParams): Vec3 {
  const { bx, by } = twoWireFieldXY(p.x, p.y, twoWires(params));
  const mag = Math.hypot(bx, by);
  if (mag < 1e-6) return v(0, 0, 0);
  return v(bx / mag, by / mag, 0);
}

/** Scene-space x positions (and current sense) of the two wires, for rendering. */
export function twoWirePositions(params: MagFieldParams): LineWire[] {
  return twoWires(params);
}

// ─────────────────────────────────────────────
//  Public: field lines per mode
// ─────────────────────────────────────────────

export function generateFieldLines(params: MagFieldParams): FieldLine[] {
  switch (params.mode) {
    case 'wire':
      return finalize(straightWireLines(params.direction, params.density));
    case 'loop':
      return finalize(currentLoopLines(params.direction, params.density));
    case 'solenoid':
      return finalize(solenoidLines(params));
    case 'two-wire':
      return finalize(twoWireLines(params));
    default:
      return [];
  }
}

// ─────────────────────────────────────────────
//  Public: current-direction arrow markers per mode
// ─────────────────────────────────────────────

export function generateCurrentArrows(params: MagFieldParams): CurrentArrow[] {
  const dir = params.direction;
  const arrows: CurrentArrow[] = [];

  if (params.mode === 'wire') {
    const count = 6;
    for (let i = 0; i < count; i += 1) {
      const z = -WIRE_HALF_LENGTH + (i / (count - 1)) * 2 * WIRE_HALF_LENGTH;
      arrows.push({ position: v(0, 0, z), direction: v(0, 0, dir) });
    }
  } else if (params.mode === 'loop') {
    const count = 8;
    for (let i = 0; i < count; i += 1) {
      const a = (i / count) * TWO_PI;
      const p = v(LOOP_RADIUS * Math.cos(a), LOOP_RADIUS * Math.sin(a), 0);
      // tangent = dir · φ̂
      const tan = v(-Math.sin(a) * dir, Math.cos(a) * dir, 0);
      arrows.push({ position: p, direction: tan });
    }
  } else if (params.mode === 'solenoid') {
    const halfLen = Math.max(0.6, (params.coilLengthCm * CM_TO_SCENE) / 2);
    const R = Math.max(0.4, params.coilRadiusCm * CM_TO_SCENE);
    const count = 10;
    for (let i = 0; i < count; i += 1) {
      const t = i / (count - 1);
      const z = -halfLen + t * 2 * halfLen;
      const a = t * TWO_PI * Math.max(2, params.turns / 4) * dir;
      const tan = vec3.norm(v(-Math.sin(a), Math.cos(a), 0.001));
      arrows.push({ position: v(R * Math.cos(a), R * Math.sin(a), z), direction: tan });
    }
  } else if (params.mode === 'two-wire') {
    const wires = twoWires(params);
    const count = 5;
    for (const w of wires) {
      for (let i = 0; i < count; i += 1) {
        const z = -WIRE_HALF_LENGTH + (i / (count - 1)) * 2 * WIRE_HALF_LENGTH;
        arrows.push({ position: v(w.x, 0, z), direction: v(0, 0, w.sign) });
      }
    }
  }
  return arrows;
}

/** Unit field direction at an arbitrary point — used by the test compass. */
export function sampleFieldDirection(p: Vec3, params: MagFieldParams): Vec3 {
  switch (params.mode) {
    case 'wire':
      return wireFieldDir(p, params.direction);
    case 'loop':
      return dipoleFieldDir(p, params.direction);
    case 'solenoid':
      return solenoidFieldDir(p, params);
    case 'two-wire':
      return twoWireFieldDir(p, params);
    default:
      return v(0, 0, 0);
  }
}

// ─────────────────────────────────────────────
//  Physical readouts (real SI values from the slider settings)
// ─────────────────────────────────────────────

/** Straight-wire field magnitude at WIRE_READOUT_RADIUS_M. */
export function wireFieldMagnitude(current: number): number {
  return (MU_0 * current) / (TWO_PI * WIRE_READOUT_RADIUS_M);
}

/** Solenoid interior field B = μ₀ n I. */
export function solenoidField(current: number, turns: number, coilLengthCm: number): number {
  const lengthM = Math.max(1e-4, coilLengthCm / 100);
  const n = turns / lengthM;
  return MU_0 * n * current;
}

/** Loop field at its centre B = μ₀ I / (2a). */
export function loopCentreField(current: number): number {
  return (MU_0 * current) / (2 * LOOP_RADIUS_M);
}

/** Force per unit length between two parallel wires F/L = μ₀ I₁ I₂ / (2πd). */
export function forcePerLength(current: number, separationCm: number): number {
  const d = Math.max(1e-4, separationCm / 100);
  return (MU_0 * current * current) / (TWO_PI * d);
}
