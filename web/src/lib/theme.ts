import { useCallback, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

function current(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => (typeof document === 'undefined' ? 'light' : current()));

  const setTheme = useCallback((t: Theme) => {
    document.documentElement.classList.toggle('dark', t === 'dark');
    try {
      localStorage.setItem('fr-theme', t);
    } catch {
      /* almacenamiento no disponible: el tema solo dura la sesión */
    }
    setThemeState(t);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      let stored: string | null = null;
      try {
        stored = localStorage.getItem('fr-theme');
      } catch {
        stored = null;
      }
      if (!stored) {
        document.documentElement.classList.toggle('dark', mq.matches);
        setThemeState(mq.matches ? 'dark' : 'light');
      }
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return { theme, setTheme, toggle: () => setTheme(theme === 'dark' ? 'light' : 'dark') };
}
