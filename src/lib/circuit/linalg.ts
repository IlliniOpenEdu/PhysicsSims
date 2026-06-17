// Dense linear solvers used by the MNA engine.
// Real-valued (DC / transient) and complex-valued (AC phasor analysis).

/**
 * Solve A·x = b for a dense real matrix using Gaussian elimination with
 * partial pivoting. Returns null if the system is singular.
 * `A` is modified in place; pass copies if you need to reuse it.
 */
export function solveReal(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  if (n === 0) return [];

  for (let col = 0; col < n; col += 1) {
    // Partial pivot.
    let pivotRow = col;
    let pivotMag = Math.abs(A[col][col]);
    for (let r = col + 1; r < n; r += 1) {
      const mag = Math.abs(A[r][col]);
      if (mag > pivotMag) {
        pivotMag = mag;
        pivotRow = r;
      }
    }
    if (pivotMag < 1e-18) return null;

    if (pivotRow !== col) {
      const tmp = A[col];
      A[col] = A[pivotRow];
      A[pivotRow] = tmp;
      const tb = b[col];
      b[col] = b[pivotRow];
      b[pivotRow] = tb;
    }

    const pivot = A[col][col];
    for (let r = col + 1; r < n; r += 1) {
      const factor = A[r][col] / pivot;
      if (factor === 0) continue;
      for (let c = col; c < n; c += 1) {
        A[r][c] -= factor * A[col][c];
      }
      b[r] -= factor * b[col];
    }
  }

  const x = new Array<number>(n).fill(0);
  for (let row = n - 1; row >= 0; row -= 1) {
    let sum = b[row];
    for (let c = row + 1; c < n; c += 1) {
      sum -= A[row][c] * x[c];
    }
    x[row] = sum / A[row][row];
  }
  return x;
}

// ── Complex arithmetic ──────────────────────────────────────────────────────

export interface Complex {
  re: number;
  im: number;
}

export const cx = (re: number, im = 0): Complex => ({ re, im });
export const cAdd = (a: Complex, b: Complex): Complex => ({ re: a.re + b.re, im: a.im + b.im });
export const cSub = (a: Complex, b: Complex): Complex => ({ re: a.re - b.re, im: a.im - b.im });
export const cMul = (a: Complex, b: Complex): Complex => ({
  re: a.re * b.re - a.im * b.im,
  im: a.re * b.im + a.im * b.re,
});
export const cDiv = (a: Complex, b: Complex): Complex => {
  const denom = b.re * b.re + b.im * b.im;
  return { re: (a.re * b.re + a.im * b.im) / denom, im: (a.im * b.re - a.re * b.im) / denom };
};
export const cAbs = (a: Complex): number => Math.hypot(a.re, a.im);
export const cArg = (a: Complex): number => Math.atan2(a.im, a.re);
export const cConj = (a: Complex): Complex => ({ re: a.re, im: -a.im });
export const cPolar = (mag: number, phase: number): Complex => ({
  re: mag * Math.cos(phase),
  im: mag * Math.sin(phase),
});

/** Solve A·x = b for a dense complex matrix. Returns null if singular. */
export function solveComplex(A: Complex[][], b: Complex[]): Complex[] | null {
  const n = b.length;
  if (n === 0) return [];

  for (let col = 0; col < n; col += 1) {
    let pivotRow = col;
    let pivotMag = cAbs(A[col][col]);
    for (let r = col + 1; r < n; r += 1) {
      const mag = cAbs(A[r][col]);
      if (mag > pivotMag) {
        pivotMag = mag;
        pivotRow = r;
      }
    }
    if (pivotMag < 1e-18) return null;

    if (pivotRow !== col) {
      const tmp = A[col];
      A[col] = A[pivotRow];
      A[pivotRow] = tmp;
      const tb = b[col];
      b[col] = b[pivotRow];
      b[pivotRow] = tb;
    }

    const pivot = A[col][col];
    for (let r = col + 1; r < n; r += 1) {
      const factor = cDiv(A[r][col], pivot);
      if (factor.re === 0 && factor.im === 0) continue;
      for (let c = col; c < n; c += 1) {
        A[r][c] = cSub(A[r][c], cMul(factor, A[col][c]));
      }
      b[r] = cSub(b[r], cMul(factor, b[col]));
    }
  }

  const x = new Array<Complex>(n);
  for (let i = 0; i < n; i += 1) x[i] = cx(0, 0);
  for (let row = n - 1; row >= 0; row -= 1) {
    let sum = b[row];
    for (let c = row + 1; c < n; c += 1) {
      sum = cSub(sum, cMul(A[row][c], x[c]));
    }
    x[row] = cDiv(sum, A[row][row]);
  }
  return x;
}
