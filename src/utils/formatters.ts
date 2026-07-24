// ─────────────────────────────────────────────
//  formatters.ts
//  Number display helpers for PhysicsSims
// ─────────────────────────────────────────────

/**
 * Round to n significant figures
 * toSigFigs(9.81234, 3) → 9.81
 */
export function toSigFigs(value: number, sig = 3): number {
  if (value === 0) return 0;
  const d = Math.ceil(Math.log10(Math.abs(value)));
  const power = sig - d;
  const magnitude = Math.pow(10, power);
  return Math.round(value * magnitude) / magnitude;
}

/**
 * Format with a unit, auto sig figs
 * formatSI(244.8, 'W') → "244.8 W"
 * formatSI(0.00123, 'm') → "0.00123 m"
 */
export function formatSI(value: number, unit: string, sig = 4): string {
  return `${toSigFigs(value, sig)} ${unit}`;
}

/**
 * Scientific notation for very small or very large numbers
 * formatSci(1.380649e-23) → "1.38 × 10⁻²³"
 */
export function formatSci(value: number, sig = 3): string {
  if (value === 0) return '0';
  const exp = Math.floor(Math.log10(Math.abs(value)));
  const coeff = (value / Math.pow(10, exp)).toFixed(sig - 1);
  const supExp = String(exp)
    .split('')
    .map((c) => (c === '-' ? '⁻' : '⁰¹²³⁴⁵⁶⁷⁸⁹'[parseInt(c)]))
    .join('');
  return `${coeff} × 10${supExp}`;
}

/**
 * Auto-pick SI vs scientific based on magnitude
 * formatAuto(0.000001, 'F') → "1.00 × 10⁻⁶ F"
 * formatAuto(9.81, 'm/s²') → "9.81 m/s²"
 */
export function formatAuto(value: number, unit: string, sig = 3): string {
  const abs = Math.abs(value);
  if (abs === 0) return `0 ${unit}`;
  if (abs < 1e-3 || abs >= 1e6) return `${formatSci(value, sig)} ${unit}`;
  return formatSI(value, unit, sig);
}

/**
 * Degrees with decimal places
 * formatDeg(1.5708) → "90.0°"
 */
export function formatDeg(radians: number, decimals = 1): string {
  return `${((radians * 180) / Math.PI).toFixed(decimals)}°`;
}

/**
 * Pressure formatting — picks Pa/kPa/MPa/GPa automatically
 * formatPressure(101325) → "101 kPa"
 */
export function formatPressure(pascals: number, sig = 3): string {
  const abs = Math.abs(pascals);
  if (abs >= 1e9) return formatSI(pascals / 1e9, 'GPa', sig);
  if (abs >= 1e6) return formatSI(pascals / 1e6, 'MPa', sig);
  if (abs >= 1e3) return formatSI(pascals / 1e3, 'kPa', sig);
  return formatSI(pascals, 'Pa', sig);
}

/**
 * Time formatting — picks best unit automatically
 * formatTime(0.003) → "3.00 ms"
 * formatTime(65)    → "1m 05s"
 */
export function formatTime(seconds: number): string {
  if (seconds < 1e-6) return `${(seconds * 1e9).toFixed(2)} ns`;
  if (seconds < 1e-3) return `${(seconds * 1e6).toFixed(2)} μs`;
  if (seconds < 1)    return `${(seconds * 1e3).toFixed(2)} ms`;
  if (seconds < 60)   return `${seconds.toFixed(2)} s`;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}m ${s}s`;
}

/**
 * Compact large numbers with suffix
 * formatCompact(1388900) → "1.39M"
 */
export function formatCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${(value / 1e9).toPrecision(3)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toPrecision(3)}M`;
  if (abs >= 1e3) return `${(value / 1e3).toPrecision(3)}K`;
  return value.toPrecision(3);
}