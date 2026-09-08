import { createContext, useContext, useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
export const THEME_KEY = 'lotto-rec-theme';
export const THEME_QUERY = '(prefers-color-scheme: dark)';

interface ThemeCtx {
  mode: ThemeMode;
  dark: boolean;
  setMode: (m: ThemeMode) => void;
}
export const ThemeContext = createContext<ThemeCtx | null>(null);

export function readStored(): ThemeMode {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
  } catch {
    return 'system';
  }
}

export function systemDark(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(THEME_QUERY).matches : false;
}

export function useTheme(): ThemeCtx {
  const v = useContext(ThemeContext);
  if (!v) throw new Error('ThemeProvider 밖에서 useTheme 호출');
  return v;
}

/** Provider 없이도 안전한 조회 (차트 등). */
export function useThemeDark(): boolean {
  const v = useContext(ThemeContext);
  const [sys, setSys] = useState(systemDark);
  useEffect(() => {
    if (v || typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(THEME_QUERY);
    const on = (e: MediaQueryListEvent) => setSys(e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [v]);
  return v ? v.dark : sys;
}
