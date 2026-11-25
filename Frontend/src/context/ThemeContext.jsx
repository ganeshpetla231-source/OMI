import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Theme } from '../config/constants';

const ThemeContext = createContext(null);
const STORAGE_KEY = 'talkready_theme';

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem(STORAGE_KEY) || Theme.SYSTEM);

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    const applyTheme = () => {
      const isDark = theme === Theme.DARK || (theme === Theme.SYSTEM && Boolean(media?.matches));
      document.documentElement.classList.toggle('dark', isDark);
      document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
    };
    applyTheme();
    media?.addEventListener('change', applyTheme);
    return () => media?.removeEventListener('change', applyTheme);
  }, [theme]);

  const updateTheme = useCallback((nextTheme) => {
    setTheme(nextTheme);
    localStorage.setItem(STORAGE_KEY, nextTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    updateTheme(theme === Theme.DARK ? Theme.LIGHT : Theme.DARK);
  }, [theme, updateTheme]);

  const value = useMemo(() => ({ theme, setTheme: updateTheme, toggleTheme }), [theme, updateTheme, toggleTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
