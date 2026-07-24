/**
 * LIGHT THEME COLORS — edit this file to change how light mode looks.
 *
 * The dark theme always uses the default Tailwind palette (the site's original
 * look) and is not affected by anything here.
 *
 * How it works: in light mode every Tailwind color family is inverted
 * (slate-950 renders as slate-50, cyan-200 as cyan-700, and so on). The
 * entries below OVERRIDE that automatic inversion for specific tokens, keyed
 * by the DARK-MODE class name. Example: pages use `bg-slate-950` as the page
 * background, so the 'slate-950' entry here is the light-mode page background.
 *
 * Add any `family-shade` key (e.g. 'cyan-300': '#0e7490') to override more.
 * Consumed by tailwind.config.js — the dev server picks up changes on restart.
 */
export const LIGHT_THEME_OVERRIDES = {
  // ---- Surfaces (blue-tinted, light to dark = page to raised elements) ----
  'slate-950': '#f0f6fc', // page background, navbar, footer box
  'slate-900': '#e1ecf8', // buttons, pills
  'slate-800': '#cff1ec', // card borders, lines
  'slate-700': '#a9c2dd', // input borders, button borders
  'slate-600': '#7e9cc0', // footer text (version number) and copyright text ONLY

  // ---- Text (dark navy for contrast on the tinted surfaces) ----
  'slate-500': '#5a708e', // faintest text
  'slate-400': '#3c5471', // secondary text
  'slate-300': '#2b3f58', // body text
  'slate-200': '#1c2e45',
  'slate-100': '#12233a', // headings
  'slate-50': '#0a1a30',

  // ---- App chrome (navbar + footer surface) ----
  // Deeper than the page background so the chrome stands apart from content.
  // Dark mode's chrome color lives in tailwind.config.js (slate-900).
  chrome: '#a9c2dd',

  // ---- Neutrals ----
  // `text-white` headings become this; `border-white/10` becomes it at 10%.
  white: '#081527',
  black: '#ffffff',
};
