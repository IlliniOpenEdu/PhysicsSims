// Engineering-notation formatting + parsing for circuit quantities.

const SI_PREFIXES: { exp: number; symbol: string }[] = [
  { exp: 12, symbol: 'T' },
  { exp: 9, symbol: 'G' },
  { exp: 6, symbol: 'M' },
  { exp: 3, symbol: 'k' },
  { exp: 0, symbol: '' },
  { exp: -3, symbol: 'm' },
  { exp: -6, symbol: 'µ' },
  { exp: -9, symbol: 'n' },
  { exp: -12, symbol: 'p' },
];

const PREFIX_FACTOR: Record<string, number> = {
  t: 1e12,
  g: 1e9,
  meg: 1e6,
  k: 1e3,
  '': 1,
  m: 1e-3,
  u: 1e-6,
  µ: 1e-6,
  n: 1e-9,
  p: 1e-12,
  f: 1e-15,
};

/** Format a value with an SI prefix, e.g. 4700 → "4.7 k". */
export function formatEng(value: number, digits = 3): string {
  if (!Number.isFinite(value)) return '—';
  if (value === 0) return '0';
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  const exp = Math.floor(Math.log10(abs));
  let chosen = SI_PREFIXES[SI_PREFIXES.length - 1];
  for (const p of SI_PREFIXES) {
    if (exp >= p.exp) {
      chosen = p;
      break;
    }
  }
  const scaled = abs / 10 ** chosen.exp;
  const rounded = Number(scaled.toPrecision(digits));
  return `${sign}${rounded}${chosen.symbol ? ' ' + chosen.symbol : ''}`;
}

/** Unit formatter: "4.7 kΩ". */
export function withUnit(value: number, unit: string, digits = 3): string {
  const base = formatEng(value, digits);
  if (base === '—') return '—';
  return base.includes(' ') ? `${base}${unit}` : `${base} ${unit}`;
}

/** Parse a human value like "4.7k", "10m", "1MEG", "100" into a number. */
export function parseEng(raw: string): number | null {
  const text = raw.trim().replace(/\s+/g, '');
  if (text === '') return null;
  const match = /^(-?\d*\.?\d+(?:[eE][-+]?\d+)?)([a-zµ]*)$/.exec(text);
  if (!match) return null;
  const mantissa = Number(match[1]);
  if (!Number.isFinite(mantissa)) return null;
  const suffix = match[2].toLowerCase();
  if (suffix === '') return mantissa;
  const factor = PREFIX_FACTOR[suffix];
  if (factor == null) return null;
  return mantissa * factor;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
