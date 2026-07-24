export type Theme = 'dark' | 'light';

export const THEME_EVENT = 'app:theme';
const THEME_KEY = 'physicssims-theme';
const LIGHT_CLASS = 'theme-light';

export const getTheme = (): Theme =>
  document.documentElement.classList.contains(LIGHT_CLASS) ? 'light' : 'dark';

export const readStoredTheme = (): Theme => {
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // localStorage may be unavailable
  }
  return 'dark';
};

export const applyStoredTheme = () => {
  document.documentElement.classList.toggle(LIGHT_CLASS, readStoredTheme() === 'light');
};

export const setTheme = (theme: Theme) => {
  document.documentElement.classList.toggle(LIGHT_CLASS, theme === 'light');
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    // best-effort persistence
  }
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: { theme } }));
};

export const toggleTheme = (): Theme => {
  const next: Theme = getTheme() === 'light' ? 'dark' : 'light';
  setTheme(next);
  return next;
};
