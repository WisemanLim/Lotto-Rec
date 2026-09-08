import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { THEME_KEY, THEME_QUERY, ThemeContext, readStored, systemDark, type ThemeMode } from './useTheme';

/** 테마 상태(light/dark/system) — html.dark 클래스 토글 + color-scheme + localStorage (PRD §E6 공통 UX). */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(readStored);
  const [sys, setSys] = useState(systemDark);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(THEME_QUERY);
    const on = (e: MediaQueryListEvent) => setSys(e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  const dark = mode === 'dark' || (mode === 'system' && sys);
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', dark);
    root.style.colorScheme = dark ? 'dark' : 'light';
    root.dataset.theme = dark ? 'dark' : 'light';
  }, [dark]);
  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    try {
      localStorage.setItem(THEME_KEY, m);
    } catch {
      /* 저장 불가 환경 */
    }
  }, []);
  const value = useMemo(() => ({ mode, dark, setMode }), [mode, dark, setMode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

