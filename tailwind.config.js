import colors from 'tailwindcss/colors';
import plugin from 'tailwindcss/plugin';
import { LIGHT_THEME_OVERRIDES } from './src/styles/themeColors.js';

// Theme-aware palette: every family below is remapped to CSS variables so the
// existing dark-first utility classes (bg-slate-950, text-white, …) render an
// inverted scale when <html> has the `theme-light` class.
const THEMED_FAMILIES = [
  'slate',
  'cyan',
  'sky',
  'blue',
  'indigo',
  'violet',
  'purple',
  'fuchsia',
  'pink',
  'rose',
  'red',
  'orange',
  'amber',
  'yellow',
  'green',
  'emerald',
  'teal',
];
const SHADES = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];

const hexToRgbChannels = (hex) => {
  const raw = hex.replace('#', '');
  const full = raw.length === 3 ? [...raw].map((c) => c + c).join('') : raw;
  const n = parseInt(full, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
};

const themedColors = {
  white: 'rgb(var(--c-white) / <alpha-value>)',
  black: 'rgb(var(--c-black) / <alpha-value>)',
};
const darkVars = { '--c-white': '255 255 255', '--c-black': '0 0 0' };
const lightVars = { '--c-white': '2 6 23', '--c-black': '255 255 255' };

for (const family of THEMED_FAMILIES) {
  themedColors[family] = {};
  SHADES.forEach((shade, index) => {
    const invertedShade = SHADES[SHADES.length - 1 - index];
    themedColors[family][shade] = `rgb(var(--c-${family}-${shade}) / <alpha-value>)`;
    darkVars[`--c-${family}-${shade}`] = hexToRgbChannels(colors[family][shade]);
    lightVars[`--c-${family}-${shade}`] = hexToRgbChannels(colors[family][invertedShade]);
  });
}

// App chrome (navbar + footer surface) — distinct from the page background so
// the layout chrome reads as its own layer in both themes.
themedColors.chrome = 'rgb(var(--c-chrome) / <alpha-value>)';
darkVars['--c-chrome'] = '15 23 42'; // slate-900
lightVars['--c-chrome'] = '199 216 235'; // fallback; themeColors.js may override

// Hand-tuned light-theme colors (src/styles/themeColors.js) win over inversion.
for (const [token, hex] of Object.entries(LIGHT_THEME_OVERRIDES)) {
  lightVars[`--c-${token}`] = hexToRgbChannels(hex);
}

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: themedColors,
    },
  },
  plugins: [
    plugin(({ addBase }) => {
      addBase({
        ':root': { ...darkVars, colorScheme: 'dark' },
        ':root.theme-light': { ...lightVars, colorScheme: 'light' },
        // Pins the dark palette for a subtree even when light mode is active
        // (e.g. the home page keeps its original look).
        '.theme-dark-scope': { ...darkVars, colorScheme: 'dark' },
      });
    }),
  ],
};
