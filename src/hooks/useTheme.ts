import { useEffect, useState } from 'react';
import { getTheme, THEME_EVENT } from '../utils/theme';
import type { Theme } from '../utils/theme';

export function useTheme(): Theme {
  const [theme, setTheme] = useState<Theme>(getTheme);

  useEffect(() => {
    const onThemeChange = () => setTheme(getTheme());
    window.addEventListener(THEME_EVENT, onThemeChange);
    return () => window.removeEventListener(THEME_EVENT, onThemeChange);
  }, []);

  return theme;
}
