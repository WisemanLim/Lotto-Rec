import { useThemeDark } from './useTheme';

/** 유효 다크모드 여부 — ThemeProvider(light/dark/system) 기준. Provider 없으면 OS 설정. */
export function usePrefersDark(): boolean {
  return useThemeDark();
}
